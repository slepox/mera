var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  _ = require('underscore'),
  moment = require('moment'),
  debug = require('debug')('mera'),
  XLSX = require('xlsx'),
  os = require('os'),
  path = require('path');

function mongooseRoute(model, options) {
  var router = express.Router();

  var options = options || {},
    omitProps = ['output'].concat(options.omitProps),
    props = options.props || _.keys(model.schema.tree).filter(e => !/^_/.test(e)).filter(e => omitProps.indexOf(e) == -1),
    propsMapping = _.extend({ 'id': '_id' }, options.propsMapping),
    _id = options._id || '_id',
    uploadProps = options.uploadProps || {};

  function error(method, err, statusCode) {
    var msg = 'Failed to ' + method + ' ' + model.modelName + ' : ' + err;
    var retErr = new Error(msg);
    err.statusCode = statusCode || 500;
    debug('err: %j', retErr);
    return retErr;
  }

  function convert(data) {
    _.each(_.keys(propsMapping), k => {
      if (data[k] && propsMapping[k] != k) {
        data[propsMapping[k]] = data[k];
        delete data[k];
      }
    });
    return data;
  }

  function output(item) {
    if (!item) return {};
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

  function replaceUploaded(req, res, next) {
    if (!_.isEmpty(uploadProps)) {
      _.keys(uploadProps).forEach(k => {
        if (req.body[k]) {
          req.body[uploadProps[k]] = req.body[k];
        }
      });
    }
    next();
  }

  function pickFilters(base, raw) {
    _.keys(raw).forEach(k => {
      var secs = k.split('.'), bk = secs.shift(1);
      if (props.indexOf(bk) == -1)
        return;
      base[k] = raw[k];
    });
    return base;
  }

  function Workbook() {
    if (!(this instanceof Workbook)) return new Workbook();
    this.SheetNames = [];
    this.Sheets = {};
  }

  function datenum(v, date1904) {
    if (date1904) v += 1462;
    var epoch = Date.parse(v);
    return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
  }

  function sheet_from_array_of_arrays(data, opts) {
    var ws = {};
    var range = { s: { c: 10000000, r: 10000000 }, e: { c: 0, r: 0 } };
    for (var R = 0; R != data.length; ++R) {
      for (var C = 0; C != data[R].length; ++C) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;
        var cell = { v: data[R][C] };
        if (cell.v == null) continue;
        var cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

        if (typeof cell.v === 'number') cell.t = 'n';
        else if (typeof cell.v === 'boolean') cell.t = 'b';
        else if (cell.v instanceof Date) {
          cell.t = 'n'; cell.z = XLSX.SSF._table[14];
          cell.v = datenum(cell.v);
        }
        else cell.t = 's';

        ws[cell_ref] = cell;
      }
    }
    if (range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);
    return ws;
  }

  function formatToXlsx(data, name) {
    var ws_name = "SheetJS";
    var wb = new Workbook(), ws = sheet_from_array_of_arrays(data);

    /* add worksheet to workbook */
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;

    var tempFile = path.join(os.tmpdir(), (name || (new Date().toString() + '.xlsx')));
    XLSX.writeFile(wb, tempFile);
    return tempFile;
  }

  function formatToCsv(rows, head) {
    var lines = []
    if (head) {
      lines.push(head.map(e => `"${e}"`).join(','))
    }
    rows.forEach(row => {
      lines.push(row.map(e => `"${e}"`).join(','))
    })
    return lines.join('\r\n')
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
    var filter = _.extend({}, options.baseFilter);

    // regard _filter in query firstly
    if (req.query._filters) {
      try {
        pickFilters(filter, JSON.parse(req.query._filters));
      } catch (e) {
        debug('not valid _filter although present: %j', req.query._filter);
      }
    } else {
      pickFilters(filter, req.query);
    }
    filter = convert(filter);
    _.extend(filter, getTimeFilter(req.query));

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
      var items = [], limit = Math.min(lo.limit, 1000), skip = lo.skip;

      function findBatch(cb) {
        model.find(filter).sort(lo.sort).skip(skip).limit(limit).exec(function(errB, itemsB) {
          if (errB) return cb(errB);
          items = items.concat(itemsB)
          // if get all items, finish batch
          if (items.length >= lo.limit) {
            return cb(null, items)
          }
          // if current fetch is less than a batch, which means no more items to get, finish batch
          if (itemsB.length < limit) {
            return cb(null, items);
          }
          // else, continue
          skip = skip + itemsB.length;
          findBatch(cb)
        });
      }
      findBatch((err2, items) => {
        if (err2) {
          return next(error('LIST', err2));
        }
        if (req.query.format == 'csv') {
          res.set('Content-Type', 'text/csv');
          var rows = items.map(e => props.map(k => e[k]));
          var csvout = formatToCsv(rows, props);
          res.send(csvout);
        } else if (req.query.format == 'xlsx') {
          var rows = items.map(e => props.map(k => e[k]));
          rows.unshift(props);
          var wbout = formatToXlsx(rows, model.modelName + '_' + new Date().getTime().toString() + '.xlsx');
          res.sendfile(wbout);
        } else {
          res.set('X-Total-Count', num).json(items.map(output));
        }
      })
    });
  });

  router.post('/', replaceUploaded, function(req, res, next) {
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

  router.put('/:id', replaceUploaded, function(req, res, next) {
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
