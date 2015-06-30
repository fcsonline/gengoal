/*jshint laxcomma:true */

var environment = process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  , knexfile    = require('./knexfile')
  , knex        = require('knex')(knexfile[environment])
  , bookshelf   = require('bookshelf')(knex)
  , path        = require('path')
  , fs          = require('fs')
  , _           = require('underscore')
  , which       = require('shelljs').which
  , chalk       = require('chalk')
  , express     = require('express')
  , bodyParser  = require('body-parser')
  , serveStatic = require('serve-static')
  , compression = require('compression')
  , helmet      = require('helmet')
  , multer      = require('multer')
  , http        = require('http')
  , events      = require('events')
  , gengo       = require('gengo')
  , Promise     = require('bluebird')
  , GitHubApi   = require('github')
  , config      = require('./config.json')
  , Tracker     = require('./lib/tracker')
  , logger      = require('./lib/logger')
  , Order       = require('./models/order')(bookshelf)
  , envvarsnames
  , envvars
  , getenv
  , callback_url
  , private_key
  , public_key
  , sandbox
  , boot
  , server
  , app;

// Checking the required environment variables
envvarsnames = ['GENGOAL_CALLBACK', 'GENGOAL_PUBLIC_KEY', 'GENGOAL_PRIVATE_KEY', 'GENGOAL_GITHUB_USERNAME', 'GENGOAL_GITHUB_BASIC_PASSWORD', 'GENGOAL_SANDBOX'];
getenv = _.partial(_.pick, process.env);
envvars = getenv.apply(this, envvarsnames);

if (_.keys(envvars).length < 4) {
  logger.gengoal("You must set those environment variables: " + envvarsnames.join(', '));
  process.exit(-1);
}

if (!which('git')) {
  logger.gengoal("You must install git");
  process.exit(-1);
}

callback_url  = envvars.GENGOAL_CALLBACK;
public_key    = envvars.GENGOAL_PUBLIC_KEY;
private_key   = envvars.GENGOAL_PRIVATE_KEY;
sandbox       = envvars.GENGOAL_SANDBOX === 'true';

config.callback_url = callback_url;
config.envvars = envvars;

app = express();
server = http.createServer(app);
events = new events.EventEmitter();

app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');
app.set('bookshelf', bookshelf);

app.use(helmet());
app.use(serveStatic('./public'));
app.use(compression({ threshold: 512 }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());

app.use('/admin', require('./controllers/admin')(app));
app.use('/api', require('./controllers/api')(app));
app.use('/', require('./controllers/interfaces')(app));

// Gengo boot
boot = new Promise(function (resolve, reject) {

  gengo = gengo(public_key, private_key, sandbox);

  gengo.account.stats(function (err, res) {
    if (err) {
      logger.gengo('Error initializing Gengo connection: ' + err);
      return;
    }

    logger.gengo('Initialized Gengo connection!');
    logger.gengo('Spent: ' + res.credits_spent + ' ' + res.currency);
    logger.gengo('Fetching glossaries...');

    gengo.glossary.list(function (err, res) {
      if (err) {
        logger.gengo('Error listing Gengo glossaries: ' + err);
      } else {
        config.glossaries = res;
      }

      // Ignore errors...
      resolve();
    });
  });
});

boot
.then(function() {
  var token
    , password
    , options;

  options = {
    username: envvars.GENGOAL_GITHUB_USERNAME
  };

  password = envvars.GENGOAL_GITHUB_BASIC_PASSWORD;
  token = envvars.GENGOAL_GITHUB_OAUTH_TOKEN;

  github = new GitHubApi({version: '3.0.0'});

  if (password) {
    options.type = 'basic';
    options.password = password;
  } else if (token) {
    options.type = 'oauth';
    options.token = token;
  } else {
    logger.github('Missing GitHub Authentication information...');
  }

  github.authenticate(options);
})
.then(function () {
  return Order.where({status: 'pending'}).fetchAll().then(function(orders){
    logger.gengoal('Pending orders: ' + orders.length);
  });
})
.then(function () {
  var tracker;

  app.set('bookshelf', bookshelf);
  app.set('github', github);
  app.set('gengo', gengo);

  tracker = new Tracker(config, app);

  app.set('events', events);
  app.set('config', config);
  app.set('tracker', tracker);

  tracker.debounce(5000); // Store all Gengo callbacks after 5s

  logger.gengoal('Initializing repositories...');
  tracker.init().then(function () {
    logger.gengoal('Repositories initialized...');
    logger.gengoal('Gengo Tracker Server: Listening on port ' + chalk.magenta(config.port));

    server.listen(config.port);
  });
});
