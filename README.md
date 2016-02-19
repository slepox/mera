MERA
====

**M**ongoose and **E**xpress built **R**ESTful **A**PI

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
});

app.use('/persons', router); // use in app, all RESTful APIs are available.
```

