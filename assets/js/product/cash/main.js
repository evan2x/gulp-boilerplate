/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现专区页入口模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var assign = require('object-assign');
var Dialog = require('components/Dialog');
var alert = require('components/Alert');
var cashAmount = require('../cash/cashAmount');
var cashRate = require('../cash/cashRate');
var helper = require('js/common/helper');
var request = require('js/common/request');

var constants = assign({}, __GLOBAL_CONFIG__);

var NOW_CASH_ACTION = '/bxt/pc/cashApply.json';

var cashApp = {
  disabled: false,
  node: {
    $availableCashAmount: $('#availableCashAmount'),
    $charge: $('#charge'),
    cashType: $('.cash-type'),
    $submit: $('#cashBtn'),
    $mask: $('#mask'),
    cashIntro: {
      $amountValue: $('#amountValue'),
      $realRate: $('#realRate'),
      $maxAvailableCash: $('#maxAvailableCash'),
      $realCashAmount: $('#realCashAmount'),
      $remainingAmount: $('#remainingAmount')
    }
  },
  init: function(){
    this.dialog = new Dialog({
      content: this._createSuccessTipsFragment(),
      useClose: false
    });

    cashRate.init();
    cashAmount.init();

    this._eventMount();
  },
  _createSuccessTipsFragment: function(){
    return (
      '<img class="success-icon" src="/assets/img/success.png" height="70">' +
      '<h4>变现贷发布成功</h4>' +
      '<p>等待被认购。变现有效期内，成功变现的资金将自动转入绑定银行卡；<br>未成功变现部分将自动取消，可重新发起变现。</p>' +
      '<div class="operation-area">' +
        '<a href="" class="cash-btn-primary" id="checkCashHistory">查看变现历史</a>' +
        '<a href="/bxt/index.html">去变现通</a>' +
      '</div>'
    );
  },
  _eventMount: function(){
    var that = this,
      node = this.node;

    cashRate.on('rate:change', function(data){
      that._shouldSubmitUpdate({
        rate: data.value,
        money: cashAmount.getMoney()
      });
      
      // 变现介绍
      node.cashIntro.$realRate.text((data.value * 100).toFixed(2));
      that._updateRemainingAmount(data.value, cashAmount.getMoney());
    });

    cashAmount.on('money:change', function(data){
      that._shouldSubmitUpdate({
        rate: cashRate.getRate(), 
        money: data.value
      });

      // 变现介绍
      node.cashIntro.$realCashAmount.text(data.value === '' ? '--' : (+data.value).toFixed(2));
      that._updateRemainingAmount(cashRate.getRate(), data.value);
    });

    // 当变现利率失去焦点的时候刷新最大可投金额
    cashRate.on('rate:blur', function(data){
      if(data.value !== ''){
        cashAmount.refreshMaxAvailableCash(data.value);
      }
    });

    // 最大可变现金额变化
    cashAmount.on('money:maxChange', function(data){
      var max = helper.formatNumber(data.maxAvailableCash.toFixed(2));
      node.$availableCashAmount.text(max);
      // 变现介绍
      node.cashIntro.$maxAvailableCash.text(max);
    });

    node.$submit.on('click', $.proxy(this.handleNowCash, this));
  },
  _shouldSubmitUpdate: function(data){
    var $submit = this.node.$submit;

    // 检测剩余金额是否能够进行二次变现，且利率和变现金额不为空
    if(cashAmount.checkRemainingAvailableCash() && data.rate !== '' && data.money !== ''){
      $submit.removeClass('btn-disabled');
      this.disabled = true;
    } else {
      $submit.addClass('btn-disabled');
      this.disabled = false;
    }
  },
  _updateRemainingAmount: function(rate, money){
    var node = this.node,
      value = '--';
    if(rate !== '' && money !== ''){
      value = this._calcRemainingAmount(rate, money);
    }
    node.cashIntro.$remainingAmount.text(value);
  },
  _calcRemainingAmount: function(rate, money){
    rate /= 100;
    return Math.max(
      0,
      (constants.REMAINING_EXPIRE_AMOUNT - money * (1 + rate * constants.REMAINING_DAY / 365)).toFixed(2)
    );
  },
  handleNowCash: function(){
    var that = this,
      node = this.node;

    if(this.disabled){
      this.loading();
      request({
        url: NOW_CASH_ACTION,
        type: 'POST',
        data: {
          token: constants.TOKEN,
          investNo: constants.INVEST_ID,
          prodType: constants.PRODUCT_TYPE,
          channelSource: constants.CHANNEL_SOURCE,
          loanAmount: cashAmount.getMoney(),
          cashRates: cashRate.getRate()
        }
      })
      .then(function(data){
        that.recover();
        that.dialog.show();
        $('#checkCashHistory').prop('href', data.historyUrl);
      }, function(){
        that.recover();
      });
    }
  },
  loading: function(){
    this.node
      .$submit.addClass('btn-disabled')
      .val('变现中...');
  },
  recover: function(){
    this.node
      .$submit.removeClass('btn-disabled')
      .val('同意协议并变现');
  }
}

cashApp.init();

var agreementDialog = {
  node: {
    $controlBtn: $('.agreement-dialog-btn')
  },
  init: function(){
    this.dialog = new Dialog({
      fixed: false
    });

    this._eventMount();
  },
  _eventMount: function(){
    this.node.$controlBtn.on('click', $.proxy(this.handleShowAgreement, this));
  },
  handleShowAgreement: function(e){
    var el = e.target,
      url = el.getAttribute('data-url');

    if(this.iframe){
      if(this.iframe.src !== url){
        this.iframe.src = url;
      }
    } else {
      this.iframe = document.createElement('iframe');
      this.iframe.setAttribute('frameborder', 0);
      this.iframe.src = url;
      this.iframe.className = 'dialog-iframe';
    }
    this.dialog.show(this.iframe);
  }
}

agreementDialog.init();