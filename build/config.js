import path from 'path';
import { Glob } from 'glob';
import glob2base from 'glob2base';

/**
 * 资源根目录
 * @type {String}
 */
const base = './assets';

/**
 * 资源输出目录
 * @type {String}
 */
const output = './dist';

/**
 * 文档输出目录
 * @type {String}
 */
const docs = './docs';

const config = {
  /**
   * 资源CDN域名
   * @type {String}
   */
  domain: '',
  /**
   * 资源访问路径前缀
   * @type {String}
   */
  prefix: '',
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
    logPrefix: 'CreditEase',
    open: false,
    port: 3000
  },
  /**
   * 资源配置项
   * @todo 所有资源的[src]都相对于[base]，所有资源的[dest]都相对于[output]
   * @type {Object}
   */
  assets: {
    base: path.posix.normalize(base),
    output: path.posix.join(output, 'assets'),
    /**
     * gulp-rev静态资源清单文件输出路径
     * @type {String}
     */
    manifest: './rev-manifest.json',
    /**
     * 版本号格式
     * @type {String} filename 或者 query
     */
    versionFormat: 'query',
    /**
     * JS参数配置
     * @type {Object}
     */
    js: {
      src: 'js/**/*.js',
      dest: 'js/',
      /**
       * 从[src]中匹配的所有JS中指定的[entry]模块作为browserify入口模块
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
       * 提取模块转译过程中babel用到的辅助方法到 babelHelpers.js 中
       * @todo 不使用extensions
       * @type {String}
       */
      babelHelpers: 'babelHelpers.js',
      /**
       * 使用 vue 时相关的配置项
       */
      vueify: {
        /**
         * 是否使用 vue
         * @type {Boolean}
         */
        enable: false,
        css: {
          /**
           * vue组件中提取的css输出文件，该文件输出位置相对于css配置项中指定的dest目录
           * @type {String}
           */
          filename: 'bundle.css'
        }
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
        modules: [],
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
    css: {
      src: 'css/**/*.css',
      dest: 'css/'
    },
    /**
     * 图片配置项
     * @type {Object}
     */
    img: {
      src: 'img/**/*.{png,jpg,jpeg}',
      dest: 'img/'
    },
    /**
     * 静态HTML文件
     * @type {Object}
     */
    html: {
      src: 'html/**/*.html',
      dest: 'html/'
    },
    /**
     * SVG文件配置项
     * @type {Object}
     */
    svg: {
      src: 'svg/**/*.svg',
      dest: 'svg/',
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
      },
      /**
       * SVG跨域存在问题，所以通常来说不使用全局的domain
       * @type {Boolean}
       */
      useDomain: false
    },
    /**
     * 其他资源
     * @todo 只用于拷贝文件及使用[useHash]来设置是否对文件添加版本号
     * @type {Array}
     */
    other: [
      {
        src: '/font/**/*.{eot,svg,ttf,woff}',
        dest: '/font',
        useHash: true
      }
    ]
  },
  /**
   * 模板配置项
   * @type {Object}
   */
  tmpl: {
    src: './views/**/*.{vm,ftl,html}',
    dest: `${output}/views/`
  }
};

/**
 * 图标配置项
 * @type {Object}
 */
config.icon = {
  src: path.posix.join(base, 'icon'),
  /**
   * SVG Symbols配置项
   * @type {Object}
   */
  symbols: {
    /**
     * 指定生成的SVG Symbols输出位置
     * @type {String}
     */
    dest: path.posix.join(base, 'svg'),
    /**
     * 输出文件名
     * @type {String}
     */
    name: 'icon-symbols.svg',
    /**
     * 使用文档输出位置
     * @type {String}
     */
    doc: path.posix.join(docs, 'svg-symbols/demo.html')
  },
  /**
   * iconfont配置项
   * @type {Object}
   */
  font: {
    /**
     * 指定iconfont输出位置
     * @type {String}
     */
    dest: path.posix.join(base, 'font'),
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
    style: path.posix.join(base, glob2base(new Glob(config.assets.css.src)), 'iconfont.css'),
    /**
     * 使用文档输出位置
     * @type {String}
     */
    doc: path.posix.join(docs, 'iconfont/demo.html')
  }
};

export default config;
