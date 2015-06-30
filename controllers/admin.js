/*jshint laxcomma:true */

var express = require('express');

module.exports = function (app) {
  var admin = express()
    , bookshelf = app.get('bookshelf')
    , Order = require('../models/order')(bookshelf)
    , Copy  = require('../models/copy')(bookshelf);

  admin.get('/', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    Order
    .fetchAll()
    .then(function (orders) {
      res.render('index', {
        repositories: tracker.repositories
      , orders: orders.toJSON()
      });
    });
  });

  admin.get('/repositories/:repository', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    Order
    .fetchAll()
    .then(function (orders) {
      res.render('repository', {
        repositories: tracker.repositories
      , orders: orders.toJSON()
      });
    });
  });

  admin.get('/orders/:order_id', function (req, res) {
    var tracker;

    tracker = app.get('tracker');

    Order
    .where({id: req.params.order_id})
    .fetch()
    .then(function (order) {
      Copy
      .where({order_id: req.params.order_id})
      .fetchAll()
      .then(function (copies) {
        res.render('order', {
          repositories: tracker.repositories
        , order: order.toJSON()
        , copies: copies.toJSON()
        });
      });
    });
  });

  return admin;
};
