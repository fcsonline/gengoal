/*jshint laxcomma:true */

var _       = require('underscore')
  , express = require('express')
  , chalk   = require('chalk')
  , logger  = require('../lib/logger')
  , Order   = require('../models/order')
  , Copy    = require('../models/copy');

module.exports = function (app) {
  var interfaces = express();

  interfaces.param('repository', function(req, res, next, repository_id){
    var tracker
      , repository;

    tracker = app.get('tracker');
    repository = tracker.find(repository_id);

    if (repository) {
      req.repository = repository;
      next();
    } else {
      next(new Error('failed to load repository'));
    }
  });

  interfaces.get('/status', function (req, res) {
    res.send('OK');
  });

  interfaces.get('/expired', function (req, res) {
    res.send('OK');

    app.get('tracker').checkExpiredOrders(!!req.query.force);
  });

  interfaces.get('/:repository/recover', function (req, res) {
    res.send('OK');

    app.get('tracker').recover(req.repository, +req.query.timestamp_after);
  });

  interfaces.get('/:repository/sample', function (req, res) {
    res.json(req.repository.jobs());
  });

  interfaces.get('/:repository/normalize', function (req, res) {
    res.send('Done');
    req.repository.normalize();
  });

  interfaces.post('/:repository/gengo', function (req, res) {
    var tracker
      , branch
      , key
      , result
      , job;

    if (_.isEmpty(req.body)) {
      logger.gengo('Empty body');
      res.send('OK');
      return;
    }

    try {
      job = JSON.parse(req.body.job);
      res.send('OK');
    } catch (e) {
      logger.gengo('Unprocessable Entity: ', req.body + e);
      res.status(422).send('Unprocessable Entity');
      return;
    }

    if (job.custom_data) {
      key = job.custom_data;
      result = job.body_tgt;

      logger.gengo('Incoming job for respository ' + chalk.cyan(req.repository.name) + ' with status ' + chalk.magenta(job.status) + ' and key ' + chalk.yellow(key) + '...');

      if (job.status === 'approved') {
        tracker = app.get('tracker');
        branch = 'gengo-' + (job.order_id || req.repository.last_order_id); // Fallback for sandbox compatibility

        tracker.processTranslation(key, result, branch);
      }
    }
  });

  interfaces.post('/:repository/github', function (req, res) {
    var tracker
      , branch
      , regexp;

    res.send('OK');

    if (req.headers['x-github-event'] === 'ping') {
      logger.github('Hook to Gengoal properly set up');
      return;
    }

    if (_.isEmpty(req.body)) {
      logger.github('Empty body');
      return;
    }

    tracker = app.get('tracker');
    branch = req.body.ref.match('refs/heads/(.*)')[1];

    tracker.processNewBranch(req.repository, branch);
  });

  return interfaces;
};
