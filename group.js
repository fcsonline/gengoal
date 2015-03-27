module.exports = function (bookshelf) {
  var Player = require('./player')(bookshelf);

  return bookshelf.Model.extend({
    tableName: 'groups',
    hasTimestamps: true,

    players: function () {
      return this.belongsToMany(Player);
    }
  });
};
