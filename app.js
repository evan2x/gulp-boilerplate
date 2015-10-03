
var app = require('koa')();
var serve = require('koa-static');
var logger = require('koa-logger');

app.use(logger());
app.use(serve('.'));
app.use(serve('./views'));

app.listen(3000);
