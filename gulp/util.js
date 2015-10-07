/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks utils
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

'use strict';

var path = require('path');
var chokidar = require('chokidar');
var gulp = require('gulp');
var config = require('./config');

/**
 * 扩展名数组转为glob模式的字符
 * @param  {Array<String>} arr
 * @return {String}
 */
function array2ext(arr){
    var ret = '';

    if(Array.isArray(arr)){
        if(arr.length === 1){
            ret = arr[0];
        } else if(arr.length > 1){
            ret = '{' + arr + '}';
        }
    }

    return ret;
}

/**
 * 使用chokidar实现watch，弃用vinyl-fs(gulp)的watch
 * @see https://www.npmjs.com/package/chokidar
 * @param {Glob} glob
 * @param {Object} opts
 * @param {Array|String} task
 */
exports.watch = function(glob, opts, task){
    if(opts == null){
        opts = {};
    } else if(typeof opts === 'string' || Array.isArray(opts)){
        task = opts;
        opts = {};
    }

    opts.ignoreInitial = !!opts.ignoreInitial;
    var watcher = chokidar.watch(glob, opts);

    if(Array.isArray(task) || typeof task === 'string'){
        var fn = function(){
            gulp.start(task);
        };

        watcher
            .on('add', fn)
            .on('unlink', fn)
            .on('change', fn);
    }

    return watcher;
};

/**
 * 获取资源的源路径与输出路径
 * @param  {Object} obj
 * @return {Object} obj
 * @return {Array<String>} obj.src  资源原路径
 * @return {Array<String>} obj.revsrc  revision资源原路径
 * @return {String} obj.target  资源输出目录
 */
exports.getResourcePath = function(obj){
    var rootpath = config.assets.rootpath,
        getPath = function(root, dir){
            if(!dir) dir = '';
            return path.join(root, dir, '/**/*.' + array2ext(obj.extensions));
        },
        src = [],
        target = path.join(rootpath.dest, obj.dest);

    // 针对配置中使用了数组的情况进行处理
    if(Array.isArray(obj.src)){
        src = obj.src.map(function(v){
            return getPath(rootpath.src, v);
        });
    } else {
        src.push(getPath(rootpath.src, obj.src));
    }

    return {
        src: src,
        revsrc: getPath(target),
        target: target
    };
};

/**
 * 获取模板的源路径与输出路径
 * @return {Object} obj
 * @return {Array<String>} obj.src  模板原路径
 * @return {Array<String>} obj.revsrc  revision模板原路径
 * @return {String} obj.target  模板输出目录
 */
exports.getTemplatePath = function(){
    var tmpl = config.tmpl,
        src = [],
        getPath = function(dir){
            return path.join(dir, '/**/*.' + array2ext(tmpl.extensions));
        };

    // 针对配置中使用了数组的情况进行处理
    if(Array.isArray(tmpl.src)){
        src = tmpl.src.map(function(arr, v){
            return getPath(v);
        });
    } else {
        src.push(getPath(tmpl.src));
    }

    return {
        src: src,
        revsrc: getPath(tmpl.dest),
        target: tmpl.dest
    };
};

/**
 * 提取other task中的原路径与输出路径
 * @return {Array<Object>} arr<obj>
 * @return {Array<String>} obj.src  其他资源原路径
 * @return {Array<String>} obj.revsrc  revision 其他资源原路径
 * @return {String} obj.target  其他输出目录
 */
exports.getOtherResourcePath = function(){
    var assets = config.assets,
        rootdest = assets.rootpath.dest;

    return assets.other.map(function(obj){
        if(!Array.isArray(obj.src)){
            obj.src = [obj.src];
        }

        var getPath = function(root){
            return obj.src.map(function(glob){
                return path.join(root, glob);
            });
        };

        return {
            src: getPath(assets.rootpath.src),
            revsrc: getPath(rootdest),
            target: path.join(rootdest, obj.dest),
            useHash: !!obj.useHash
        };
    });
};
