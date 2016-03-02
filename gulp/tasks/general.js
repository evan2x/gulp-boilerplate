/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description general tasks
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import path from 'path';
import gulp from 'gulp';
import pngquant from 'imagemin-pngquant';
import autoprefixer from 'autoprefixer';
import through from 'through2';
import gutil from 'gulp-util';
import minimist from 'minimist';
import useref from 'useref';
import browserSync from 'browser-sync';
import * as utils from '../utils';
import packer from './packer';

const bs = browserSync.create();
const argv = minimist(process.argv.slice(2));

/**
 * 根据生成的静态资源表替换文件中的路径
 * @param {Object} options  参数
 * @param {Object} options.manifest
 * @return {Stream<Writable>}
 */
function fileReplace(options = {}) {
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
 * 利用useref记录产生的垃圾资源
 * @param  {Object} options 参数
 * @param  {String} options.prefix 针对特定前缀的文件路径，如果为空则不记录任何资源
 * @return {Stream<Writable>}
 */
function userefRecordGarbage(options = {}) {
  let prefix = options.prefix || '';

  if (prefix) {
    prefix = utils.normalizeReferencePath(prefix);
    if (!path.isAbsolute(prefix)) {
      prefix = `/${prefix}`;
    }
  }

  return through.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('collect-waste', 'Streaming not supported'));
      return cb();
    }

    let nextStream = () => {
      this.push(file);
      cb();
    };

    if (prefix) {
      let result = useref(file.contents.toString())[1],
        collectWaste = (resources, dirtyMaps) => {
          Object.keys(resources).forEach((key) => {
            let replacedFiles = resources[key].assets;
            if (replacedFiles && Array.isArray(replacedFiles)) {
              replacedFiles.forEach((filePath) => {
                // 以prefix开头及以打包后与输出资源不是同一路径的文件加入到待回收资源表中
                if (filePath.startsWith(prefix) && !filePath.endsWith(key)) {
                  dirtyMaps[filePath] = filePath;
                }
              });
            }
          });
        };

      let wasteMap = {};

      if (result.css) {
        collectWaste(result.css, wasteMap);
      }

      if (result.js) {
        collectWaste(result.js, wasteMap);
      }

      utils.writeWaste(wasteMap)
        .then(nextStream)
        .catch(nextStream);
    } else {
      nextStream();
    }
  });
}

