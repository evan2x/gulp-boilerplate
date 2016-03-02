/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 工具栏计算器模块购买金额区域
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2016/01/19
 */

var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var helper = require('js/common/helper');
var request = require('js/common/request');

var dayMs = 864e5;
var WORK_DAYS_ACTION = '/api/workDays.json';
var CONTROL_CLASS_NAME = '.calculator-form-control';
var nowDate = new Date();
var buttonImage = '/assets/img/datepicker_icon.png';

if(window.devicePixelRatio >= 2){
  buttonImage = '/assets/img/datepicker_icon@2x.png';
}

var investment = assign({}, EventEmitter.prototype, {
  init: function(){
    var that = this;

    var defaults = this.defaults = {
      annualRate: {
        value: '',
        min: 3,
        max: 18
      },
      investmentDate: {
        value: $.datepicker.formatDate('yy-mm-dd', nowDate),
        min: new Date(2014, 0, 1),
        max: nowDate
      },
      dueDate: {
        value: '',
        min: nowDate
      },
      dueDays: {
        value: 365,
        min: 1,
        max: 9999
      },
      useDueDate: {
        checked: false
      },
      buyAmount: {
        value: '',
        min: 100,
        max: 5e5
      }
    }

    var node = this.node = {
      $el: $('#investmentPlate'),
      $annualRate: $('#calculatorAnnualRate'),
      $investmentDate: $('#calculatorInvestmentDate'),
      $investmentDateBtn: $('#calculatorInvestmentDateBtn'),
      $dueDays: $('#calculatorDueDays'),
      $dueDate: $('#calculatorDueDate'),
      $useDueDate: $('#calculatorUseDueDate'),
      $buyAmount: $('#calculatorBuyAmount'),
      $dueDaysContainer: $('#calculatorDueDaysContainer'),
      $dueDateContainer: $('#calculatorDueDateContainer')
    };

    // 限制比率输入格式
    helper.inputTypeOnly(node.$annualRate, {
      regex: /^\d{1,2}(?:\.\d{0,2})?$/
    });

    helper.inputRange(node.$annualRate, {
      min: defaults.annualRate.min,
      max: defaults.annualRate.max
    });

    request({
      url: '/api/yesterdayAverageRate.json'
    })
    .then(function(ret){
      defaults.annualRate.value = ret.yesterdayAverageRate;
      node.$annualRate.val(ret.yesterdayAverageRate);
    });

    // 限制到期天数输入格式
    helper.inputTypeOnly(node.$dueDays, {
      regex: /^[1-9]\d{0,3}$/,
      decimals: 0
    });

    node.$dueDays.val(defaults.dueDays.value);

    this.dueDaysRange = helper.inputRange(node.$dueDays, {
      min: defaults.dueDays.min,
      max: defaults.dueDays.max
    });

    // 限制购买金额输入格式
    helper.inputTypeOnly(node.$buyAmount);

    if(defaults.buyAmount.value){
      node.$buyAmount.val(defaults.buyAmount.value);
    }

    // 限制购买金额的范围
    helper.inputRange(node.$buyAmount, {
      min: defaults.buyAmount.min,
      max: defaults.buyAmount.max
    });

    this._initInvestmentDate();
    this._initDueDate();
    this._initEvents();
  },
  /**
   * 初始化到期日期
   */
  _initDueDate: function(){
    var that = this,
      node = this.node,
      defaults = this.defaults;

    // 取到期日期的默认值
    request({
      url: WORK_DAYS_ACTION,
      data: {
        date: $.datepicker.formatDate('yy-mm-dd', nowDate),
        range: [1].join()
      }
    })
    .done(function(ret){
      var date = new Date(new Date(ret.date['1']).getTime() + 364 * dayMs);
      var dateFormat = $.datepicker.formatDate('yy-mm-dd', date);
      node.$dueDate.val(dateFormat);
      that.emit('dueDate:change', dateFormat);
      defaults.dueDate.value = dateFormat;
    });

    // 实例化日期
    node.$dueDate
      .val(defaults.dueDate.value)
      .datepicker({
        showOn: 'both',
        buttonImage: buttonImage,
        minDate: defaults.dueDate.min,
        dateFormat: 'yy-mm-dd',
        onSelect: function(date){
          // 当复选框勾选为使用“到期日期”，则发出变更事件
          if(node.$useDueDate.prop('checked')){
            that.emitChange();
            that.emit('dueDate:change', date);
          }
        }
      });

  },
  /**
   * 初始化投资日期
   */
  _initInvestmentDate: function(){
    var that = this,
      defaults = this.defaults;

    // 初始化完成“投资日期”后，触发一次投资日期变更事件
    setTimeout(function(){
      that.emit('investmentDate:change', defaults.investmentDate.value);
    }, 0);

    // 填充投资日期默认日期及实例化日期
    this.node.$investmentDate
      .val(defaults.investmentDate.value)
      .datepicker({
        showOn: 'both',
        buttonImage: buttonImage,
        minDate: defaults.investmentDate.min,
        maxDate: defaults.investmentDate.max,
        dateFormat: 'yy-mm-dd',
        onSelect: function(date){
          that.setMinDueDate(new Date(new Date(date).getTime() + 5 * dayMs));
          that.emitChange();
          that.emit('investmentDate:change', date);
        }
      });
  },
  _initEvents: function(){
    var that = this,
      node = this.node;

    // 到期日期与到期天数的切换
    node.$useDueDate.on('change', function(){
      if(this.checked){
        node.$dueDateContainer.show();
        node.$dueDaysContainer.hide();
        that.emit('dueDate:change', node.$dueDate.val());
      } else {
        node.$dueDateContainer.hide();
        node.$dueDaysContainer.show();
        that.emit('dueDays:change', node.$dueDays.val());
      }
      that.emitChange();
    });

    node.$annualRate.on('blur', function(){
      that.emit('annualRate:change', this.value);
      that.emitChange();
    });

    node.$dueDays.on('blur', function(){
      if(!node.$useDueDate.prop('checked')){
        that.emit('dueDays:change', this.value);
        that.emitChange();
      }
    });

    node.$buyAmount.on('blur', function(){
      that.emitChange();
    });

  },
  /**
   * 发起一个change事件，表示当前投资模块有变更
   */
  emitChange: function(){
    this.emit('change');
  },
  /**
   * 获取购买日期/投资日期
   * @return {String}
   */
  getBuyDate: function(){
    return this.node.$investmentDate.val();
  },
  /**
   * 设置最小到期日期
   * @param {String|Date} date
   */
  setMinDueDate: function(date){
    this.node.$dueDate.datepicker('option', 'minDate', date);
  },
  /**
   * 设置最小到期天数
   * @param {String|Number} days
   */
  setMinDueDays: function(days){
    this.dueDaysRange.setMin(days);
  },
  /**
   * 清除投资模块错误提示
   */
  clearError: function(){
    this.node.$el.find(CONTROL_CLASS_NAME).removeClass('error');
  },
  /**
   * 验证当前模块
   * @return {Boolean} true 表示验证通过， false 验证未通过
   */
  validate: function(){
    var node = this.node,
      valids = [
        node.$annualRate,
        node.$investmentDate,
        node.$useDueDate.prop('checked') ? node.$dueDate : node.$dueDays,
        node.$buyAmount
      ];

    this.clearError();

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
   * @return {String} object.annualRate 预期年化收益率
   * @return {String} object.investmentDate 投资日期
   * @return {String} object.dueDate 到期日期
   * @return {String} object.dueDays 到期天数
   * @return {Boolean} object.useCashDate 是否使用到期日期
   * @return {String} object.buyAmount 投资金额
   */
  toPlainObject: function(){
    var node = this.node;

    return {
      annualRate: node.$annualRate.val(),
      investmentDate: node.$investmentDate.val(),
      dueDate: node.$dueDate.val(),
      dueDays: node.$dueDays.val(),
      useDueDate: node.$useDueDate.prop('checked'),
      buyAmount: node.$buyAmount.val()
    };
  },
  /**
   * 重置投资模块所有可填项
   */
  reset: function(){
    var node = this.node,
      defaults = this.defaults;

    this.clearError();

    node.$annualRate.val(defaults.annualRate.value);
    node.$investmentDate.datepicker('setDate', defaults.investmentDate.value);
    setTimeout(function(){
      this.emit('investmentDate:change', defaults.investmentDate.value);
    }.bind(this), 0);
    node.$dueDays.val(defaults.dueDays.value);

    node.$dueDate
      .datepicker('setDate', defaults.dueDate.value)
      .datepicker('option', 'minDate', defaults.dueDate.min);

    node.$useDueDate.prop(
      'checked',
      defaults.useDueDate.checked
    ).trigger('change');

    node.$buyAmount.val(defaults.buyAmount.value);
  }
});

module.exports = investment;
