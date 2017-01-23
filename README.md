MERA
====

**M**ongoose and **E**xpress built **R**ESTful **A**PI

# Output

As you build a REST API with mera, you get APIs:

- GET /?querya=xx&queryb=xx&start_time=xx&end_time=xx&_filter=xx&_page=x&_perPage=x
  - Fully supported List
    - Any allowed field can be added as a query field for filtering
    - JSON string can passed in by _filter, if you prefer
    - Use start_time and end_time to filter a time range if timeFilter is set
    - Use _page and _perPage for pagination, X-Total-Count in response head for total count
    - Use _sortDir (ASC|DESC) and _sortField to sort any allowed field
    - Use format=<xxx> to export a certain format, now supports
      - csv
      - xlsx
      - json (default)
- GET /:id
  - Get by ID, simply enough
- POST /
  - Use JSON body to create a new doc; any unknown field or not allowed field will be omitted
- PUT /:id
  - Use JSON body to update a doc, similar
- DELETE /:id
  - Delete by ID

# Samples

```javascript
// Create a mongoose model as usual
var mongoose = require('mongoose'), Schema = mongoose.Schema;

var personSchema = new Schema({
  firstName: String,
  lastName: String
});

var Person = mongoose.model('Person', personSchema);

// Create the router with the model
var mera = require('mera');
var router = mera(Person, {
  props: // the properties to be filter at listing, creating or updating
  propsMapping: // [api prop]: [model prop], if any to be mapped, id: '_id' is always added
  baseFilter: // used at listing
  defaultSort: // used at listing
  protects: // { LIST: function(req, cb), GET: , PUT: , ... } // to protect a certain method
  _id: // String, used as { options._id: req.params.id } when /:id is passed in
  omitProps: // [String], list of all props to omit at output, 'output' is always omitted
  uploadProps: // {'upload_file_prop': 'prop_to_be_replaced', }
  timeFilter: // 'field_name', to use this field for time search
});

app.use('/persons', router); // use in app, all RESTful APIs are available.
```

# and Frontend?

This API is a perfect companion of [ng-admin](http://ng-admin-book.marmelab.com/), an Angular based management UI.

You should be able to satify 99% of your management requirements in 1 hour for a model if your db is ready.
