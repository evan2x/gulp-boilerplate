/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现专区页-变现历史
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');

var constants = assign({}, __GLOBAL_CONFIG__);

constants.ANNUALIZED_RATE_OF_RETURN = +constants.ANNUALIZED_RATE_OF_RETURN;
constants.MIN_INTEREST_RATE = +constants.MIN_INTEREST_RATE;
constants.MAX_INTEREST_RATE = +constants.MAX_INTEREST_RATE;

/**
 * 变现利率
 * @type {Object}
 */
module.exports = assign(new EventEmitter, {
  tipsTimer: null,
  node: {
    $input: $('#interestRates'),
    $minus: $('#minusInterestRates'),
    $plus: $('#plusInterestRates'),
    $rateTips: $('#rateTips')
  },

  init: function(){
    // 设置变现利率的输入类型以及初始值
    helper.inputTypeOnly(
      this.node.$input, 
      constants.ANNUALIZED_RATE_OF_RETURN * 100
    );

    this._eventMount();
  },

  _eventMount: function(){
    var node = this.node;

    node.$minus.on('click', $.proxy(this.handleMinusBtn, this));
    node.$plus.on('click', $.proxy(this.handlePlusBtn, this));
    node.$input.on('input propertychange', $.proxy(this.handleRealTimeChange, this));
    node.$input.on('blur', $.proxy(this.handleChange, this));
  },
  /**
   * 对指定表单控件的数值进行纠错处理
   * @param  {Element} el 
   * @return {Number|String}
   */
  _correct: function(el){
    if(!el || el.nodeType !== 1 || el.value === '') return '';
    var min = constants.MIN_INTEREST_RATE,
      max = constants.MAX_INTEREST_RATE,
      node = this.node,
      value = el.value / 100,
      tips = '',
      valueFormat = '';

    if(value < min){
      value = min;
      valueFormat = (value * 100).toFixed(2)
      el.value = valueFormat;

      tips = '已调整为最小变现利率'+ valueFormat +'%';
    }

    // 修正最大利率
    if(value > max){
      value = max;
      valueFormat = (value * 100).toFixed(2);
      el.value = valueFormat;

      tips = '已调整为最大变现利率'+ valueFormat +'%';
    }

    // 提示信息不为空时显示提示信息，并启用定时器指定2秒后关闭提示
    if(tips !== ''){
      this.showTips(tips);
      var that = this;
      clearTimeout(this.tipsTimer);
      this.tipsTimer = setTimeout(function(){
        that.hideTips();
      }, 2000);
    }

    return value;
  },
  /**
   * 检测是否达到最小利率
   * @return {Boolean}   true表示已达到最小值，false表示未达到
   */
  _checkMinRate: function(){
    var v = this.getRate() / 100;
    if(isNaN(v)) return false;
    
    return v <= constants.MIN_INTEREST_RATE;
  },
  /**
   * 检测是否达到最大利率
   * @return {Boolean}   true表示已达到最大值，false表示未达到
   */
  _checkMaxRate: function(){
    var v = this.getRate() / 100;
    if(isNaN(v)) return false;

    return v >= constants.MAX_INTEREST_RATE;
  },
  /**
   * 利率控制按钮状态检测
   * @param  {Number} v 检测值
   */
  _shouldBtnUpdate: function(){
    var node = this.node,
      value = this.getRate();

    if(this._checkMinRate(value)){
      node.$minus.addClass('disabled');
    } else {
      node.$minus.removeClass('disabled');
    }

    if(this._checkMaxRate(value)){
      node.$plus.addClass('disabled');
    } else {
      node.$plus.removeClass('disabled');
    }
  },
  handleRealTimeChange: function(e){
    var el = e.target;

    this._shouldBtnUpdate();

    this.emit('rate:change', {
      value: el.value
    });
  },
  handleChange: function(e){
    var el = e.target,
      value = this._correct(el);

    var data = {value: value};

    this.emit('rate:change', data);
    this.emit('rate:blur', data);
    
    this._shouldBtnUpdate();
  },
  handleMinusBtn: function(){
    var value = this.getRate(),
      calcPrev = (value - 0.01).toFixed(2);

    if(!this._checkMinRate(value)){
      this.node.$input.val(calcPrev);
      this.node.$input.trigger('blur');
    }
  },
  handlePlusBtn: function(){
    var value = this.getRate(),
      calcNext = (value + 0.01).toFixed(2);

    if(!this._checkMaxRate(value)){
      this.node.$input.val(calcNext);
      this.node.$input.trigger('blur');
    }
  },
  /**
   * 显示提示信息
   */
  showTips: function(msg){
    if(msg !== ''){
      this.node.$rateTips.text(msg);
    }
  },
  /**
   * 关闭提示信息
   * @todo 目前只对提示信息的内容做清空处理
   */
  hideTips: function(){
    this.node.$rateTips.text('');
  },
  getRate: function(){
    var value = $.trim(this.node.$input.val());
    if(value === '') return '';
    return +value;
  }
});