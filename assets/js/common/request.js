
'use strict';

var alert = require('components/Alert');

var handler = {
  '0': function(ret){
    return ret.body;
  },
  '10001': function(){
    var value = window.location.pathname + window.location.search;
    $.cookie('pc_curpage', value, {
      path: '/'
    });
    alert('您未登录或登录已失效，请 <a href="/bxt/user/login.html">登录</a>');
  }
}

module.exports = function(options){
  var defer = $.Deferred();

  $.ajax(options).done(function(ret){
    var fn = handler[ret.header.code],
      result = {
        status: ret.header.code,
        message: ret.header.message
      };

    if(fn){
      var data = fn(ret);
      if(data != null){
        defer.resolve(data);
      } else {
        defer.reject(result);
      }
    } else {
      alert(ret.header.message);
      defer.reject(result);
    }
  })
  .fail(function(jqXHR, type, message){
    alert('服务端接口异常！');
    defer.reject({
      status: jqXHR.status,
      message: message
    });
  });

  return defer.promise();
}