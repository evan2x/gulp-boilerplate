
export default {
  /**
   * 静态资源CDN域名
   */
  domain: '',
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
      /**
       * babel helper
       * @todo 不使用extensions
       * @type {String}
       */
      babelHelper: 'babelHelpers.js',
      /**
       * 将modules中指定的模块打包到一起，并输出到output指定的文件中
       * @todo babel-polyfill会强制打包到output文件中
       * @type {Object}
       */
      vendor: {
        modules: [],
        output: 'vendor.js'
      },
      /**
       * 模块目录，该选项避免了 ../../../ 这种引用模块的方式
       * @todo node_modules会强制作为模块的第一个搜索目录
       * @type {Array}
       */
      modulesDirectories: ['assets'],
      extensions: ['js']
    },
    css: {
      src: '/css',
      dest: '/css',
      autoprefixer: {
        browsers: ['last 2 versions', '> 1% in CN', 'Firefox ESR', 'Opera 12.1', 'Safari >= 5', 'ie >= 8']
      },
      /**
       * CSS Sprites config
       * @type {Object}
       */
      sprites: {
        /**
         * 从CSS中收集图片时的根路径
         * @type {String}
         */
        basePath: './',
        extensions: ['png']
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
      /**
       * SVG跨域存在问题，所以通常来说不使用全局的domain
       * @type {Boolean}
       */
      useDomain: false,
      extensions: ['svg']
    },
    /**
     * 图标配置，可生成SVG Symbols和iconfont
     * @todo 注意图标的目录下有生成文档的模板，请不要修改模板目录及模板名称
     * @type {Object}
     */
    icon: {
      src: '/icon',
      /**
       * SVG Symbols配置项
       * @type {Object}
       */
      symbols: {
        dest: '/svg',
        name: 'icon-symbols.svg',
        related: {
          doc: '/doc/svg-symbols/demo.html'
        }
      },
      /**
       * iconfont配置项
       * @type {Object}
       */
      font: {
        dest: '/font',
        name: 'iconfont',
        formats: ['svg', 'ttf', 'eot', 'woff'],
        related: {
          style: '/css/iconfont.css',
          doc: '/doc/iconfont/demo.html'
        }
      }
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
        src: '/font',
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
    extensions: ['html', 'vm']
  }
};
