/*jshint laxcomma:true */

var _ = require('underscore');

module.exports = function (app) {
  app.get('/status', function (req, res) {
    res.send('OK');
  });

  app.get('/', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    res.render('index', {
      repositories: tracker.repositories
    });
  });

  app.param('repository', function(req, res, next, repository_id){
    var tracker
      , repository;

    tracker = app.get('tracker');
    repository = tracker.find(req.param('repository'));

    if (repository) {
      req.repository = repository;
      next();
    } else {
      next(new Error('failed to load repository'));
    }
  });

  app.post('/:repository/gengo', function (req, res) {
    var language
      , tracker
      , branch
      , key
      , job;

    res.send('OK');

    if (_.isEmpty(req.body)) {
      console.log('Empty body');
      return;
    }

    job = JSON.parse(req.body.job);

    console.log('Incoming job for respository "' + req.repository.name + '" with status "' + job.status + '"...');

    if (job.custom_data) {
      key = job.custom_data;

      if (job.status === 'available') {
        console.log('Translating "' + key + '" copy...');
      } else if (job.status === 'approved') {
        branch = 'gengo-' + (job.order_id || req.repository.last_order_id); // Sandbox features

        language = req.repository.find(job.lc_tgt);
        language.set(key.split('.'), job.body_tgt);

        tracker = app.get('tracker');
        tracker.processTranslation(req.repository, language, branch, app.get('github'));
      }
    }
  });

  app.get('/:repository/sample', function (req, res) {
    res.json(req.repository.jobs());
  });

  app.get('/:repository/normalize', function (req, res) {
    res.send('Done');
    req.repository.normalize();
  });

  app.post('/:repository/github', function (req, res) {
    var branch
      , regexp;

    res.send('OK');

    if (_.isEmpty(req.body)) {
      console.log('Empty body');
      return;
    }

    branch = req.body.ref.match('refs/heads/(.*)')[1];

    if (req.repository.config.branch) {
      regexp = new RegExp(req.repository.config.branch);

      if (!branch.match(regexp)) {
        console.log('Ignored branch "' + branch + '" for respository "' + req.repository.name + '"...');
        return;
      }
    }

    console.log('Incoming branch "' + branch + '" for respository "' + req.repository.name + '"...');

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
