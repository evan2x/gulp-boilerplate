
import path from 'path';
import fs from 'fs';
import glob2base from 'glob2base';
import chokidar from 'chokidar';
import postcss from 'postcss';
import through from 'through2';
import gulp from 'gulp';
import glob, { Glob } from 'glob';
import del from 'del';
import useref from 'useref';
import gutil from 'gulp-util';

const noop = function() {}; // eslint-disable-line no-empty-function
const rqueryVersion = /\?v=([\da-zA-Z]+)$/;
const rfilenameVersion = /-([\da-zA-Z]{10})(?:\.\S*)*$/;

class GrabageSet extends Set {
  clean() {
    del.sync(Array.from(this));
  }
}

export const grabage = new GrabageSet();

/**
 * 去除字符串中左边的 “/” 字符
 * @param {String} str
 * @return {String}
 */
export function trimSlashLeft(str) {
  if (!str) return '';

  return str.replace(/^\/+/, '');
}

/**
 * 去除字符串中右边的 “/” 字符
 * @param {String} str
 * @return {String}
 */
export function trimSlashRight(str) {
  if (!str) return '';

  for (let count = str.length; count >= 0; count--) {
    if (str.charCodeAt(count - 1) !== 47) {
      str = str.slice(0, count);
      break;
    }
  }

  return str;
}

/**
 * 去除字符串首尾的斜杠
 * @param {String} str
 * @return {String}
 */
export function trimSlash(str) {
  return trimSlashRight(trimSlashLeft(str));
}

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
    return globs.map((item) => path.join(base, item));
  }

  return path.join(base, globs);
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

  let rebase = (globPath) => {
    let originalBase = glob2base(new Glob(globPath));

    if (originalBase === './') {
      return path.join(base, globPath);
    }

    return path.normalize(globPath.replace(originalBase, base));
  };

  if (Array.isArray(globs)) {
    globs.map((item) => rebase(item));
  } else {
    return rebase(globs);
  }
}

/**
 * 使用useref标记清除资源
 * @param {Object} options
 * @param {String} options.directory
 * @param {String} options.outputResult
 * @return {Stream.Readable}
 */
export function userefMarkSweep({
  directory = '',
  outputResult = noop
} = {}) {

  if (typeof directory === 'string' && directory.length > 0) {
    directory = trimSlashLeft(directory);
  }

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('mark-sweep-resources', 'Streaming not supported'));
      return cb();
    }

    let result = useref(file.contents.toString())[1];

    const markSweep = (resources) => {
      Object.keys(resources).forEach((key) => {
        let replacedFiles = resources[key].assets;

        if (replacedFiles && Array.isArray(replacedFiles)) {
          replacedFiles.forEach((filePath) => {
            filePath = trimSlashLeft(filePath);

            if (
              filePath.startsWith(directory) &&
              !filePath.endsWith(key)
            ) {
              grabage.add(filePath);
            }
          });
        }
      });
    };

    if (result.css) {
      markSweep(result.css);
    }

    if (result.js) {
      markSweep(result.js);
    }

    outputResult(result);

    this.push(file);
    cb();
  });
}

/**
 * 根据生成的静态资源表替换文件中的路径
 * @param {Object} manifest
 * @return {Stream.Readable}
 */
export function replaceByManifest(manifest) {
  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('replace', 'Streaming not supported'));
      return cb();
    }

    let contents = file.contents.toString();

    for (let [key, value] of Object.entries(manifest)) {
      contents = contents.replace(new RegExp(`${trimSlash(key)}`, 'g'), trimSlash(value));
    }

    file.contents = new Buffer(contents);
    this.push(file);
    cb();
  });
}

/**
 * 版本号格式转换器
 * @type {Object}
 */
