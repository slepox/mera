var _ = require('underscore'),
  express = require('express'),
  debug = require('debug')('mera:router');

function error(method, model, err) {
  var msg = 'Failed to ' + method + ' ' + model.modelName + ' : ' + err;
  debug(msg);
  return new Error(msg);
}

function mongooseRoute(model, options) {

  var router = express.Router();

  var props = options ? options.props : {},
    protects = options ? options.protects : {},
    baseFilter = options ? baseFilter : {},
    defaultSort = options ? options.defaultSort : {};

  router.get('/', function(req, res, next) {
    if (protects.LIST) {
      protects.LIST(req);
    }
    var filter = _.pick(req.query, _.keys(props));
    _.each(_.keys(props), function(k) {
      if (filter[k] && props[k] != k) {
        filter[props[k]] = filter[k];
        delete filter[k];
      }
    });
    filter = _.extend(filter, baseFilter);
    var size = req.query._perPage || 0,
      offset = Math.max(req.query._page - 1, 0) * size;
    var sortCondition = {}, sortField = props[req.query._sortField] || req.query._sortField;
    if (sortField) {
      sortField = sortField.replace(/^id/, '_id');
      sortCondition[sortField] = req.query._sortDir == 'ASC' ? 1 : -1;
    } else if (defaultSort) {
      sortCondition = _(sortCondition).extend(defaultSort);
    }

    debug('List %s by filter %j on offset %d, limit %d, sorted by %j', model.modelName, filter, offset, size, sortCondition);

    model.find(filter).skip(offset).limit(size).sort(sortCondition).exec(function(err, items) {
      if (err) {
        next(error('LIST', model, err));
      } else {
        model.size(function(err, num) {
          if (err) {
            next(error('LIST', model, err));
          } else {
            res.set('X-Total-Count', num).json(_.pluck(items, 'output'));
          }
        });
      }
    });
  });

  router.post('/', function(req, res, next) {
    if (protects.POST) {
      protects.POST(req);
    }
    var data = req.body;
    for(var k in props) {
      if (data[k] && props[k] != k) {
        data[props[k]] = data[k];
        delete data[k];
      }
    }
    debug('Post to model %s by data %j', model.modelName, data);
    model.create(data, function(err, item) {
      if (err) {
        next(error('POST', model, err));
      } else {
        res.json(item.output);
      }
    })
  });

  router.get('/:id', function(req, res, next) {
    if (protects.GET) {
      protects.GET(req);
    }
    debug('Get model %s by id %s', model.modelName, req.params.id);
    model.findOne({
      _id: req.params['id']
    }).exec(function(err, item) {
      if (err) {
        next(error('GET', model, err));
      } else {
        if (!item) {
          next();
        } else {
          res.json(item.output);
        }
      }
    });
  });

  router.put('/:id', function(req, res, next) {
    if (protects.PUT) {
      protects.PUT(req);
    }
    var data = req.body;
    for(var k in props) {
      if (data[k] && props[k] != k) {
        data[props[k]] = data[k];
        delete data[k];
      }
    }

    debug('Put to model %s by data %j', model.modelName, data);
    model.findOne({
      _id: req.params['id']
    }).exec(function(err, item) {
      if (err) {
        next(error('PUT', model, err));
        return;
      } else if (!item) {
        next();
        return;
      }
      _.extend(item, data);
      item.save(function(err) {
        if (err) {
          next(error('PUT', model, err));
          return;
        }
        res.json(item.output);
      });
    });
  });

  router.delete('/:id', function(req, res, next) {
    if (protects.DELETE) {
      protects.DELETE(req);
    }
    debug('delete model %s by id %s', model.modelName, req.params.id);
    model.remove({
      _id: req.params['id']
    }).exec(function(err, item) {
      if (err) {
        next(error('DELETE', model, err));
        return;
      }
      res.json({});
    });
  });

var ngaTemplate = `

`;

  // output the ng-admin entity in mera.[baseUrl], we assume baseUrl will be the routes name
  router.get('/nga.js', function(req, res, next) {
  });

  return router;
}

module.exports = mongooseRoute;