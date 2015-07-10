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

  interfaces.get('/:repository/sample', function (req, res) {
    res.json(req.repository.jobs());
  });

  interfaces.get('/:repository/normalize', function (req, res) {
    res.send('Done');
    req.repository.normalize();
  });

  interfaces.post('/:repository/gengo', function (req, res) {
    var language
      , branch
      , key
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

      logger.gengo('Incoming job for respository ' + chalk.cyan(req.repository.name) + ' with status ' + chalk.magenta(job.status) + ' and key ' + chalk.yellow(key) + '...');

      if (job.status === 'approved') {
        branch = 'gengo-' + (job.order_id || req.repository.last_order_id); // Fallback for sandbox compatibility

        language = req.repository.find(job.lc_tgt);
        language.set(key.split('.'), job.body_tgt);

        logger.gengo('Added a new copy to the order branch "' + chalk.magenta(branch) + '"');

        Order(app.get('bookshelf'))
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
                  .set('result', job.body_tgt)
                  .save();
              });
          })
          .then(function () {
            var tracker = app.get('tracker');

            tracker.processTranslation(req.repository, language, branch);
          });
      }
    }
  });

  interfaces.post('/:repository/github', function (req, res) {
    var branch
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

    branch = req.body.ref.match('refs/heads/(.*)')[1];

    if (req.repository.config.branch) {
      regexp = new RegExp(req.repository.config.branch);

      if (!branch.match(regexp)) {
        logger.github('Ignored branch "' + branch + '" for respository "' + req.repository.name + '"...');
        return;
      }
    }

    logger.github('Incoming branch "' + branch + '" for respository "' + req.repository.name + '"...');

    Order(app.get('bookshelf'))
      .where({status: 'pending'})
      .fetchAll()
      .then(function(orders){
        if (orders.length) {
          logger.gengoal('You have pending orders. Waiting for complete them before process "' + branch + '"...');
        } else {
          req.repository.pull()
            .then(function () {
              return req.repository.checkout(branch);
            })
            .then(function () {
              return req.repository.load();
            })
            .then(function () {
              return req.repository.jobs();
            });
        }
      });
  });

  return interfaces;
};
