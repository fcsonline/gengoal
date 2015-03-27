exports.up = function (knex, Promise) {
  "use strict";

  return knex.schema

    .createTable('orders', function (table) {
      table.increments('id').primary();
      table.string('repository');
      table.string('branch');
      table.string('status');
      table.integer('total_jobs').defaultTo(0);
      table.integer('pending_jobs').defaultTo(0);
      table.float('price').defaultTo(0);
      table.timestamps();
    })

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
