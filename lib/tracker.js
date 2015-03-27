/*jshint laxcomma:true */

var fs   = require('fs')
  , path = require('path')
  , exec = require('child_process').exec
  , util = require('util')
  , _    = require('underscore')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')

  , Builder     = require('./builder')
  , Repository  = require('./repository')
  , Language    = require('./language');

function Tracker(config, gengo, app) {
  var self = this;

  this.gengo = gengo;

  this.app = app;

  this.repositories = config.repositories.map(function (repository_config) {
    var repository;

    repository = new Repository(repository_config, config.callback_url, config.envvars);

    repository.on('jobs', _.bind(_.partial(self.send, repository), self));

    return repository;
  });

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
    console.log('Fetching ' + repository.config.url + '...');
    return repository.pull();
  });

  return Promise.all(pulls)
    .then(function () {
      var loads;

      loads = self.repositories.map(function (repository) {
        console.log('Loading languages for "' + repository.config.name + '" repository...');
        return repository.load();
      });

      return Promise.all(loads);
    })
    .then(function () {
      var normalizations;

      normalizations = self.repositories.map(function (repository) {
        console.log('Normalizating languages for "' + repository.config.name + '" repository...');
        return repository.normalize();
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
  var data
    , bookshelf = this.app.get('bookshelf')
    , Order = require('../models/order')(bookshelf)
    , Copies = require('../models/copy')(bookshelf);

  data = {
    jobs: Builder.reduce_jobs(jobs)
  };

  console.log('Sending ' + Object.keys(jobs).length + ' jobs for the repository "' + repository.name + '" to Gengo...');

  this.gengo.jobs.create(data, function(err, res){
    var branch;

    if (err) {
      console.log('Error submitting Gengo jobs: ', err);
      return;
    }

    branch = 'gengo-' + res.order_id;

    console.log('Processing new order ' + res.order_id + ' with ' + res.job_count + ' jobs (' + res.credits_used + ' USD) in Gengo...');


    repository.branch(branch)
      .then(function () {
        repository.last_order_id = res.order_id; // Sandbox features
        repository.setPending(branch, res.job_count);
        console.log('Created a new branch "' + branch + '" for order ' + res.order_id);
      })
      .then(function () {
        return Order.forge({
          repository: repository.name
        , branch: branch
        , status: 'pending'
        , total_jobs: res.job_count
        , pending_jobs: res.job_count
        , price: res.credits_used
        }).save();
      });
  });
};

module.exports = Tracker;
