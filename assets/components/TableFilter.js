/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 简单表格过滤器
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/25
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');

var classPrefix = 'cp-table-filter';

/**
 * 表格单个过滤器
 * @param {options} Object 参数
 * @param {String} options.key
 * @param {String} options.id
 * @param {String} options.name
 * @param {Boolean} options.useInput 是否允许手动输入
 * @param {Array} options.values 可选项列表
 * @memberof TableFilter
 * @private
 */
function TableFilterItem(options){
  EventEmitter.apply(this, arguments);
  options = options || {};

  this.$el = null;
  this.key = options.key || '';

  this.useInput = true;
  if(typeof options.useInput === 'boolean'){
    this.useInput = options.useInput;
  }

  this.name = options.name;
  this.id = options.id || '';
  this.values = options.values || [];

  EventEmitter.call(this);
}

TableFilterItem.prototype = {
  /**
   * 动态计算的属性
   * @private
   */
  _computed: function(){
    var range = this.range = {};

    range.start = this.$el.find('.start-range');
    range.end = this.$el.find('.end-range');
    range.search = this.$el.find('.range-btn');

    this.select = this.$el.find('.'+ classPrefix +'-values-group > li');
  },
  /**
   * 渲染节点
   * @todo 并不会插入到DOM中
   * @return {jQuery Object} 返回一个由jQuery构造的DOM节点
   */
  render: function(){
    var $node = $(
      '<div class="'+ classPrefix +'-item" data-id="'+ this.id +'">' +
        '<div class="'+ classPrefix +'-key"><span>'+ this.name +'</span></div>' +
        '<div class="'+ classPrefix +'-values">' +
          '<ul class="'+ classPrefix +'-values-group">'+ this._createValues() +'</ul>' +
        '</div>' +
        this._createInputs() +
      '</div>'
    );

    this.$el = $node;
    this._computed();
    this._eventMount();
    return $node;
  },
  /**
   * 挂载事件
   * @private
   */
  _eventMount: function(){
    this.$el.on('click', this.range.search.selector, $.proxy(this.handleRangeSearch, this));
    this.$el.on('click', this.select.selector, $.proxy(this.handleRangeSelected, this));
  },
  /**
   * 范围查询句柄，仅发起change事件
   * @context TableFilterItem instance
   */
  handleRangeSearch: function(){
    var range = this.range;

    this.select.removeClass('active');

    this.emit('change', {
      id: this.id,
      min: $.trim(range.start.val()),
      max: $.trim(range.end.val())
    });
  },
  /**
   * 可选项被选中
   * @param  {Object} e jQuery Event对象
   * @context TableFilterItem instance
   */
  handleRangeSelected: function(e){
    var node = e.currentTarget,
      data = JSON.parse(node.getAttribute('data-value'));

    $(node)
      .addClass('active')
      .siblings()
      .removeClass('active');

    this.range.start.val(data.min);
    this.range.end.val(data.max);

    this.emit('change', {
      id: this.id,
      min: data.min,
      max: data.max
    });
  },
  /**
   * 生成自定义输入框HTML片段
   * @todo 当useInput为false的时候返回空字符串
   * @return {String}
   * @private
   */
  _createInputs: function(){
    if(!this.useInput) return '';

    return (
      '<div class="'+ classPrefix +'-inputs">' +
        '<input type="text" class="start-range">' +
        '<span>-</span>' +
        '<input type="text" class="end-range">' +
        '<button class="range-btn cp-icon-magnifier"></button>' +
      '</div>'
    );
  },
  /**
   * 生成可选项HTML片段
   * @return {String}
   * @private
   */
  _createValues: function(){
    var fragment = '';

    for(var i = 0, item; item = this.values[i++];){
      if(!item) continue;
      var className = item.selected ? 'active' : '',
        style = item.width ? ('min-width:' + item.width) : '',
        value = {
          min: item.min,
          max: item.max
        };

      fragment += (
        '<li' +
          (className !== '' ? (' class="'+ className +'"') : '') +
          (style !== '' ? (' style="'+ style +'"') : '') +
          ' data-value=\''+ JSON.stringify(value) +'\'' +
          '>' +
          '<span>'+ (item.name || '') +'</span>' +
        '</li>'
      );
    }

    return fragment;
  }
}

helper.inherits(TableFilterItem, EventEmitter);

/**
 * 表格过滤器
 * @param {Object} options 参数
 * @param {jQuery Object} options.el
 * @param {Array} options.data 过滤器列表
 * @event
 * 	- Event#change 过滤器条件变更后的触发的事件
 * 			@param {Object} data
 * 			@param {String} data.id
 * 			@param {String} data.min
 * 			@param {String} data.max
 */
function TableFilter(options) {
  options = options || {};
  // 当传入的不是一个jQuery对象，终止后续代码执行
  if(!(options.el && options.el.jquery)) return;
  EventEmitter.call(this);

  this.el = options.el;

  this.data = [];
  if($.isArray(options.data)){
    this.data = options.data;
  }

  this.$items = [];
  this.collection = [];

  this._createDOMTree();
  this._eventMount();
}

TableFilter.prototype = {
  _createDOMTree: function(){
    this.el.empty();

    var nodeList = [];

    for(var i = 0, data; data = this.data[i++];){
      var item =  new TableFilterItem(data);
      // 子节点渲染，并追加到即将渲染至this.el节点的列表中
      nodeList.push(item.render());
      // 加入过滤器集合中
      this.collection.push(item);
    }

    this.el.append(nodeList);
  },
  _eventMount: function(){
    for(var i = 0, item; item = this.collection[i++];){
      // 监听子节点发出的变更事件
      item.on('change', $.proxy(function(data){
        this.emit('change', data);
      }, this));
    }
  }
}

helper.inherits(TableFilter, EventEmitter);

module.exports = TableFilter;
