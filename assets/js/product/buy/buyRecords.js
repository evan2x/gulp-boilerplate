/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现购买页-购买记录
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/12/02
 */

'use strict';
   
var Table = require('components/Table');
var Pagination = require('components/Pagination');
var helper = require('js/common/helper');
var StoreCreator = helper.StoreCreator;
var request = require('js/common/request');

var PRODUCT_ID = __GLOBAL_CONFIG__.PRODUCT_ID;

var BUY_RECORDS_ACTION = '/bxt/tradeDetail.json';
   
var TABLE_FIELDS = [
  {
    name: '出借人',
    value: 'mobile',
    align: 'center',
    width: '300px'
  },
  {
    name: '购买金额',
    value: 'tradeAmount',
    align: 'center',
    width: '330px',
    content: function(row){
      return helper.formatNumber((+row.tradeAmount).toFixed(2));
    }
  },
  {
    name: '出借时间',
    value: 'tradeDate',
    align: 'center',
    width: '300px'
  },
  {
    name: '购买状态',
    value: 'tradeStatus',
    align: 'center',
    width: '200px',
    content: function(row){
      switch(row.tradeStatus) {
        case 0:
          return '未付款';
        case 1:
        case 2:
          return '已完成';
        default:
          return '';
      }
    }
  }
];

var LOADED = false;

exports.load = function(){
  if(LOADED) return;
  LOADED = true;

  var store = new StoreCreator({
    page: 1,
    total: 0,
    pageSize: 10
  });

  var actions = {
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
     
  var buyRecordsPager = new Pagination({
    el: $('#buyRecordPagination'),
    page: initialData.page,
    pageSize: initialData.pageSize,
    total: initialData.total
  });

  var buyRecordsTable = new Table({
    el: $('#buyRecordTable'),
    noDataMessage: '暂无购买记录',
    fields: TABLE_FIELDS,
    sortBy: initialData.sortBy,
    orderBy: initialData.orderBy
  });

  store.subscribe(function(payload){
    var data = store.toPlainObject();
    request({
      url: BUY_RECORDS_ACTION,
      data: {
        prodNo: PRODUCT_ID,
        pageNum: data.page,
        pageSize: data.pageSize
      }
    })
    .then(function(data){
      var page = data.page;

      buyRecordsPager.setPage(page.pageNum);
      buyRecordsPager.setPageSize(page.pageSize);
      buyRecordsPager.setTotal(page.totalCount);

      buyRecordsTable.render(data.list);
    });
  });

  buyRecordsPager.on('change', function(data){
    actions.pageChange(data);   
  });
    
  actions.start();
}
   
