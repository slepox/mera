var mongoose = require('mongoose'),
  _ = require('underscore');
var Schema = mongoose.Schema;

module.exports = function(modelName, schema) {

  schema.virtual('props').get(function() {    
    return _.without(Object.keys(schema.paths), '_id');
  });

  schema.virtual('output').get(function() {
    return _.extend({
      id: this.id
    }, _.pick(this, this.props));
  });

  var size = -1;
  schema.post('create', function() {
    if (size >= 0) size++;
  });
  schema.post('delete', function() {
    if (size > 0) size--;
  })

  var model = mongoose.model(modelName, schema);

  model.size = function(cb) {
    if (size === -1) {
      model.count(cb);
    } else {
      cb(null, size);
    }
  }

  return model;
};