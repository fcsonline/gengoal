var chalk  = require('chalk')
  , Logger = {};

Logger.gengoal = function (message){
  console.log(chalk.blue('[GENGOAL]') + ' ' + message);
};

Logger.github = function (message){
  console.log(chalk.grey('[GITHUB]') + ' ' + message);
};

Logger.gengo = function (message){
  console.log(chalk.green('[GENGO]') + ' ' + message);
};

module.exports = Logger;
