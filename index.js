var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  _ = require('underscore'),
  plural = require('plural');

var meraModel = require('./lib/mera-model'),
  restRoute = require('./lib/rest-route');
  //adminRoute = require('./lib/admin-route');

function meraRoute() {
  var model = null, options = {};
  if (arguments[0].__proto__ == mongoose.Model) {
    model = arguments[0];
    options = arguments[1] || {};
  } else if (arguments[0].__proto__ == String.prototype && arguments[1].__proto__ == mongoose.Schema.prototype) {
    model = meraModel(arguments[0], arguments[1]);
    options = arguments[2] || {};
  } else {
    throw new Error('Invalid arguments');
  }

  var adminPath = options.adminPath || '/admin',
    restPath = options.restPath || '/'+plural(model.modelName.toLowerCase());

  router.use(restPath, restRoute(model, options.protects));
  // if (!options.noAdmin) {
  //   router.use(adminPath, adminRoute(model, options.authenticated));
  // }

  return router;
}

module.exports = {
  Schema: mongoose.Schema,
  model: meraModel,
  route: meraRoute
};