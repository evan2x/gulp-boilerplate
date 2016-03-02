/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 简单表格组件
 * @todo 暂不支持跨列
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/25
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var helper = require('js/common/helper');

var HEADER_ABSOLUTE = 0,
  HEADER_FIXED = 1;

var ALIGN_PROPERTIES = {
  left: 1,
  center: 1,
  right: 1
};

var ORDER_TYPE = {
  asc: 1,
  desc: 1
};

var $win = $(window);

var classPrefix = 'cp-table';

var SORTABLE_CLASSNAME = classPrefix + '-field-sortable';

/**
 * 表格控件
 * @param {Object} options 参数
 * @param {jQuery Object} options.el 表格容器
 * @param {Array<Object>} options.fields 表头
 * @param {Array<Object>} options.data 表格主体数据
 * @param {String} options.noDataMessage 无数据时的提示信息
 * @param {Boolean} options.useLockHeader 是否开启锁定表头
 * @param {String} options.lockHeaderOffsetTop 锁定表头后，表头距离顶部的位置
 * @example
 * fields:
 *  [
 *    {
 *      name: '用户名',
 *      value: 'username',
 *      width: '300px'
 *    },
 *    {
 *      name: '年龄',
 *      value: 'age',
 *      sortable: true,
 *      width: '100px',
 *      align: 'right',
 *      content: function(data){
 *        return data.age + '岁';
 *      }
 *    },
 *  ]
 *
 * data:
 *  [
 *    {
 *      username: 'evan2x',
 *      age: 23
 *    }
 *  ]
 */
function Table(options){
  EventEmitter.apply(this, arguments);
  options = options || {};

  // 当传入的不是一个jQuery对象，终止后续代码执行
  if(!(options.el && options.el.jquery)) return;

  this.el = options.el;
  this.noDataMessage = options.noDataMessage || '暂无数据';

  this.useLockHeader = true;
  if(typeof options.useLockHeader === 'boolean'){
    this.useLockHeader = options.useLockHeader;
  }

  this.lockHeaderOffsetTop = options.lockHeaderOffsetTop || '0px';
  this.sortBy = options.sortBy || '';

  this.orderBy = '';
  if(options.orderBy && ORDER_TYPE[options.orderBy]){
    this.orderBy = options.orderBy;
  }

  this.data = [];
  if($.isArray(options.data)){
    this.data = options.data;
  }

  this.header = {};
  this.header.fields = [];
  if($.isArray(options.fields)){
    this.header.fields = options.fields;
  }

  this._initDOMTree();
  this.renderHeader();
  this._eventMount();

  if(this.data.length){
    this.render();
  }
}

