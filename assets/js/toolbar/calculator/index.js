/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 工具栏计算器模块入口
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2016/01/19
 */

var investment = require('./investment');
var cash = require('./cash');
var helper = require('js/common/helper');
var request = require('js/common/request');
var assign = require('object-assign');

var dayMs = 864e5;

var WORK_DAYS_ACTION = '/api/workDays.json';

// 缓存日期的查询
var cache = {};

/**
 * 取指定日期的后一个工作日
 * @param  {String}   date     指定日期
 * @return {Promise}
 */
function getNextWorkDate(date){
  var defer = $.Deferred();
  if (cache[date]) {
    if (cache[date]['1']) {
      defer.resolve(cache[date]['1']);
      return defer.promise();
    }
  } else {
    cache[date] = {};
  }

  request({
    url: WORK_DAYS_ACTION,
    data: {
      date: date,
      range: '1'
    }
  })
  .done(function(ret){
    var retDate = new Date(ret.date['1']);
    cache[date]['1'] = retDate;
    defer.resolve(retDate);
  })
  .fail(function(){
    defer.reject();
  });

  return defer.promise();
}

/**
 * 取指定日期的前一个工作日
 * @param  {String}   date     指定日期
 */
function getPrevWorkDate(date){
  var defer = $.Deferred();

  if (cache[date]) {
    if (cache[date]['-1']) {
      defer.resolve(cache[date]['-1']);
      return defer.promise();
    }
  } else {
    cache[date] = {};
  }

  request({
    url: WORK_DAYS_ACTION,
    data: {
      date: date,
      range: '-1'
    }
  })
  .done(function(ret){
    var retDate = new Date(ret.date['-1']);
    cache[date]['-1'] = retDate;
    defer.resolve(retDate);
  })
  .fail(function(){
    defer.reject();
  });

  return defer.promise();
}

/**
 * 求两个日期的差值
 * @param  {String|Date} start 开始日期
 * @param  {String|Date} end   结束日期
 * @return {Number}       相差的毫秒数
 */
function dateDifference(start, end){
  var startTimestamp = 0,
    endTimestamp = 0;

  if(start instanceof Date){
    startTimestamp = start.getTime();
  } else if(typeof start === 'string') {
    startTimestamp = new Date(start).getTime();
  }

  if(end instanceof Date){
    endTimestamp = end.getTime();
  } else if(typeof end === 'string'){
    endTimestamp = new Date(end).getTime();
  }

  return endTimestamp - startTimestamp;
}

/**
 * 计算到期本息
 * @param {Object} options
 * @param {String|Number} options.principal 投资本金
 * @param {String|Number} options.rate 预期年化收益率
 * @param {String|Number} options.start 投资日期(实际为投资日期的下一个工作日)
 * @param {String|Number} options.end 到期日期
 * @return {Number}
 */
function calcDuePrincipalAndInterest(options){
  var principal = +options.principal,
    rate = options.rate / 100,
    milliseconds = dateDifference(options.start, options.end);

  return (principal + principal * rate * (milliseconds / dayMs) / 365).toFixed(2);
}

/**
 * 根据天数转日期
 * @param  {String|Date} date 参考日期
 * @param  {String|Number} days 天数
 * @return {String}      日期
 */
function dateByDays(date, days){
  var timestamp = new Date(date).getTime();
  return $.datepicker.formatDate(
    'yy-mm-dd',
    new Date(timestamp + days * dayMs)
  );
}

/**
 * 计算实际年化收益率
 * @param  {Object} options
 * @param {String|Number} options.earnings 收益
 * @param {String|Number} options.principal 投资本金
 * @param {String|Number} options.days 持有天数
 * @return {Number}
 */
function calcRealAnnualRate(options){
  var earnings = options.earnings,
    principal = options.principal,
    days = options.days;

  return (earnings * 365 / principal / days * 100).toFixed(2);
}

/**
 * 刷新最大可变现金额
 */
