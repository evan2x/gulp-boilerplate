/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现购买页入口模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var assign = require('object-assign');
var Dialog = require('components/Dialog');
var buyAmount = require('./buyAmount');

var constants = assign({}, __GLOBAL_CONFIG__);

var PRODUCT_DETAIL_SECTION = {
  buyRecords: require('./buyRecords')
};

/**
 * 产品Tab
 * @type {Object}
 */
var productTabs = {
  node: {
    $win: $(window),
    $tabs: $('#productTabs'),
    $panels: $('#tabsPanelGroup > .tab-panel')
  },
  init: function(){
    this._eventMount();
    this.load(this.node.$tabs.children('li.active'));
  },
  /**
   * 加载对应的Tab页
   * @param  {jQuery} $el 
   */
  load: function($el){
    var section = PRODUCT_DETAIL_SECTION[$el.attr('data-tag')];
    if(section && section.load){
      section.load();
      this.node.$win.trigger('scroll');
    }
  },
  _eventMount: function(){
    var node = this.node;

    node.$tabs.on('click', '>li', $.proxy(this.handleTabChange, this));
  },
  handleTabChange: function(e){
    var $el = $(e.target),
      index = $el.index();

    $el
      .addClass('active')
      .siblings()
      .removeClass('active');

    this.node.$panels
      .eq(index)
      .addClass('active')
      .siblings()
      .removeClass('active');

    this.load($el);
  }
}

/**
 * 协议对话框
 * @type {Object}
 */
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

// 当不可购买时，不初始化购买金额模块
if(constants.AVAILABLE_CASH){
  buyAmount.init();
}

productTabs.init();
agreementDialog.init();