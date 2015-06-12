/*jshint laxcomma:true */

var _       = require('underscore')
  , yaml    = require('js-yaml')
  , fs      = require('fs')
  , Promise = require('bluebird')
  , diff    = require('deep-diff').diff;

function Language(path, name, master) {
  this.path = path;
  this.name = name;
  this.master = master === true;

  if (fs.existsSync(this.path)) {
    this.language = yaml.safeLoad(fs.readFileSync(this.path, 'utf8'));
  } else {
    console.log('File not found "' + this.path + '"...');
  }
}

/**
 * Sets a new value for the given key path
 * an array of jobs
 *
 * @param {Array} keypath
 * @param {String} value
 * @param {Object} language optional
 */
Language.prototype.set = function (keypath, value, language) {
  if (!language) {
    this.set(keypath, value, this.language);
    return;
  }

  var step = keypath.shift(1);

  if (!keypath.length) {
    language[step] = value;
  } else {
    if (!language[step]) {
      language[step] = {};
    }

    this.set(keypath, value, language[step]);
  }
};

/**
 * Returns the root node for the current language
 *
 * @return {Object}
 */
Language.prototype.root = function () {
  return this.language[this.name];
};

/**
 * Checks the differences between languages and master root nodes
 *
 * @param {Object} master
 * @return {Object}
 */
Language.prototype.diff = function (master) {
  return this.flat(diff(master.root(), this.root()));
};

/**
 * Builds a hash with all the required jobs to be sent to Gengo
 *
 * @param {Array} differences
 * @return {Hash}
 */
Language.prototype.flat = function (differences) {
  var self = this
    , result = {};

  differences.forEach(function (difference) {
    var globalpath;

    if (difference.kind === 'E' || difference.kind === 'N') {
      return;
    }

    globalpath = difference.path;
    globalpath.unshift(self.lang);

    self.flat_diff(difference.lhs, result, globalpath.join('.'));
  });

  return result;
};

/**
 * Goes through the lhs tree of differences and build an array of jobs
 *
 * @param {Hash} lhs
 * @param {Hash} jobs
 * @param {String} parentkey
 */
Language.prototype.flat_diff = function (lhs, jobs, parentkey) {
  var self = this;

  if (_.isString(lhs)) {
    jobs[parentkey] = lhs;
    return;
  }

  _.each(lhs, function (value, key) {
    self.flat_diff(lhs[key], jobs, parentkey + '.' + key);
  });
};

/**
 * Save the current memory representation to the language files
 */
Language.prototype.save = function () {
  var self = this
    , result;

  result = yaml.safeDump(this.language, {indent: 2});

  return new Promise(function (resolve, reject) {
    fs.writeFile(self.path, result, function (err) {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
};

module.exports = Language;
