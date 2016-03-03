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
import glob from 'glob';
import del from 'del';
import config from './config';

const rootpath = config.assets.rootpath;
const trashManifest = path.join(process.cwd(), './.trash-manifest.json');

/**
 * [1,2,3] -> '{1,2,3}'
 * @param  {Array<String>} arr
 * @return {String}
 */
export function array2ext(arr) {
  let ret = '';

  if (Array.isArray(arr)) {
    if (arr.length === 1) {
      ret = arr[0];
    } else if (arr.length > 1) {
      ret = `{${arr}}`;
    }
  }

  return ret;
}

/**
 * 检测文件是否存在
 * @param  {String} filePath 文件路径
 * @return {Boolean}
 */
export function existsSync(filePath) {
  try {
    fs.accessSync(filePath, fs.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 使用chokidar实现watch，弃用vinyl-fs(gulp)的watch
 * @see https://www.npmjs.com/package/chokidar
 * @param  {Glob} glob
 * @param  {Object} options
 * @param  {Array|String} task
 * @return {Watcher}
 */
export function watch(pattern, options = {}, task) {
  if (typeof options === 'string' || Array.isArray(options)) {
    task = options;
    options = {};
  }

  options.ignoreInitial = !!options.ignoreInitial;
  let watcher = chokidar.watch(pattern, options);

  if (Array.isArray(task) || typeof task === 'string') {
    let fn = () => gulp.start(task);

    watcher
      .on('add', fn)
      .on('unlink', fn)
      .on('change', fn);
  }

  return watcher;
}

/**
 * 创建一个用于glob读取资源的对象
 * @param  {Object} options 参数列表
 * @param  {Array|String} options.src 原路径
 * @param  {Array|String} options.ext 扩展名
 * @param  {String} options.target 目标路径
 * @return {Object} object
 */
export function createPattern(options = {}) {
  const prefixPath = Object.assign({
      src: '',
      dest: ''
    }, options.rootpath),
    createMatchPattern = (prefix, filePath) => path.join(
      prefix,
      filePath,
      `/**/*.${array2ext(options.extensions)}`
    );

  let src = [];
  if (Array.isArray(options.src)) {
    src = options.src.map((p) => createMatchPattern(prefixPath.src, p));
  } else {
    src.push(createMatchPattern(prefixPath.src, options.src));
  }

  return {
    src,
    target: createMatchPattern(prefixPath.dest, options.dest),
    destPath: path.join(prefixPath.dest, options.dest)
  };
}

/**
 * 删除空目录
 * @param {String} dir 目标目录
 */
export function deleteEmptyDir(dir) {
  let files = fs.readdirSync(dir);

  if (files.length === 0) {
    fs.rmdirSync(dir);
  } else {
    let count = 0,
      file = null;
    while ((file = files[count++])) {
      file = path.join(dir, file);
      if (fs.statSync(file).isDirectory()) {
        deleteEmptyDir(file);
      }
    }
  }
}

/**
 * 将冗余的垃圾资源写入到.trash-manifest.json文件中，方面后期回收
 * @todo 通常是js/css构建后的冗余资源
 * @param  {Object} data 要写入的数据
 * @return {Promise}
 */
export function writeTrash(data) {
  return new Promise((resolve, reject) => {
    if (Object.keys(data).length === 0) {
      resolve(data);
      return;
    }

    let oldData = {};

    if (existsSync(trashManifest)) {
      try {
        oldData = JSON.parse(fs.readFileSync(trashManifest, 'utf8'));
      } catch (e) {}
    }

    let newData = Object.assign({}, oldData, data);

    fs.writeFile(
      trashManifest,
      JSON.stringify(newData, null, '  '),
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(newData);
        }
      }
    );
  });
}

/**
 * 清理垃圾资源(通常是js/css构建后的冗余资源)
 * @return {Promise}
 */
export function delTrash() {
  return new Promise((resolve, reject) => {
    if (existsSync(trashManifest)) {
      fs.readFile(trashManifest, 'utf8', (err, data) => {
        if (err) {
          return reject(err);
        }

        let manifest = {};
        try {
          manifest = JSON.parse(data);
        } catch (e) {}

        let cwd = process.cwd(),
          trashList = Object.keys(manifest).map((key) => path.join(cwd, key));

        del(trashList)
          .then(() => {
            resolve(trashManifest);
          })
          .catch(reject);
      });
    } else {
      resolve(trashManifest);
    }
  });
}

/**
 * 标准化文件资源的引用路径
 * @param  {String} filePath 资源路径
 * @return {String}
 */
export function normalizeReferencePath(filePath) {
  let resultPath = path.normalize(filePath).split(path.sep).join('/');
  if (path.isAbsolute(filePath)) {
    resultPath = `/${resultPath}`;
  }

  return resultPath;
}

/**
 * 拼接两个引用路径
 * @param  {String} first
 * @param  {String} second
 * @return {String}
 */
export function concatReferencePath(first, second) {
  if (first.endsWith('/')) {
    first = first.slice(0, -1);
  }

  if (second.startsWith('/')) {
    second = second.slice(1);
  }

  return `${first}/${second}`;
}

/**
 * 将匹配到的资源路径写入到manifest
 * @param  {String}  patterns   file globbing格式
 * @param  {Object} options
 * @param  {Boolean} options.merge 是否将匹配到的资源合并到已有的manifest.json文件
 * @return {Promise}
 */
export function writeManifest(patterns, options = {}) {
  let regex = new RegExp(`^${normalizeReferencePath(rootpath.dest)}`, 'g'),
    prefix = options.prefix || '';

  return new Promise((resolve, reject) => {
    let maps = {},
      files = patterns.reduce((arr, v) => [...arr, ...glob.sync(v)], []);

    files.forEach((v) => {
      let filePath = concatReferencePath(
          normalizeReferencePath(rootpath.src),
          normalizeReferencePath(v).replace(regex, '')
        );

      maps[filePath] = concatReferencePath(prefix, filePath);
    });

    // 合并原有的manifest文件
    if (options.merge && existsSync(config.manifest)) {
      let manifest = {};
      try {
        manifest = JSON.parse(fs.readFileSync(config.manifest, 'utf8'));
      } catch (e) {}

      maps = Object.assign(manifest, maps);
    }

    let out = JSON.stringify(maps, null, '  ');

    fs.writeFile(config.manifest, out, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(maps);
      }
    });
  });
}
