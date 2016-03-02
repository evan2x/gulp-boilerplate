/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc banner滑块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var Slider = require('../index/Slider');
var helper = require('js/common/helper');

/**
 * banner轮播
 * @todo 其他参数请参阅基类Slider
 * @param {Object} options 参数
 * @param {Boolean} options.autoplay 是否自动切换
 */
function BannerSlider(options){
  Slider.apply(this, arguments);

  this.autoplay = typeof options.autoplay === 'boolean' ? options.autoplay : true;
  if(this.autoplay){
    this.play();
  }

  this._eventMount();
}


BannerSlider.prototype = {
  _computed: function(){
    // 调用父类的_computed
    this._super('_computed');

    this.children
      .hide()
      .first()
      .fadeIn(this.duration);
  },
  _eventMount: function(){
    // 自动播放启用时，对鼠标移入移出的动作做处理
    if(this.autoplay){
      this.el.on('mouseenter', $.proxy(this.stop, this));
      this.el.on('mouseleave', $.proxy(this.play, this));
    }
  },
  /**
   * 播放轮播图
   */
  play: function(){
    if(this.maxLength <= 1 || this._timer) return;

    var that = this;
    this._timer = setInterval(function(){
      var idx = that.nextTick();

      that.children
        .eq(idx)
        .fadeIn(that.duration)
        .siblings()
        .fadeOut(that.duration);

    }, this.interval);
  }
};

/**
 * 继承Slider类
 */
helper.inherits(BannerSlider, Slider);

module.exports = BannerSlider;
