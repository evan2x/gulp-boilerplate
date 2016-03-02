/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 项目私有工具包
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var assign = require('object-assign');
var native_slice = Array.prototype.slice;
var EventEmitter = require('events').EventEmitter;

/**
 * 继承
 * @param  {Function} subClass   子类
 * @param  {Function} superClass 父类
 * @return {Function}
 */
function inherits(subClass, superClass){
  var originProto = subClass.prototype,
    F = function(){};

  F.prototype = superClass.prototype;
  var proto = subClass.prototype = new F;

  // 将子类原有的方法/属性拷贝回去
  assign(proto, originProto);

  // 修正构造函数
  proto.constructor = subClass;

  // 提供一个访问父类prototype的方式，主要用于super调用
  proto._super = function(name){
    var method = superClass.prototype[name];

    if(!method){
      throw new TypeError('Cannot read property \'' + name + '\' of undefined');
    }

    if(typeof method === 'function'){
      return method.apply(this, native_slice.call(arguments, 1));
    } else {
      return method;
    }
  };

  return subClass;
};

exports.inherits = inherits;

/**
 * store creator
 * @param  {Object} data store初始数据
 * @return {Object} store
 * @return {Function} store.dispatch
 * @return {Function} store.subscribe
 * @return {Function} store.toPlainObject
 */
function StoreCreator(data){
  this._callbacks = [];

  this._data = data || {};
}

StoreCreator.prototype = {

  dispatch: function(payload){
    if(!payload.type) return;

    if(payload.data) {
      assign(this._data, payload.data);
    }

    for(var i = 0, callback; callback = this._callbacks[i++];){
      callback(payload.type);
    }
  },

  subscribe: function(fn){
    if(typeof fn !== 'function') return;
    for(var i = 0, callback; callback = this._callbacks[i++];){
      if(fn === callback) return;
    }

    this._callbacks.push(fn);
  },

  toPlainObject: function(){
    return assign({}, this._data);
  }
}

inherits(StoreCreator, EventEmitter);

exports.StoreCreator = StoreCreator;

/**
 * CSS3的动画属性检测
 * @return {Object} object
 * @return {String} object.prefix
 * @return {Boolean} object.supportTransition
 * @return {String} object.animationEnd
 * @return {String} object.transitionEnd
 */
exports.css = (function(){
  var vendors = ['webkit', 'moz', 'o'],
    el = document.createElement('div'),
    style = el.style;

  var eventPrefix = '',
    props = {
      prefix: '',
      supportTransition: false,
    },
    normalizeEvent = function(property){
      if(eventPrefix){
        return (eventPrefix + property);
      } else {
        return property.toLowerCase();
      }
    };

  if('transitionProperty' in style){
    props.prefix = eventPrefix = '';
    props.supportTransition = true;
  } else {
    for(var i = 0; i < vendors.length; i++){
      if((vendors[i] + 'TransitionProperty') in style){
        eventPrefix = vendors[i];
        props.prefix = '-' + eventPrefix + '-';
        props.supportTransition = true;
        break;
      }
    }
  }

  props.animationEnd = normalizeEvent('AnimationEnd');
  props.transitionEnd = normalizeEvent('TransitionEnd');

  el = style = null;

  return props;
}());

function isRegExp(reg){
  return Object.prototype.toString.call(reg) === '[object RegExp]';
}

/**
 * 输入框类型限制，默认限制为正数且仅允许两位小数
 * @param  {jQuery Object} $el jQuery对象
 * @param {Object} options 参数
 * @param {RegExp} options.regex 校验输入类型的正则
 * @param {Number} options.decimals 值保留的小数
 */
var isRewrite = false;
exports.inputTypeOnly = function($el, options){
    if(!($el && $el.jquery)) return;
    options = options || {};

    if(!isRegExp(options.regex)){
      options.regex = /^\d+(?:\.\d{0,2})?$/;
    }

    if(!$.isNumeric(options.decimals)){
      options.decimals = 2;
    }
    if(!isRewrite){
      var originVal = $.fn.val,
        originProp = $.fn.prop;

      $.fn.val = function(value){
        if(typeof value !== 'undefined'){
          this.data('__cache__', value);
        }
        return originVal.apply(this, arguments);
      }

      $.fn.prop = function(name, value){
        if(name === 'value' && typeof value !== 'undefined'){
          this.data('__cache__', value);
        }
        return originProp.apply(this, arguments);
      }
      isRewrite = true;
    }

    var changeHandler = function(){
      var cache = $.data(this, '__cache__') || '';
      if(this.value !== '' && !options.regex.test(this.value)){
          this.value = cache;
      }
      $.data(this, '__cache__', $.trim(this.value));
    }

    $el.data('__ie_change__', false);
    setTimeout(function(){
      $el.data('__cache__', $.trim($el.val()));
    }, 0);
    $el
    .on('focus', function(){
      $.data(this, '__ie_change__', true);
    })
    .on('input', changeHandler)
    .on('propertychange', function(){
        setTimeout(function(){
          if($.data(this, '__ie_change__')){
            changeHandler.apply(this, arguments);
          }
        }.bind(this), 0);
    })
    .on('blur', function(){
      $.data(this, '__ie_change__', false);
      setTimeout(function(){
        var v = $.trim(this.value);
        if(v !== '' && options.regex.test(v)){
          v = parseFloat(v).toFixed(options.decimals);
          this.value = v;
          $.data(this, '__cache__', v);
        }
      }.bind(this), 0);
    });
}

exports.inputRange = function($el, range){
  if(!($el && $el.jquery)) return;

  $el.on('blur', function() {
    if(this.value === '') return;
    var v = +$.trim(this.value);
    // if(v === 0) return;

    if (range.min != null) {
      if(v < range.min){
        this.value = range.min;
      }
    }

    if (range.max != null) {
      if(v > range.max){
        this.value = range.max;
      }
    }
  }); 

  return {
    setMin: function(value){
      if(+$.trim($el.val()) < +value){
        $el.val(value);
      }
      range.min = value;
    },
    setMax: function(value){
      if(+$.trim($el.val()) > +value){
        $el.val(value);
      }
      range.max = value;
    },
    getMin: function(){
      return range.min;
    },
    getMax: function(){
      return range.max;
    }
  }
}

/**
 * 格式化数字，增加千分位符号
 * @param  {Number|String} num
 * @return {String}
 */
exports.formatNumber = function(num){
  num = '' + num;

  var str = '',
    ret = num.split('.');

  if(ret[0]){
    str = ret[0].replace(/\B(?=(?:\d{3})+$)/g, ',');

    if(ret[1]){
      str += '.' + ret[1];
    }
  }

  return str;
}

/**
 * 文本框/文本域获取焦点时选中的范围设置
 * @param  {Element|jQuery Object} el
 * @param  {Number} start 范围起始值
 * @param  {Number} end   范围结束值
 */
exports.focusRange = function(el, start, end){
  if(!el) return;

  if(!el.jquery){
    el = $(el);
  }

  start = start || 0;

  el.each(function(){
    var tagName = this.tagName.toLowerCase();
    if(tagName === 'input' || tagName === 'textarea'){
      end = end || this.value.length;

      if(this.setSelectionRange){
        this.setSelectionRange(start, end);
      } else if(this.createTextRange){
        var range = this.createTextRange();
        range.moveStart('character', start);
        range.moveEnd('character', end);
        range.select();
      }
    }
  });
}
