/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 首页入口模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var BannerSlider = require('../index/BannerSlider');
var NoticeSlider = require('../index/NoticeSlider');
var gauge = require('../index/gauge');
var assign = require('object-assign');

var SALE_SECTION = {
  today: require('../index/saleToday'),
  yesterday: require('../index/saleYesterday'),
  history: require('../index/saleHistory')
};

var constants = assign({}, __GLOBAL_CONFIG__);

new BannerSlider({
  el: $('#slider'),
  autoplay: false
});

new NoticeSlider({
  el: $('#notice')
});

gauge.init(constants.DEGREE_OF_DIFFICULTY);

var sidebar = {
  fixed: false,
  node: {
    $el: $('#mainSidebar'),
    $doc: $(document),
    $win: $(window),
    $tabs: $('#sidebarTabs'),
    $panels: $('#sidebarTabsPanelGroup > .tab-panel')
  },
  init: function(){
    var node = this.node;

    this.parent = node.$el.parent();
    this.height = node.$el.height();
    this.min = node.$el.offset().top;
    this.clientHeight = $(window).height();

    this._eventMount();
    this.load(this.node.$tabs.children('li.active'));
  },
  load: function($el){
    var that = this,
      node = this.node,
      section = SALE_SECTION[$el.attr('data-tag')];
    if(section && section.load){
      section.load(function(){
        node.$win.trigger('scroll');
      });
    }
  },
  _eventMount: function(){
    var node = this.node;

    node.$tabs.on('click', '>li', $.proxy(this.handleTabChange, this));
    node.$win.on('scroll', $.proxy(this.handlePageScroll, this));
  },
  handleTabChange: function(e){
    var $el = $(e.currentTarget),
      index = $el.index(),
      node = this.node;

    $el
      .addClass('active')
      .siblings()
      .removeClass('active');

    node.$panels
      .eq(index)
      .addClass('active')
      .siblings()
      .removeClass('active');

    this.load($el);
  },
  handlePageScroll: function(){
    var node = this.node,
      max = this.min + this.parent.height() - this.height,
      scrollTop = node.$doc.scrollTop();

    if(scrollTop >= this.min && scrollTop <= max){
      if(!this.fixed) {
        node.$el.css({
          position: 'fixed',
          top: 0,
          bottom: 'auto'
        });
        this.fixed = true;
      }
    } else {
      // 恢复原本的定位方式
      if(this.fixed){
        var property = {
          position:'absolute'
        }
        if(scrollTop >= max){
          property.top = 'auto';
          property.bottom = 0;
        } else {
          property.top = 0;
          property.bottom = 'auto';
        }

        node.$el.css(property);
        this.fixed = false;
      }
    }

  }
}

var questionCenter = {
  node: {
    $tabs: $('#questionTabs'),
    $panels: $('#questionTabsPanelGroup > .tab-panel')
  },
  init: function(){
    this._eventMount();
  },
  _eventMount: function(){
    var node = this.node;

    node.$tabs.on('click', '>li', $.proxy(this.handleTabChange, this));
  },
  handleTabChange: function(e){
    var $el = $(e.target),
      index = $el.index(),
      node = this.node;

    $el
      .addClass('active')
      .siblings()
      .removeClass('active');

    node.$panels
      .eq(index)
      .addClass('active')
      .siblings()
      .removeClass('active');
  }
}

sidebar.init();
questionCenter.init();