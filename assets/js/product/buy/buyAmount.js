/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现购买页-购买金额
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/12/02
 */

'use strict';

var assign = require('object-assign');
var helper = require('js/common/helper');
var alert = require('components/Alert');
var request = require('js/common/request');

var constants = assign({}, __GLOBAL_CONFIG__);

constants.ANNUALIZED_RATE_OF_RETURN = +constants.ANNUALIZED_RATE_OF_RETURN;
constants.MIN_BUY_AMOUNT = +constants.MIN_BUY_AMOUNT;
constants.AVAILABLE_BUY_AMOUNT = +constants.AVAILABLE_BUY_AMOUNT;
constants.REMAINING_DAY = +constants.REMAINING_DAY;

var BUY_PRODUCT_ACTION = '/bxt/productBuy.json';

/**
 * 计算预估收益
 * @todo toFixed 可能存在精度问题
 * @param  {Number} money 投入金额
 * @return {String}       收益
 */
function calcEarnings(money){
  return (+money * constants.ANNUALIZED_RATE_OF_RETURN * constants.REMAINING_DAY / 365).toFixed(2);
}

module.exports = {
  tipsTimer: null,  
  node: {
    $input: $('#buyAmountInput'),
    $allBuy: $('#allBuyAmount'),
    $allAccount: $('#allAccountAmount'),
    $estimateEarnings: $('#estimateEarnings'),
    $submit: $('#buyBtn'),
    $buyTips: $('#buyTips')
  },
  init: function(){
    var node = this.node;
    // 限定输入框类型
    helper.inputTypeOnly(node.$input);

    var defaults = this.defaults = {
      value: parseFloat(this.getMoney()).toFixed(2)
    };

    this._eventMount();

    // 默认值存在则进行一次相关内容的计算
    if(defaults.value !== ''){
      node.$input.trigger('blur');
    }
  },
  _eventMount: function(){
    var node = this.node;

    node.$input.on('focus', function(){
      helper.focusRange(this);
    });
    node.$input.on('input propertychange', $.proxy(this.handleRealTimeChange, this));
    node.$input.on('blur', $.proxy(this.handleChange, this));
    node.$allBuy.on('change', $.proxy(this.handleAllBuy, this));
    node.$submit.on('click', $.proxy(this.handleBuySubmit, this));
  },
  /**
   * 变更提交按钮状态
   */
  _shouldSubmitUpdate: function(){
    var node = this.node;

    if(!this.checkRemainingAvailableCash() || this.getMoney() === ''){
      node.$submit.addClass('btn-disabled');
    } else {
      node.$submit.removeClass('btn-disabled');
    }
  },
  /**
   * 计算相关内容区的显示值
   * @param  {String|Number} value 
   */
  _calcAboutContent: function(value){
    var node = this.node;

    value = value || '';

    // 计算收益
    node.$estimateEarnings.text(
      helper.formatNumber(calcEarnings(value))
    );
  },
  /**
   * 对指定表单控件的数值进行纠错处理
   * @param  {Element} el 
   * @return {Number|String}
   */
  _correct: function(el){
    if(!el || el.nodeType !== 1) return '';

    if(el.value === ''){
      el.value = this.defaults.value;
    }

    var node = this.node,
      min = constants.MIN_BUY_AMOUNT,
      max = constants.AVAILABLE_BUY_AMOUNT,
      value = +el.value,
      tips = '',
      passMsg = '购买金额有效！请在30分钟内完成支付。';


    // 输入小于起投金额，修正为起投金额
    if(value < min){
      value = parseFloat(min).toFixed(2);
      el.value = value;

      tips = '最小起投金额为'+ min +'元，已为您更正';
    }

    // 输入金额大于最大可投金额修正为最大金额
    if(value > max){
      value = parseFloat(max).toFixed(2);
      el.value = value;

      tips = '最大可购买金额为'+ max +'元，已为您更正';
    }

    /**
     * 如果存在提示信息，则优先显示提示信息，两秒后再提示通过信息
     */
    if(tips !== ''){
      this.showTips(tips);
      var that = this;
      clearTimeout(this.tipsTimer);
      this.tipsTimer = setTimeout(function(){
        that.showTips(passMsg);
      }, 2000);
    } else {
      this.showTips(passMsg);
    }

    return value;
  },
  handleAllBuy: function(e){
    var el = e.target,
      $input = this.node.$input,
      value = constants.AVAILABLE_BUY_AMOUNT;

    if(el.checked){
      $input.data('changeBefore', this.getMoney());
    } else {
      value = $input.data('changeBefore');
    }

    $input
      .val(value)
      .trigger('blur');
  },
  handleRealTimeChange: function(e){
    this.hideTips();

    var node = this.node,
      max = constants.AVAILABLE_BUY_AMOUNT,
      min = constants.MIN_BUY_AMOUNT,
      el = e.target,
      value = +el.value;

    // 当输入值小于起投金额，后续的计算以0为参考
    if(value < min){
      value = 0;
    }
    
    // 当输入值大于最大可投金额，后续的计算以最大可投金额为参考
    if(value > max){
      value = max;
    }

    this._changeAllBuyState(value);
    this._calcAboutContent(value);
    this._shouldSubmitUpdate();
  },
  handleChange: function(e){
    this.hideTips();

    var el = e.target,
      value = this._correct(el);

    this._changeAllBuyState(value);
    this._calcAboutContent(value);
    this._shouldSubmitUpdate();
  },
  handleBuySubmit: function(){
    var value = this.getMoney();

    if(value !== ''){
      this.loading();
      var that = this;

      request({
        url: BUY_PRODUCT_ACTION,
        type: 'POST',
        data: {
          prodNo: constants.PRODUCT_ID,
          investAmount: value
        }
      })
      .then(function(data){
        if(window.gsTrackEvent){
          window.gsTrackEvent('变现通确认购买', constants.PRODUCT_NAME, '', '');
        }
        window.location.href = data.url;
      }, function(){
        that.recover();
      });
    }
  },
  /**
   * 变更全选按钮的状态
   * @param  {String|Number} value 
   */
  _changeAllBuyState: function(value){
    var node = this.node;
    value = value || this.getMoney();
    // 设置“全部购买”复选框checked状态
    this.node.$allBuy.prop(
      'checked', 
      value == constants.AVAILABLE_BUY_AMOUNT
    );
  },
  /**
   * 检测是否为可启用状态
   * @todo 主要判断当前剩余金额是否能进行二次变现
   * @return {Boolean}
   */
  checkRemainingAvailableCash: function(){
    var min = constants.MIN_BUY_AMOUNT,
      max = constants.AVAILABLE_BUY_AMOUNT,
      remaining = max - this.getMoney();

    if(remaining <= 0 || remaining >= min){
      return true;
    } else {
      this.showTips('部分购买时，剩余金额必须≥'+ parseFloat(constants.MIN_BUY_AMOUNT).toFixed(2) +'元，否则请全部购买');
      return false;
    }
  },
  /**
   * 显示提示信息
   */
  showTips: function(msg){
    if(msg !== ''){
      this.node.$buyTips.text(msg);
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
   * 关闭提示信息
   * @todo 目前只对提示信息的内容做清空处理
   */
  hideTips: function(){
    this.node.$buyTips.text('');
  },
  loading: function(){
    this.node
      .$submit.addClass('btn-disabled')
      .val('购买中...');
  },
  recover: function(){
    this.node
      .$submit.removeClass('btn-disabled')
      .val('同意协议并购买');
  }
};