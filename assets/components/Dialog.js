/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 对话框组件
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/25
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');

var classPrefix = 'cp-dialog';
var $win = $(window);
var $doc = $(document);
var maskLayer = null;

function Dialog(options){
  EventEmitter.apply(this, arguments);
  options = options || {};

  this.width = options.width || 550;
  this.title = options.title || '';
  this.fixed = typeof options.fixed === 'boolean' ? options.fixed : true;
  this.content = options.content || '';
  this.useClose = typeof options.useClose === 'boolean' ? options.useClose : true; 
  this._initialized = false;

  this.node = {};
}

Dialog.prototype = {
  constructor: Dialog,
  _init: function(){
    var node = this.node,
      body = $('body');

    node.el = $(this._createLayer());

    if(!maskLayer){
      maskLayer = $(this._createMask());
      body.append(maskLayer);
    }

    $('body')
      .append(node.el);

    node.content = node.el.find('.'+ classPrefix +'-content');
    node.dismiss = node.el.find('.'+ classPrefix +'-dismiss');
  },
  _eventMount: function(){
    if(this.useClose){
      this.node.dismiss.on('click', $.proxy(this.handleClose, this));
    }
  },
  _createLayer: function(){
    return (
      '<div class="'+ classPrefix +'-layer" style="display:none">' +
        '<div class="'+ classPrefix +'-title">' +
          (this.useClose ? '<span class="'+ classPrefix +'-dismiss">&times;</span>' : '') +
          '<h4>'+ this.title +'</h4>' +
        '</div>' +
        '<div class="'+ classPrefix +'-content">'+ this.content +'</div>' +
      '</div>'
    );
  },
  _createMask: function(){
    return (
      '<div class="'+ classPrefix +'-mask" style="display:none"></div>'
    );
  },
  handleClose: function(){
    this.hide();
  },
  hooks: {
    /**
     * 默认是直接插入到 content中的，如果需要不一样的插入姿势，请重写此钩子
     * @param {String} message 
     */
    show: function(message){
      this.node.content.html(message);
    }
  },
  show: function(message){
    if(!this._initialized){
      this._init();
      this._eventMount();
      this._initialized = true;
    }
    var node = this.node;

    if(message != null && $.isFunction(this.hooks.show)){
      this.hooks.show.call(this, message);
    }
    node.el.show();
    maskLayer.show();

    var top = ($win.height() - node.el.outerHeight()) / 2,
      left = ($win.width() - this.width) / 2;

    if(!this.fixed){
      top += $doc.scrollTop();
    }

    if(top < 0){
      top = 0;
    }

    node.el
      .css({
        position: this.fixed ? 'fixed' : 'absolute',
        width: this.width,
        left: left,
        top: top
      });

    this.emit('show');
  },
  hide: function(){
    var node = this.node;

    node.el
      .css({
        left: '-999em',
        top: '-999em'
      })
      .hide();

    maskLayer.hide();

    this.emit('hide');
  }
}

helper.inherits(Dialog, EventEmitter);

module.exports = Dialog;