Table.prototype = {
  /**
   * 初始化表格容器
   * @private
   */
  _initDOMTree: function(){
    this.table = $(
      '<table class="'+ classPrefix +'">'+
        '<thead></thead>'+
        '<tbody></tbody>'+
      '</table>'
    );
    this.el.append(this.table);

    // 开启锁定表头，单独生成一个表头
    if(this.useLockHeader){

      this.header.$el = $(
        '<div class="'+ classPrefix +'-head">'+
          '<table class="'+ classPrefix +'">'+
            '<thead></thead>'+
          '</table>'+
        '</div>'
      );

      this.el.prepend(this.header.$el);
    }

    this.header.rangeMin = this.table.offset().top;
    this.header.width = this.table.outerWidth();
  },
  /**
   * 初始化挂载事件
   * @private
   */
  _eventMount: function(){
    // 排序按钮的委托元素
    var $delegation = this.table;

    // 锁定表头开启时，监听document的scroll事件
    if(this.useLockHeader){
      $win.on('scroll', $.proxy(this.handleLockHeader, this));
      $delegation = this.header.$el;
    }

    $delegation.on(
      'click',
      '.' + SORTABLE_CLASSNAME,
      $.proxy(this.handleFieldSort, this)
    );
  },
  handleLockHeader: function(e){
    if(this.el.is(':visible')){
      var scrollTop = $(e.currentTarget).scrollTop(),
        header = this.header;

      if(scrollTop >= header.rangeMin && scrollTop <= header.rangeMax){
        if(header.status !== HEADER_FIXED){
          header.$el.css({
            position: 'fixed',
            top: this.lockHeaderOffsetTop
          });
          header.status = HEADER_FIXED;
        }
      } else {
        if(header.status !== HEADER_ABSOLUTE){
          header.$el.css({
            position: 'absolute',
            top: 'auto'
          });
          header.status = HEADER_ABSOLUTE;
        }
      }
    }
  },
  handleFieldSort: function(e){
    var $sortBtn = $(e.currentTarget),
      value = $sortBtn.attr('data-value');

    this.sortBtnGroup
      .removeClass('active-asc')
      .removeClass('active-desc');

    if(this.sortBy === value){
      this.orderBy = this.orderBy === 'asc' ? 'desc' : 'asc';
      $sortBtn.addClass('active-' + this.orderBy);
    } else {
      this.sortBy = value;
      this.orderBy = 'desc';
      $sortBtn.addClass('active-desc');
    }

    this.emit('sort', {
      sortBy: this.sortBy,
      orderBy: this.orderBy
    });
  },
  _createHeader: function(){
    var fields = this.header.fields,
      fragment = '';

    for(var i = 0, item; item = fields[i++];){
      var colspan = '',
        style = '',
        className = '';

      if($.isNumeric(item.colspan) && item.colspan > 1){
        colspan = ' colspan="'+ item.colspan +'"';
      }

      if(item.width){
        style += 'width:' + item.width + ';';
      }

      if(style){
        style = ' style="'+ style +'"';
      }

      if(item.sortable){
        className += SORTABLE_CLASSNAME;
      }

      if(this.sortBy === item.value){
        className += ' active-' + this.orderBy;
      }

      fragment += (
        '<th'+ colspan + style +''+ (item.sortable ? (' class="'+ className +'"') : '') +' data-value="'+ item.value +'">' +
          '<span>'+
            item.name +
          '</span>' +
          (item.sortable ? this._createSortBtn() : '') +
        '</th>'
      );
    }
    fragment = '<tr>' + fragment + '</tr>';

    return fragment;
  },
  _createBody: function(data){
    var fields = this.header.fields,
      rows = '';

    if(data.length){
      var value, colspan, style, row;

      for(var i = 0, item; item = data[i++];){
        row = '<tr>';
        for(var count = 0, field; field = fields[count++];){
          colspan = '';
          value = '',
          style = '';

          if($.isFunction(field.content)){
            value = field.content(item);
          } else {
            value = item[field.value];
          }

          // 将value为null或者undefined的数据转成空字符串
          if(value == null){
            value = '';
          }

          if($.isNumeric(field.colspan) && field.colspan > 1){
            colspan = ' colspan="'+ field.colspan +'"';
          }

          if(field.align && ALIGN_PROPERTIES[field.align]){
            style += 'text-align:' + field.align + ';';
          }

          if(field.width){
            style += 'width:' + field.width + ';';
          }

          if(style){
            style = ' style="'+ style +'"';
          }

          row += '<td'+ colspan + style +'>'+ value +'</td>';
        }
        row += '</tr>';

        rows += row;
      }

    } else {
      rows += (
        '<tr>'+
          '<td colspan="'+ fields.length +'" style="text-align:center">'+
            this.noDataMessage +
          '</td>'+
        '<tr>'
      );
    }

    return rows;
  },
  /**
   * 渲染表格内容区域
   * @param {Array?} 表格数据
   */
  render: function(){
    var data = this.data;

    if($.isArray(arguments[0])){
      data = arguments[0];
    }

    // 表格数据填充
    this.table
      .find('tbody')
      .html(this._createBody(data));

    // 更新表头的最大锁定位置
    this.header.rangeMax = this.header.rangeMin + this.table.height() - this.header.height;
    // 重新设置一次锁定列的
    this._resetLockHeaderCellsWidth();
  },
  _resetLockHeaderCellsWidth: function(){
    if(this.useLockHeader){
      var cells = this.header.cells,
        count = 0,
        width = this.theadCells.map(function(i, item){
          return $(item).width();
        });

      for(var w, cell; cell = cells[count];count++){
        w = width[count];
        // fixed: 第一个单元格增加1像素
        if(count === 0){
          w += 1;
        }
        cell.style.width = w + 'px';
      }
    }
  },
  /**
   * 渲染表头
   */
  renderHeader: function(){
    var headerFragment = this._createHeader(),
      findRange = this.table;

    // 渲染普通表头
    this.table.find('thead').html(headerFragment);
    this.theadCells = this.table.find('thead th');

    // 开启锁定表头功能则单独生成一个表头
    if(this.useLockHeader){
      // 更新表头高度
      this.header.height = this.theadCells.first().innerHeight();
      // 设置锁定表头的初始属性
      this.header.$el
        .css({
          width: this.header.width,
          height: this.header.height,
          position: 'absolute',
          overflow: 'hidden'
        })
        .find('thead')
        .html(headerFragment);

      this.header.cells = this.header.$el.find('thead th');
      findRange = this.header.$el;
    }

    // 记录所有排序按钮
    this.sortBtnGroup = findRange.find('th.' + SORTABLE_CLASSNAME);
  },
  _createSortBtn: function(){
    var className = SORTABLE_CLASSNAME + '-btn';

    return (
      '<div class="'+ className +'" style="display:inline-block">' +
        '<span class="'+ classPrefix +'-field-asc"></span>' +
        '<span class="'+ classPrefix +'-field-desc"></span>' +
      '</div>'
    );
  }
}

helper.inherits(Table, EventEmitter);

module.exports = Table;
