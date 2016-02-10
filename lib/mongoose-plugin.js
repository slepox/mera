var mongoose = require('mongoose'),
  _ = require('underscore');
var Schema = mongoose.Schema;

module.exports = exports = function size(schema, options) {
  var props = (options ? options.outputFields : null) || Object.keys(schema.tree).filter(k => !/^_/.test(k));

  var _size = -1;

  schema.post('init', function(doc) {
    if (_size >= 0)
      _size++;
  });
  schema.post('remove', function(doc) {
    if (_size > 0)
      _size--;
  });
  schema.post('findAndRemove', function(result) {
    if (_size > 0)
      _size--;
  });

  schema.statics.size = function(cb) {
    if (_size === -1) {
      return this.count(cb);
    } else {
      if (cb)
        cb(null, _size);
      else
        return Promise.resolve(_size);
    };
  }

  schema.virtual('output').get(function() {
    var result = _.extend({
      id: this.id
    }, _.pick(this, props));
    var rest_fields = _.difference(props, _.keys(result));
    _.each(rest_fields, function(k) {
      result[k] = _.property(k)(this);
    });
    return result;
  });
};
