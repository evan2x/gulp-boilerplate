/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description normal tasks
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

 /* eslint-disable no-console */

'use strict';

var gulp = require('gulp');
var del = require('del');
var plugins = require('gulp-load-plugins')();
var pngquant = require('imagemin-pngquant');
var chalk = require('chalk');
var util = require('../util');
var config = require('../config');

module.exports = function(debug){

    var assets = config.assets;
    // JS模块打包器
    var bundler = require('./bundler')(assets, debug);

    /**
     * 清理dest目录
     */
    gulp.task('clean', function(done){
        del([
            assets.rootpath.dest,
            config.tmpl.dest
        ])
        .then(function(){
            done();
        });
    });

    /**
     * 使用eslint对JavaScript代码进行检查
     */
    gulp.task('eslint', function(){

        return gulp.src(util.getResourcePath(assets.js).src)
            .pipe(plugins.eslint())
            .pipe(plugins.eslint.format());
            // 暂时不开启抛出异常，只进行检查，而不强制中断整个构建
            // .pipe(plugins.eslint.failAfterError());
    });

    /**
     * 图片压缩
     * @todo debug模式下不压缩图片
     */
    gulp.task('image', function(){
        var paths = util.getResourcePath(assets.img);

        return gulp.src(paths.src)
            .pipe(plugins.if(!debug, plugins.cache(plugins.imagemin({
                progressive: true,
                use: [pngquant()]
            }))))
            .pipe(gulp.dest(paths.target));
    });

    /**
     * SCSS样式转换为CSS，并且使用autoprefixer处理前缀
     * @todo debug模式下保留sourcemap
     */
    gulp.task('css', function(){
        var paths = util.getResourcePath(assets.css);

        return gulp.src(paths.src)
            .pipe(plugins.if(debug, plugins.sourcemaps.init()))
            .pipe(plugins.sass(assets.css.sass).on('error', function(e){
                // 打印Sass抛出的异常
                console.log(chalk.red('\nSass error:\n' + e.messageFormatted));
                this.emit('end');
            }))
            .pipe(plugins.autoprefixer(assets.css.autoprefixer))
            .pipe(plugins.if(debug, plugins.sourcemaps.write()))
            .pipe(plugins.if(!debug, plugins.csso()))
            .pipe(gulp.dest(paths.target));
    });

    /**
     * 压缩svg文件
     * @todo debug模式不压缩
     */
    gulp.task('svg', function(){
        var paths = util.getResourcePath(assets.svg);

        return gulp.src(paths.src)
            .pipe(plugins.if(!debug, plugins.svgmin(assets.svg.compress)))
            .pipe(gulp.dest(paths.target));
    });

    /**
     * 使用browserify打包JavaScript模块
     */
    gulp.task('js', function(done){
        return bundler(done);
    });

    /**
     * copy other列表中的静态资源
     */
    gulp.task('other', function(done){
        var paths = util.getOtherResourcePath(),
            otherTask = paths.map(function(obj){
                return new Promise(function(resolve, reject){
                    gulp.src(obj.src)
                        .pipe(gulp.dest(obj.target))
                        .on('end', resolve)
                        .on('error', reject);
                });
            });

        Promise.all(otherTask).then(function(){
            done();
        });
    });

    /**
     * 从模板中对使用了useref语法的资源进行合并以及压缩
     * 并且对添加了inline标识的资源进行内联
     * @todo debug模式下不对css及js进行压缩
     */
    gulp.task('tmpl', function(){
        var paths = util.getTemplatePath(),
            resource = plugins.useref.assets(config.tmpl.useref),
            opts = {};

        if(config.tmpl.base){
            opts.base = config.tmpl.base;
        }

        return gulp.src(paths.src, opts)
            .pipe(resource)
            .pipe(plugins.if(!debug, plugins.if('*.css', plugins.csso())))
            .pipe(plugins.if(!debug, plugins.if('*.js', plugins.uglify())))
            .pipe(resource.restore())
            .pipe(plugins.useref())
            .pipe(plugins.inlineSource({
                rootpath: './',
                compress: !debug
            }))
            .pipe(gulp.dest(paths.target));
    });

    /**
     * watch js, css
     * @todo 仅对js和css进行watch
     */
    gulp.task('watch', function(){
        // watch CSS/SCSS
        util.watch(util.getResourcePath(assets.css).src, ['css']);
        // 启用打包器的watch模式
        bundler('watch');
    });

};
