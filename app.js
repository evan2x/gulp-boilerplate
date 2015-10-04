
var app = require('koa')();
var serve = require('koa-static');
var logger = require('koa-logger');
var compress = require('koa-compress');

app.use(compress());
app.use(logger());
app.use(serve('.'));
app.use(serve('./views'));

app.listen(3000);
