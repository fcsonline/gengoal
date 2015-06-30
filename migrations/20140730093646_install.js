exports.up = function (knex, Promise) {
  "use strict";

  return knex.schema

    .createTable('orders', function (table) {
      table.increments('id').primary();
      table.string('repository');
      table.string('name');
      table.string('status');
      table.dateTime('expires_at');
      table.integer('jobs');
      table.timestamps();
    });

};

exports.down = function (knex, Promise) {
  return knex.schema
  .dropTable('orders');
};
