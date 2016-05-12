/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks entry
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import loadPlugins from 'gulp-load-plugins';
import config from './config';
import general from './tasks/general';
import revision from './tasks/revision';
import * as util from './util';

const plugins = loadPlugins();

general(config, plugins, process.env.NODE_ENV !== 'production');
revision(config, plugins);

/**
 * 清理构建后的资源目录
 */
gulp.task('clean', () => del([
  config.assets.rootpath.dest,
  config.tpl.dest
]));

/**
 * 删除manifest文件
 */
gulp.task('clean:manifest', () => del([config.manifest]));

/**
 * 删除垃圾资源
 * @todo 删除收集的垃圾资源表
 * @todo 清理静态资源目录下的空目录
 */
gulp.task('clean:grabage', () => util.delGarbage()
  .then(del)
  .then(() => util.removeEmptyDirectory(config.assets.rootpath.dest))
);

/**
 * 构建
 */
gulp.task('build', (done) => {
  runSequence(
    'clean:manifest',
    ['css', 'js', 'image', 'other', 'svg'],
    ['html', 'tpl'],
    'prefix',
    'clean:grabage',
    done
  );
});

/**
 * 带有hash版本号的构建
 */
gulp.task('revision', (done) => {
  runSequence(
    'clean',
    'build',
    'clean:manifest',
    ['image:rev', 'svg:rev', 'other:rev'],
    'css:rev',
    'js:rev',
    ['tpl:rev', 'html:rev', 'clean:rev:garbage'],
    done
  );
});

/**
 * 默认task
 */
gulp.task('default', ['build']);
