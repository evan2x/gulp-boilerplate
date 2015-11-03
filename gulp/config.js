/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks config
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

export default {
  /**
   * 替换静态资源路径时，需要添加的domain
   * @todo 常用于替换为CDN域名，暂不支持domain sharding
   * @type {String}
   */
  domain: '',
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
       * @todo 不会使用extensions
       * @type {String}
       */
      entry: 'main.js',
      /**
       * 提取公共模块为`common.js`
       * @todo 不会使用extensions
       * @type {String}
       */
      commonChunk: 'common.js',
      extensions: ['js']
    },
    css: {
      src: '/css',
      dest: '/css',
      sass: {
        outputStyle: 'expanded'
      },
      autoprefixer: {
        browsers: ['last 2 versions', '> 1% in CN', 'Firefox ESR', 'Opera 12.1', 'Safari >= 5']
      },
      extensions: ['css', 'scss']
    },
    svg: {
      src: '/svg',
      dest: '/svg',
      compress: {
        plugins: [
          { removeHiddenElems: false },
          { removeUselessDefs: false },
          { cleanupIDs: false }
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
        src: ['/iconfont/**/*.{eot,svg,ttf,woff}'],
        dest: '/iconfont',
        useHash: true
      }
    ]
  },
  /**
   * 模板配置
   * @todo
   * @see 关于base属性的说明 https://github.com/contra/glob2base/blob/master/README.md
   * @type {Object}
   */
  tmpl: {
    src: './views',
    dest: './dist',
    base: './',
    useref: {
      searchPath: './'
    },
    extensions: ['vm', 'ftl', 'html']
  }
};
