var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  _ = require('underscore'),
  debug = require('debug')('mera'),
  ejs = require('ejs');

function mongooseRoute(model, options) {
  var router = express.Router();

  function error(method, err, statusCode) {
    var msg = 'Failed to ' + method + ' ' + model.modelName + ' : ' + err;
    var err = new Error(msg);
    err.statusCode = statusCode;
    debug('err: %j', err);
    return err;
  }

  function convert(data) {
    data = _.pick(data, props);
    _.each(_.keys(propsMapping), k => {
      if (data[k] && propsMapping[k] != k) {
        data[propsMapping[k]] = data[k];
        delete data[k];
      }
    });
    return data;
  }

  function output(item) {
    var output = {};
    props.forEach(p => { output[p] = item[p] }); // item can have virtual props so they need to be assigned one by one.
    return output;
  }

  var props = options.props || _.keys(model.schema.tree).filter(e => !/^_/.test(e)),
    propsMapping = _.extend({ 'id': '_id' }, options.propsMapping);

  // protect the method if defined in protects
  router.use('/', function(req, rest, next) {
    var protects = options.protects || {};
    var protect = req.method === 'GET' ? (req.url === '/' ? protects.LIST : protects.GET) : protects[req.method];
    if (protect) {
      protect(req, next);
    } else {
      next();
    }
  });

  router.get('/', function(req, res, next) {

    // filter buildup
    var filter = _.pick(req.query, props);
    filter = _.extend(convert(filter), options.baseFilter);
    debug('List %s by filter %j', model.modelName, filter);

    // listOptions buildup
    var lo = {
      limit: req.query._perPage || 0
    };
    lo.skip = Math.max((req.query._page || 1) - 1, 0) * lo.limit;
    if (req.query._sortField && req.query._sortDir) {
      lo.sort = {};
      lo.sort[req.query._sortField.replace(/^id/, '_id')] = req.query._sortDir.toUpperCase() == 'ASC' ? 1 : -1;
    } else {
      lo.sort = options.defaultSort;
    }
    debug('get list options from request: %j', lo);

    // list model
    model.count(filter, function(err, num) {
      if (err) {
        return next(error('LIST', model, err));
      }
      model.find(filter).skip(lo.skip).limit(lo.limit).sort(lo.sort).exec(function(err2, items) {
        if (err2) {
          return next(error('LIST', model, err2));
        }
        res.set('X-Total-Count', num).json(items.map(output));
      });
    });
  });

  router.post('/', function(req, res, next) {
    var data = convert(req.body);
    debug('Post to model %s by data %j', model.modelName, data);

    model.create(data, function(err, item) {
      if (err) {
        return next(error('POST', model, err));
      }
      res.json(output(item));
    });
  });

  router.get('/:id', function(req, res, next) {
    debug('Get model %s by id %s', model.modelName, req.params.id);
    model.findOne({
      _id: req.params.id
    }).exec(function(err, item) {
      if (err) {
        return next(error('GET', model, err));
      }
      if (!item) {
        return next();
      }
      res.json(item.output);
    });
  });

  router.put('/:id', function(req, res, next) {
    var data = convert(req.body);
    debug('Put to model %s, id %s by data %j', model.modelName, req.params.id, data);

    model.findOne({
      _id: req.params.id
    }).exec(function(err, item) {
      if (err) {
        return next(error('PUT', model, err));
      }
      if (!item) {
        return next();
      }
      _.extend(item, data);
      item.save(function(err) {
        if (err) {
          return next(error('PUT', model, err));
        }
        res.json(output(item));
      });
    });
  });

  router.delete('/:id', function(req, res, next) {
    debug('delete model %s by id %s', model.modelName, req.params.id);

    model.remove({
      _id: req.params['id']
    }).exec(function(err, item) {
      if (err) {
        return next(error('DELETE', model, err));
      }
      res.json({});
    });
  });

  // var ngaBaseTemplate = fs.readFileSync(path.join(__dirname, './templates/nga-base.ejs'));
  // router.get('/nga-base.js', function(req, res, next) {
  //   var content = ejs.render(ngaBaseTemplate, {
  //     appName: options.appName || (model.modelName + 'App'),
  //     title: options.title || model.modelName,
  //     baseApiUrl: req.baseUrl.split('/').slice(0,-1).join('/')
  //   });
  //   res.set('content-type', 'text/javascript').end(content);
  // });

  // var ngaBaseTemplate = fs.readFileSync(path.join(__dirname, './templates/nga-entity.ejs'));
  // router.get('/nga-entity.js', function(req, res, next) {

  // });

  return router;
}

module.exports = mongooseRoute;
