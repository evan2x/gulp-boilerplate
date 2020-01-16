import path from 'path';
import fs from 'fs';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import browserify from 'browserify';
import babelify from 'babelify';
import watchify from 'watchify';
import mkdirp from 'mkdirp';
import chalk from 'chalk';
import gulp from 'gulp';
import gutil from 'gulp-util';
import glob, { Glob } from 'glob';
import glob2base from 'glob2base';
import vueify from 'vueify';
import envify from 'envify';
import es3ify from 'es3ify';
import aliasify from 'aliasify';
import * as _ from 'lodash';
import through from 'through2';

import styleify from '../transforms/styleify';
import extractStyle from '../plugins/extract-style';
import extractBabelHelpers from '../plugins/extract-babel-helpers';
import createProcessor from '../postcss.config';
import * as util from '../util';

// eslint-disable-next-line no-unused-vars
export default function (plugins, config, debug, lint = _.noop) {
  const { baseDir, output, assets, assets: { script } } = config;
  let allGlobs = util.processGlobs(baseDir, script.src);

  if (!Array.isArray(allGlobs)) {
    allGlobs = [allGlobs];
  }

  /**
   * 提取到所有browserify入口文件
   * @type {Array}
   */
  let entries = allGlobs.reduce((arr, item) => {
    let files = glob.sync(path.join(glob2base(new Glob(item)), '**', script.entry));

    return [
      ...arr,
      ...files
    ];
  }, []);

  /**
   * 模块输出路径
   * @type {String}
   */
  let destPath = path.join(output.path, script.dest);

  /**
   * 第三方模块
   */
  let vendorModules = script.vendor.modules;

    /**
     * 记录模块输出目录
     * @type {Set}
     */
  let outputChunksDirectories = new Set();

  //
  let babelHelpersCode = '';

  /**
   * 创建browserify打包器
   * @type {Object}
   */
  let packager = browserify({
    cache: {},
    packageCache: {},
    entries,
    debug,
    paths: ['node_modules', ...script.modulesDirectories],
    extensions: script.extensions
  });

  packager.transform(envify);

  let stylesheetPath = path.join(output.path, assets.style.dest);

  if (script.vueify.enable) {
    let spritePath = path.join(output.path, assets.image.dest);
    let referencePath = path.posix.join(baseDir, assets.image.dest);
    let processor = createProcessor({ spritePath, stylesheetPath, referencePath }, debug);

    packager.transform(vueify, {
      postcss: processor,
      global: true
    });
    
    packager.transform(aliasify, {
      global: true,
      appliesTo: {
        includeExtensions: ['.js', '.vue']
      },
      aliases: {
        'vue': 'vue/dist/vue.js'
      }
    });

    if (vendorModules.indexOf('vue') === -1) {
      vendorModules.push('vue');
    }
  }

  packager.transform(babelify);
  packager.transform(styleify, {
    global: true,
    stylePath: stylesheetPath
  });

  // 如果第三方模块中有依赖babel-polyfill，辣么就给每个main.js加一个引入babel-polyfill的语句
  if (vendorModules.indexOf('babel-polyfill') > -1) {
    packager.transform(function (file) {
      if (file.endsWith(script.entry)) {
        return through((chunk, enc, done) => {
          chunk = 'require("babel-polyfill");' + chunk;
          done(null, chunk);
        });
      } else {
        return through();
      }
    });
  }

  /**
   * 移除文件base
   * @param {Array} filePaths
   * @return {Array}
   */
  const removeBase = (filePaths) => {
    let baseList = allGlobs.map(item => glob2base(new Glob(item)).split(path.sep).join(path.posix.sep));

    return filePaths.map((filePath) => {
      baseList.forEach((baseItem) => {
        filePath = filePath.replace(baseItem, '');
      });
      return filePath;
    });
  };

  /**
   * 生成各个模块的输出目标，保存对应的目录树
   * @type {Array}
   */
  const outputChunks = removeBase(entries).reduce((arr, item) => {
    let filePath = path.join(destPath, item);

    outputChunksDirectories.add(path.resolve(path.dirname(filePath)));
    arr.push(filePath);

    return arr;
  }, []);

  /**
   * factor-bundle plugin
   * @see https://github.com/substack/factor-bundle#api-plugin-example
   */
  packager.plugin('factor-bundle', {
    output: outputChunks
  });

  packager.plugin(extractBabelHelpers, {
    output(code) {
      babelHelpersCode = code;
    }
  });

  packager.plugin(extractStyle, {
    output: path.join(output.path, assets.style.dest, script.extractStyleFile)
  });

  if (assets.script.vueify.enable) {
    packager.plugin('vueify/plugins/extract-css', {
      out: path.join(output.path, assets.style.dest, script.vueify.extractStyleFile)
    });
  }

  // 排除第三方模块
  for (let i = 0; i < vendorModules.length; i++) {
    packager.exclude(vendorModules[i]);
  }

  /**
   * 打包第三方模块
   */
  const vendorBundle = () => new Promise((resolve, reject) => {
    if (!Array.isArray(vendorModules) || vendorModules.length === 0) {
      mkdirp.sync(destPath);
      fs.writeFile(path.join(destPath, vendor.chunkName), '', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      let vendorPackager = browserify();

      vendorPackager.transform(envify, {
        global: true
      });

      vendorPackager.transform(es3ify, {
        global: true
      });

      for (let i = 0; i < vendorModules.length; i++) {
        vendorPackager.require(vendorModules[i]);
      }

      vendorPackager
        .bundle()
        .pipe(source(script.vendor.chunkName))
        .on('end', resolve)
        .pipe(gulp.dest(destPath))
        .on('error', reject);
    }
  });

  /**
   * 打包业务模块
   */
  const bundle = () => {
    Array.from(outputChunksDirectories).forEach(dir => mkdirp.sync(dir));

    return new Promise((resolve, reject) => {
      packager
        .bundle()
        .once('error', reject)
        .pipe(source(script.commonChunk))
        .pipe(buffer())
        .pipe(through.obj(function (file, enc, next) {
          if (file.isNull()) {
            return next();
          }

          let contents = file.contents.toString();

          file.contents = new Buffer(babelHelpersCode + contents);
          this.push(file);
          next();
        }))
        .pipe(gulp.dest(destPath))
        .once('end', resolve)
        .once('error', reject);
    });
  };

  /**
   * 处理打包出现的错误
   * @type {Function}
   */
  const notifyError = plugins.notify.onError({
    title: 'Packager error',
    message(err) {
      return err.toString();
    }
  });

  return ({ watch = false } = {}) => vendorBundle()
    .then(() => {
      if (watch) {
        packager = watchify(packager);
        // eslint-disable-next-line no-unused-vars
        packager.on('update', (ids) => {
          // lint(ids);
          bundle().catch(notifyError);
        });
        packager.on('log', (msg) => {
          gutil.log(`Watching ${chalk.cyan('\'browserify\'')}: ${chalk.green(msg)}`);
        });
      }

      // lint(allGlobs);
      return bundle();
    })
    .catch((err) => {
      notifyError(err);
      return Promise.reject(err);
    });
}
