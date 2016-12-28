MERA
====

**M**ongoose and **E**xpress built **R**ESTful **A**PI

# Output

As you build a REST API with mera, you get APIs:

- GET /?querya=xx&queryb=xx&start_time=xx&end_time=xx&_filter=xx&_page=x&_perPage=x
  - Fully supported LIST
    - any allowed field can be added as a query field for filtering
    - JSON string can passed in as _filter, if you prefer
    - start_time and end_time to filter a time field if set
    - _page and _perPage for pagination, X-Total-Count in response head for total count
- GET /:id?querya=xx
  - GET by ID, can filter by query as LIST
- POST /
  - use body to create a new doc, all unknown fields will be omitted, and all allowed fields to create
- PUT /:id
  - use body to update
- DELETE /:id
  - to delete one

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

