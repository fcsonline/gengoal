module.exports = function (bookshelf) {
  return bookshelf.Model.extend({
    tableName: 'copies',
    hasTimestamps: true
  });
};
