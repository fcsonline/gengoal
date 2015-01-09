/*jshint laxcomma:true */

var fs   = require('fs')
  , path = require('path')
  , util = require('util')
  , _    = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
  , exec = require('child_process').exec

  , Builder = require('./builder')
  , Language    = require('./language');

function Repository(config, callback_url) {
  this.config = config;
  this.name = config.name;
  this.path = './repositories/' + this.config.name;
  this.languages = [];
  this.status = 'init';
  this.callback_url = callback_url + this.config.name + '/gengo';
  this.info = {};
  this.completed = {};
}

util.inherits(Repository, EventEmitter);

/**
 * Loads all the available languages in the given directory
 */
Repository.prototype.load = function () {
  var self = this
    , directory = path.join(this.path, this.config.directory);

  this.languages = [];

  return new Promise(function (resolve, reject) {
    fs.readdir(directory, function (err, files) {
      if (err) {
        throw err;
      }

      files.forEach(function (file) {
        var filepath
          , name
          , master
          , language;

        filepath = path.join(directory, file);

        // TODO: IMPROVE
        if (path.extname(file) !== '.yml') {
          return;
        }

        name = path.basename(file, '.yml');
        master = name === self.config.master;
        language = new Language(filepath, name, master);

        self.languages.push(language);
      });

      self.status = 'load';
      resolve();
    });
  });

};

/**
 * Checks the differences between languages and master and builds
 * an array of jobs
 *
 * @return {Array}
 */
Repository.prototype.jobs = function () {
  var self = this
    , jobs = []
    , master;

  master = this.findMaster();
  defaults = _.pick(this.config, 'comment');

  this.languages.forEach(function (language) {
    var data
      , builder;

    if (language === master) {
      return;
    }

    console.log('Checking differences between "' + language.name + '" and "' + master.name + '"...');

    builder = new Builder(self.callback_url, language.name, defaults);
    data = builder.build(language.diff(master));

    jobs.push(data);
  });

  jobs = _.flatten(jobs);
  jobs = this.filter(jobs);

  self.info.counter = jobs.length;

  this.emit('jobs', jobs);

  return jobs;
};

/**
 * Checks the differences between languages and master and builds
 * an array of jobs
 *
 * @return {Array}
 */
Repository.prototype.normalize = function () {
  var self = this
    , saves;

  saves = this.languages.map(function (language) {
    return language.save();
  });

  return Promise.all(saves)
    .then(function (){
      return self.commit('Gengo Normalization');
    })
    .then(function (){
      console.log("Files normalized");
    });
};

/**
 * Filters the list of jobs
 *
 * @param {Array} jobs
 * @return {Array}
 */
Repository.prototype.filter = function (jobs) {
  var result = jobs
    , regexp;

  if (this.config.only) {
    regexp = new RegExp(this.config.only);

    result = _.filter(result, function (job) {
      return job.custom_data.match(regexp);
    });
  }

  // FIXME: Remove that
  this.config.throughput = this.config.throughput || 3;

  if (this.config.throughput) {
    result = _.sample(result, this.config.throughput);
  }

  return result;
};

/**
 * Finds a language by name
 *
 * @return {Language}
 */
Repository.prototype.find = function (name) {
  return _.findWhere(this.languages, {name: name});
};

/**
 * Finds the master language
 *
 * @return {Language}
 */
Repository.prototype.findMaster = function () {
  return _.findWhere(this.languages, {master: true});
};

/**
 * Pulls the last code version for the current repository
 *
 * @return {Promise}
 */
Repository.prototype.pull = function () {
  var self = this;

  if (fs.existsSync(this.path)) {
    return this.rebase();
  } else {
    return this.clone();
  }
};

/**
 * Clones the current repository
 *
 * @return {Promise}
 */
