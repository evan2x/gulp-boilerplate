
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
      matcher = new RegExp(`\\.(.+)\\.(?:${css.sprites.extensions.join('|')})$`);

    if (!debug) {
      // support css sprites
      processors.push(sprites({
        stylesheetPath: pattern.destPath,
        spritePath: path.join(rootpath.dest, assets.img.dest),
        basePath: css.sprites.basePath,
        retina: true,
        hooks: {
          onUpdateRule: util.updateSpritesRule
        },
        filterBy(image) {
          if (matcher.test(image.url)) {
            return Promise.resolve();
          }

          return Promise.reject();
        },
        groupBy(image) {
          let match = image.url.match(matcher);

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
      .pipe(plugins.changed(pattern.destPath))
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
        rhtmlExt = new RegExp(`\\.(?:${conf.extensions.join('|')})`),
        searchPaths = {...rootpath};

      // 提取rootpath的第一层目录
      Object.keys(searchPaths).forEach((key) => {
        let directory = path.normalize(searchPaths[key]).split(path.sep);
        searchPaths[key] = directory.length > 1 ? directory[0] : './';
      });

      /**
       * 处理内嵌CSS/JS资源
       */
      let inlineSourceProcessor = () => {
        gulp.src(pattern.target)
          .pipe(plugins.inlineSource({
            rootpath: searchPaths.dest,
            compress: !debug,
            handlers: (source, context, next) => {
              let filePath = source.filepath.replace(rcwdDir, ''),
                prefix = path.posix.normalize(rootpath.dest);

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
      };

      gulp.src(pattern.src)
        .pipe(util.collectGarbageByUseref({prefix: rootpath.dest}))
        .pipe(plugins.useref({
          searchPath: [searchPaths.dest, searchPaths.src, './']
        }))
        .pipe(plugins.if((file) => rhtmlExt.test(file.path), gulp.dest(pattern.destPath)))
        .pipe(plugins.if((file) => !debug && /\.css$/.test(file.path), plugins.csso()))
        .pipe(plugins.if((file) => !debug && /\.js$/.test(file.path), plugins.uglify()))
        .pipe(plugins.filter((file) => !rhtmlExt.test(file.path)))
        .pipe(gulp.dest(searchPaths.dest))
        .on('end', inlineSourceProcessor)
        .on('error', reject);
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
    let pattern = util.createPattern({
      ...config.tpl
    });

    return processHTML(pattern, config.tpl);
  });

  /**
   * 替换css/js/html/template中的引用路径
   */
  gulp.task('path:replace', (done) => {
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
          .on('end', resolve)
          .on('error', reject);
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
        domain: config.domain,
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
    .catch(done);
  });

  /**
   * svg图标生成svg symbols
   */
  gulp.task('symbols:gen', () => {
    let icon = assets.icon,
      src = path.join(rootpath.src, icon.src, '**/*.svg'),
      dest = path.join(rootpath.src, icon.symbols.dest),
      docPath = icon.symbols.related.doc,
      docDest = path.join(rootpath.src, path.dirname(docPath)),
      tmpl = path.resolve(__dirname, '../templates/svg-symbols.html');

    let filter = {
      svg: plugins.filter((file) => /\.svg$/.test(file.path), {
        restore: true
      }),
      html: plugins.filter((file) => /\.html$/.test(file.path), {
        restore: true
      })
    };

    return gulp.src(src)
      .pipe(plugins.cheerio({
        run($) {
          $('style').remove();
          $('[class]').removeAttr('class');
          $('[id]').removeAttr('id');
          $('[fill]').removeAttr('fill');
          $('[stroke]').removeAttr('stroke');
        },
        parserOptions: {
          xmlMode: true
        }
      }))
      .pipe(plugins.svgSymbols({
        templates: ['default-svg', tmpl],
        transformData(svg, defaultData) {
          let filePath = path.posix.join(dest, icon.symbols.name);

          if (!filePath.startsWith('/')) {
            filePath = `/${filePath}`;
          }

          return {
            id: defaultData.id,
            className: defaultData.className,
            width: '48px',
            height: '48px',
            filePath
          };
        }
      }))
      .pipe(filter.svg)
      .pipe(plugins.rename(icon.symbols.name))
      .pipe(gulp.dest(dest))
      .pipe(filter.svg.restore)
      .pipe(filter.html)
      .pipe(plugins.rename('demo.html'))
      .pipe(gulp.dest(docDest));
  });

  /**
   * svg图标生成iconfont
   */
  gulp.task('iconfont:gen', () => {
    let icon = assets.icon,
      src = path.join(rootpath.src, icon.src, '**/*.svg'),
      dest = path.join(rootpath.src, icon.font.dest),
      tmpl = {
        css: path.resolve(__dirname, '../templates/iconfont.css'),
        html: path.resolve(__dirname, '../templates/iconfont.html')
      },
      stylePath = icon.font.related.style,
      docPath = icon.font.related.doc,
      docDest = path.join(rootpath.src, path.dirname(docPath));

    return gulp.src(src)
      .pipe(plugins.iconfont({
        fontName: icon.font.name,
        formats: icon.font.formats,
        timestamp: Math.round(Date.now() / 1000)
      }))
      .on('glyphs', (glyphs) => {
        let options = {
          className: 'icon',
          fontName: icon.font.name,
          glyphs
        };

        options.fontPath = path.posix.join(rootpath.src, icon.font.dest);

        if (!options.fontPath.startsWith('/')) {
          options.fontPath = `/${options.fontPath}`;
        }

        if (!options.fontPath.endsWith('/')) {
          options.fontPath = `${options.fontPath}/`;
        }

        // 生成项目所需的CSS
        gulp.src(tmpl.css)
          .pipe(plugins.consolidate('lodash', options))
          .pipe(plugins.rename(path.basename(stylePath)))
          .pipe(gulp.dest(path.join(rootpath.src, path.dirname(stylePath))));

        let docOptions = Object.assign({}, options, {
          fontPath: ''
        });

        // 生成iconfont文档所需的css
        gulp.src(tmpl.css)
          .pipe(plugins.consolidate('lodash', docOptions))
          .pipe(plugins.rename('style.css'))
          .pipe(gulp.dest(docDest));

        // 生成iconfont文档页面
        gulp.src(tmpl.html)
          .pipe(plugins.consolidate('lodash', docOptions))
          .pipe(plugins.rename(path.basename(docPath)))
          .pipe(gulp.dest(docDest));
      })
      .pipe(gulp.dest(docDest))
      .pipe(gulp.dest(dest));
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
    let options = config.browserSync;

    if (argv.port && typeof argv.port != 'boolean') {
      options.port = argv.port;
    }

    if (argv.proxy && typeof argv.proxy != 'boolean') {
      delete options.server;
      options.proxy = argv.proxy;
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

    bs.init(options);
  });
}
