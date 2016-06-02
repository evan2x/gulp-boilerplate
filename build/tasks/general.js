
import path from 'path';
import gulp from 'gulp';
import pngquant from 'imagemin-pngquant';
import autoprefixer from 'autoprefixer';
import sprites from 'postcss-sprites';
import willChange from 'postcss-will-change';
import minimist from 'minimist';
import browserSync from 'browser-sync';
import * as util from '../util';
import packer from './packer';

const bs = browserSync.create();
const argv = minimist(process.argv.slice(2));

export default function(config, plugins, debug) {
  let assets = config.assets,
    rootpath = assets.rootpath,
    // JS模块打包器
    bundler = packer(assets, debug);

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('lint', () => {
    let pattern = util.createPattern({
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
    let pattern = util.createPattern({
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
    let pattern = util.createPattern({
      ...assets.svg,
      rootpath
    });

    return gulp.src(pattern.src)
      .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.if(!debug, plugins.svgmin(assets.svg.compress)))
      .pipe(gulp.dest(pattern.destPath));
  });

  /**
   * 对CSS进行处理
   * @todo debug模式下保留sourcemap, 非debug模式下会启动CSS Sprites功能。
   */
  gulp.task('css', () => {
    let css = assets.css,
      pattern = util.createPattern({
        ...css,
        rootpath
      }),
      processors = [],
      regex = new RegExp('\\.(.+)\\.(?:' + css.sprite.extensions.join('|') + ')$');

    if (debug) {
      // support css sprites
      processors.push(sprites({
        stylesheetPath: pattern.destPath,
        spritePath: path.join(rootpath.dest, assets.img.dest),
        relativeTo: 'assets',
        retina: true,
        hooks: {
          onUpdateRule: util.updateSpritesRule
        },
        filterBy(image) {
          if (regex.test(image.url)) {
            return Promise.resolve();
          }

          return Promise.reject();
        },
        groupBy(image) {
          let match = image.url.match(regex);

          image.groups = [];

          if (match && match[1]) {
            return Promise.resolve(match[1]);
          }

          return Promise.reject();
        },
        spritesmith: {
          padding: 1
        }
      }));
    }

    processors.push(
      willChange(),
      autoprefixer(assets.css.autoprefixer)
    );

    return gulp.src(pattern.src)
      // .pipe(plugins.changed(pattern.destPath))
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.postcss(processors))
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
      let pattern = util.createPattern({
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

  /**
   * 处理HTML中的inline资源及useref统计的资源
   * @param  {Object} pattern
   * @param  {Object} conf
   * @return {Promise}
   */
  function processHTML(pattern, conf) {
    return new Promise((resolve, reject) => {
      let garbageMap = {},
        rcwdDir = new RegExp(`^${process.cwd()}`),
        rhtmlExt = new RegExp(`\.(?:${conf.extensions.join('|')})`),
        searchPaths = {
          src: rootpath.src,
          dest: rootpath.dest
        };

      Object.keys(searchPaths).forEach((key) => {
        let directories = path.normalize(searchPaths[key]).split(path.sep);
        searchPaths[key] = directories.length > 1 ? directories[0] : './';
      });

      gulp.src(pattern.src)
        .pipe(util.collectGarbageByUseref({prefix: rootpath.dest}))
        .pipe(plugins.useref({
          searchPath: [searchPaths.dest, searchPaths.src]
        }))
        .pipe(plugins.if((file) => rhtmlExt.test(file.path), gulp.dest(pattern.destPath)))
        .pipe(plugins.if(!debug, plugins.if((file) => /\.css$/.test(file.path), plugins.csso())))
        .pipe(plugins.if(!debug, plugins.if((file) => /\.js$/.test(file.path), plugins.uglify())))
        .pipe(plugins.filter((file) => !rhtmlExt.test(file.path)))
        .pipe(gulp.dest(searchPaths.dest))
        .on('end', () => {
          gulp.src(pattern.target)
            .pipe(plugins.inlineSource({
              rootpath: searchPaths.dest,
              compress: !debug,
              handlers: (source, context, next) => {
                let filePath = source.filepath.replace(rcwdDir, ''),
                  prefix = util.normalizeReferencePath(rootpath.dest);

                if (!path.isAbsolute(prefix)) {
                  prefix = `/${prefix}`;
                }

                if (filePath.startsWith(prefix)) {
                  garbageMap[filePath] = filePath;
                }

                next();
              }
            }))
            .pipe(gulp.dest(pattern.destPath))
            .on('end', () => {
              util.writeGarbage(garbageMap)
              .then(resolve)
              .catch(reject);
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
    let pattern = util.createPattern({
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
    let pattern = util.createPattern({...config.tpl});

    return processHTML(pattern, config.tpl);
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
          .pipe(util.fileReplace({manifest}))
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

      patterns[key] = util.createPattern(properties);
    });

    util.writeManifest(
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
        util.createPattern({...config.tpl})
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
    let pattern = util.createPattern({
      ...assets.css,
      rootpath
    });

    util.watch(pattern.src, ['css']);
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
      ...util.createPattern({
        ...config.tpl
      }).src,
      util.createPattern({
        ...assets.js,
        rootpath
      }).target
    ];

    util.watch(group)
      .on('change', bs.reload);

    bs.init(conf);
  });
}
