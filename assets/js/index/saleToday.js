/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @desc 今日在售模块
 * @author aiweizhang(aiweizhang@creditease.cn)
 * @date 2015/11/22
 */

'use strict';

var TableFilter = require('components/TableFilter');
var Table = require('components/Table');
var Pagination = require('components/Pagination');
var helper = require('js/common/helper');
var StoreCreator = helper.StoreCreator;
var request = require('js/common/request');

var PRODUCT_LIST_ACTION = '/bxt/productList.json';

var FILTER_DATA = [
  {
    id: 'yieldRate',
    name: '年化收益率',
    useInput: true,
    values: [
      {
        name: '全部',
        width: '60px',
        selected: true
      },
      {
        name: '9%以下',
        min: '0',
        max: '9'
      },
      {
        name: '9%~10%',
        min: '9',
        max: '10'
      },
      {
        name: '10%以上',
        min: '10'
      }
    ]
  },
  {
    id: 'expireDate',
    name: '距离到期日',
    useInput: true,
    values: [
      {
        name: '全部',
        width: '60px',
        selected: true
      },
      {
        name: '0天～60天',
        min: '0',
        max: '60'
      },
      {
        name: '60天～180天',
        min: '60',
        max: '180'
      },
      {
        name: '180天～365天',
        min: '180',
        max: '365'
      },
      {
        name: '365天以上',
        min: '365'
      }
    ]
  },
  {
    id: 'amountAvailable',
    name: '可购买金额',
    useInput: true,
    values: [
      {
        name: '全部',
        width: '60px',
        selected: true
      },
      {
        name: '100元～1000元',
        min: '100',
        max: '1000'
      },
      {
        name: '1000元～10000元',
        min: '1000',
        max: '10000'
      },
      {
        name: '10000元～50000元',
        min: '10000',
        max: '50000'
      },
      {
        name: '50000元以上',
        min: '50000'
      }
    ]
  }
];

var TABLE_FIELDS = [
  {
    name: '产品名称',
    value: 'prodName',
    width: '150px',
    align: 'center'
  },
  {
    name: '约定年化收益率',
    value: 'yearIrr',
    width: '160px',
    align: 'center',
    sortable: true,
    content: function(row){
      return ((row.yearIrr * 100).toFixed(2) + '%');
    }
  },
  {
    name: '距离到期日',
    value: 'remainingDay',
    width: '120px',
    align: 'center',
    sortable: true,
    content: function(row){
      return (row.remainingDay + '天');
    }
  },
  {
    name: '可购买金额',
    value: 'remainAmount',
    width: '160px',
    align: 'center',
    sortable: true,
    content: function(row){
      var progress = row.progress;
      if(progress > 1){
        progress = 1;
      }
      var fragment = '<div>'+ (helper.formatNumber(row.remainAmount.toFixed(2)) || 0.00) +'元<div>';
      if(row.nonPaymentAmount && progress * 100 == 100){
        fragment += (
          '<div style="font-size:12px;color:#f00">未付款:' + 
          helper.formatNumber(row.nonPaymentAmount.toFixed(2)) +
          '元</div>'
        );
      }

      return fragment;
    }
  },
  {
    name: '成交笔数',
    value: 'trades',
    width: '90px',
    align: 'center',
    content: function(row){
      return (row.trades + '笔');
    }
  },
  {
    name: '购买进度',
    value: 'progress',
    width: '200px',
    align: 'left',
    content: function(row){
      var progress = row.progress;
      if(progress > 1){
        progress = 1;
      }
      return (
        '<div class="progress-bar">'+
          '<span style="width:'+ (progress * 100).toFixed(2) +'%"></span>'+
        '</div>'+
        '<span class="progress-value">'+ (progress * 100).toFixed(2) +'%</span>'
      );
    }
  },
  {
    name: '操作',
    value: 'operation',
    width: '100px',
    align: 'center',
    content: function(row){
      var text = '立即购买';
      var progress = row.progress;
      if(progress > 1){
        progress = 1;
      }

      if(row.nonPaymentAmount && progress * 100 == 100){
        text = '还有机会';
      }

      return (
        '<span class="table-operation-btn gs-tracker" data-id="'+ row.id +'">'+ 
          text+
        '</span>'
      );
    }
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
    sortBy: 'yearIrr',
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
    filterChange: function(data){
      var ret = {
        page: 1
      };

      ret[data.id] = {
        min: data.min,
        max: data.max
      };

      store.dispatch({
        type: 'FILTER_CHANGE',
        data: ret
      });
    },
    start: function(){
      store.dispatch({
        type: 'INIT_TABLE'
      });
    }
  }

  var initialData = store.toPlainObject();

  var tableFilter = new TableFilter({
    el: $('#todayFilter'),
    data: FILTER_DATA
  });

  var saleTodayPager = new Pagination({
    el: $('#todayPagination'),
    page: initialData.page,
    pageSize: initialData.pageSize,
    total: initialData.total
  });

  var saleTodayTable = new Table({
    el: $('#todayTable'),
    noDataMessage: '没有相关的产品',
    fields: TABLE_FIELDS,
    sortBy: initialData.sortBy,
    orderBy: initialData.orderBy
  });

  $('#todayTable').on('click', '.gs-tracker', function(){
    var id = this.getAttribute('data-id');
    if (window._gsTracker) {
      window._gsTracker.track('/targetpage/invest/bxtlijigoumai');
    }

    window.location.href = '/bxt/purchase.html?tradeId=' + id;
  });

  store.subscribe(function(payload){
    var data = store.toPlainObject();

    data.yieldRate = data.yieldRate || {};
    data.expireDate = data.expireDate || {};
    data.amountAvailable = data.amountAvailable || {};

    request({
      url: PRODUCT_LIST_ACTION,
      data: {
        tabType: 0,
        minYieldRate: data.yieldRate.min,
        maxYieldRate: data.yieldRate.max,
        minProdAmount: data.amountAvailable.min,
        maxProdAmount: data.amountAvailable.max,
        minDueDate: data.expireDate.min,
        maxDueDate: data.expireDate.max,
        pageNum: data.page,
        pageSize: data.pageSize,
        orderParam: data.sortBy,
        orderRule: data.orderBy
      }
    })
    .then(function(data){
      var page = data.page;

      saleTodayPager.setPage(page.pageNum);
      saleTodayPager.setPageSize(page.pageSize);
      saleTodayPager.setTotal(page.totalCount);

      saleTodayTable.render(data.list);
      $.isFunction(cb) && cb();
    });
  });

  tableFilter.on('change', function(data){
    actions.filterChange(data);
  });

  saleTodayTable.on('sort', function(data){
    actions.tableSort(data);
  });

  saleTodayPager.on('change', function(data){
    actions.pageChange(data);
  });

  actions.start();
};
