import path from 'path';
import fs from 'fs';
import glob2base from 'glob2base';
import chokidar from 'chokidar';
import gulp from 'gulp';
import glob, { Glob } from 'glob';
import del from 'del';
import * as _ from 'lodash';

const hashForQueryRE = /\?v=([\da-zA-Z]+)$/;
const hashForFilenameRE = /-([\da-zA-Z]{10})(?:\.[^-?=/]*)*$/;

class GrabageSet extends Set {
  clean() {
    del.sync(Array.from(this));
  }
}

export const grabage = new GrabageSet();

/**
 * 处理gulp.src所需要的globs
 * @param {String} base
 * @param {Array|String} globs
 * @return {Array|String}
 */
export function processGlobs(base, globs) {
  if (globs == null) {
    return '';
  }

  if (Array.isArray(globs)) {
    return globs.map(item => path.join(base, item));
  }

  return path.join(base, globs);
}

/**
 * 拼接多个Globs
 * @param  {String|Array}
 * @return {String|Array}
 */
export function concatGlobs(...args) {
  if (args.length < 2) {
    return args[0];
  }

  let ret = [];

  for (let i = 0; i < args.length; i++) {
    if (!args[i]) continue;

    if (Array.isArray(args[i])) {
      ret = ret.concat(args[i]);
    } else {
      ret.push(args[i]);
    }
  }

  return ret;
}

/**
 * 替换globs base
 * @param {Array|String} globs
 * @param {String} base
 * @return {Array|String}
 */
export function globRebase(globs, base) {
  if (globs == null) {
    return '';
  }

  const rebase = (globPath) => {
    let originalBase = glob2base(new Glob(globPath));

    if (originalBase === './') {
      return path.join(base, globPath);
    }

    if (!base.endsWith(path.sep)) {
      base = `${base}${path.sep}`;
    }

    return path.normalize(globPath.replace(originalBase, base));
  };

  if (Array.isArray(globs)) {
    return globs.map(item => rebase(item));
  }

  return rebase(globs);
}

/**
 * 将querystring版本号格式转为filename版本号格式
 * @param  {String} filePath
 * @return {String}
 * @example
 *   /path/to/name.png?v=1d746b2ce5 -> /path/to/name-1d746b2ce5.png
 */
export function query2filename(filePath) {
  if (hashForFilenameRE.test(filePath)) return filePath;

  let match = filePath.match(hashForQueryRE);
  let hash = null;

  if (Array.isArray(match) && (hash = match[1])) {
    let dotIndex = filePath.indexOf('.');

    filePath = filePath.replace(`?v=${hash}`, '');

    if (dotIndex > -1) {
      filePath = `${filePath.slice(0, dotIndex)}-${hash}${filePath.slice(dotIndex)}`;
    } else {
      filePath = `${filePath}-${hash}`;
    }
  }

  return filePath;
}

/**
 * 使用chokidar实现watch，弃用vinyl-fs(gulp)的watch
 * @param  {Glob} glob
 * @param  {Object} options
 * @param  {Array|String} task
 * @return {Watcher}
 * @see https://www.npmjs.com/package/chokidar
 */
export function watch(globs, options = {}, task) {
  if (typeof options === 'string' || Array.isArray(options)) {
    task = options;
    options = {};
  }

  options.ignoreInitial = !!options.ignoreInitial;
  let watcher = chokidar.watch(globs, options);

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
 * 删除空目录
 * @param {String} basedir 目标目录
 */
export function delEmptyDir(basedir) {
  if (!basedir) return;

  const collect = (dir, dirs = []) => {
    let files = fs.readdirSync(dir);
    let count = 0;
    let file = null;

    while ((file = files[count++]) != null) {
      file = path.join(dir, file);
      if (fs.statSync(file).isDirectory()) {
        dirs.push(file);
        dirs.concat(collect(file, dirs));
      }
    }

    return dirs;
  };

  collect(basedir)
    .sort((a, b) => _.trim(b, path.posix.sep).split('/').length - _.trim(a, path.posix.sep).split('/').length)
    .forEach((directory) => {
      if (!fs.readdirSync(directory).length) {
        fs.rmdirSync(directory);
      }
    });
}

/**
 * 从globs中提取后缀
 * @param {Array|String} globs
 * @return {Array}
 */
export function extractExtsByGlobs(globs) {
  if (!Array.isArray(globs)) {
    globs = [globs];
  }

  let exts = globs.reduce((arr, item) => {
    let extList = item.slice(
      item.lastIndexOf('.') + 1,
      item.length
    ).replace(/^{+|}+$/g, '').split(',');

    return [
      ...arr,
      ...extList
    ];
  }, []);

  return _.uniq(exts);
}

/**
 * 将匹配到的资源路径写入到manifest
 * @param  {Array}  globsList
 * @param  {Object} options
 * @return {Object}
 */
export function createReplacementManifest(globsList, {
  domain = '',
  domainIgnore = null,
  prefix = '',
  prefixIgnore = null,
  inputDirectory = '',
  outputDirectory = ''
} = {}) {
  const manifest = {};
  const filePaths = globsList.reduce((arr, v) => {
    let files = glob.sync(v).map(filePath => path.posix.normalize(
      filePath.replace(outputDirectory, inputDirectory)
    ));

    return [
      ...arr,
      ...files
    ];
  }, []);

  for (let i = 0, filePath; filePath = filePaths[i++];) {
    let newFilePath = filePath;

    if (prefix && (!_.isRegExp(prefixIgnore) || !prefixIgnore.test(newFilePath))) {
      newFilePath = path.posix.join(prefix, newFilePath);
    }

    if (domain && (!_.isRegExp(domainIgnore) || !domainIgnore.test(newFilePath))) {
      newFilePath = path.posix.join(domain, newFilePath);
    }

    if (newFilePath !== filePath) {
      manifest[filePath] = newFilePath;
    }
  }

  return manifest;
}
