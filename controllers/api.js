/*jshint laxcomma:true */

var express = require('express');

module.exports = function (app) {
  var api = express()
    , bookshelf = app.get('bookshelf')
    , Order = require('../models/order')(bookshelf);

  api.get('/orders', function (req, res) {
    Order
    .fetchAll()
    .then(function (orders) {
      res.json(orders);
    });
  });

  return api;
};
