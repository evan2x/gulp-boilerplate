/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks entry
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import 'babel-core/external-helpers';
import gulp from 'gulp';
import runSequence from 'run-sequence';
import general from './gulp/tasks/general';
import './gulp/tasks/version';

general(process.env.NODE_ENV !== 'production');

/**
 * 普通任务
 */
gulp.task('release', (done) => {
  runSequence(
    'clean',
    ['css', 'js', 'image', 'other', 'svg'],
    ['tpl', 'html'],
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
    ['tpl:rev', 'html:rev', 'assets:gc'],
    done
  );
});

/**
 * 默认任务执行普通任务
 */
gulp.task('default', ['release']);
