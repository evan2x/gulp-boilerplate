/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 工具栏模块主入口
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2016/01/19
 */

var calculator = require('./calculator');
var helper = require('js/common/helper');

var hidden = true;
var activeItem = null;
var prefix = helper.css.prefix;

var node = {
  $el: $('#toolbar'),
  $tabs: $('#toolbarTabs'),
  $content: $('#toolbarContent')
}

var moduleMap = {
  calculator: {
    initialized: false,
    fn: function(){
      calculator.init();
    }
  }
}

/**
 * 三次方缓动
 * @see https://github.com/gdsmith/jquery.easing/blob/master/jquery.easing.js#L35
 */
$.easing.easeInOutCubic = function (x, t, b, c, d) {
  if ((t/=d/2) < 1) return c/2*t*t*t + b;
  return c/2*((t-=2)*t*t + 2) + b;
}

// 初始化侧栏位置及动画属性
if(helper.css.supportTransition){
  node.$el.css('right', 0);
  node.$el.css(
    prefix + 'transition',
    prefix + 'transform 600ms ease'
  );
} else {
  node.$el.css(
    prefix + 'transform',
    'translateX(0)'
  );
}

function showBar($el){
  hidden = false;
  if(helper.css.supportTransition){
    $el.css(
      prefix + 'transform',
      'translateX(0)'
    );
  } else {
    $el.animate({
      right: 0
    }, {
      duration: 600,
      easing: "easeInOutCubic"
    });
  }
}

function hideBar($el){
  hidden = true;
  if(helper.css.supportTransition){
    $el.css(
      prefix + 'transform',
      'translateX(330px)'
    );
  } else {
    $el.animate({
      right: -330
    }, {
      duration: 600,
      easing: "easeInOutCubic"
    });
  }
}

node.$tabs.on('click', '.pull-item', function(){
  var $this = $(this),
    item = this.getAttribute('data-item'),
    property = '[data-content="' + item + '"]';

  if(hidden){
    showBar(node.$el);
  }

  if(activeItem === item){
    hideBar(node.$el);
    $this.removeClass('active');
    activeItem = null;
  } else {
    $this
      .addClass('active')
      .siblings()
      .removeClass('active');

    node.$content
      .find(property).show()
      .siblings().hide();

    // 激活对应的模块
    var activeModule = moduleMap[item];
    if(activeModule && !activeModule.initialized){
      activeModule.initialized = true;
      activeModule.fn();
    }

    activeItem = item;
  }

});
