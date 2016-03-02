/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 工具栏计算器变现区域
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2016/01/19
 */

var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var helper = require('js/common/helper');

var dayMs = 864e5;
var CONTROL_CLASS_NAME = '.calculator-form-control';
var nowDate = new Date();
var buttonImage = '/assets/img/datepicker_icon.png';

if(window.devicePixelRatio >= 2){
  buttonImage = '/assets/img/datepicker_icon@2x.png';
}

var cash = assign({}, EventEmitter.prototype, {
  init: function(){
    var defaults = this.defaults = {
      cashRate: {
        value: '',
        min: 3,
        max: 18
      },
      cashAmount: {
        value: '',
        min: 100,
        max: null
      },
      cashDays: {
        value: '',
        min: 1,
        max: 9999
      },
      cashDate: {
        value: '',
        min: nowDate,
        max: null
      },
      useCashDate: {
        checked: false
      }
    }

    var node = this.node = {
      $el: $('#cashPlate'),
      $cashRate: $('#calculatorCashRate'),
      $cashDays: $('#calculatorCashDays'),
      $cashDate: $('#calculatorCashDate'),
      $useCashDate: $('#calculatorUseCashDate'),
      $cashAmount: $('#calculatorCashAmount'),
      $cashDaysContainer: $('#calculatorCashDaysContainer'),
      $cashDateContainer: $('#calculatorCashDateContainer'),
      $tips: $('#calculatorTips')
    }

    // 限制变现利率输入格式
    helper.inputTypeOnly(node.$cashRate, {
      regex: /^\d{1,2}(?:\.\d{0,2})?$/
    });

    this.cashRateRange = helper.inputRange(node.$cashRate, {
      min: defaults.cashRate.min,
      max: defaults.cashRate.max
    });

    // 限制变现金额输入格式
    helper.inputTypeOnly(node.$cashAmount);

    this.cashAmountRange = helper.inputRange(node.$cashAmount, {
      min: defaults.cashAmount.min,
      max: defaults.cashAmount.max
    });

    helper.inputTypeOnly(node.$cashDays, {
      regex: /^[1-9]\d{0,3}$/,
      decimals: 0
    });

    this.cashDaysRange = helper.inputRange(node.$cashDays, {
      min: defaults.cashDays.min,
      max: defaults.cashDays.max
    });

    node.$useCashDate.prop('checked', defaults.useCashDate.checked);

    var that = this;

    node.$cashDate
      .val(defaults.cashDate.value)
      .datepicker({
        showOn: 'both',
        buttonImage: buttonImage,
        dateFormat: 'yy-mm-dd',
        minDate: defaults.cashDate.min,
        maxDate: defaults.cashDate.max,
        onSelect: function(){
          that.emitChange();
        }
      });

    this._initEvents();
  },
  _initEvents: function(){
    var that = this,
      node = this.node;

    node.$cashRate.on('blur', function(){
      that.emitChange();
    });

    node.$cashDays.on('blur', function(){
      if(!node.$useCashDate.prop('checked')){
        that.emitChange();
      }
    });

    node.$useCashDate.on('change', function(){
      if(this.checked){
        node.$cashDateContainer.show();
        node.$cashDaysContainer.hide();
      } else {
        node.$cashDateContainer.hide();
        node.$cashDaysContainer.show();
      }
      that.emitChange();
    });
  },
  /**
   * 发起一个change事件，表示当前变现模块有变更
   */
  emitChange: function(){
    this.emit('change');
  },
  /**
   * 设置变现最小日期
   * @param {String} date 日期
   */
  setMinCashDate: function(date){
    this.node.$cashDate.datepicker('option', 'minDate', date);
    this.emitChange();
  },
  /**
   * 设置变现最大日期
   * @param {String} date 日期
   */
  setMaxCashDate: function(date){
    this.node.$cashDate.datepicker('option', 'maxDate', date);
    this.emitChange();
  },
  /**
   * 设置变现最大利率
   * @param {Number} value 预期年化收益率
   */
  setMaxCashRate: function(value){
    if(!value) return;
    var node = this.node,
      max = Math.min(18, 1.5 * value).toFixed(2),
      cur = +node.$cashRate.val();

    if(cur > max){
      node.$cashRate.val(max);
      this.emitChange();
    }

    this.cashRateRange.setMax(max);
  },
  /**
   * 设置最大持有天数
   * @param {String} value
   */
  setMaxCashDays: function(value){
    if(!value) return;
    var node = this.node,
      cur = +node.$cashDays.val();

    if(cur > +value){
      node.$cashDays.val(value);
      this.emitChange();
    }
    this.cashDaysRange.setMax(value);
  },
  /**
   * 设置最大可变现金额
   * @param {Number|Null} value
   */
  setMaxCashAmount: function(value){
    var node = this.node;

    if(!value){
      value = null;
    }

    if(value == null){
      node.$tips.text('');
    } else {
      node.$tips.text('最高变现金额：'+ value +'元');
    }

    if(value){
      var cur = +node.$cashAmount.val();

      if(cur > +value){
        node.$cashAmount.val(value);
        this.emitChange();
      }
    }

    this.cashAmountRange.setMax(value);
  },
  /**
   * 取最大可变现金额
   * @return {Number}
   */
  getMaxCashAmount: function(){
    return this.cashAmountRange.getMax();
  },
  /**
   * 清除变现模块错误提示
   */
  clearError: function(){
    this.node.$el.find(CONTROL_CLASS_NAME).removeClass('error');
  },
  /**
   * 是否变现
   * @return {Boolean}
   */
  shouldCash: function(){
    var node = this.node,
      valids = [
        node.$cashRate,
        node.$useCashDate.prop('checked') ? node.$cashDate : node.$cashDays,
        node.$cashAmount
      ];

    var count = valids.filter(function($item){
      if($item.val() === ''){
        return $item;
      }
    }).length;


    if(count < valids.length){
      return true;
    }

    return false;
  },
  /**
   * 验证当前模块
   * @return {Boolean} true 表示验证通过， false 验证未通过
   */
  validate: function(){
    var node = this.node,
      valids = [
        node.$cashRate,
        node.$useCashDate.prop('checked') ? node.$cashDate : node.$cashDays,
        node.$cashAmount
      ];

    this.clearError();

    // 用户所有可填入项都为空也表示通过当前验证
    if(!this.shouldCash()){
      return true;
    }

    valids.forEach(function($item){
      if($item.val() === ''){
        $item.parents(CONTROL_CLASS_NAME).addClass('error');
      }
    });

    return valids.every(function($item){
      return $item.val() !== '';
    });
  },
  /**
   * 以对象字面量的方式将当前模块的所有值进行输出
   * @return {Object} object
   * @return {String} object.cashRate 变现利率
   * @return {String} object.cashDays 持有天数
   * @return {String} object.cashDate 变现日期
   * @return {Boolean} object.useCashDate 是否使用变现日期
   * @return {String} object.cashAmount 变现金额
   */
  toPlainObject: function(){
    var node = this.node;

    return {
      cashRate: node.$cashRate.val(),
      cashDays: node.$cashDays.val(),
      cashDate: node.$cashDate.val(),
      useCashDate: node.$useCashDate.prop('checked'),
      cashAmount: node.$cashAmount.val()
    }
  },
  /**
   * 重置变现模块
   */
  reset: function(){
    var node = this.node,
      defaults = this.defaults;

    this.clearError();

    node.$cashRate.val(defaults.cashRate.value);
    node.$cashDays.val(defaults.cashDays.value);
    node.$cashDate.datepicker('setDate', defaults.cashDate.value);
    node.$useCashDate.prop('checked', defaults.useCashDate.checked).trigger('change');
    node.$cashAmount.val(defaults.cashAmount.value);
    node.$tips.text('');

    this.cashRateRange.setMax(defaults.cashRate.max);
    this.cashAmountRange.setMax(defaults.cashAmount.max);
    this.cashDaysRange.setMax(defaults.cashDays.max);
  }
});

module.exports = cash;
