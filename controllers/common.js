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
    repository = tracker.find(repository_id);

    if (repository) {
      req.repository = repository;
      next();
    } else {
      next(new Error('failed to load repository'));
    }
  });

  app.get('/:repository/sample', function (req, res) {
    res.json(req.repository.jobs());
  });

  app.get('/:repository/normalize', function (req, res) {
    res.send('Done');
    req.repository.normalize();
  });
};
