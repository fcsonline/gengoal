/*jshint laxcomma:true */

var fs   = require('fs')
  , path = require('path')
  , exec = require('child_process').exec
  , util = require('util')
  , _    = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')

  , logger      = require('./logger')
  , Builder     = require('./builder')
  , Repository  = require('./repository')
  , Language    = require('./language')
  , Order       = require('../models/order')
  , Copy        = require('../models/copy');

function Tracker(config, app) {
  var self = this;

  this.gengo = app.get('gengo');
  this.bookshelf = app.get('bookshelf');
  this.github = app.get('github');

  this.repositories = config.repositories.map(function (repository_config) {
    var repository;

    repository = new Repository(repository_config, config.callback_url, config.envvars);

    repository.on('jobs', _.bind(_.partial(self.send, repository), self));

    return repository;
  });

  setInterval(_.bind(this.checkExpiredOrders, this), 1000 * 600); // 10 mins
}

util.inherits(Tracker, EventEmitter);

/**
 * Initializes all the configured repositories
 *
 * @return {Language}
 */
Tracker.prototype.init = function () {
  var self = this
    , pulls = [];

  pulls = this.repositories.map(function (repository) {
    logger.gengoal('Fetching ' + repository.config.url + '...');
    return repository.pull();
  });

  return Promise.all(pulls)
    .then(function () {
      var loads;

      loads = self.repositories.map(function (repository) {
        logger.gengoal('Loading languages for "' + repository.config.name + '" repository...');
        return repository.load();
      });

      return Promise.all(loads);
    })
    .then(function () {
      var normalizations;

      normalizations = self.repositories.map(function (repository) {
        if (repository.config.normalize) {
          logger.gengoal('Normalizating languages for "' + repository.config.name + '" repository...');

          return repository.normalize();
        }
      });

      return Promise.all(normalizations);
    });
};

/**
 * Finds a repository by name
 *
 * @return {Repository}
 */
Tracker.prototype.find = function (name) {
  return _.findWhere(this.repositories, {name: name});
};

/**
 * Sends to Gengo some jobs
 *
 * @param {Repository} repository
 * @param {Array} jobs
 */
Tracker.prototype.send = function (repository, jobs) {
  var self = this
    , data;

  data = {
    jobs: Builder.reduce_jobs(jobs)
  };

  logger.gengoal('Sending ' + Object.keys(jobs).length + ' jobs for the repository "' + repository.name + '" to Gengo...');

  this.gengo.jobs.create(data, function(err, res){
    var branch;

    if (err) {
      logger.gengoal('Error submitting Gengo jobs: ' + err);
      return;
    }

    branch = 'gengo-' + res.order_id;

    logger.gengoal('Processing new order ' + res.order_id + ' with ' + res.job_count + ' jobs (' + res.credits_used + ' USD) in Gengo...');

    Order(self.bookshelf).forge({
      repository: repository.name
    , branch: branch
    , status: 'pending'
    , expires_at: Date.now() + 86400000 // Expires in 1 day
    , total_jobs: res.job_count
    , pending_jobs: res.job_count
    , price: res.credits_used
    })
      .save()
      .then(function(order) {
        var inserts = [];

        jobs.forEach(function (job) {
          var copy;

          copy = Copy(self.bookshelf).forge({
            key: job.custom_data
          , order_id: order.id
          , status: 'pending'
          , original: job.body_src
          , result: ''
          }).save();

          inserts.push(copy);
        });

        return Promise.all(inserts);
      })
      .then(function() {
        return repository.branch(branch)
          .then(function () {
            repository.last_order_id = res.order_id; // Sandbox features
            repository.setPending(branch, res.job_count);
            logger.gengoal('Created a new branch "' + branch + '" for order ' + res.order_id);
          });
      });
  });
};

/**
 * Complete the branch creating a pullrequest
 *
 * @param {Repository} repository
 * @param {String} branch
 */
Tracker.prototype.createPullRequest = function (repository, branch) {
  var self = this;

  return repository.push(branch)
    .then(function () {
      logger.gengoal('Creating the pullrequest...');
      return repository.pullrequest(self.github, branch);
    })
    .then(function () {
      logger.gengoal('Pull Request created! :D');
    });
};

