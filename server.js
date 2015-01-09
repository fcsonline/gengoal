/*jshint laxcomma:true */

var knexfile    = require('./knexfile')
  , knex        = require('knex')(knexfile.tracker)
  , bookshelf   = require('bookshelf')(knex)
  , path        = require('path')
  , fs          = require('fs')
  , _           = require('underscore')
  , which       = require('shelljs').which
  , express     = require('express')
  , bodyParser  = require('body-parser')
  , multer      = require('multer')
  , http        = require('http')
  , events      = require('events')
  , gengo       = require('gengo')
  , Promise     = require('bluebird')
  , GitHubApi   = require('github')
  , config      = require('./config.json')
  , Tracker     = require('./lib/tracker')
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
envvarsnames = ['GENGOAL_CALLBACK', 'GENGOAL_PUBLIC_KEY', 'GENGOAL_PRIVATE_KEY', 'GENGOAL_GITHUB_USERNAME', 'GENGOAL_GITHUB_BASIC_PASSWORD'];
getenv = _.partial(_.pick, process.env);
envvars = getenv.apply(this, envvarsnames);

if (_.keys(envvars).length < 4) {
  console.log("You must set those environment variables: " + envvarsnames.join(', '));
  process.exit(-1);
}

if (!which('git')) {
  console.log("You must install git");
  process.exit(-1);
}

callback_url  = envvars.GENGOAL_CALLBACK;
public_key    = envvars.GENGOAL_PUBLIC_KEY;
private_key   = envvars.GENGOAL_PRIVATE_KEY;

config.callback_url = callback_url;
config.envvars = envvars;

app = express();
server = http.createServer(app);
events = new events.EventEmitter();

app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());

require('./controllers/gengo')(app);

// Gengo boot
boot = new Promise(function (resolve, reject) {

  sandbox = false;
  sandbox = true;
  gengo = gengo(public_key, private_key, sandbox);

  gengo.account.stats(function (err, res) {
    if (err) {
      console.log('Error initializing Gengo connection: ', err);
      return;
    }
    console.log('Initialized Gengo connection!');
    console.log('Spent: ' + res.credits_spent + ' ' + res.currency);

    console.log('Fetching glossaries...');
    gengo.glossary.list(function (err, res) {
      if (err) {
        console.log('Error listing Gengo glossaries: ', err);
        return;
      }

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
    console.log('Missing GitHub Authentication information...');
  }

  github.authenticate(options);
})
.then(function () {
  var tracker = new Tracker(config, gengo);

  console.log('Initializing repositories...');
  tracker.init().then(function () {
    console.log('Repositories initialized...');
    console.log('Gengo Tracker Server: Listening on port ' + config.port);

    app.set('events', events);
    app.set('bookshelf', bookshelf);
    app.set('config', config);
    app.set('tracker', tracker);
    app.set('github', github);

    server.listen(config.port);
  });
});
