/*jshint laxcomma:true */

var _       = require('underscore')
  , chalk   = require('chalk')
  , logger  = require('../lib/logger');

module.exports = function (app) {

  app.post('/:repository/gengo', function (req, res) {
    var language
      , pending
      , tracker
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

        pending = req.repository.decreasePending(branch);
        logger.gengo('Added a new copy to the order branch "' + chalk.magenta(branch) + '". Pending: ' + chalk.yellow(pending));

        tracker = app.get('tracker');
        tracker.processTranslation(req.repository, language, branch);
      }
    }
  });
};
