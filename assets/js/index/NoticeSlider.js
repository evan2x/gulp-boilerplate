/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 公告滑块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var Slider = require('../index/Slider');
var helper = require('js/common/helper');

/**
 * 公告轮播
 * @todo 其他参数请参阅基类Slider
 * @param {Object} options 参数
 * @param {Number} options.showLength 控制每次显示多少条数据
 */
function NoticeSlider(options){
  this.showLength = options.showLength || 1;
  Slider.apply(this, arguments);

  if(this.showLength < this.maxLength){
    this.play();
  }
  this._eventMount();
}

NoticeSlider.prototype = {
  _computed: function(){
    this._super('_computed');

    // 修正最大显示条数
    if(this.showLength){
      if(this.showLength < 1){
        this.showLength = 1;
      }

      if(this.showLength > this.maxLength){
        this.showLength = this.maxLength;
      }
    }

    // 取单步长度
    this.step = this.children.first().outerHeight(true) * this.showLength;

    // 将第一组显示的节点copy一份，插入到children中
    this.children
      .slice(0, this.showLength)
      .clone()
      .appendTo(this.el);

    // 修正maxLength
    this.maxLength += this.showLength;
  },
  /**
   * 挂载事件
   */
  _eventMount: function(){
    this.el.on('mouseenter', $.proxy(this.stop, this));
    this.el.on('mouseleave', $.proxy(this.play, this));

    // 用于支持CSS3动画过渡场景下绑定动画执行后事件，处理重置索引及layer位置
    if(helper.css.supportTransition){
      var that = this;
      this.el.on(helper.css.transitionEnd, function(){
        if(that.index === that.maxLength){
          that.el
            .css(
              helper.css.prefix + 'transition',
              'transform 0ms ease'
            )
            .css(helper.css.prefix + 'transform', 'translate(0, 0)');

          that.index = 0;
        }
      });
    }
  },
  play: function(){
    if(this.maxLength <= 1 || this._timer) return;
    var that = this;

    this._timer = setInterval(function(){
      var idx = that.nextTick(),
        posY = -(idx * that.step);

      // 支持CSS3动画过渡场景下直接使用过渡方式执行动画
      if(helper.css.supportTransition){
        that.el
          .css(
            helper.css.prefix + 'transition',
            'transform '+ that.duration +'ms ease'
          )
          .css(
            helper.css.prefix + 'transform',
            'translate(0, '+ posY +'px)'
          );
      } else {
        that.el
          .css('position', 'relative')
          .animate({
            top: posY
          }, {
            complete: function(){
              // 重置索引及layer位置
              if(that.index === that.maxLength){
                that.el.css('top', 0);
                that.index = 0;
              }
            }
          });
      }

    }, this.interval);
  }
};

helper.inherits(NoticeSlider, Slider);

module.exports = NoticeSlider;
