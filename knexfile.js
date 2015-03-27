// Update with your config settings.

module.exports = {

  development: {
    client: 'sqlite3',
    debug: false,
    connection: {
      filename: './dev.sqlite3'
    },
    seeds: {
      directory: './seeds'
    }
  },

  staging: {
    client: 'mysql',
    connection: {
      database: 'gengoal',
      user:     'gengoal',
      password: ''
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: './migrations'
    }
  },

  production: {
    client: 'mysql',
    connection: {
      database: 'gengoal',
      user:     'gengoal',
      password: ''
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: './migrations'
    }
  }

};
