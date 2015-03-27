module.exports = function (bookshelf) {
  return bookshelf.Model.extend({
    tableName: 'players',
    hasTimestamps: true
  });
};
