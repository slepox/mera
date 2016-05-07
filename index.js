var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  _ = require('underscore'),
  moment = require('moment'),
  debug = require('debug')('mera');

function mongooseRoute(model, options) {
  var router = express.Router();

  var options = options || {},
    omitProps = ['output'].concat(options.omitProps),
    props = options.props || _.keys(model.schema.tree).filter(e => !/^_/.test(e)).filter(e => omitProps.indexOf(e) == -1),
    propsMapping = _.extend({ 'id': '_id' }, options.propsMapping),
    _id = options._id || '_id';

  function error(method, err, statusCode) {
    var msg = 'Failed to ' + method + ' ' + model.modelName + ' : ' + err;
    var retErr = new Error(msg);
    err.statusCode = statusCode || 500;
    debug('err: %j', retErr);
    return retErr;
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
    if (!item)  return {};
    var output = {};
    props.forEach(p => { output[p] = item[p] }); // item can have virtual props so they need to be assigned one by one.
    return output;
  }

  // time filter works in such a way:
  // if start is given, only look at end, and start/end are parsed literally by moment.js, gte start, and lt end
  // otherwise look at start_time and then end_time
  // so if given start and end_time, only start takes effects
  // a special handle on end_time is if YYYY-MM-DD is given, we regard it as a full day included
  function getTimeFilter(rawFilter) {
    if (!options.timeFilter) {
      return null;
    }
    var f = {};
    if (rawFilter.start) {
      f.$gte = moment(rawFilter.start).toDate();
      if (rawFilter.end) {
        f.$lt = moment(rawFilter.end).toDate();
      }
    } else if (rawFilter.start_time) {
      f.$gte = moment(rawFilter.start_time).toDate();
      if (rawFilter.end_time) {
        if (/[0-9]{4,4}-[0-9]{2,2}-[0-9]{2,2}/.test(rawFilter.end_time)) {
          f.$lt = moment(rawFilter.end_time).add(1, 'day').startOf('day').toDate();
        } else {
          f.$lt = moment(rawFilter.end_time).toDate();
        }
      }
    }
    if (_.isEmpty(f)) {
      return null;
    }
    var timeFilter = {};
    timeFilter[options.timeFilter] = f;
    return timeFilter;
  }

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
    var filter = null;

    // regard _filter in query firstly
    if (req.query._filters) {
      try {
        filter = _.pick(JSON.parse(req.query._filters), props);
        _.extend(filter, getTimeFilter(req.query._filter));
      } catch (e) {
        debug('not valid _filter although present: %j', req.query._filter);
      }
    }
    // if _filter not present, look for all direct props, which not starting with _
    if (!filter) {
      filter = _.pick(req.query, props);
      _.extend(filter, getTimeFilter(req.query));
    }

    filter = _.extend(convert(filter), options.baseFilter);
    debug('List %s by filter %j', model.modelName, filter);

    // listOptions buildup
    var lo = {
      limit: parseInt(req.query._perPage) || 0
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
        return next(error('LIST', err));
      }
      model.find(filter).skip(lo.skip).limit(lo.limit).sort(lo.sort).exec(function(err2, items) {
        if (err2) {
          return next(error('LIST', err2));
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
        return next(error('POST', err));
      }
      res.json(output(item));
    });
  });

  router.use('/:id', function(req, res, next) {
    req.id_filter = {};
    req.id_filter[options._id || '_id'] = req.params.id;
    next();
  });

  router.get('/:id', function(req, res, next) {
    debug('Get model %s by id %s', model.modelName, req.params.id);
    model.findOne(req.id_filter).exec(function(err, item) {
      if (err) {
        return next(error('GET', err));
      }
      if (!item) {
        return next();
      }
      res.json(output(item));
    });
  });

  router.put('/:id', function(req, res, next) {
    var data = convert(req.body);
    debug('Put to model %s, id %s by data %j', model.modelName, req.params.id, data);

    model.findOne(req.id_filter).exec(function(err, item) {
      if (err) {
        return next(error('PUT', err));
      }
      if (!item) {
        return next();
      }
      _.extend(item, data);
      item.save(function(err) {
        if (err) {
          return next(error('PUT', err));
        }
        res.json(output(item));
      });
    });
  });

  router.delete('/:id', function(req, res, next) {
    debug('delete model %s by id %s', model.modelName, req.params.id);

    model.remove(req.id_filter).exec(function(err, item) {
      if (err) {
        return next(error('DELETE', err));
      }
      res.json(output(item));
    });
  });

  return router;
}

module.exports = mongooseRoute;
