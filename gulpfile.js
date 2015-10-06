/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks entry
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

'use strict';

var gulp = require('gulp');
var runSequence = require('run-sequence');

// 默认debug模式
var debug = true;

// 查看环境变量中是否关闭了debug模式
if(process.env.DEBUG === 'false'){
    debug = false;
}

require('./gulp/tasks/normal')(debug);
require('./gulp/tasks/rev');

/**
 * 常规任务
 */
gulp.task('release', function(done){
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
gulp.task('rev', function(done){
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
gulp.task('default', function(){
    gulp.start('release');
});
