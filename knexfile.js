// Update with your config settings.

module.exports = {

  development: {
    client: 'sqlite3',
    debug: false,
    connection: {
      filename: './dev.sqlite3'
    }
  },

  production: {
    client: 'sqlite3',
    debug: false,
    connection: {
      filename: './pro.sqlite3'
    }
  },

};