export default function(config, plugins, debug) {
  let assets = config.assets,
    rootpath = assets.rootpath,
    // JS模块打包器
    bundler = packer(assets, debug);

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('eslint', () => {
    let pattern = utils.createPattern({
      ...assets.js,
      rootpath
    });

    return gulp.src(pattern.src)
      .pipe(plugins.eslint())
      .pipe(plugins.eslint.format());
      // 暂时不开启抛出异常，只进行检查，而不强制中断整个构建
      // .pipe(plugins.eslint.failAfterError());
  });

  /**
   * 图片压缩
   * @todo debug模式下不压缩图片
   */
  gulp.task('image', () => {
    let pattern = utils.createPattern({
      ...assets.img,
      rootpath
    });

    return gulp.src(pattern.src)
      .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.if(!debug, plugins.imagemin({
        progressive: true,
        use: [pngquant()]
      })))
      .pipe(gulp.dest(pattern.destPath));
  });

  /**
   * 压缩svg文件
   * @todo debug模式不压缩
   */
  gulp.task('svg', () => {
    let pattern = utils.createPattern({
      ...assets.svg,
      rootpath
    });

    return gulp.src(pattern.src)
      .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.if(!debug, plugins.svgmin(assets.svg.compress)))
      .pipe(gulp.dest(pattern.destPath));
  });

  /**
   * SCSS样式转换为CSS，并且使用autoprefixer处理前缀
   * @todo debug模式下保留sourcemap
   */
  gulp.task('css', () => {
    let pattern = utils.createPattern({
      ...assets.css,
      rootpath
    });

    return gulp.src(pattern.src)
      .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.postcss([
        autoprefixer(assets.css.autoprefixer)
      ]))
      .pipe(plugins.if(!debug, plugins.csso()))
      .pipe(plugins.if(debug, plugins.sourcemaps.write()))
      .pipe(gulp.dest(pattern.destPath))
      .pipe(bs.stream());
  });

  /**
   * 使用browserify打包JavaScript模块
   */
  gulp.task('js', (done) => {
    bundler(done);
  });

  /**
   * copy other列表中的静态资源
   */
  gulp.task('other', (done) => {
    let tasks = assets.other.map((item) => {
      let pattern = utils.createPattern({
        ...item,
        rootpath
      });

      return new Promise((resolve, reject) => {
        gulp.src(pattern.src)
          .pipe(plugins.changed(pattern.destPath))
          .pipe(gulp.dest(pattern.destPath))
          .on('end', resolve)
          .on('error', reject);
      });
    });

    Promise.all(tasks)
      .then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });

  });

  function processHTML(pattern, conf) {
    let userefDestPath = path.normalize(pattern.destPath).split(path.sep)[0],
      regex = new RegExp(`^${process.cwd()}`);

    return new Promise((resolve, reject) => {
      let wasteMap = {};

      gulp.src(pattern.src, {base: './'})
        .pipe(plugins.changed(userefDestPath))
        .pipe(userefRecordGarbage({prefix: rootpath.dest}))
        .pipe(plugins.useref(conf.useref))
        .pipe(plugins.if(!debug, plugins.if('*.css', plugins.csso())))
        .pipe(plugins.if(!debug, plugins.if('*.js', plugins.uglify())))
        .pipe(gulp.dest(userefDestPath))
        .on('end', () => {
          gulp.src(pattern.target)
            .pipe(plugins.inlineSource({
              rootpath: './',
              compress: !debug,
              handlers: (source, context, next) => {
                let filePath = source.filepath.replace(regex, ''),
                  prefix = utils.normalizeReferencePath(rootpath.dest);

                if (!path.isAbsolute(prefix)) {
                  prefix = `/${prefix}`;
                }

                if (filePath.startsWith(prefix)) {
                  wasteMap[filePath] = filePath;
                }

                next();
              }
            }))
            .pipe(gulp.dest(pattern.destPath))
            .on('end', () => {
              utils.writeWaste(wasteMap)
              .then(resolve)
              .catch(reject);
            })
            .on('error', (err) => {
              reject(err);
            });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * 对静态HTML中对使用了useref语法的资源进行合并以及压缩
   * 并且对添加了inline标识的资源进行内联
   * @todo debug模式下不对css及js进行压缩
   */
  gulp.task('html', () => {
    let pattern = utils.createPattern({
      ...assets.html,
      rootpath
    });

    return processHTML(pattern, assets.html);
  });

  /**
   * 对模板中对使用了useref语法的资源进行合并以及压缩
   * 并且对添加了inline标识的资源进行内联
   * @todo debug模式下不对css及js进行压缩
   */
  gulp.task('tpl', () => {
    let pattern = utils.createPattern({...config.tpl});

    return processHTML(pattern, assets.html);
  });

  /**
   * 扫描所有文件，增加文件中引用路径的前缀
   */
  gulp.task('prefix', (done) => {
    let patterns = {},
      maps = {
        svg: assets.svg,
        img: assets.img,
        css: assets.css,
        js: assets.js,
        html: assets.html
      },
      prefixRelpace = (pattern, manifest) => new Promise((resolve, reject) => {
        gulp.src(pattern.target)
          .pipe(fileReplace({manifest}))
          .pipe(gulp.dest(pattern.destPath))
          .on('end', () => {
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          });
      });

    assets.other.forEach((item, index) => {
      maps[`other${index}`] = item;
    });

    Object.keys(maps).forEach((key) => {
      let properties = {
        ...maps[key],
        rootpath
      };

      patterns[key] = utils.createPattern(properties);
    });

    utils.writeManifest(
      Object.values(patterns).map((item) => item.target),
      {
        prefix: config.prefix
      }
    )
    .then((manifest) => {
      let list = [
        patterns.css,
        patterns.js,
        patterns.html,
        utils.createPattern({...config.tpl})
      ].map((item) => prefixRelpace(item, manifest));

      return Promise.all(list);
    })
    .then(() => {
      done();
    })
    .catch((err) => {
      done(err);
    });
  });

  /**
   * watch js, css
   * @todo 仅对js和css进行watch
   */
  gulp.task('watch', () => {
    let pattern = utils.createPattern({
      ...assets.css,
      rootpath
    });

    utils.watch(pattern.src, ['css']);
    bundler('watch');
  });

  /**
   * browser-sync service
   */
  gulp.task('serve', () => {
    let conf = config.browserSync;

    if (argv.port && typeof argv.port != 'boolean') {
      conf.port = argv.port;
    }

    // proxy port
    if (argv.pport && typeof argv.pport != 'boolean') {
      let proxy = `127.0.0.1:${argv.pport}`;
      switch (Object.prototype.toString.call(conf.proxy)) {
        case '[object Object]':
          conf.proxy.target = proxy;
          break;

        // 字符串或者其他非对象类型重新修正proxy配置项
        case '[object String]':
        default:
          conf.proxy = proxy;
      }

      delete conf.server;
    }

    gulp.start('watch');

    let group = [
      ...utils.createPattern({
        ...config.tpl
      }).src,
      utils.createPattern({
        ...assets.js,
        rootpath
      }).target
    ];

    utils.watch(group)
      .on('change', bs.reload);

    bs.init(conf);
  });
}
