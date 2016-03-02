/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description file hash version tasks 静态资源添加hash版本号
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import del from 'del';
import lazypipe from 'lazypipe';
import * as utils from '../utils';

export default function(config, plugins) {
  let assets = config.assets,
    rootpath = assets.rootpath,
    /**
     * 根输出目录
     * @type {String}
     */
    basedir = path.normalize(rootpath.dest).split(path.sep)[0],
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
      .pipe(gulp.dest, opts.dir);

  /**
   * image revision
   */
  gulp.task('image:rev', () => {
    let pattern = utils.createPattern({
      ...assets.img,
      rootpath
    });

    return gulp.src(pattern.target, {base: basedir})
      .pipe(plugins.changed(opts.dir))
      .pipe(channel());
  });

  /**
   * svg revision
   */
  gulp.task('svg:rev', () => {
    let pattern = utils.createPattern({
      ...assets.svg,
      rootpath
    });

    return gulp.src(pattern.target, {base: basedir})
      .pipe(plugins.changed(opts.dir))
      .pipe(channel());
  });

  /**
   * js css替换hash文件路径task
   */
  function resourceRevTask(src) {
    let manifest = gulp.src(config.manifest);

    return gulp.src(src, {base: basedir})
      .pipe(plugins.changed(opts.dir))
      .pipe(plugins.revReplace({
        manifest
      }))
      .pipe(channel());
  }

  /**
   * css revision
   */
  gulp.task('css:rev', () => {
    let pattern = utils.createPattern({
      ...assets.css,
      rootpath
    });

    return resourceRevTask(pattern.target);
  });

  /**
   * js revision
   */
  gulp.task('js:rev', () => {
    let pattern = utils.createPattern({
      ...assets.js,
      rootpath
    });

    return resourceRevTask(pattern.target);
  });

  gulp.task('other:rev', (done) => {
    let tasks = assets.other.filter((item) => {
      let pattern = utils.createPattern({
        ...item,
        rootpath
      });

      if (item.useHash) {
        return new Promise((resolve, reject) => {
          gulp.src(pattern.target, {base: basedir})
            .pipe(plugins.changed(opts.dir))
            .pipe(channel())
            .on('end', resolve)
            .on('error', reject);
        });
      }

      return false;
    });

    Promise.all(tasks).then(() => {
      done();
    })
    .catch((err) => {
      done(err);
    });
  });

  /**
   * HTML/模板文件替换hash文件名的task
   */
  function htmlRevTask(pattern, ext) {
    let manifest = gulp.src(config.manifest);

    return gulp.src(pattern.target)
      .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.revReplace({
        manifest,
        replaceInExtensions: ext.map((suffix) => `.${suffix}`)
      }))
      .pipe(gulp.dest(pattern.destPath));
  }

  gulp.task('html:rev', () => {
    let pattern = utils.createPattern({
      ...assets.html,
      rootpath
    });

    return htmlRevTask(pattern, assets.html.extensions);
  });

  /**
   * 替换模板中的资源路径
   */
  gulp.task('tpl:rev', () => {
    let pattern = utils.createPattern({...config.tpl});

    return htmlRevTask(pattern, config.tpl.extensions);
  });

  /**
   * 文件名hash后产生新文件，删除旧文件。
   */
  gulp.task('clean:hashgarbage', (done) => {
    if (utils.existsSync(config.manifest)) {
      let manifest = {},
        files = [];

      try {
        manifest = JSON.parse(fs.readFileSync(config.manifest, 'utf8'));
      } catch (err) {
        done(err);
      }

      for (let key in manifest) {
        if (manifest.hasOwnProperty(key)) {
          files.push(path.join(basedir, key));
        }
      }

      del(files).then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });
    } else {
      done();
    }
  });
}
