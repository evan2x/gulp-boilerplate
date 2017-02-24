
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

import extractBabelHelpers from '../plugins/extract-babel-helpers';
import * as util from '../util';
import config from '../config';

export default function (plugins, debug) {
  const {
    base,
    output,
    js: {
      src,
      dest,
      entry,
      commonChunk,
      babelHelpers,
      vendor,
      modulesDirectories
    }
  } = config.assets;

  let entryGlobs = util.processGlobs(base, src);

  if (!Array.isArray(entryGlobs)) {
    entryGlobs = [entryGlobs];
  }

  /**
   * 提取到所有browserify入口文件
   * @type {Array}
   */
  let entries = entryGlobs.reduce((arr, item) => {
    let files = glob.sync(path.join(glob2base(new Glob(item)), '**', entry));

    return [
      ...arr,
      ...files
    ];
  }, []);

  /**
   * 模块输出路径
   * @type {String}
   */
  let destPath = path.join(output, dest);

  /**
   * 第三方模块
   */
  let vendorModules = vendor.modules;

    /**
     * 记录模块输出目录
     * @type {Set}
     */
  let outputChunksDirectories = new Set();

  /**
   * 创建browserify打包器
   * @type {Object}
   */
  let packager = browserify({
    cache: {},
    packageCache: {},
    entries,
    debug,
    paths: ['node_modules', ...modulesDirectories]
  }).transform(babelify);

  /**
   * 移除文件base
   * @param {Array} filePaths
   * @return {Array}
   */
  const removeBase = (filePaths) => {
    let baseList = entryGlobs.map(item => glob2base(new Glob(item)));

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
    output: path.resolve(destPath, babelHelpers)
  });

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

      for (let i = 0; i < vendorModules.length; i++) {
        vendorPackager.require(vendorModules[i]);
      }

      vendorPackager
        .bundle()
        .pipe(source(vendor.chunkName))
        .pipe(gulp.dest(destPath))
        .on('end', resolve)
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
        .pipe(source(commonChunk))
        .pipe(buffer())
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
      let message = err.message;

      if (err.codeFrame) {
        message += `\n\n${err.codeFrame}\n`;
      }

      return message;
    }
  });

  return ({ watch = false } = {}) => vendorBundle()
    .then(() => {
      if (watch) {
        packager = watchify(packager);
        packager.on('update', () => {
          bundle().catch(notifyError);
        });
        packager.on('log', (msg) => {
          gutil.log(`Watching ${chalk.cyan('\'browserify\'')}: ${chalk.green(msg)}`);
        });
      }

      return bundle();
    })
    .catch((err) => {
      notifyError(err);
      return Promise.reject(err);
    });
}
