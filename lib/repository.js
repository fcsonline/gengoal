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
}

util.inherits(Repository, EventEmitter);

/**
 * Loads all the available languages in the given directory
 */
Repository.prototype.load = function () {
  var self = this
    , directory = path.join(this.path, this.config.directory);

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
  var self = this;

  return new Promise(function (resolve, reject) {
    var commands = [
      'git clone ' + self.config.url + ' ' + self.path
    , 'cd ' + self.path
    , 'git checkout develop'
    , 'git branch gengo'
    , 'git checkout gengo'
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
    , 'git checkout gengo'
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
 * Sync the repository and enqueue Gengo jobs
 *
 * @return {Promise}
 */
Repository.prototype.sync = function () {
  var self = this;
  //TODO
  return this.pull().then(function () {
    self.jobs();
  });
};

module.exports = Repository;
