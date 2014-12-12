module.exports = function (bookshelf) {
  return bookshelf.Model.extend({
    tableName: 'logs',
    hasTimestamps: true
  });
};
