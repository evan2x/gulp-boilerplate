/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 历史满标模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var Table = require('components/Table');
var Pagination = require('components/Pagination');
var helper = require('js/common/helper');
var StoreCreator = helper.StoreCreator;
var request = require('js/common/request');

var PRODUCT_LIST_ACTION = '/bxt/productList.json';

var TABLE_FIELDS = [
  {
    name: '产品名称',
    value: 'prodName',
    width: '180px',
    align: 'center'
  },
  {
    name: '约定年化收益率',
    value: 'yearIrr',
    width: '140px',
    align: 'center',
    content: function(row){
      return ((row.yearIrr * 100).toFixed(2) + '%');
    }
  },
  {
    name: '满标日期',
    value: 'effectDateString',
    width: '140px',
    align: 'center'
  },
  {
    name: '成交笔数',
    value: 'trades',
    width: '70px',
    align: 'center',
    content: function(row){
      return (row.trades + '笔');
    }
  },
  {
    name: '产品总金额',
    value: 'prodAmount',
    width: '120px',
    align: 'center',
    content: function(row){
      return (helper.formatNumber(row.prodAmount.toFixed(2)) + '元');
    }
  },
  {
    name: '满标耗时',
    value: 'finishTotalTime',
    align: 'center',
    width: '160px'
  }
];

var LOADED = false;

exports.load = function(cb){
  if(LOADED) return;
  LOADED = true;

  var store = new StoreCreator({
    page: 1,
    total: 0,
    pageSize: 10,
    sortBy: 'rateOfReturn',
    orderBy: 'desc'
  });

  var actions = {
    tableSort: function(data){
      store.dispatch({
        type: 'TABLE_SORT',
        data: {
          sortBy: data.sortBy,
          orderBy: data.orderBy
        }
      });
    },
    pageChange: function(data){
      store.dispatch({
        type: 'PAGE_CHANGE',
        data: {
          page: data.page,
          pageSize: data.pageSize,
          total: data.total
        }
      });
    },
    start: function(){
      store.dispatch({
        type: 'INIT_TABLE'
      });
    }
  }

  var initialData = store.toPlainObject();

  var saleHistoryPager = new Pagination({
    el: $('#historyPagination'),
    page: initialData.page,
    pageSize: initialData.pageSize,
    total: initialData.total
  });

  var saleHistoryTable = new Table({
    el: $('#historyTable'),
    noDataMessage: '没有相关的产品',
    fields: TABLE_FIELDS,
    sortBy: initialData.sortBy,
    orderBy: initialData.orderBy
  });
  
  store.subscribe(function(payload){
    var data = store.toPlainObject();

    request({
      url: PRODUCT_LIST_ACTION,
      data: {
        tabType: 2,
        pageNum: data.page,
        pageSize: data.pageSize,
        orderParam: data.sortBy,
        orderRule: data.orderBy
      }
    })
    .then(function(data){
      var page = data.page;

      saleHistoryPager.setPage(page.pageNum);
      saleHistoryPager.setPageSize(page.pageSize);
      saleHistoryPager.setTotal(page.totalCount);

      saleHistoryTable.render(data.list);
      $.isFunction(cb) && cb();
    });
  });  
  
  saleHistoryTable.on('sort', function(data){
    actions.tableSort(data);
  });

  saleHistoryPager.on('change', function(data){
    actions.pageChange(data);
  });

  actions.start();
};
