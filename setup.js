var readline  = require('readline')
  , async     = require('async')
  , fs        = require('fs');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var questions = [
  {
    sentence: 'Database hostname: '
  , default_value: 'localhost'
  }
, {
    sentence: 'Database user name: '
  , default_value: 'topspinjs'
  }
, {
    sentence: 'Database password: '
  , default_value: 'topspinjs'
  }
, {
    sentence: 'Database name: '
  , default_value: 'topspinjs'
  }
];

function ask(question) {
  return function (callback) {
    rl.question(question.sentence + " [" + question.default_value + "] ", function (answer) {
      callback(null, answer || question.default_value);
    });
  };
}

console.log("MYSQL server configuration:");
async.series(questions.map(ask), function (err, answers) {
  var data = JSON.stringify({
    database: {
      host     : answers[0]
    , user     : answers[1]
    , password : answers[2]
    , database : answers[3]
    , charset  : 'utf8'
    }
  }, null, 4);

  console.log("Writing configuration file...");

  fs.writeFile("./config.json", data, function (err) {
    if (err) {
      console.log(err);
    }
  });

  rl.close();
});
