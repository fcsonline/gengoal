/*jshint laxcomma:true */

var express = require('express');

module.exports = function (app) {
  var admin = express();

  admin.get('/status', function (req, res) {
    res.send('OK');
  });

  admin.get('/', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    res.render('index', {
      repositories: tracker.repositories
    });
  });

  admin.get('/repositories/:repository', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    res.render('index', {
      repositories: tracker.repositories
    });
  });

  return admin;
};
