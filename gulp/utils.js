/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description gulp tasks utils
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import fs from 'fs';
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
  let src = [],
    target = path.join(rootpath.dest, resource.dest),
    getPath = (root, dir = '') => {
      return path.join(
        root,
        dir, `/**/*.${array2ext(resource.extensions)}`
      );
    };

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
 * 提取useref的目标路径
 * @param  {String} p1 比对路径，通常是静态资源的公共输出路径
 * @param  {String} p2 比对路径，通常是模板的输入路径
 * @return {String}    
 */
export function getUserefTarget(p1, p2){
  p1 = path.normalize(p1).split(path.sep);
  p2 = path.normalize(p2).split(path.sep);

  let same = [];
  // 取字符串中两个相等的路径
  for(let count = 0; count < p1.length; count++){
    if(p1[count] === p2[count]){
      same.push(p1[count]);
    } else {
      break;
    }
  }

  same = same.join(path.sep);
  if(fs.existsSync(path.join(process.cwd(), same))){
    if(same === p1.join(path.sep)){
      return path.dirname(same);
    } else {
      return same;
    }
  } else {
    return '';
  }
}

/**
 * 获取模板的源路径与输出路径
 * @return {Object} resource
 * @return {Array<String>} resource.src  模板原路径
 * @return {Array<String>} resource.revsrc  revision模板原路径
 * @return {String} resource.target  模板输出目录
 */
export function getTemplatePath(opts) {
  let src = [],
    getPath = (dir) => {
      return path.join(
        dir,
        `/**/*.${array2ext(opts.extensions)}`
      );
    };

  // 针对配置中使用了数组的情况进行处理
  if(Array.isArray(opts.src)){
    src = opts.src.map((arr, v) => getPath(v));
  } else {
    src.push(getPath(opts.src));
  }

  return {
    src: src,
    revsrc: getPath(opts.dest),
    target: opts.dest
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


