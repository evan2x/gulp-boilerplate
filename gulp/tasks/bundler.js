/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description browserify bundler
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

 /* eslint-disable no-console */

'use strict';

var path = require('path');
var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var glob = require('glob');
var plugins = require('gulp-load-plugins')();
var mkdirp = require('mkdirp');
var chalk = require('chalk');
// var browserSync = require('browser-sync');

module.exports = function(assets, debug){
    var srcdir = assets.js.src,
        done = function(){};

    if(!Array.isArray(srcdir)){
        srcdir = [srcdir];
    }

    /**
     * 提取所有browserify入口文件
     * @type {Array}
     */
    var entries = srcdir.reduce(function(arr, v){
            var p = path.join(assets.rootpath.src, v, '/**/' + assets.js.entry);
            return arr.concat(glob.sync(p));
        }, []),
        /**
         * 打包后输出目录
         * @type {String}
         */
        dest = path.join(assets.rootpath.dest, assets.js.dest),
        /**
         * 创建browserify打包器
         * @type {Object}
         */
        packager = browserify({
            cache: {},
            packageCache: {},
            entries: entries,
            debug: debug
        }),
        /**
         * 提取需要删除的部分路径
         * @type {String}
         */
        dirs = srcdir.map(function(v){
            return path.join(assets.rootpath.src, v);
        }).join('|'),
        /**
         * 生成一个需要删除路径的正则
         * @type {RegExp}
         */
        regex = new RegExp('^(?:' + dirs + ')'),
        /**
         * 提取输出目录，仅用于创建目录
         * @type {Array}
         */
        outputdir = [],
        /**
         * 生成各个模块的输出目标，保存对应的目录树
         * @type {Array}
         */
        outputs = entries.reduce(function(arr, v){
            var filepath = path.join(dest, v.replace(regex, ''));
            outputdir.push(path.dirname(filepath));
            arr.push(filepath);
            return arr;
        }, []);

    packager.plugin('factor-bundle', {
        outputs: outputs
    });

    var bundle = function(){
        outputdir.forEach(function(dir){
            mkdirp.sync(dir);
        });

        return packager
            .transform(babelify.configure(assets.js.babel))
            .bundle()
            .on('error', function(e){
                // 打印browserify或者babelify抛出的异常信息
                console.log(chalk.red('\nBrowserify or Babelify error:\n' + e.message));
                this.emit('end');
            })
            .pipe(source(assets.js.commonChunk))
            .pipe(buffer())
            .pipe(plugins.if(!debug, plugins.uglify()))
            .pipe(gulp.dest(dest))
            .on('end', function(){
                if(debug){
                    done();
                } else {
                    gulp.src(outputs, {base: './'})
                        .pipe(plugins.uglify())
                        .pipe(gulp.dest('./'))
                        .on('end', done);
                }
            });
    };

    return function(mode, cb){
        if(typeof mode === 'function'){
            cb = mode;
        }

        if(mode === 'watch'){
            packager = watchify(packager);
            packager.on('update', bundle);
            packager.on('log', function(msg){
                gutil.log(chalk.green(msg));
            });
        }

        if(typeof cb === 'function'){
            done = cb;
        }

        return bundle();
    };
};