export const versionTransformer = Object.freeze({
  /**
   * 转换为querystring格式
   * @param  {String} filePath
   * @return {String}
   * @example
   *   /path/to/name-1d746b2ce5.png -> /path/to/name.png?v=1d746b2ce5
   */
  toQuery(filePath) {
    if (rqueryVersion.test(filePath)) return filePath;

    let match = filePath.match(rfilenameVersion),
      hash = null;

    if (Array.isArray(match) && (hash = match[1])) {
      filePath = filePath.replace(`-${hash}`, '');
      filePath = `${filePath}?v=${hash}`;
    }

    return filePath;
  },
  /**
   * 转换为文件名格式
   * @param  {String} filePath
   * @return {String}
   * @example
   *   /path/to/name.png?v=1d746b2ce5 -> /path/to/name-1d746b2ce5.png
   */
  toFilename(filePath) {
    if (rfilenameVersion.test(filePath)) return filePath;

    let match = filePath.match(rqueryVersion),
      hash = null;

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
});

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

  let collectEmptyDir = (dir, dirs = []) => {
    let files = fs.readdirSync(dir),
      count = 0,
      file = null;

    while ((file = files[count++]) != null) {
      file = path.join(dir, file);
      if (fs.statSync(file).isDirectory()) {
        dirs.push(file);
        dirs.concat(collectEmptyDir(file, dirs));
      }
    }

    return dirs;
  };

  collectEmptyDir(basedir)
    .sort((a, b) => trimSlash(b).split('/').length - trimSlash(a).split('/').length)
    .forEach((directory) => {
      if (!fs.readdirSync(directory).length) {
        fs.rmdirSync(directory);
      }
    });
}

/**
 * 将一个Buffer或者字符串添加到读取的文件内容之前
 * @param {String|Buffer} data
 * @return {Stream.Readable}
 */
export function insertBeforeCode(code) {
  if (Buffer.isBuffer(code)) {
    code = code.toString();
  }

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('insert-code', 'Streaming not supported'));
      return cb();
    }

    let contents = file.contents.toString();

    file.contents = new Buffer(`${code}\n${contents}`);
    this.push(file);
    cb();
  });
}

/**
 * 从globs中提取后缀
 * @param {Array|String} globs
 * @return {Array}
 */
export function extractExtsForGlobs(globs) {
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

  return Array.from(new Set(exts));
}

/**
 * 检测是否为正则表达式
 * @param {Any} v
 * @return {Boolean}
 */
function isRegExp(v) {
  return Object.prototype.toString.call(v) === '[object RegExp]';
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
  const manifest = {},
    filePaths = globsList.reduce((arr, v) => {
      let files = glob.sync(v).map((filePath) => path.posix.normalize(
        filePath.replace(outputDirectory, inputDirectory)
      ));

      return [
        ...arr,
        ...files
      ];
    }, []);

  for (let i = 0, filePath; filePath = filePaths[i++];) {
    let newFilePath = filePath;

    if (prefix && (!isRegExp(prefixIgnore) || !prefixIgnore.test(newFilePath))) {
      newFilePath = path.posix.join(prefix, newFilePath);
    }

    if (domain && (!isRegExp(domainIgnore) || !domainIgnore.test(newFilePath))) {
      newFilePath = path.posix.join(domain, newFilePath);
    }

    if (newFilePath !== filePath) {
      manifest[filePath] = newFilePath;
    }
  }

  return manifest;
}

/**
 * postcss-sprites 插件更新CSS规则
 * @reference https://github.com/2createStudio/postcss-sprites/blob/master/src/index.js#L422
 */
export function updateSpritesRule(rule, token, image) {
  const {retina, ratio, coords, spriteWidth, spriteHeight} = image;
  const posX = coords.x / ratio;
  const posY = coords.y / ratio;
  const sizeX = spriteWidth / ratio;
  const sizeY = spriteHeight / ratio;

  let spriteUrl = path.posix.join(
    path.posix.dirname(image.url),
    path.posix.basename(image.spriteUrl)
  );

  const backgroundImageDecl = postcss.decl({
    prop: 'background-image',
    value: `url(${spriteUrl})`
  });

  const backgroundPositionDecl = postcss.decl({
    prop: 'background-position',
    value: `${-1 * posX}px ${-1 * posY}px`
  });

  rule.insertAfter(token, backgroundImageDecl);
  rule.insertAfter(backgroundImageDecl, backgroundPositionDecl);

  if (retina) {
    const backgroundSizeDecl = postcss.decl({
      prop: 'background-size',
      value: `${sizeX}px ${sizeY}px`
    });

    rule.insertAfter(backgroundPositionDecl, backgroundSizeDecl);
  }
}

/**
 * gulp-rev收集的资源重写为querystring格式
 * @return {Stream.Readable}
 */
export function revRewriteQuery() {
  let manifest = {};

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('rev-query', 'Streaming not supported'));
      return cb();
    }

    try {
      let oldManifest = JSON.parse(file.contents.toString());
      manifest = Object.assign(oldManifest, manifest);
    } catch (e) {}

    for (let [key, value] of Object.entries(manifest)) {
      manifest[key] = versionTransformer.toQuery(value);
    }

    file.contents = new Buffer(JSON.stringify(manifest, null, '    '));
    this.push(file);
    cb();
  });
}
