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
envvarsnames = ['GENGO_CALLBACK', 'GENGO_PUBLIC_KEY', 'GENGO_PRIVATE_KEY'];
getenv = _.partial(_.pick, process.env);
envvars = getenv.apply(this, envvarsnames);

if (_.keys(envvars).length !== 3) {
  console.log("You must set those environment variables: " + envvarsnames.join(', '));
  process.exit(-1);
}

if (!which('git')) {
  console.log("You must install git");
  process.exit(-1);
}

if (!which('hub')) {
  console.log("You must install hub");
  process.exit(-1);
}

callback_url  = envvars.GENGO_CALLBACK;
public_key    = envvars.GENGO_PUBLIC_KEY;
private_key   = envvars.GENGO_PRIVATE_KEY;

config.callback_url = callback_url;

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

boot.then(function () {
  var tracker = new Tracker(config, gengo);

  console.log('Initializing repositories...');
  tracker.init().then(function () {
    console.log('Repositories initialized...');
    console.log('Gengo Tracker Server: Listening on port ' + config.port);

    app.set('events', events);
    app.set('bookshelf', bookshelf);
    app.set('config', config);
    app.set('tracker', tracker);

    server.listen(config.port);
  });
});
