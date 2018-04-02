import path from 'path';
import { Glob } from 'glob';
import glob2base from 'glob2base';

/**
 * querystring式的版本类型
 * @type {Number}
 * @example
 *  /assets/xx.js?v=9fe32f9daf
 */
export const QUERY_VERSION = 1;

/**
 * filename式的版本类型
 * @type {Number}
 * @example
 *  /assets/xx-9fe32f9daf.js
 */
export const FILENAME_VERSION = 2;

const defaults = {
  /**
   * browser-sync 配置项
   * @type {Object}
   * @see https://browsersync.io/docs/options
   */
  browserSync: {
    server: {
      baseDir: './',
      index: 'views/index.html'
    },
    logPrefix: 'Boilerplate',
    open: false,
    port: 3000
  },
  /**
   * 文档输出目录
   * @type {String}
   */
  docDir: './docs',
  /**
   * 资源根目录
   * @type {String}
   */
  baseDir: './assets',
  /**
   * 版本类型
   * @type {String} filename 或者 query
   * @example
   *  filename:
   *    /assets/xx-9fe32f9daf.js
   *  query:
   *    /assets/xx.js?v=9fe32f9daf
   */
  versionType: 'query',
  /**
   * 资源输出相关配置
   * @type {Object}
   */
  output: {
    /**
     * 资源输出目录
     * @type {String}
     */
    path: './dist',
    /**
     * 资源通过网络访问时的路径
     * @type {String}
     * @example
     *  https://cdn.example.com/assets/
     *  //cdn.example.com/assets
     *  /yx
     */
    publicPath: ''
  },
  /**
   * 资源配置项
   * @todo 所有资源的src都相对于baseDir，所有资源的dest都相对于output配置
   * @type {Object}
   */
  assets: {
    manifest: './rev-manifest.json',
    /**
     * 模板配置项
     * @type {Object}
     */
    template: {
      src: '../views/**/*.{vm,ftl,html}',
      dest: `views/`
    },
    /**
     * JS参数配置
     * @type {Object}
     */
    script: {
      src: 'js/**/*.js',
      dest: 'assets/js/',
      /**
       * 在src中匹配的所有的js文件中指定entry模块作为browserify的入口模块
       * @type {String}
       */
      entry: 'main.js',
      /**
       * 提取公共模块为 common.js
       * @todo 不使用extensions
       * @type {String}
       */
      commonChunk: 'common.js',
      /**
       * 提取js模块中导入的样式，该文件输出位置相对于css配置项中指定的dest目录
       * @todo 不使用extensions
       * @type {String}
       */
      extractStyleFile: 'common.css',
      /**
       * 使用 vue 时相关的配置项
       */
      vueify: {
        /**
         * 是否使用 vue
         * @type {Boolean}
         */
        enable: false,
        /**
         * vue组件中提取的css输出文件，该文件输出位置相对于css配置项中指定的dest目录
         * @type {String}
         */
        extractStyleFile: 'bundle.css'
      },
      /**
       * 打包第三方模块
       * @type {Object}
       */
      vendor: {
        /**
         * 需要打包的模块
         * @type {Array}
         */
        modules: ['babel-polyfill'],
        /**
         * vendor包的输出文件
         * @type {String}
         */
        chunkName: 'vendor.js'
      },
      /**
       * 配置此项后，在导入模块时可省略文件扩展名
       * @type {Array}
       */
      extensions: [],
      /**
       * 查找模块目录，该选项避免了 ../../../ 这种引用模块的方式
       * @todo node_modules会强制作为模块的第一个搜索目录
       * @type {Array}
       */
      modulesDirectories: ['assets']
    },
    /**
     * CSS参数配置
     * @type {Object}
     */
    style: {
      src: 'css/**/*.css',
      dest: 'assets/css/'
    },
    /**
     * 图片配置项
     * @type {Object}
     */
    image: {
      src: 'img/**/*.{png,jpg,jpeg}',
      dest: 'assets/img/'
    },
    /**
     * 静态HTML文件
     * @type {Object}
     */
    html: {
      src: 'html/**/*.html',
      dest: 'assets/html/'
    },
    /**
     * SVG文件配置项
     * @type {Object}
     */
    svg: {
      src: 'svg/**/*.svg',
      dest: 'assets/svg/',
      /**
       * 压缩SVG文件配置项
       * @type {Object}
       * @see https://github.com/ben-eb/gulp-svgmin
       */
      compress: {
        plugins: [
          { removeHiddenElems: false },
          { removeUselessDefs: false },
          { cleanupIDs: false }
        ]
      }
    },
    /**
     * 其他只用于拷贝文件及使用[useHash]来设置是否对文件添加版本号的资源
     * @type {Array}
     */
    copies: [
      {
        src: '/font/**/*.{eot,svg,ttf,woff}',
        dest: 'assets/font',
        useHash: true
      }
    ]
  }
};

/**
 * 图标配置项
 * @type {Object}
 */
defaults.icon = {
  src: path.posix.join(defaults.baseDir, 'icon'),
  /**
   * SVG Symbols配置项
   * @type {Object}
   */
  symbols: {
    /**
     * 指定生成的SVG Symbols输出位置
     * @type {String}
     */
    dest: path.posix.join(defaults.baseDir, 'svg'),
    /**
     * 输出文件名
     * @type {String}
     */
    name: 'icon-symbols.svg',
    /**
     * 使用文档输出位置
     * @type {String}
     */
    doc: path.posix.join(defaults.docDir, 'svg-symbols/demo.html')
  },
  /**
   * iconfont配置项
   * @type {Object}
   */
  iconfont: {
    /**
     * 指定iconfont输出位置
     * @type {String}
     */
    dest: path.posix.join(defaults.baseDir, 'font'),
    /**
     * iconfont输出文件名
     * @type {String}
     */
    name: 'iconfont',
    formats: ['svg', 'ttf', 'eot', 'woff'],
    /**
     * 样式文件输出位置
     * @type {String}
     */
    style: path.posix.join(defaults.baseDir, glob2base(new Glob(defaults.assets.style.src)), 'iconfont.css'),
    /**
     * 使用文档输出位置
     * @type {String}
     */
    doc: path.posix.join(defaults.docDir, 'iconfont/demo.html')
  }
};

export default defaults;
