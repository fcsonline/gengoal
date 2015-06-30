exports.up = function (knex, Promise) {
  "use strict";

  return knex.schema

    .createTable('orders', function (table) {
      table.increments('id').primary();
      table.string('repository');
      table.string('branch');
      table.string('status');
      table.dateTime('expires_at');
      table.integer('total_jobs').defaultTo(0);
      table.integer('pending_jobs').defaultTo(0);
      table.float('price').defaultTo(0);
      table.timestamps();
    })
    .createTable('copies', function (table) {
      table.increments('id').primary();
      table.integer('order_id').unsigned().references('orders.id');
      table.string('key');
      table.string('status');
      table.string('original');
      table.string('result');
      table.timestamps();
    });
};

exports.down = function (knex, Promise) {
  return knex.schema
  .dropTable('orders')
  .dropTable('copies');
};
