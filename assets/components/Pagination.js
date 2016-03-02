/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 简单分页组件
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/25
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');

var classPrefix = 'cp-pagination';

function Pagination(options){
  EventEmitter.apply(this, arguments);
  options = options || {};
  
  // 当传入的不是一个jQuery对象，终止后续代码执行
  if(!(options.el && options.el.jquery)) return;
  this.el = options.el;

  this.page =  1;
  if($.isNumeric(options.page)){
    this.page = options.page;
  }

  this.pageSize = 10;
  if($.isNumeric(options.pageSize)){
    this.pageSize = options.pageSize;
  }

  this.total = 0;
  if($.isNumeric(options.total)){
    this.total = options.total;
  }

  this.showPageTotal = options.showPageTotal || 5;

  this._createDOMTree();
  this._eventMount();
  this.refresh();
}

Pagination.prototype = {
  /**
   * 创建分页容器
   * @private
   */
  _createDOMTree: function(){
    this.container = $('<div class="'+ classPrefix +'"></div>');
    // this.first = $('<span title="首页">&lt;&lt;</span>');
    this.prev = $('<span title="上一页">&lt;</span>');
    this.pagerGroup = $('<div class="'+ classPrefix +'-group"></div>');
    this.next = $('<span title="下一页">&gt;</span>');
    // this.last = $('<span title="尾页">&gt;&gt;</span>');

    this.container
      .append(
        // this.first,
        this.prev,
        this.pagerGroup,
        this.next//,
        // this.last
      )
      .appendTo(this.el);
  },
  /**
   * 挂载事件
   * @private
   */
  _eventMount: function(){
    // this.first.on('click', $.proxy(this.handleFirstPage, this));
    this.prev.on('click', $.proxy(this.handlePrevPage, this));
    this.pagerGroup.on('click', '>span', $.proxy(this.handlePageItem, this));
    this.next.on('click', $.proxy(this.handleNextPage, this));
    // this.last.on('click', $.proxy(this.handleLastPage, this));
  },
  /*handleFirstPage: function(e){
    if(!this._isMinPage()){
      this.page = 1;
      this.emitChange();
    }
  },*/
  handlePrevPage: function(e){
    if(!this._isMinPage()){
      this.page -= 1;
      this.emitChange();
    }
  },
  handlePageItem: function(e){
    var $el = $(e.currentTarget),
      page = $el.attr('data-page');

    if(page == null) return;
    page = +page;
    if(!isNaN(page) && this.page !== page){
      this.page = page;
      this.emitChange();
    }
  },
  handleNextPage: function(){
    if(!this._isMaxPage()){
      this.page += 1;
      this.emitChange();
    }
  },
  /*handleLastPage: function(){
    if(!this._isMaxPage()){
      this.page = this._calcPageTotal();
      this.emitChange();
    }
  },*/
  /**
   * 检查是否达到最大页码
   * @return {Boolean}
   * @private
   */
  _isMaxPage: function(){
    return this.page === this._calcPageTotal();
  },
  /**
   * 检查是否达到最小页码
   * @return {Boolean}
   * @private
   */
  _isMinPage: function(){
    return this.page === 1;
  },
  emitChange: function(){
    this.emit('change', {
      page: this.page,
      pageSize: this.pageSize,
      total: this.total
    });
  },
  /**
   * 刷新分页控件
   */
  refresh: function(){
    var disabled = classPrefix + '-disabled';

    if(this.page === 1){
      this.prev
        // .add(this.first)
        .addClass(disabled);
    } else {
      this.prev
        // .add(this.first)
        .removeClass(disabled);
    }

    if(this.page === this._calcPageTotal()){
      this.next
        // .add(this.last)
        .addClass(disabled);
    } else {
      this.next
        // .add(this.last)
        .removeClass(disabled);
    }

    this.pagerGroup.html(this._createPagerGroup());
  },
  /**
   * 创建分页页码HTML碎片
   * @param  {Number} page
   * @return {String}     分页页码HTML碎片
   * @private
   */
  _createPager: function(page){
    return (
      '<span data-page="'+ page +'"'+ (this.page === page ? 'class="active"' : '') +' title="'+ page +'">'+
        page+
      '</span>'
    );
  },
  /**
   * 计算最大分页页码
   * @return {Number}
   */
  _calcPageTotal: function(){
    return Math.max(Math.ceil(this.total / this.pageSize), 1);
  },
  /**
   * 创建分页组
   * @return {String} 分页组HTML片段
   */
  _createPagerGroup: function(){
    var fragment = '',
      pageTotal = this._calcPageTotal();

    if(pageTotal <= this.showPageTotal + 4){
      for(var i = 1; i <= pageTotal; i++){
        fragment += this._createPager(i);
      }
    } else {
      var page = this.page,
        morePager = '<span class="'+ classPrefix +'-placeholder">...</span>',
        median = Math.floor(this.showPageTotal / 2),
        remain = this.showPageTotal - median,
        begin, end;

      // 当前页码第4页之前及第4页显示前面所有页码
      if(page <= 4){
        begin = 1;
        end = this.showPageTotal;

      } else if(page > pageTotal - 4){
        begin = pageTotal - this.showPageTotal;
        end = pageTotal;

      // 正常情况以当前页码为中间点，向前后延伸
      } else {
        begin = page - median;
        // 剩余页码，排除掉当前页码
        end = page + (remain - 1);
      }

      // 第4页时，调整页码尾端的最大值
      if(page === 4){
        end = this.showPageTotal + 1;
      }

      for(var i = begin; i <= end; i++){
        fragment += this._createPager(i);
      }

      // 大于第四页显示
      if(page > 4){
        fragment = this._createPager(1) + morePager + fragment;
      }

      if(page <= pageTotal - 4){
        fragment = fragment + morePager + this._createPager(pageTotal);
      }
    }

    return fragment;
  },
  /**
   * 设置页码
   * @param  {Number} page 页码
   */
  setPage: function(page){
    if($.isNumeric(page)){
      this.page = page;
      this.refresh();
    }
  },
  /**
   * 获取页码
   * @return {Number}
   */
  getPage: function(){
    return this.page;
  },
  /**
   * 设置单页显示数据量
   * @param  {Number} pageSize
   */
  setPageSize: function(pageSize){
    if($.isNumeric(pageSize)){
      this.pageSize = pageSize;
      this.refresh();
    }
  },
  /**
   * 获取单页显示数据量
   * @return {Number}
   */
  getPageSize: function(){
    return this.pageSize;
  },
  /**
   * 设置总数据量
   * @param  {Number} total
   */
  setTotal: function(total){
    if($.isNumeric(total)){
      this.total = total;
      this.refresh();
    }
  },
  /**
   * 获取总数据量
   * @return {Number}
   */
  getTotal: function(){
    return this.total;
  }
}

helper.inherits(Pagination, EventEmitter);

module.exports = Pagination;
