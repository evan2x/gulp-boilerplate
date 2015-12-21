/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description file hash version tasks 静态资源添加hash版本号
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import lazypipe from 'lazypipe';
import loadPlugins from 'gulp-load-plugins';
import glob from 'glob';
import del from 'del';
import * as utils from '../utils';
import config from '../config';

const plugins = loadPlugins();

/**
 * 资源配置项
 * @type {Object}
 */
let assets = config.assets,
  /**
   * 所有资源的输出目录
   * @type {String}
   */
  basedir = path.normalize(assets.rootpath.dest).split(path.sep)[0],
  /**
   * 解析manifest的文件路径
   * @type {Object}
   */
  opts = path.parse(config.manifest),
  channel = lazypipe()
    .pipe(plugins.rev, opts.base)
    .pipe(gulp.dest, basedir)
    .pipe(plugins.rev.manifest, {
      base: opts.dir,
      merge: true
    })
    .pipe(gulp.dest, opts.dir),
  /**
   * JS,CSS 替换hash文件路径的通用task
   */
  revision = function(src){
    let manifest = gulp.src(config.manifest);

    return gulp.src(src, {base: basedir})
      .pipe(plugins.revReplace({
        prefix: config.domain || '',
        manifest: manifest
      }))
      .pipe(channel());
  },

  regex = new RegExp(`^${path.normalize(basedir)}`),

  /**
   * 读取manifest文件，将globs匹配到的文件路径合并到manifest已有的列表中
   * @todo 针对未使用hash版本号的资源
   * @param  {Array<Glob>|Glob} globs
   * @param {Function} 写入完执行的回调函数
   */
  buildManifest = function(globs){
    let files = globs.reduce((arr, v) => [...arr, glob.sync(v)], []),
      fileMaps = {},
      filepath = '',
      stat = null;

    files.forEach((v) => {
      filepath = path.normalize(v).replace(regex, '');
      stat = fs.statSync(path.join(process.cwd(), filepath));

      if(path.isAbsolute(filepath) && stat.isFile()){
        filepath = filepath.slice(path.sep.length);
      }

      fileMaps[filepath] = filepath;
    });

    if(fs.existsSync(config.manifest)){
      let maps = {};
      try {
        maps = JSON.parse(fs.readFileSync(config.manifest));
      }catch(e){
        throw new Error(e.message);
      }

      fileMaps = Object.assign(maps, fileMaps);
    }

    return fileMaps;
  };


/**
 * 删除manifest文件
 */
gulp.task('clean:rev', (done) => {
  del([config.manifest])
  .then(() => {
    done();
  });
});

/**
 * image revision
 */
gulp.task('image:rev', () => {
  let paths = utils.getResourcePath(assets.img);
  return gulp.src(paths.revsrc, {base: basedir})
    .pipe(channel());
});

/**
 * svg revision
 */
gulp.task('svg:rev', () => {
  let paths = utils.getResourcePath(assets.svg);
  return gulp.src(paths.revsrc, {base: basedir})
    .pipe(channel());
});

gulp.task('other:rev', (done) => {

  let paths = utils.getOtherResourcePath(),
    otherTask = paths.map((resource) => {
      if(resource.useHash){
        return new Promise((resolve, reject) => {
          gulp.src(resource.revsrc, {base: basedir})
            .pipe(channel())
            .on('end', resolve)
            .on('error', reject);
        });
      } else {
        return new Promise((resolve, reject) => {
          let str = JSON.stringify(buildManifest(resource.revsrc));
          try {
            fs.writeFileSync(config.manifest, str);
            resolve();
          } catch(e){
            reject(e.message);
          }
        });
      }
    });

  Promise.all(otherTask).then(() => {
    done();
  });
});

/**
 * css revision
 */
gulp.task('css:rev', () => {
  let paths = utils.getResourcePath(assets.css);
  return revision(paths.revsrc);
});

/**
 * js revision
 */
gulp.task('js:rev', () => {
  let paths = utils.getResourcePath(assets.js);
  return revision(paths.revsrc);
});

function templateRevisionTask(paths, ext){
  let manifest = gulp.src(config.manifest);

  return gulp.src(paths.revsrc)
    .pipe(plugins.revReplace({
      prefix: config.domain || '',
      manifest: manifest,
      replaceInExtensions: ext.map((suffix) => `.${suffix}`)
    }))
    .pipe(gulp.dest(paths.target));
}

gulp.task('html:rev', () => {
  let paths = utils.getResourcePath(assets.html);
  return templateRevisionTask(paths, assets.html.extensions);
});

/**
 * 替换模板中的资源路径
 */
gulp.task('tpl:rev', () => {
  let paths = utils.getTemplatePath(config.tpl);
  return templateRevisionTask(paths, config.tpl.extensions);
});

/**
 * 回收无用的静态资源，根据rev-manifest.json文件中的key删除原本的资源文件，保留增加了版本号的资源
 * @todo 当资源表中K/V一致时保留原文件
 */
gulp.task('assets:gc', (done) => {
  if(fs.existsSync(config.manifest)){
    let manifest = {},
      files = [];

    try {
      manifest = JSON.parse(fs.readFileSync(config.manifest));
    }catch(e){
      throw new Error(e.message);
    }

    for(var key in manifest){
      if(manifest.hasOwnProperty(key) && manifest[key] !== key){
        files.push(path.join(basedir, key));
      }
    }

    del(files).then(() => {
      done();
    });
  } else {
    done();
  }
});
