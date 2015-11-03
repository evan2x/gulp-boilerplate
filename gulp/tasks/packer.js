/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description browserify bundler
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import gulp from 'gulp';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import browserify from 'browserify';
import watchify from 'watchify';
import babelify from 'babelify';
import cacheify from 'cacheify';
import level from 'level';
import loadPlugins from 'gulp-load-plugins';
import mkdirp from 'mkdirp';
import chalk from 'chalk';
import glob from 'glob';

const plugins = loadPlugins();
const db = level('./.__cache__');

export default function(assets, debug) {

  let
    srcdir = assets.js.src,
    done = function() {};

  if (!Array.isArray(srcdir)) {
    srcdir = [srcdir];
  }

  let
    /**
     * 提取所有browserify入口文件
     * @type {Array}
     */
    entries = srcdir.reduce((arr, v) => {
      return arr.concat(glob.sync(
        path.join(
          assets.rootpath.src,
          v,
          `/**/${assets.js.entry}`
        )
      ));
    }, []),
    /**
     * 打包后输出目录
     * @type {String}
     */
    destdir = path.join(assets.rootpath.dest, assets.js.dest),
    /**
     * 创建browserify打包器
     * @type {Object}
     */
    packager = browserify({
      cache: {},
      packageCache: {},
      entries: entries,
      debug: debug
    }).transform(cacheify(babelify, db)),
    /**
     * 提取需要删除的部分路径
     * @type {String}
     */
    delpaths = srcdir.map((v) => path.join(assets.rootpath.src, v)).join('|'),
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
      var filepath = path.join(destdir, v.replace(regex, ''));
      outputdir.push(path.dirname(filepath));
      arr.push(filepath);
      return arr;
    }, []);

  packager.plugin('factor-bundle', {
    outputs: outputs
  });

  let bundle = () => {
    outputdir.forEach((dir) => mkdirp.sync(dir));

    return packager
      .bundle()
      .on('error', (e) => {
        // print browserify or babelify error
        console.log(chalk.red('\nBrowserify or Babelify error:\n' + e.message));
        this && this.emit('end');
      })
      .pipe(source(assets.js.commonChunk))
      .pipe(buffer())
      .pipe(plugins.if(!debug, plugins.uglify()))
      .pipe(gulp.dest(destdir))
      .on('end', () => {
        if (debug) {
          done();
        } else {
          gulp.src(outputs, {
            base: './'
          })
          .pipe(plugins.uglify())
          .pipe(gulp.dest('./'))
          .on('end', () => {
            done();
          });
        }
      });
  };

  return (mode, cb) => {
    if (typeof mode === 'function') {
      cb = mode;
    }

    if (mode === 'watch') {
      packager = watchify(packager);
      packager.on('update', bundle);
      packager.on('log', (msg) => {
        console.log(chalk.green(msg));
      });
    }

    if (typeof cb === 'function') {
      done = cb;
    }

    return bundle();
  };

}
