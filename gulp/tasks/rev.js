/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description revision tasks 给静态资源添加hash版本号并且增加domain
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

'use strict';

var path = require('path');
var fs = require('fs');
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var lazypipe = require('lazypipe');
var glob = require('glob');
var del = require('del');
var assign = require('object-assign');
var util = require('../util');
var config = require('../config');

/**
 * 静态资源配置
 * @type {Object}
 */
var assets = config.assets,
    /**
     * 所有资源的输出目录
     * @type {String}
     */
    destdir = path.normalize(assets.rootpath.dest).split(path.sep)[0],
    /**
     * 使用path模块解析manifest文件
     * @type {Object}
     */
    opts = path.parse(config.manifest),

    channel = lazypipe()
        .pipe(plugins.rev, opts.base)
        .pipe(gulp.dest, destdir)
        .pipe(plugins.rev.manifest, {
            base: opts.dir,
            merge: true
        })
        .pipe(gulp.dest, opts.dir),
    /**
     * js,css文件的共用task
     */
    revision = function(src){
        var manifest = gulp.src(config.manifest);

        return gulp.src(src, {base: destdir})
            .pipe(plugins.revReplace({
                prefix: config.domain || '',
                manifest: manifest
            }))
            .pipe(channel());
    },
    /**
     * 读取manifest文件，将globs匹配到的文件路径合并到manifest已有的列表中
     * @todo 针对未使用hash版本号的资源
     * @param  {Array<Glob>|Glob} globs
     * @param {Function} 写入完执行的回调函数
     */
    buildManifest = function(globs){
        var regex = new RegExp('^' + path.normalize(destdir)),
            files = globs.reduce(function(arr, v){
                return arr.concat(glob.sync(v));
            }, []),
            fileMaps = {};

        files.forEach(function(v){
            var filepath = path.normalize(v).replace(regex, '');

            if(path.isAbsolute(filepath)){
                filepath = filepath.slice(path.sep.length);
            }

            fileMaps[filepath] = filepath;
        });

        if(fs.existsSync(config.manifest)){
            var maps = {};
            try {
                maps = JSON.parse(fs.readFileSync(config.manifest));
            }catch(e){
                throw new Error(e.message);
            }

            fileMaps = assign(maps, fileMaps);
        }

        return fileMaps;
    };

/**
 * 删除manifest文件
 */
gulp.task('clean:rev', function(done){
    del([config.manifest])
    .then(function(){
        done();
    });
});

/**
 * image revision
 */
gulp.task('image:rev', function(){
    var paths = util.getResourcePath(assets.img);
    return gulp.src(paths.revsrc, {base: destdir})
        .pipe(channel());
});

/**
 * svg revision
 */
gulp.task('svg:rev', function(){
    var paths = util.getResourcePath(assets.svg);
    return gulp.src(paths.revsrc, {base: destdir})
        .pipe(channel());
});

gulp.task('other:rev', function(done){
    var paths = util.getOtherResourcePath(),
        otherTask = paths.map(function(obj){
            if(obj.useHash){
                return new Promise(function(resolve, reject){
                    gulp.src(obj.revsrc, {base: destdir})
                        .pipe(channel())
                        .on('end', resolve)
                        .on('error', reject);
                });
            } else {
                return new Promise(function(resolve, reject){
                    var str = JSON.stringify(buildManifest(obj.revsrc));
                    try {
                        fs.writeFileSync(config.manifest, str);
                        resolve();
                    } catch(e){
                        reject(e.message);
                    }
                });
            }
        });

    Promise.all(otherTask).then(function(){
        done();
    });
});

/**
 * css revision
 */
gulp.task('css:rev', function(){
    var paths = util.getResourcePath(assets.css);
    return revision(paths.revsrc);
});

/**
 * js revision
 */
gulp.task('js:rev', function(){
    var paths = util.getResourcePath(assets.js);
    return revision(paths.revsrc);
});

/**
 * 替换模板中的资源路径
 */
gulp.task('tmpl:rev', function(){
    var paths = util.getTemplatePath(),
        manifest = gulp.src(config.manifest);

    return gulp.src(paths.revsrc)
        .pipe(plugins.revReplace({
            prefix: config.domain || '',
            manifest: manifest,
            replaceInExtensions: config.tmpl.extensions.map(function(suffix){
                return ('.' + suffix);
            })
        }))
        .pipe(gulp.dest(paths.target));
});

/**
 * 根据rev-manifest.json文件中的key删除原本的资源文件
 * @todo 当资源表中K/V一致时保留原文件
 */
gulp.task('original:del', function(done){
    if(fs.existsSync(config.manifest)){
        var manifest = {},
            files = [];

        try {
            manifest = JSON.parse(fs.readFileSync(config.manifest));
        }catch(e){
            throw new Error(e.message);
        }

        for(var key in manifest){
            if(manifest.hasOwnProperty(key) && manifest[key] !== key){
                files.push(path.join(destdir, key));
            }
        }

        del(files).then(function(){
            done();
        });
    } else {
        done();
    }
});