Repository.prototype.clone = function () {
  var self = this
    , basic_auth;

  basic_auth = this.config.envvars.GENGOAL_GITHUB_USERNAME + ':' +
               this.config.envvars.GENGOAL_GITHUB_BASIC_PASSWORD;

  return new Promise(function (resolve, reject) {

    var commands = [
      'git clone http://' + basic_auth + '@' + self.config.url + ' ' + self.path
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      resolve();
      console.log('Cloned!');

      self.info.last_sync = new Date();
      self.emit('pulled');
    });
  });
};

/**
 * Branches the current code
 *
 * @param {String} name
 * @return {Promise}
 */
Repository.prototype.branch = function (name) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var commands = [
      'cd ' + self.path
    , 'git checkout develop'
    , 'git branch ' + name
    , 'git checkout ' + name
    , 'git commit --allow-empty -m "Gengo Translations"'
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      resolve();
      console.log('Branched!');

      self.emit('branched');
    });
  });
};

/**
 * Checkouts a branches in the current code
 *
 * @param {String} name
 * @return {Promise}
 */
Repository.prototype.checkout = function (name) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var commands = [
      'cd ' + self.path
    , 'git fetch'
    , 'git checkout ' + name
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      resolve();
      console.log('Checkout!');

      self.emit('Checkout');
    });
  });
};

/**
 * Rebases the fetched code to the last version
 *
 * @return {Promise}
 */
Repository.prototype.rebase = function () {
  var self = this;

  return new Promise(function (resolve, reject) {
    var commands = [
      'cd ' + self.path
    , 'git checkout develop'
    , 'git pull --rebase origin develop'
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      resolve();
      console.log('Rebased!');

      self.info.last_sync = new Date();
      self.emit('pulled');
    });
  });
};

/**
 * Commits the current changes
 *
 * @param {String} title
 * @return {Promise}
 */
Repository.prototype.commit = function (title) {
  var self = this
    , param_title = '';

  if (title) {
    param_title = '-m "' + title + '"';
  } else {
    param_title = '--amend --no-edit';
  }

  return new Promise(function (resolve, reject) {
    var commands = [
      'cd ' + self.path
    , 'git add ' + self.config.directory
    , 'git commit ' + param_title
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      console.log('Commited!');
      self.info.last_commit = '0d032fg'; // FIXME
      self.emit('commit');
      resolve();
    });
  });
};

/**
 * Push the current changes
 *
 * @param {String} branch
 * @return {Promise}
 */
Repository.prototype.push = function (branch) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var commands = [
      'cd ' + self.path
    , 'git push origin ' + branch
    ];

    exec(commands.join(' && '), function (error, stdout, stderr) {
      console.log('Pushed!');
      self.emit('push');
      resolve();
    });
  });
};

/**
 * Creates a pullrequest in GitHub
 *
 * @param {Object} github GitHub connection
 * @param {String} branch
 *
 * @return {Promise}
 */
Repository.prototype.pullrequest = function (github, branch) {
  var params
    , user
    , repo;

  params = this.config.url.match('.*:([^/]*)/(.*)\\.git');
  user = params[1];
  repo = params[2];

  return new Promise(function (resolve, reject) {
    github.pullRequests.create({
      user: user
    , repo: repo

    , title: 'Gengo Translations - Order: ' + branch
    , body: '![](http://www.deafecho.com/wp-content/uploads/2011/05/Babel.jpg)'

    , base: 'refs/heads/develop'
    , head: 'refs/heads/' + branch
    }, function (err, data) {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
};

/**
 * Sets pending jobs for an order
 *
 * @param {String} branch
 * @param {Integer} value
 *
 * @return {Boolean}
 */
Repository.prototype.setPending = function (branch, value) {
  this.completed[branch] = value;
};

/**
 * Decreases pending jobs for an order
 *
 * @param {String} branch
 *
 * @return {Boolean}
 */
Repository.prototype.decreasePending = function (branch) {
  return --this.completed[branch];
};

/**
 * Checks if a order is completed
 *
 * @param {String} branch
 *
 * @return {Boolean}
 */
Repository.prototype.checkCompleted = function (branch) {
  return this.completed[branch] === 0;
};

module.exports = Repository;
