var express = require('express'), path = require('path'), ejs = require('ejs'), fs= require('fs'), _ = require('underscore');

var adminEjs = fs.readFileSync(path.join(__dirname, '../templates/admin.ejs')).toString();
var adminTemplate = ejs.compile(adminEjs);

var ng_admin_js = fs.readFileSync(path.join(__dirname, '../node_modules/ng-admin/build/ng-admin.min.js')),
  ng_admin_js_map = fs.readFileSync(path.join(__dirname, '../node_modules/ng-admin/build/ng-admin.min.js.map')),
  ng_admin_css = fs.readFileSync(path.join(__dirname, '../node_modules/ng-admin/build/ng-admin.min.css')),
  ng_admin_css_map = fs.readFileSync(path.join(__dirname, '../node_modules/ng-admin/build/ng-admin.min.css.map'));

function adminRoute(model, path) {
  var router = express.Router();

  router.get('/', function(req, res, next) {
    var respHTML = adminTemplate({title: 'test'});
    res.end(respHTML);
  });

  var ng_admin_files = {'ng-admin.min.js': 'javascripts', 'ng-admin.min.js.map': 'javascripts/maps', 'ng-admin.min.css': 'stylesheets', 'ng-admin.min.css.map' : 'stylesheets/maps'};

  var ng_admin_build = express.static(path.join(__dirname, '../node_modules/ng-admin/build'));
  router.use('/javascripts', ng_admin_build);
  router.use('/javascripts/maps', ng_admin_build);
  router.use('/stylesheets', ng_admin_build);
  router.use('/stylesheets/maps', ng_admin_build);
  // _(ng_admin_files).keys( f => {
  //   var content = fs.readFileSync(path.join(__dirname, '../node_modules/ng-admin/build', f)).toString();
  //   router.get(`/${ng_admin_files[f]}/${f}`, function(req, res, next) {
  //     res.end(content);
  //   });
  // });

  return router;
}

module.exports = adminRoute;