/**
 * Process Github branch
 *
 * @param {Repository} repository
 * @param {String} branch
 */
Tracker.prototype.processNewBranch = function (repository, branch) {
  if (repository.config.branch) {
    regexp = new RegExp(repository.config.branch);

    if (!branch.match(regexp)) {
      logger.github('Ignored branch "' + branch + '" for respository "' + repository.name + '"...');
      return;
    }
  }

  logger.github('Incoming branch "' + branch + '" for respository "' + repository.name + '"...');

  Order(this.bookshelf)
    .where({status: 'pending'})
    .fetchAll()
    .then(function(orders){
      if (orders.length) {
        logger.gengoal('You have pending orders. Waiting for complete them before process "' + branch + '"...');
      } else {
        repository.pull()
          .then(function () {
            return repository.checkout(branch);
          })
          .then(function () {
            return repository.load();
          })
          .then(function () {
            return repository.jobs();
          });
      }
    });
};

/**
 * Process Gengo jobs
 *
 * @param {String} key
 * @param {String} result
 * @param {String} branch
 */
Tracker.prototype.processTranslation = function (key, result, branch) {
  var self = this;

  return Order(app.get('bookshelf'))
    .where({branch: branch})
    .fetch()
    .then(function (order) {
      return order
        .set('pending_jobs', order.get('pending_jobs') - 1)
        .save();
    })
    .then(function (order) {
      return Copy(app.get('bookshelf'))
        .where({order_id: order.id, key: key})
        .fetch()
        .then(function (copy) {
          return copy
            .set('status', 'completed')
            .set('result', result)
            .save();
        })
        .then(function () {
          return order;
        });
    })
    .then(function (order) {
      var completed
        , commit;

      logger.gengo('Added a new copy to the order branch "' + chalk.magenta(branch) + '"');

      if (order.get('pending_jobs') === 0) {
        completed = order.set('status', 'completed').save();

        commit = self.persistAndCloseBranch(repository, branch);
      }

      return Promise.all([completed, commit]);
    });
};

/**
 * Persist and close orders
 *
 * @param {Repository} repository
 * @param {String} branch
 */
Tracker.prototype.persistAndCloseBranch = function (repository, branch) {
  var self = this;

  return repository.checkout(branch)
    .then(function () {
      return Copy(app.get('bookshelf'))
        .where({order_id: order.id, status: 'completed'})
        .fetchAll()
        .then(function (copies) {
          var languages = []
            , saves;

          copies.forEach(function(copy) {
            var key_path
              , locale
              , language;

            key_path = key.split('.');
            locale = key_path[0];
            language = repository.find(locale);
            language.set(key_path, job.body_tgt);

            languages.push(language);
          });

          languages = _.uniq(languages);

          saves = languages.map(function (language) {
            return language.save();
          });

          return Promise.all(saves);
        });
    }).then(function () {
      return repository.commit();
    }).then(function () {
      var pull;

      logger.gengoal('The order "' + branch + '" is completed. Pushing the branch...');
      pull = self.createPullRequest(repository, branch);

      return Promise.all([pull]);
    });

};

/**
 * Check all the expired orders
 */
Tracker.prototype.checkExpiredOrders = function () {
  var self = this;

  logger.gengoal('Checking expired orders...');

  return Order(this.bookshelf).where({status: 'pending'}).fetchAll().then(function(orders){
    var pull_requests = [];

    orders.forEach(function(order) {
      var branch
        , pull
        , repository;

      if (order.get('expires_at') < Date.now()) {

        branch = order.get('branch');
        repository = self.find(order.get('repository'));

        logger.gengoal('Order "' + branch + '" has expired. Creating pull-request...');

        pull = self.persistAndCloseBranch(repository, branch).then(function () {
          order.set('status', 'completed');

          return order.save();
        });

        pull_requests.push(pull);
      }
    });

    return Promise.all(pull_requests);
  });
};

module.exports = Tracker;