function refreshCashMaxAmount(){
  var data = assign({}, investment.toPlainObject(), cash.toPlainObject());

  // 若未勾选到期日期，则将到期天数转为到期日期
  if(data.useDueDate){
    data.dueDays = dateDifference(data.investmentDate, data.dueDate) / dayMs;
  } else {
    data.dueDate = dateByDays(data.investmentDate, data.dueDays);
  }

  // 若未勾选变现日期，则将变现天数转为变现日期
  if(data.useCashDate){
    data.cashDays = dateDifference(data.investmentDate, data.cashDate) / dayMs;
  } else {
    data.cashDate = dateByDays(data.investmentDate, data.cashDays);
  }

  // 如果存在未填写项，则放开可变现金额最大值限制
  for(var key in data){
    if(data.hasOwnProperty(key) && key !== 'cashAmount'){
      if(data[key] === ''){
        cash.setMaxCashAmount(null);
        return;
      }
    }
  }

  // 求“投资日期”与“变现日期”各自的下个工作日
  $.when(
    getNextWorkDate(data.investmentDate),
    getNextWorkDate(data.cashDate)
  )
  .then(function(investmentNextDate, cashNextDate){
    // 有效到期本息
    var principalAndInterest = calcDuePrincipalAndInterest({
      principal: data.buyAmount,
      rate: data.annualRate,
      start: investmentNextDate,
      end: data.dueDate
    });
    // “到期日”与 “变现日的下一个工作日” 差的天数
    var days = dateDifference(cashNextDate, data.dueDate) / dayMs;
    // 最大可变现金额
    cash.setMaxCashAmount((principalAndInterest / (1 + data.cashRate / 100 * days / 365)).toFixed(2));
  }, function(){
    cash.setMaxCashAmount(null);
  });
}

