/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 仪表盘
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var helper = require('js/common/helper');

/**
 * 将难易指数转换为角度
 * @param  {Number|String} value 
 * @return {Number}       
 */
function transferAngle(value){
  if(typeof value === 'string'){
    value = +value;
  }

  if(value > 100){
    value = 100;
  }

  if(value < 0){
    value = 0;
  }

  value = 180 / 100 * value;

  if(!isFinite(value)){
    value = 0;
  }

  return value;
}

function loadImg(url, cb){
  var img = new Image;
  img.src = url;
  if(img.complete){
    cb(img);
  } else {
    img.onload = function(){
      cb(img);
      img.onload = null;
    }
  }
}

exports.init = function(value){
  var prefix = helper.css.prefix,
    gaugeAnnular = $('#gaugeAnnular'),
    gaugePointer = $('#gaugePointer'),
    gaugeIndex = $('#gaugeIndex'),
    angle = transferAngle(value),
    duration = value / 100 * 1000 * 2;


  /**
   * 三次方缓动
   * @see https://github.com/gdsmith/jquery.easing/blob/master/jquery.easing.js#L35
   */
  $.easing.easeInOutCubic = function (x, t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t + b;
    return c/2*((t-=2)*t*t + 2) + b;
  }
  
  // 支持CSS过渡则使用CSS过渡执行动画
  if(helper.css.supportTransition){
    gaugeAnnular
      .add(gaugePointer)
      .css(
        prefix + 'transition', 
        'transform '+ duration +'ms ease'
      );
  }

  var gaugeImage = '/assets/img/gauge.png';
  if(window.devicePixelRatio >= 2){
    gaugeImage = '/assets/img/gauge@2x.png';
  }
  loadImg(gaugeImage, function(){
    setTimeout(function(){
      // 支持CSS过渡则使用CSS过渡执行动画
      if(helper.css.supportTransition){
        gaugeAnnular.css(
          prefix + 'transform', 
          'rotate('+ angle +'deg)'
        );

        gaugePointer.css(
          prefix + 'transform', 
          'rotate('+ (angle) +'deg)'
        );
      } else {
        if(typeof gaugeAnnular[0].style.msTransform !== 'undefined'){
          // IE9 使用jQuery animate执行动画
          gaugeAnnular
            .add(gaugePointer)
            .animate({transform: angle}, {
              duration: duration,
              easing: "easeInOutCubic",
              step: function(now, tween){
                this.style.msTransform = 'rotate('+ now +'deg)';
              }
            });
        } else {
          /**
           * IE8 使用jQueryRotate绘制VML实现rotate动画
           * @see https://github.com/wilq32/jqueryrotate
           */
          var ga = gaugeAnnular.children('img'),
            gp = gaugePointer.children('img');
          loadImg(ga.prop('src'), function(){
            loadImg(gp.prop('src'), function(){
              ga.add(gp).rotate({
                angle: 0,
                easing: $.easing.easeInOutCubic,
                animateTo: angle
              });
            });
          });
        }
      }

      // 数字变动动画
      gaugeIndex.animate({
        count: value
      }, {
        duration: duration,
        step: function(now, tween){
          gaugeIndex.text(Math.round(now));
        }
      });

    }, 600);
  });
}