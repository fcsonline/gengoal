/*jshint laxcomma:true */

var _       = require('underscore')
  , logger  = require('../lib/logger');

module.exports = function (app) {

  app.post('/:repository/github', function (req, res) {
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
  });
};