exports.init = function(){
  investment.init();
  cash.init();

  var node = {
    $calcBtn: $('#calculatorCalculate'),
    $resetBtn: $('#calculatorReset'),
    $interestDate: $('#interestDate'),
    $realizableDate: $('#realizableDate'),
    $estimatePrincipalAndInterest: $('#estimatePrincipalAndInterest'),
    $holdingsDays: $('#holdingsDays'),
    $lastDay: $('#lastDay'),
    $estimateAmount: $('#estimateAmount'),
    $realEarnings: $('#realEarnings'),
    $realAnnualRate: $('#realAnnualRate'),
    $remainDuePrincipalAndInterest: $('#remainDuePrincipalAndInterest'),

    $investmentResult: $('#investmentResult'),
    $cashResult: $('#cashResult'),

    $partCash: $('.result-part-cash'),
    $allCash: $('.result-all-cash')
  }

  investment.on('change', function(){
    setTimeout(function(){
      refreshCashMaxAmount();
    }, 0);
  });

  cash.on('change', function(){
    setTimeout(function(){
      refreshCashMaxAmount();
    }, 0);
  });

  // “年化收益率” 变化
  investment.on('annualRate:change', function(rate){
    // 限制最大变现利率
    cash.setMaxCashRate(rate);
  });

  // “投资日期” 变化
  investment.on('investmentDate:change', function(date){
    // 取投资日的下一个工作日
    getNextWorkDate(date)
    .then(function(nextDate){
      // 最小变现日期为投资日期的下一个工作日
      cash.setMinCashDate(nextDate);

      // 以下一个工作日的后5个自然日作为“到期日期”或“到期天数”的最小限制
      var fiveDaysLater = new Date(nextDate.getTime() + 5 * dayMs);
      investment.setMinDueDate(fiveDaysLater);
      investment.setMinDueDays(dateDifference(date, fiveDaysLater) / dayMs);
    });
  });

  // “到期日期” 变化
  investment.on('dueDate:change', function(date){
    var buyDate = investment.getBuyDate();

    // 到期日的前一个工作日
    getPrevWorkDate(date)
    .then(function(prevDate){
      // 最大变现日期为到期日的上一个工作日的前5个自然日
      var fiveDaysAgo = new Date(prevDate.getTime() - 5 * dayMs);
      cash.setMaxCashDate(fiveDaysAgo);
      cash.setMaxCashDays(dateDifference(buyDate, fiveDaysAgo) / dayMs);
    });
  });

  // “到期天数” 变化
  investment.on('dueDays:change', function(days){
    if(!days) return;

    var buyDate = investment.getBuyDate();
    var daysLater = dateByDays(buyDate, days);

    getPrevWorkDate(daysLater)
    .then(function(prevDate){
      // 最大变现日期为到期日的上一个工作日的前5个自然日
      var fiveDaysAgo = new Date(prevDate.getTime() - 5 * dayMs);
      cash.setMaxCashDate(fiveDaysAgo);
      cash.setMaxCashDays(dateDifference(buyDate, fiveDaysAgo) / dayMs);
    });
  });

  // 快速计算按钮
  node.$calcBtn.on('click', function(){
    node.$investmentResult.hide();
    node.$cashResult.hide();

    var investmentValid = investment.validate();
    var cashValid = cash.validate();

    if(investmentValid && cashValid){
      var data = assign({}, investment.toPlainObject(), cash.toPlainObject());

      // 收益计算
      //-----
      node.$investmentResult.show();
      getNextWorkDate(data.investmentDate)
      .then(function(nextDate){
        // 起息日期
        node.$interestDate.text($.datepicker.formatDate('yy/mm/dd', nextDate));
        // 可变现日期
        node.$realizableDate.text($.datepicker.formatDate('yy/mm/dd', nextDate));

        if(!data.useDueDate){
          data.dueDate = dateByDays(data.investmentDate, data.dueDays);
        }

        var duePrincipalAndInterest = calcDuePrincipalAndInterest({
          principal: data.buyAmount,
          rate: data.annualRate,
          start: nextDate,
          end: data.dueDate
        });

        // 预估到期本息
        node.$estimatePrincipalAndInterest
          .text(helper.formatNumber(duePrincipalAndInterest));

        // 变现计算
        //-----
        if(cash.shouldCash()){
          node.$cashResult.show();
          if(data.useCashDate){
            data.cashDays = dateDifference(data.investmentDate, data.cashDate) / dayMs;
          } else {
            data.cashDate = dateByDays(data.investmentDate, data.cashDays);
          }

          // 变现持有天数
          node.$holdingsDays.text(data.cashDays);

          // 最晚到帐日
          request({
            url: WORK_DAYS_ACTION,
            data: {
              date: data.cashDate,
              range: '3'
            }
          })
          .then(function(ret){
            node.$lastDay.text(ret.date['3'].replace(/-/g, '/'));
          });

          // 预估到账金额
          node.$estimateAmount.text(helper.formatNumber((+data.cashAmount).toFixed(2)));

          // 变现金额小于最大可变现金额，即部分变现
          if(+data.cashAmount < +cash.getMaxCashAmount()){
            node.$partCash.show();
            node.$allCash.hide();

            // 取变现日期的下一个工作日
            getNextWorkDate(data.cashDate)
            .then(function(nextDate){
              // 历史变现
              var cashHistory = data.cashAmount * (1 + data.cashRate / 100 * dateDifference(nextDate, data.dueDate) / dayMs / 365);
              // 剩余到期本息
              node.$remainDuePrincipalAndInterest.text(helper.formatNumber((duePrincipalAndInterest - cashHistory).toFixed(2)));
            });
          } else {
            node.$partCash.hide();
            node.$allCash.show();
            // 投资实际收益
            var realEarnings = (data.cashAmount - data.buyAmount).toFixed(2);
            // 投资实际收益
            node.$realEarnings.text(helper.formatNumber(realEarnings));
            // 实际年化收益率
            node.$realAnnualRate.text(calcRealAnnualRate({
              earnings: realEarnings,
              principal: data.buyAmount,
              days: data.cashDays
            }));
          }
        }
        //-----
      });
    }
  });

  /**
   * 重置计算器
   */
  node.$resetBtn.on('click', function(){
    investment.reset();
    cash.reset();

    node.$investmentResult.hide();
    node.$cashResult.hide();

    node.$allCash.hide();
    node.$partCash.hide();
  });
}
