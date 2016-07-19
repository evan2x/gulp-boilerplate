
import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import browserify from 'browserify';
import watchify from 'watchify';
import babelify from 'babelify';
import {buildExternalHelpers} from 'babel-core';
import mkdirp from 'mkdirp';
import chalk from 'chalk';
import glob from 'glob';
import gutil from 'gulp-util';
import loadPlugins from 'gulp-load-plugins';
import * as util from '../util';

const plugins = loadPlugins();

export default function(assets, debug) {

  let srcdir = assets.js.src,
    isWatch = false,
    done = function() {}; // eslint-disable-line

  if (!Array.isArray(srcdir)) {
    srcdir = [srcdir];
  }

  /**
   * 提取所有browserify入口文件
   * @type {Array}
   */
  let entries = srcdir.reduce((arr, v) => {
      let files = glob.sync(
        path.join(
          assets.rootpath.src,
          v,
          `/**/${assets.js.entry}`
        )
      );

      return [...arr, ...files];
    }, []),
    /**
     * 打包后输出目录
     * @type {String}
     */
    destdir = path.join(assets.rootpath.dest, assets.js.dest),
    /**
     * 第三方模块
     * @type {Array}
     */
    vendorModules = assets.js.vendor.modules,
    /**
     * 创建browserify打包器
     * @type {Object}
     */
    packager = browserify({
      cache: {},
      packageCache: {},
      entries,
      debug,
      paths: ['node_modules', ...assets.js.modulesDirectories]
    }).transform(babelify),
    /**
     * 提取需要删除的部分路径
     * @type {String}
     */
    delpaths = srcdir.map((v) => path.posix.join(assets.rootpath.src, v)).join('|'),
    /**
     * 生成一个需要删除路径的正则
     * @type {RegExp}
     */
    regex = new RegExp(`^(?:${delpaths})`),
    /**
     * 提取输出目录，仅用于创建目录
     * @type {Array}
     */
    outputdir = [],
    /**
     * 生成各个模块的输出目标，保存对应的目录树
     * @type {Array}
     */
    outputs = entries.reduce((arr, v) => {
      let filepath = path.join(destdir, path.normalize(v).replace(regex, ''));
      outputdir.push(path.dirname(filepath));
      arr.push(filepath);
      return arr;
    }, []);

  packager.plugin('factor-bundle', {outputs});

  // 排除第三方模块
  for (let i = 0; i < vendorModules.length; i++) {
    packager.exclude(vendorModules[i]);
  }

  // 提取babel helpers file
  let usedHelpers = new Set(),
    babelHelpersCode = '';

  packager.on('transform', (tr) => {
    if (tr instanceof babelify) {
      tr.once('babelify', (result) => {
        let beforeSize = usedHelpers.size;

        result.metadata.usedHelpers.forEach((method) => {
          usedHelpers.add(method);
        });

        if (beforeSize === usedHelpers.size) {
          return;
        }

        babelHelpersCode = buildExternalHelpers(Array.from(usedHelpers), 'global');
      });
    }
  });

  let bundle = () => {
    outputdir.forEach((dir) => mkdirp.sync(dir));

    return packager
      .bundle()
      .once('error', function(e) {
        // print browserify or babelify error
        console.log(chalk.red(`\nBrowserify or Babelify error:\n${e.message}`));
        this.emit('end');
        if (!isWatch) process.exit(1);
      })
      .pipe(source(assets.js.commonChunk))
      .pipe(buffer())
      .pipe(gulp.dest(destdir))
      .once('end', () => {
        gulp.src(path.join(destdir, assets.js.commonChunk), {base: './'})
          .pipe(util.addBeforeSource(babelHelpersCode))
          .pipe(plugins.if(!debug, plugins.uglify().once('error', function() {
            this.emit('end');
          })))
          .pipe(gulp.dest('./'))
          .once('end', () => {
            if (debug) {
              done();
            } else {
              gulp.src(outputs, {base: './'})
              .pipe(plugins.uglify().once('error', function() {
                this.emit('end');
              }))
              .pipe(gulp.dest('./'))
              .once('end', () => {
                done();
              });
            }
          });
      });
  };

  /**
   * 打包第三方模块
   */
  let vendorBundle = () => {
    if (!Array.isArray(vendorModules) || vendorModules.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let vendorPackager = browserify();

      for (let i = 0; i < vendorModules.length; i++) {
        vendorPackager.require(vendorModules[i]);
      }

      vendorPackager
        .bundle()
        .pipe(source(assets.js.vendor.output))
        .pipe(gulp.dest(destdir))
        .on('end', resolve)
        .on('error', reject);
    });
  };

  return (mode, cb) => vendorBundle()
    .then(() => {
      if (typeof mode === 'function') {
        done = mode;
      } else if (mode === 'watch') {
        isWatch = true;
        packager = watchify(packager);
        packager.on('update', bundle);
        packager.on('log', (msg) => {
          gutil.log(`Watching ${chalk.cyan('\'browserify\'')}: ${chalk.green(msg)}`);
        });

        if (typeof cb === 'function') {
          done = cb;
        }
      }

      return bundle();
    });
}
