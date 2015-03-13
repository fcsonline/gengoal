/*jshint laxcomma:true */

var _ = require('underscore');

function Builder(callback_url, lang, glossary_id, defaults) {
  this.callback_url = callback_url;
  this.lang = lang;
  this.glossary_id = glossary_id;

  this.master = defaults.master || 'en';
  this.tier = defaults.tier || 'standard'; // FIXME
  this.comment = defaults.comment;
}

/**
 * Builds a hash with all the required jobs to be sent to Gengo
 *
 * @param {Hash} differences
 * @return {Hash}
 */
Builder.prototype.build = function (differences) {
  var self= this
    , jobs
    , def;

  def = {
    type: 'text',
    lc_src: this.master,
    lc_tgt: this.lang,
    tier: this.tier,
    comment: this.comment,
    callback_url: this.callback_url,
    glossary_id: this.glossary_id,
    auto_approve: 1,
    force:  0,
    use_preferred: 0
  };

  jobs = _.pairs(differences).map(function (item) {
    var key = self.lang + item[0]
      , value = item[1];

    return _.extend({}, def, {
      custom_data: key
    , body_src: value
    , slug: key
    });
  });

  jobs = this.filter(jobs);

  return jobs;
};

/**
 * Filters all the jobs sent previous in another batch
 *
 * @param {Array} jobs
 * @return {Array}
 */
Builder.prototype.filter = function (jobs) {
  // TODO: Check local DB
  return jobs;
};

/**
 * Map all the jobs in a Gengo friendly way
 *
 * @param {Array} jobs
 * @return {Hash}
 */
Builder.reduce_jobs = function (jobs) {
  return _.reduce(jobs, function (memo, value) {
    var id = _.keys(memo).length + 1;

    memo['job' + id] = value;

    return memo;
  }, {});
};

module.exports = Builder;
