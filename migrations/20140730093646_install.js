exports.up = function (knex, Promise) {
  "use strict";

  return knex.schema

    .createTable('copies', function (table) {
      table.increments('id').primary();
      table.string('repository');
      table.string('key');
      table.string('status');
      table.timestamps();
    })

    .createTable('logs', function (table) {
      table.increments('id').primary();
      table.string('repository');
      table.string('value');
      table.timestamps();
    });

};

exports.down = function (knex, Promise) {
  return knex.schema
  .dropTable('copies')
  .dropTable('logs');
};
