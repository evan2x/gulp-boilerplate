/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks entry
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */
 /* eslint indent: [2, 2] */

import 'babel-core/external-helpers';
import gulp from 'gulp';
import runSequence from 'run-sequence';
import normal from './gulp/tasks/normal';
import './gulp/tasks/rev';
// 提取normal tasks
normal(!(process.env.DEBUG === 'false'));


/**
 * 常规任务
 */
gulp.task('release', (done) => {
  runSequence(
    'clean',
    ['css', 'js', 'image', 'other', 'svg'],
    'tmpl',
    done
  );
});

/**
 * 增加hash版本号任务
 */
gulp.task('rev', (done) => {
  runSequence(
    'release',
    'clean:rev',
    ['image:rev', 'svg:rev', 'other:rev'],
    'css:rev',
    'js:rev',
    ['tmpl:rev', 'original:del'],
    done
  );
});

/**
 * 默认任务执行常规任务
 */
gulp.task('default', () => {
  gulp.start('release');
});
