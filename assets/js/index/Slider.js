/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 滑块基类
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

/**
 * 轮播图基类
 * @param {Object} options 参数
 * @param {jQuery Object} options.el DOM节点包装后的jQuery对象
 * @param {Number} options.interval 自动轮播间隔时间
 * @param {Number} options.duration 动画过渡持续时间
 * @param {Number} options.index 初始化索引位置
 */
function Slider(options) {
  options = options || {};
  // 当传入的不是一个jQuery对象，终止后续代码执行
  if(!(options.el && options.el.jquery)) return;

  this.el = options.el;
  this.interval = options.interval || 3000;
  this.duration = options.duration || 600;
  this.index = options.index;
  this._timer = null;

  this._computed();

}

Slider.prototype = {
  constructor: Slider,
  /**
   * 初始化需要计算的参数
   */
  _computed: function(){

    this.children = this.el.children();
    this.maxLength = this.children.length - 1;

    // 修正初始化的index
    if(this.index){
      if(this.index < 0){
        this.index = 0;
      }

      if(this.index > this.maxLength){
        this.index = this.maxLength;
      }
    } else {
      this.index = 0;
    }
  },
  /**
   * 变更至下一个index
   * @return {Number}
   */
  nextTick: function(){
    if(this.index >= this.maxLength){
      this.index = 0;
    } else {
      this.index += 1;
    }

    return this.index;
  },
  /**
   * 停止轮播图的自动切换
   */
  stop: function(){
    clearInterval(this._timer);
    this._timer = null;
  },
  /**
   * 销毁轮播图实例
   * @todo 目前只解除this.el上绑定的事件
   */
  destroy: function(){
    this.el.off();
  }
};

module.exports = Slider;
