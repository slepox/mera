var mera = require('../index.js'), http=require('http');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/merat');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback) {
  console.log('Connected to mongodb');
});


var route = mera.route('Test', new mera.Schema( { a:String, b:Number }));

var express = require('express'),  logger = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser');

var app = express();
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());

app.use('/', route);

var server = http.createServer(app);

server.listen(3333);



