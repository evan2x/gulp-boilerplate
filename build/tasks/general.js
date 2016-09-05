
import path from 'path';
import gulp from 'gulp';
import minimist from 'minimist';
import minimatch from 'minimatch';
import chalk from 'chalk';
import pngquant from 'imagemin-pngquant';
import browserSync from 'browser-sync';
import cssnext from 'postcss-cssnext';
import sprites from 'postcss-sprites';
import willChange from 'postcss-will-change';

import * as util from '../util';
import config from '../config';
import packager from './packager';

const bs = browserSync.create();
const argv = minimist(process.argv.slice(2));
const cwd = process.cwd();
const grabage = util.grabage;

export default function(plugins, debug) {
  const {
    assets,
    assets: {
      base,
      output,
      svg: {
        compress
      }
    }
  } = config;

  /**
   * 匹配CSS Sprites 图片的分组
   * @type {RegExp}
   */
  const rgroup = /\.(.+)\.(?:[a-zA-Z0-9]+)$/;

  /**
   * JS模块打包器
   * @type {Object}
   */
  const bundler = packager(plugins, debug);

  /**
   * 处理模板
   * @param {Array|String} globs
   * @param {String} destPath
   */
  const processTmpl = (globs, destPath) => {
    let rcwd = new RegExp(`^${cwd}`),
      /**
       * 输出目录的Globs
       */
      destGlobs = util.globRebase(globs, config.tmpl.dest),
      /**
       * inline-source及useref搜索路径
       * @type {Object}
       */
      searchPaths = {
        src: base,
        dest: output
      },
      /**
       * 统计资源出现次数的记录表
       * @type {Object}
       */
      tables = {
        useref: {},
        inline: {}
      };

    const matchTmpl = (filePath) => {
      if (Array.isArray(globs)) {
        return globs.some((item) => minimatch(filePath, item));
      }

      return minimatch(filePath, globs);
    };

    // 提取searchPaths的第一层目录
    Object.keys(searchPaths).forEach((key) => {
      let dirs = path.normalize(searchPaths[key]).split(path.sep);

      searchPaths[key] = dirs.length > 1 ? dirs[0] : './';
    });

    return new Promise((resolve, reject) => {
      const inlineSourceProcessor = () => {
        gulp.src(destGlobs)
          .pipe(plugins.inlineSource({
            rootpath: searchPaths.dest,
            compress: !debug,
            handlers: (source, context, next) => {
              let filePath = util.trimSlashLeft(source.filepath.replace(rcwd, '')),
                outputPrefix = util.trimSlashLeft(path.posix.normalize(output));

              // 如果内嵌资源是以输出目录开头则将该资源出现的次数记录下来
              if (filePath.startsWith(outputPrefix)) {
                if (tables.inline[filePath]) {
                  tables.inline[filePath] += 1;
                } else {
                  tables.inline[filePath] = 1;
                }
              }

              next();
            }
          }))
          .pipe(gulp.dest(destPath))
          .once('end', () => {
            // 记录可以回收的资源
            Object.keys(tables.inline).forEach((key) => {
              if (tables.inline[key] === tables.useref[key]) {
                grabage.add(key);
              }
            });
            resolve();
          })
          .once('error', reject);
      };

      gulp.src(globs)
        // 使用useref标记清除资源
        .pipe(util.userefMarkSweep({
          directory: output,
          outputResult(result) {
            let resources = [
              ...Object.keys(result.css),
              ...Object.keys(result.js)
            ];

            // 记录useref统计到的资源出现次数
            for (let i = 0, item; item = resources[i++];) {
              item = util.trimSlashLeft(item.replace(base, output));
              if (tables.useref[item]) {
                tables.useref[item] += 1;
              } else {
                tables.useref[item] = 1;
              }
            }
          }
        }))
        .pipe(plugins.useref({
          searchPath: [searchPaths.src, searchPaths.dest, './']
        }))
        .pipe(plugins.if((file) => matchTmpl(file.path), gulp.dest(destPath)))
        .pipe(plugins.if((file) => !debug && /\.css$/.test(file.path), plugins.csso()))
        .pipe(plugins.if((file) => !debug && /\.js$/.test(file.path), plugins.uglify()))
        .pipe(plugins.filter((file) => !matchTmpl(file.path)))
        .pipe(gulp.dest(searchPaths.dest))
        .on('end', inlineSourceProcessor)
        .on('error', reject);
    });
  };

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('lint', () => {
    let globs = util.processGlobs(base, assets.js.src);

    return gulp.src(globs)
      .pipe(plugins.eslint())
      .pipe(plugins.eslint.format());
      // .pipe(plugins.eslint.failAfterError()); // 暂时不开启抛出异常，只进行检查，而不强制中断整个构建
  });

  /**
   * 图片压缩
   * @todo debug模式下不压缩图片
   */
  gulp.task('image', () => {
    let globs = util.processGlobs(base, assets.img.src),
      destPath = path.join(output, assets.img.dest);

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(!debug, plugins.filter((file) => !rgroup.test(path.basename(file.path)))))
      .pipe(plugins.if(!debug, plugins.imagemin({
        progressive: true,
        use: [pngquant()]
      })))
      .pipe(gulp.dest(destPath));
  });

  /**
   * 压缩svg文件
   * @todo debug模式不压缩
   */
  gulp.task('svg', () => {
    let globs = util.processGlobs(base, assets.svg.src),
      destPath = path.join(output, assets.svg.dest);

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(!debug, plugins.svgmin(compress)))
      .pipe(gulp.dest(destPath));
  });

  /**
   * 对CSS进行处理
   * @todo debug模式下保留sourcemap, 非debug模式下会启动CSS Sprites功能。
   */
  gulp.task('css', () => {
    let processors = [],
      globs = util.processGlobs(base, assets.css.src),
      destPath = path.join(output, assets.css.dest),
      spritePath = path.join(output, assets.img.dest);

    if (!debug) {
      // support css sprites
      processors.push(sprites({
        stylesheetPath: destPath,
        spritePath,
        basePath: './',
        retina: true,
        hooks: {
          onUpdateRule: util.updateSpritesRule
        },
        filterBy(image) {
          if (rgroup.test(image.url)) {
            return Promise.resolve();
          }

          return Promise.reject();
        },
        groupBy(image) {
          let match = image.url.match(rgroup);

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
      cssnext(assets.css.cssnext)
    );

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.postcss(processors).on('error', (e) => {
        console.log(chalk.red(`\nPostCSS Error:\n${e.message}`));
      }))
      .pipe(plugins.if(!debug, plugins.csso()))
      .pipe(plugins.if(debug, plugins.sourcemaps.write()))
      .pipe(gulp.dest(destPath))
      .pipe(bs.stream());
  });

  /**
   * 使用browserify打包JavaScript模块
   */
  gulp.task('js', () => bundler());

  /**
   * copy other列表中的静态资源
   */
  gulp.task('other', () => {
    let globs, destPath;

    return Promise.all(assets.other.map((item) => {
      globs = util.processGlobs(base, item.src);
      destPath = path.join(output, item.dest);

      return new Promise((resolve, reject) => {
        gulp.src(globs)
          .pipe(plugins.changed(destPath))
          .pipe(gulp.dest(destPath))
          .on('end', resolve)
          .on('error', reject);
      });
    }));
  });

  /**
   * 对模板使用useref语法进行资源进行合并以及压缩
   * 并且对添加了inline标识资源进行内联
   * @todo debug模式下不对css及js进行压缩
   */
  gulp.task('tmpl', () => processTmpl(
    config.tmpl.src,
    config.tmpl.dest
  ));

  /**
   * 替换输出目录下的 模板/CSS/JS 中的引用路径
   * 引用路径替换时会扫描输出目录的所有资源然后生成一张如下结构的资源路径替换表
   * key => 原路径，value => 处理后的路径
   * {
   *   "assets/js/main.js": "{domain}/{prefix}/assets/js/main.js"
   * }
   */
  gulp.task('refs:replace', () => {
    let others = assets.other,
      globsMap = {},
      temporary = {
        css: assets.css,
        js: assets.js,
        img: assets.img,
        svg: assets.svg
      };

    for (let count = 0; count < others.length; count++) {
      temporary[`other${count}`] = others[count];
    }

    for (let [key, conf] of Object.entries(temporary)) {
      globsMap[key] = util.processGlobs(
        output,
        util.globRebase(conf.src, conf.dest)
      );
    }

    const resourceManifest = util.createReplacementManifest(Object.values(globsMap), {
      domain: config.domain,
      domainIgnore: assets.svg.useDomain ? null : /\.svg$/,
      prefix: config.prefix,
      inputDirectory: base,
      outputDirectory: output
    });

    const replacePrefix = (globs) => new Promise((resolve, reject) => {
      gulp.src(globs, {base: './'})
        .pipe(util.replaceByManifest(resourceManifest))
        .pipe(gulp.dest('./'))
        .once('end', resolve)
        .once('error', reject);
    });

    return Promise.all([
      globsMap.css,
      globsMap.js,
      util.globRebase(config.tmpl.src, config.tmpl.dest)
    ].map((globs) => replacePrefix(globs, resourceManifest)));
  });

  /**
   * watch CSS/JS
   */
  gulp.task('watch', () => {
    // watch css
    util.watch(
      util.processGlobs(base, assets.css.src),
      ['css']
    );

    // watch js
    bundler({watch: true});
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
    util.watch(config.tmpl.src).on('change', bs.reload);

    bs.init(options);
  });
}
