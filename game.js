module.exports = function (bookshelf) {
  var Player = require('./player')(bookshelf)
    , Group = require('./group')(bookshelf);

  return bookshelf.Model.extend({
    tableName: 'games',
    hasTimestamps: true,

    defaults: {
      'status': 'scheduled'
    },

    players: function (params) {
      return this.belongsToMany(Player).query(
        {where: params}
      );
    },

    groups: function (params) {
      return this.belongsToMany(Group).query(
        {where: params}
      );
    },

    is_singles: function () {
      return this.get('type') === 'singles';
    },

    side: function (params) {
      if (this.is_singles()) {
        return this.players(params);
      } else {
        return this.groups(params);
      }
    },

    left: function () {
      return this.side({left: true});
    },

    right: function () {
      return this.side({left: false});
    },

    winner: function () {
      return this.side({winner: true});
    },

    increment: function (field) {
      return this.set(field, this.get(field) + 1);
    }
  });
};
