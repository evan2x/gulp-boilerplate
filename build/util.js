
import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import postcss from 'postcss';
import through from 'through2';
import gulp from 'gulp';
import glob from 'glob';
import del from 'del';
import useref from 'useref';
import gutil from 'gulp-util';
import config from './config';

const rootpath = config.assets.rootpath;
const garbageManifest = path.join(process.cwd(), '.garbage-manifest.json');

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
 * 去除首尾的斜杠
 * @param {String} p
 * @return {String}
 */
export function trimSlash(p) {
  if (!p) {
    return '';
  }

  if (p.startsWith('/')) {
    p = p.slice(1);
  }

  if (p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  return p;
}

/**
 * 删除空目录
 * @param {String} rootdir 目标目录
 */
export function removeEmptyDirectory(rootdir) {
  if (!rootdir) {
    return;
  }

  let collectDirectory = (directory, directories = []) => {
    let files = fs.readdirSync(directory),
      count = 0,
      dir = null;

    while ((dir = files[count++]) != null) {
      dir = path.join(directory, dir);
      if (fs.statSync(dir).isDirectory()) {
        directories.push(dir);
        directories.concat(collectDirectory(dir, directories));
      }
    }

    return directories;
  };

  collectDirectory(rootdir)
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

/**
 * 根据生成的静态资源表替换文件中的路径
 * @param {Object} options  参数
 * @param {Object} options.manifest
 * @return {Stream<Writable>}
 */
export function fileReplace(options = {}) {
  let manifest = options.manifest || {};

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
 * 使用useref来收集垃圾资源
 * @param  {Object} options 参数
 * @param  {String} options.prefix 针对特定前缀的文件路径，如果为空则不记录任何资源
 * @return {Stream<Writable>}
 */
export function collectGarbageByUseref(options = {}) {
  let prefix = options.prefix || '';

  if (prefix) {
    prefix = normalizeReferencePath(prefix);
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
  const { retina, ratio, coords, spriteWidth, spriteHeight } = image;
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
