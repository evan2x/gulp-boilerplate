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
import config from './gulp/config';
import general from './gulp/tasks/general';
import version from './gulp/tasks/version';
import * as utils from './gulp/utils';

const plugins = loadPlugins();

general(config, plugins, process.env.NODE_ENV !== 'production');
version(config, plugins);

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
 * 清除冗余资源
 */
gulp.task('clean:redundancy', () => {
  return utils.delTrash()
    .then((trashManifest) => {
      // 删除收集的垃圾资源表
      return del(trashManifest);
    })
    .then(() => {
      // 清理静态资源目录下的空目录
      return utils.deleteEmptyDir(config.assets.rootpath.dest);
    });
});

/**
 * 构建
 */
gulp.task('build', (done) => {
  runSequence(
    'clean:manifest',
    ['css', 'js', 'image', 'other', 'svg'],
    ['html', 'tpl'],
    'prefix',
    'clean:redundancy',
    done
  );
});

/**
 * 生产环境
 */
gulp.task('prod', (done) => {
  runSequence(
    'clean',
    'build',
    'clean:manifest',
    ['image:rev', 'svg:rev', 'other:rev'],
    'css:rev',
    'js:rev',
    ['tpl:rev', 'html:rev', 'clean:hashgarbage'],
    done
  );
});

/**
 * 默认task
 */
gulp.task('default', ['build']);
