/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks utils
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import chokidar from 'chokidar';
import gulp from 'gulp';
import config from './config';

const rootpath = config.assets.rootpath;

/**
 * 扩展名数组转为glob模式的字符
 * @param  {Array<String>} arr
 * @return {String}
 */
function array2ext(arr) {
  let ret = '';

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
export function watch(glob, opts, task) {
  if(opts == null){
    opts = {};
  } else if(typeof opts === 'string' || Array.isArray(opts)){
    task = opts;
    opts = {};
  }

  opts.ignoreInitial = !!opts.ignoreInitial;
  let watcher = chokidar.watch(glob, opts);

  if(Array.isArray(task) || typeof task === 'string'){
    let fn = () => gulp.start(task);

    watcher
      .on('add', fn)
      .on('unlink', fn)
      .on('change', fn);
  }

  return watcher;
}

/**
 * 获取资源的源路径与输出路径
 * @param  {Object} resource
 * @return {Object} resource
 * @return {Array<String>} resource.src  资源原路径
 * @return {Array<String>} resource.revsrc  revision资源原路径
 * @return {String} resource.target  资源输出目录
 */
export function getResourcePath(resource) {
  let
    getPath = (root, dir = '') => {
      return path.join(
        root,
        dir, `/**/*.${array2ext(resource.extensions)}`
      );
    },
    src = [],
    target = path.join(rootpath.dest, resource.dest);

  // 针对配置中使用了数组的情况进行处理
  if(Array.isArray(resource.src)){
    src = resource.src.map((v) => getPath(rootpath.src, v));
  } else {
    src.push(getPath(rootpath.src, resource.src));
  }

  return {
    src: src,
    revsrc: getPath(target),
    target: target
  };
}

/**
 * 获取模板的源路径与输出路径
 * @return {Object} resource
 * @return {Array<String>} resource.src  模板原路径
 * @return {Array<String>} resource.revsrc  revision模板原路径
 * @return {String} resource.target  模板输出目录
 */
export function getTemplatePath() {
  let
    tmpl = config.tmpl,
    src = [],
    getPath = (dir) => {
      return path.join(
        dir,
        `/**/*.${array2ext(tmpl.extensions)}`
      );
    };

  // 针对配置中使用了数组的情况进行处理
  if(Array.isArray(tmpl.src)){
    src = tmpl.src.map((arr, v) => getPath(v));
  } else {
    src.push(getPath(tmpl.src));
  }

  return {
    src: src,
    revsrc: getPath(tmpl.dest),
    target: tmpl.dest
  };
}

/**
 * 提取other task中的原路径与输出路径
 * @return {Array<Object>} arr<resource>
 * @return {Array<String>} resource.src  其他资源原路径
 * @return {Array<String>} resource.revsrc  revision 其他资源原路径
 * @return {String} resource.target  其他输出目录
 */
export function getOtherResourcePath(){
  let getPath;

  return config.assets.other.map((resource) => {
    if(!Array.isArray(resource.src)){
      resource.src = [resource.src];
    }

    getPath = (base) => {
      return resource.src.map((glob) => {
        return path.join(base, glob);
      });
    };

    return {
      src: getPath(rootpath.src),
      revsrc: getPath(rootpath.dest),
      target: path.join(rootpath.dest, resource.dest),
      useHash: !!resource.useHash
    };
  });
}
