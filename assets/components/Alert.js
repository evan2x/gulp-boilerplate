/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 对话框组件
 * @todo 一个页面中共享一个组件，多个实例也是如此
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/25
 */

'use strict';

var helper = require('js/common/helper');
var Dialog = require('./Dialog');

var classPrefix = 'cp-alert';

function Alert(){
  Dialog.apply(this, arguments);

  this.content = (
    '<div style="padding:20px 0 10px;">' +
      '<div class="'+ classPrefix +'-content"></div>' +
      '<div class="'+ classPrefix +'-btn-area">' +
        '<span class="'+ classPrefix +'-confirm">确定</span>' +
      '</div>' +
    '</div>'
  );
}

helper.inherits(Alert, Dialog);

Alert.prototype._init = function(){
  // 调用父类的初始化方法
  this._super('_init');

  var node = this.node,
    el = node.el;
  //重新指定内容区节点
  node.content = el.find('.' + classPrefix + '-content');
  node.confirmBtn = el.find('.' + classPrefix + '-confirm');
}

Alert.prototype._eventMount = function(){
  // 调用父类的挂载事件方法
  this._super('_eventMount');
  this.node.confirmBtn.on('click', $.proxy(this.handleConfirm, this));
}

Alert.prototype.handleConfirm = function(){
  this.hide();
}

var alert = null;
module.exports = function(message){
  if(!alert){
    alert = new Alert({
      title: '温馨提示',
      width: 330
    });
  }

  alert.show(message);
};
