/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks config
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

export default {
  /**
   * 静态资源引用添加的前缀
   * @type {String}
   */
  prefix: '',
  /**
   * 静态资源路径清单
   * @type {String}
   */
  manifest: './rev-manifest.json',
  browserSync: {
    server: {
      baseDir: './',
      index: 'views/index.html'
    },
    logPrefix: 'CreditEase',
    open: false,
    port: 3000
  },
  /**
   * 静态资源
   * @todo 所有资源的src都相对于rootpath的src，dest同理
   * @type {Object}
   */
  assets: {
    rootpath: {
      src: './assets',
      dest: './dist/assets'
    },
    js: {
      src: '/js',
      dest: '/js',
      /**
       * 抓取src下所有的`main.js`作为browserify入口模块
       * @todo 不使用extensions
       * @type {String}
       */
      entry: 'main.js',
      /**
       * 提取公共模块为`common.js`
       * @todo 不使用extensions
       * @type {String}
       */
      commonChunk: 'common.js',
      extensions: ['js'],
      modulesDirectories: ['node_modules', 'assets']
    },
    css: {
      src: '/css',
      dest: '/css',
      autoprefixer: {
        browsers: ['last 2 versions', '> 1% in CN', 'Firefox ESR', 'Opera 12.1', 'Safari >= 5', 'ie >= 8']
      },
      extensions: ['css']
    },
    html: {
      src: '/html',
      dest: '/html',
      extensions: ['html']
    },
    svg: {
      src: '/svg',
      dest: '/svg',
      compress: {
        plugins: [
          {removeHiddenElems: false},
          {removeUselessDefs: false},
          {cleanupIDs: false}
        ]
      },
      extensions: ['svg']
    },
    img: {
      src: '/img',
      dest: '/img',
      extensions: ['jpg', 'jpeg', 'png']
    },
    /**
     * other下的资源仅copy
     * @todo useHash表示是否添加hash version(只在revision task下有效)
     * @type {Object}
     */
    other: [
      {
        src: ['/font'],
        dest: '/font',
        extensions: ['eot', 'svg', 'ttf', 'woff'],
        useHash: true
      }
    ]
  },
  /**
   * 模板配置
   * @type {Object}
   */
  tpl: {
    src: './views',
    dest: './dist/views',
    extensions: ['vm']
  }
};
