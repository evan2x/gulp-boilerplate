/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现专区页-变现金额
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var assign = require('object-assign');
var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');
var alert = require('components/Alert');
var request = require('js/common/request');

var constants = assign({}, __GLOBAL_CONFIG__);

constants.SERVICE_CHARGE_RATE = +constants.SERVICE_CHARGE_RATE;
constants.DISCOUNT_RATE = +constants.DISCOUNT_RATE;

var CALC_AVAILABLE_CASH = '/bxt/pc/cashAjax.json';

/**
 * 计算手续费
 * @param  {String|Number} money 
 * @return {Number}       
 */
function calcCharge(money){
  return (+money * constants.SERVICE_CHARGE_RATE * constants.DISCOUNT_RATE).toFixed(2);
}

/**
 * 预期到账金额
 * @param  {String|Number} money 
 * @return {Number}       
 */
function calcEstimateAmount(money){
  return (+money - calcCharge(money)).toFixed(2);
}

/**
 * 变现金额
 * @type {Object}
 */
module.exports = assign(new EventEmitter, {
  calcTimer: null,
  tipsTimer: null,
  _minAvailableCash: constants.MIN_AVAILABLE_CASH,
  _maxAvailableCash: constants.MAX_AVAILABLE_CASH,
  node: {
    $input: $('#cashAmount'),
    $allCash: $('#allCash'),
    $charge: $('#charge'),
    $estimateAmount: $('#estimateAmount'),
    $amountTips: $('#amountTips'),
    $maxEnableCash: $('#maxEnableCash')
  },
  init: function(){
    // 限制变现金额输入框的可输入类型
    helper.inputTypeOnly(this.node.$input);
    
    this._eventMount();
  },
  /**
   * 挂载事件
   */
  _eventMount: function(){
    var node = this.node;

    node.$input.on('input propertychange', $.proxy(this.handleRealTimeChange, this));
    node.$input.on('blur', $.proxy(this.handleChange, this));
    node.$allCash.on('change', $.proxy(this.handleAllCash, this));
  },
  /**
   * 计算相关内容区的显示值
   * @param  {String|Number} value 
   */
  _calcAboutContent: function(value){
    var node = this.node;

    value = value || '';

    // 计算手续费
    node.$charge.text(
      calcCharge(value)
    );

    // 计算到账金额
    node.$estimateAmount.text(
      calcEstimateAmount(value)
    );
  },
  /**
   * 对指定表单控件的数值进行纠错处理
   * @param  {Element} el 
   * @return {Number|String}
   */
  _correct: function(el){
    if(!el || el.nodeType !== 1 || el.value === '') return '';
    var min = this._minAvailableCash,
      max = this._maxAvailableCash,
      value = +el.value,
      tips = '';

    if(value < min){
      value = parseFloat(min).toFixed(2);
      el.value = value;

      tips = '最小可变现金额为'+ value +'元，已为您更正';
    }

    if(value > max){
      value = parseFloat(max).toFixed(2);
      el.value = value;

      tips = '最大可变现金额为'+ value +'元，已为您更正';
    }

    /**
     * 如果存在提示信息，则优先显示提示信息，两秒后清除提示信息
     */
    if(tips !== ''){
      this.showTips(tips);
      var that = this;
      clearTimeout(this.tipsTimer);
      this.tipsTimer = setTimeout(function(){
        that.hideTips();
      }, 2000);
    } else {
      this.hideTips();
    }

    return value;
  },
  /**
   * 变更全选按钮的状态
   * @param  {String|Number} value 
   */
  _changeAllCashState: function(value){
    var node = this.node;
    value = value || this.getMoney();
    // 设置“全部购买”复选框checked状态
    this.node.$allCash.prop(
      'checked', 
      value == this._maxAvailableCash
    );
  },
  handleRealTimeChange: function(e){
    this.hideTips();

    var el = e.target,
      value = el.value;

    this.emit('money:change', {
      value: value
    });

    // 超过最大变现金额，调整为最大值后参与相关依赖的计算
    if(+value > this._maxAvailableCash){
      value = this._maxAvailableCash;
    }

    this._calcAboutContent(value);
    this._changeAllCashState(value);
  },
  handleChange: function(e){
    this.hideTips();

    var el = e.target,
      value = this._correct(el);

    var data = {value: value};

    this.emit('money:change', data);
    this.emit('money:blur', data);
    
    this._calcAboutContent(value);
    this._changeAllCashState(value);
  },
  handleAllCash: function(e){
    var el = e.target,
      $input = this.node.$input,
      value = this._maxAvailableCash;

    if(el.checked){
      $input.data('changeBefore', $input.val());
    } else {
      value = $input.data('changeBefore');
    }

    $input
      .val(value)
      .trigger('blur');
  },
  /**
   * 显示提示信息
   */
  showTips: function(msg){
    if(msg !== ''){
      this.node.$amountTips.text(msg);
    }
  },
  /**
   * 关闭提示信息
   * @todo 目前只对提示信息的内容做清空处理
   */
  hideTips: function(){
    this.node.$amountTips.text('');
  },
  /**
   * 检测是否为可启用状态
   * @todo 主要判断当前剩余金额是否能进行二次变现
   * @return {Boolean}
   */
  checkRemainingAvailableCash: function(){
    var min = +this._minAvailableCash,
      max = +this._maxAvailableCash,
      remaining = max - this.getMoney();


    if(remaining <= 0 || remaining >= min){
      return true;
    } else {
      this.showTips('部分变现时，变现后剩余金额必须≥'+ parseFloat(this._minAvailableCash).toFixed(2) +'元');
      return false;
    }
  },
  /**
   * 取当前输入框的金额
   * @return {Number} 
   */
  getMoney: function(){
    var value = $.trim(this.node.$input.val());
    if(value === '') return '';
    return +value;
  },
  /**
   * 根据利率刷新最大可投金额
   * @param  {Number|String} value 变现利率
   */
  refreshMaxAvailableCash: function(value){
    var that = this,
      node = this.node;
    clearTimeout(this.calcTimer);
    this.calcTimer = setTimeout(function(){
      request({
        url: CALC_AVAILABLE_CASH,
        data: {
          dueProperty: constants.EXPIRE_ASSETS,
          cashRates: value,
          investNo: constants.INVEST_ID,
          prodType: constants.PRODUCT_TYPE,
          channelSource: constants.CHANNEL_SOURCE,
          dueDate: constants.EXPIRE_DATE,
          yearIrr: constants.ANNUALIZED_RATE_OF_RETURN
        }
      })
      .then(function(data){
        var maxEnableCash = +data.maxEnableCash;
        that._maxAvailableCash = maxEnableCash;
        // 触发输入框的blur事件，重新计算变现金额
        node.$input.trigger('blur');
        node.$maxEnableCash.text(helper.formatNumber(maxEnableCash.toFixed(2)));
        that.emit('money:maxChange', {
          maxAvailableCash: maxEnableCash
        });
      });

    }, 300);
  }
});