/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 变现历史入口模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';
   
var Table = require('components/Table');
var Pagination = require('components/Pagination');
var helper = require('js/common/helper');
var StoreCreator = helper.StoreCreator;
var alert = require('components/Alert');
var request = require('js/common/request');

var HISTORY_LIST_ACTION = '/bxt/historyList.json';
var CANCEL_CASH_ACTION = '/bxt/realizationCancel.json';

var INVEST_NUMBERS = __GLOBAL_CONFIG__.INVEST_NUMBERS;
   
var TABLE_FIELDS = [
  {
    name: '申请变现日期',
    value: 'applyDateStr',
    align: 'center',
    width: '130px'
  },
  {
    name: '申请变现金额',
    value: 'applyAmount',
    align: 'center',
    width: '120px',
    content: function(row){
      return helper.formatNumber(row.applyAmount.toFixed(2));
    }
  },
  {
    name: '变现类型',
    value: 'tradeType',
    align: 'center',
    width: '90px',
    content: function(row){
      if(row.tradeType === 1){
        return '友情变现';
      } else if(row.tradeType === 0){
        return '普通变现';
      }
    }
  },
  {
    name: '变现模式',
    value: 'isContinue',
    align: 'center',
    width: '90px',
    content: function(row){
      if(row.isContinue === 1){
        return '持续变现';
      } else if(row.isContinue === 0) {
        return '一次变现';
      }
    }
  },
  {
    name: '变现利率',
    value: 'yearIrr',
    width: '90px',
    align: 'center',
    content: function(row){
      return (row.yearIrr * 100).toFixed(2) + '%';
    }
  },
  {
    name: '成交笔数',
    value: 'dealNums',
    width: '90px',
    align: 'center',
    content: function(row){
      return (row.dealNums + '笔');
    }
  },
  {
    name: '已成交金额',
    value: 'dealAmount',
    width: '120px',
    align: 'center',
    content: function(row){
      return helper.formatNumber(row.dealAmount.toFixed(2));
    }
  },
  {
    name: '剩余金额',
    value: 'amtBalance',
    width: '120px',
    align: 'center',
    content: function(row){
      return helper.formatNumber(row.amtBalance.toFixed(2));
    }
  },
  {
    name: '手续费',
    value: 'feeDeduction',
    width: '120px',
    align: 'center',
    content: function(row){
      return helper.formatNumber(row.feeDeduction.toFixed(2));
    }
  },
  {
    name: '到账金额',
    value: 'accountAmt',
    width: '120px',
    align: 'center',
    content: function(row){
      return helper.formatNumber(row.accountAmt.toFixed(2));
    }
  },
  {
    name: '状态',
    value: 'status',
    width: '100px',
    align: 'center',
    content: function(row){
      switch(row.prodStatus) {
        case '0':
          var fragment = '<span style="display:block">变现中</span>';
          if(row.cancelCashApply === '1'){
            fragment += '<span class="cancel-cash-btn" data-id="'+ row.prodNo +'">取消变现</span>';
          }
          return fragment;
        case '1':
          if(row.applyAmount == row.dealAmount){
            return '<span>变现成功</span>';
          } else {
            return '<span>部分成功</span>';
          }
        case '2':
          return '<span style="color:#f60">变现失败</span>';
        case '3':
          return '<span>产品结束</span>';
        default:
          return '';
      }
    }
  }
];
   
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
   
var saleTodayPager = new Pagination({
  el: $('#cashHistoryPagination'),
  page: initialData.page,
  pageSize: initialData.pageSize,
  total: initialData.total
});

var saleTodayTable = new Table({
  el: $('#cashHistoryTable'),
  noDataMessage: '暂无变现记录',
  fields: TABLE_FIELDS,
  sortBy: initialData.sortBy,
  orderBy: initialData.orderBy
});

store.subscribe(function(payload){
  var data = store.toPlainObject();
  
  request({
    url: HISTORY_LIST_ACTION,
    data: {
      investNo: INVEST_NUMBERS,
      pageNum: data.page,
      pageSize: data.pageSize
    }
  })
  .then(function(data){
    var page = data.page;

    saleTodayPager.setPage(page.pageNum);
    saleTodayPager.setPageSize(page.pageSize);
    saleTodayPager.setTotal(page.totalCount);

    saleTodayTable.render(data.list);
  });
});

saleTodayPager.on('change', function(data){
  actions.pageChange(data);
});
  
actions.start();

$('#cashHistoryTable').on('click', '.cancel-cash-btn', function(e){
  var el = e.currentTarget;
  if(confirm('确定要取消变现？')){
    request({
      url: CANCEL_CASH_ACTION,
      type: 'POST',
      data: {
        prodNo: el.getAttribute('data-id')
      }
    })
    .then(function(data){
      actions.start();
    });
  }
});