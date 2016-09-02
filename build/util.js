
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

import config from './config';

const assets = config.assets;
const rootpath = assets.rootpath;
const garbageManifest = path.join(process.cwd(), '.garbage-manifest.json');
const noop = function() {};

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
  } else {
    return path.join(base, globs);
  }
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

    if (originalBase == './') {
      return path.join(base, globPath);
    } else {
      return path.normalize(globPath.replace(originalBase, base));
    }
  }

  if (Array.isArray(globs)) {
    globs.map(item => {
      return rebase(item);
    });
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
    }

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
 * 去除字符串首尾的斜杠
 * @param {String} str
 * @return {String}
 */
export function trimSlash(str) {
  return trimSlashRight(trimSlashLeft(str));
}

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
 * 版本号格式转换器
 * @type {Object}
 */
export const versionFormatter = Object.freeze({
  /**
   * 转换为querystring格式
   * @param  {String} filePath
   * @return {String}
   * @example
   *   /path/to/name-1d746b2ce5.png -> /path/to/name.png?v=1d746b2ce5
   */
  toQuery(filePath) {
    let match = filePath.match(/-([\da-zA-Z]+)(?:\.[\s\S]+)?(?:\.[\da-zA-Z]+)*$/),
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
    let match = filePath.match(/\?v=([\da-zA-Z]+)$/),
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

  let ext = globs.reduce((arr, item) => {
    let ext = item.slice(
      item.lastIndexOf('.') + 1,
      globs.length
    ).replace(/^{+|}+$/g, '').split(',');

    return [
      ...arr,
      ...ext
    ];
  }, []);

  return Array.from(new Set(ext));
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
      let files = glob.sync(v).map(filePath => {
        return path.posix.normalize(filePath.replace(outputDirectory, inputDirectory));
      });

      return [
        ...arr,
        ...files
      ]
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

// ------------old-------------

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
 * @param {String} rootdir 目标目录
 */
export function removeEmptyDir(rootdir) {
  if (!rootdir) {
    return;
  }

  let collectDirs = (dir, dirs = []) => {
    let files = fs.readdirSync(dir),
      count = 0,
      file = null;

    while ((file = files[count++]) != null) {
      file = path.join(dir, file);
      if (fs.statSync(file).isDirectory()) {
        dirs.push(file);
        dirs.concat(collectDirs(file, dirs));
      }
    }

    return dirs;
  };

  collectDirs(rootdir)
    .sort((a, b) => trimSlash(b).split('/').length - trimSlash(a).split('/').length)
    .forEach((directory) => {
      if (!fs.readdirSync(directory).length) {
        fs.rmdirSync(directory);
      }
    });
}

/**
 * 将冗余的垃圾资源写入到.garbage-manifest.json文件中，方面后期回收
 * @todo 通常是js/css构建后的冗余资源
 * @param  {Object} data 要写入的数据
 * @return {Promise}
 */
export function writeGarbage(data) {
  return new Promise((resolve, reject) => {
    if (Object.keys(data).length === 0) {
      resolve(data);
      return;
    }

    let oldData = {};

    if (existsSync(garbageManifest)) {
      try {
        oldData = JSON.parse(fs.readFileSync(garbageManifest, 'utf8'));
      } catch (e) {}
    }

    let newData = Object.assign({}, oldData, data);

    fs.writeFile(
      garbageManifest,
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
export function delGarbage() {
  return new Promise((resolve, reject) => {
    if (existsSync(garbageManifest)) {
      fs.readFile(garbageManifest, 'utf8', (err, data) => {
        if (err) {
          return reject(err);
        }

        let manifest = {};
        try {
          manifest = JSON.parse(data);
        } catch (e) {}

        let cwd = process.cwd(),
          garbageList = Object.keys(manifest).map((key) => path.join(cwd, key));

        del(garbageList)
          .then(() => {
            resolve(garbageManifest);
          })
          .catch(reject);
      });
    } else {
      resolve(garbageManifest);
    }
  });
}

/**
 * 将匹配到的资源路径写入到manifest
 * @param  {String}  patterns   file globbing格式
 * @param  {Object} options
 * @param  {Boolean} options.merge 是否将匹配到的资源合并到已有的manifest.json文件
 * @return {Promise}
 */
export function writeManifest(patterns, {domain = '', prefix = '', merge = false} = {}) {
  let regex = {
      dest: new RegExp(`^${path.posix.normalize(rootpath.dest)}`, 'g'),
      svg: new RegExp(`\.(?:${assets.svg.extensions.join('|')})$`)
    },
    svgsrc = assets.svg.src;

  if (!Array.isArray(svgsrc)) {
    svgsrc = [svgsrc];
  }

  let svgDirs = svgsrc.map((src) => path.posix.join(rootpath.src, src));

  return new Promise((resolve, reject) => {
    let maps = {},
      files = patterns.reduce((arr, v) => [...arr, ...glob.sync(v)], []);

    files.forEach((v) => {
      let filePath = path.posix.join(
          rootpath.src,
          path.posix.normalize(v).replace(regex.dest, '')
        ),
        newFilePath = filePath,
        isSVG = regex.svg.test(filePath) && svgDirs.some((dir) => filePath.startsWith(dir));

      if (!filePath.startsWith('/')) {
        newFilePath = `/${filePath}`;
      }

      // 拼接前缀
      if (prefix !== '') {
        newFilePath = path.posix.join(prefix, filePath);
      }

      // 拼接domain
      if (domain !== '' && (!isSVG || (isSVG && assets.svg.useDomain))) {
        if (domain.endsWith('/')) {
          domain = domain.slice(0, -1);
        }

        if (newFilePath.startsWith('/')) {
          newFilePath = newFilePath.slice(1);
        }

        newFilePath = `${domain}/${newFilePath}`;
      }

      maps[filePath] = newFilePath;
    });

    // 合并原有的manifest文件
    if (merge && existsSync(config.manifest)) {
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

/**
 * 根据生成的静态资源表替换文件中的路径
 * @param {Object} options  参数
 * @param {Object} options.manifest
 * @return {Stream.Readable}
 */
export function fileReplace({manifest = {}} = {}) {
  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('replace', 'Streaming not supported'));
      return cb();
    }

    let contents = file.contents.toString();

    Object.keys(manifest).forEach((key) => {
      contents = contents.split(`/${key}`).join(manifest[key]);
    });

    file.contents = new Buffer(contents);
    this.push(file);
    cb();
  });
}

/**
 * 将一个Buffer或者字符串添加到读取的文件内容之前
 * @param {String|Buffer} data
 * @return {Stream.Readable}
 */
export function addBeforeSource(data) {
  if (Buffer.isBuffer(data)) {
    data = data.toString();
  }

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('add-source', 'Streaming not supported'));
      return cb();
    }

    let contents = file.contents.toString();

    file.contents = new Buffer(`${data}\n${contents}`);
    this.push(file);
    cb();
  });
}

/**
 * 使用useref来收集垃圾资源
 * @param  {Object} options 参数
 * @param  {String} options.prefix 针对特定前缀的文件路径，如果为空则不记录任何资源
 * @return {Stream.Readable}
 */
export function collectGarbageByUseref({prefix = ''} = {}) {
  if (prefix) {
    prefix = path.posix.normalize(prefix);

    if (!path.isAbsolute(prefix)) {
      prefix = `/${prefix}`;
    }
  }

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('collect-grabage-resources', 'Streaming not supported'));
      return cb();
    }

    let nextStream = () => {
      this.push(file);
      cb();
    };

    if (prefix) {
      let result = useref(file.contents.toString())[1],
        collectGarbage = (resources, garbageMaps) => {
          Object.keys(resources).forEach((key) => {
            let replacedFiles = resources[key].assets;
            if (replacedFiles && Array.isArray(replacedFiles)) {
              replacedFiles.forEach((filePath) => {
                filePath = filePath.replace(/^(?:\.\/|\.\.\/)+/, '');

                if (!filePath.startsWith('/')) {
                  filePath = `/${filePath}`;
                }

                // 以prefix开头及以打包后与输出资源不是同一路径的文件加入到待回收资源表中
                if (filePath.startsWith(prefix) && !filePath.endsWith(key)) {
                  garbageMaps[filePath] = filePath;
                }
              });
            }
          });
        };

      let garbageMap = {};

      if (result.css) {
        collectGarbage(result.css, garbageMap);
      }

      if (result.js) {
        collectGarbage(result.js, garbageMap);
      }

      writeGarbage(garbageMap)
        .then(nextStream)
        .catch(nextStream);
    } else {
      nextStream();
    }
  });
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

  let dist = rootpath.dest.replace(/^\.*\//, '');
  let spritePath = image.spritePath.replace(dist, '');

  spritePath = path.join(rootpath.src, spritePath).split(path.sep).join('/');

  if (!spritePath.startsWith('/')) {
    spritePath = `/${spritePath}`;
  }

  const backgroundImageDecl = postcss.decl({
    prop: 'background-image',
    value: `url(${spritePath})`
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
 * 版本号格式转换器
 * @type {Object}
 */
export const revisionConverter = Object.freeze({
  /**
   * 转换为querystring格式
   * @param  {String} filePath
   * @return {String}
   * @example
   *   /path/to/name-1d746b2ce5.png -> /path/to/name.png?v=1d746b2ce5
   */
  toQuery(filePath) {
    let match = filePath.match(/-([\da-zA-Z]+)(?:\.[\s\S]+)?(?:\.[\da-zA-Z]+)*$/),
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
    let match = filePath.match(/\?v=([\da-zA-Z]+)$/),
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
      manifest[key] = revisionConverter.toQuery(value);
    }

    file.contents = new Buffer(JSON.stringify(manifest, null, '    '));
    this.push(file);
    cb();
  });
}
