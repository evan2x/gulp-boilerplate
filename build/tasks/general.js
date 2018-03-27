
import path from 'path';
import gulp from 'gulp';
import minimatch from 'minimatch';
import pngquant from 'imagemin-pngquant';
import browserSync from 'browser-sync';

import * as util from '../util';
import collectRefuse from '../plugins/gulp-collect-refuse';
import replaceReference from '../plugins/gulp-replace-reference';
import packager from './packager';
import createProcessor from '../postcss.config';

const bs = browserSync.create();
const cwd = process.cwd();
const grabage = util.grabage;

export default function (plugins, config, argv, debug) {
  const { baseDir, output, assets } = config;

  const lint = (globs, throwError = false) => (gulp.src(globs)
    .pipe(plugins.eslint())
    .pipe(plugins.eslint.format())
    .pipe(plugins.if(throwError, plugins.eslint.failAfterError())));

  /**
   * JS模块打包器
   * @type {Object}
   */
  const bundler = packager(plugins, config, debug, lint);

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('lint', () => {
    let globs = util.processGlobs(baseDir, assets.script.src);

    return lint(globs, true);
  });

  /**
   * 图片压缩
   * @todo debug模式下不压缩图片
   */
  gulp.task('image', () => {
    let globs = util.processGlobs(baseDir, assets.image.src);
    let destPath = path.join(output.path, assets.image.dest);

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
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
    let globs = util.processGlobs(baseDir, assets.svg.src);
    let destPath = path.join(output.path, assets.svg.dest);

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(!debug, plugins.svgmin(assets.svg.compress)))
      .pipe(gulp.dest(destPath));
  });

  /**
   * 对样式进行处理
   * @todo debug模式下保留sourcemap, 非debug模式下会启动CSS Sprites功能。
   */
  gulp.task('style', () => {
    let globs = util.processGlobs(baseDir, assets.style.src);
    let destPath = path.join(output.path, assets.style.dest);
    let hasBaseDir = path.posix.normalize(assets.image.dest).startsWith(path.posix.join(baseDir))

    const processor = createProcessor({
      stylesheetPath: destPath,
      spritePath: path.join(output.path, assets.image.dest),
      referencePath: hasBaseDir ? assets.image.dest : path.posix.join(baseDir, assets.image.dest),
      collectGarbage(imagePath) {
        let trashyImagePath = path.resolve(path.join(output.path, imagePath.replace(path.resolve(baseDir), '')));
        if (trashyImagePath !== imagePath) {
          grabage.add(trashyImagePath);
        }
      }
    }, debug);

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.postcss(processor).on('error', plugins.notify.onError({
        title: 'PostCSS error',
        message: '<%= error.message %>'
      })))
      .pipe(plugins.if(!debug, plugins.csso()))
      .pipe(plugins.if(debug, plugins.sourcemaps.write()))
      .pipe(gulp.dest(destPath))
      .pipe(bs.stream());
  });

  /**
   * 使用browserify打包JavaScript模块
   */
  gulp.task('script', () => bundler());

  /**
   * 复制静态资源
   */
  gulp.task('copies', () => Promise.all(assets.copies.map((item) => {
    let globs = util.processGlobs(baseDir, item.src);
    let destPath = path.join(output.path, item.dest);

    return new Promise((resolve, reject) => {
      gulp.src(globs)
        .pipe(plugins.changed(destPath))
        .pipe(gulp.dest(destPath))
        .on('end', resolve)
        .on('error', reject);
    });
  })));

  /**
   * 对模板及静态html使用useref语法进行资源进行合并以及压缩
   * 并且对添加了inline标识资源进行内联
   * @todo debug模式下不对css及js进行压缩
   */
  gulp.task('tmpl', () => {
    let tmplGlobs = util.processGlobs(baseDir, assets.template.src);
    let tmplDest = path.join(output.path, assets.template.dest);
    let tmplDestGlobs = util.globRebase(tmplGlobs, tmplDest);
    let htmlGlobs = util.processGlobs(baseDir, assets.html.src);
    let htmlDest = path.join(output.path, assets.html.dest);
    let htmlDestGlobs = util.globRebase(htmlGlobs, htmlDest);
    let globs = util.concatGlobs(tmplGlobs, htmlGlobs);
    let destGlobs = util.concatGlobs(tmplDestGlobs, htmlDestGlobs);

    /**
     * 统计资源出现次数的记录表
     * @type {Object}
     */
    let markers = {
      useref: {},
      inline: {}
    };

    /**
     * 检查文件路径是否与globs匹配
     * @param  {String} filePath 文件路径
     * @param  {String|Array} globs
     * @return {Boolean}
     */
    const globsMatch = (filePath, globList) => {
      if (!Array.isArray(globList)) {
        globList = [globList];
      }

      return globList.some(item => minimatch(filePath, path.normalize(path.join(cwd, item))));
    };

    /**
     * 生成一个匹配base路径的正则表达式
     * @todo 用于useref中统计引用资源的匹配路径替换
     * @param {String}
     * @return
     */
    const matchBaseRE = (basePath) => {
      let basePaths = path.posix.normalize(basePath).split(path.posix.sep);
      let ret = [];

      basePaths.forEach((item, index) => {
        ret.push(basePaths.slice(index).join(path.posix.sep));
      });

      return new RegExp(`^\\/?${ret.join('|')}`);
    };

    const counter = {
      useref(grabageList, result) {
        let resources = Object.values(result).reduce((ret, { js = {}, css = {} } = {}) => ([
          ...ret,
          ...Object.keys(js),
          ...Object.keys(css)
        ]), []);

        // 记录useref输出资源的出现次数
        for (let i = 0, item; item = resources[i++];) {
          item = path.join(cwd, item.replace(matchBaseRE(baseDir), path.posix.normalize(output.path)));
          if (markers.useref[item]) {
            markers.useref[item] += 1;
          } else {
            markers.useref[item] = 1;
          }
        }

        grabageList.forEach(item => grabage.add(path.resolve(item)));
      },
      /**
       * 收集内嵌资源后的垃圾资源
       * @param  {Object}   source
       * @param  {Object}   context
       * @param  {Function} next
       * @see https://github.com/popeindustries/inline-source#custom-handlers
       */
      inline(source, context, next) {
        let filePath = source.filepath;
        let outputPrefix = path.join(cwd, output.path);

        // 如果内嵌资源是以输出目录开头则将该资源出现的次数记录下来
        if (filePath.startsWith(outputPrefix)) {
          if (markers.inline[filePath]) {
            markers.inline[filePath] += 1;
          } else {
            markers.inline[filePath] = 1;
          }
        }

        next();
      }
    };

    return new Promise((resolve, reject) => {
      gulp.src(globs)
        .pipe(collectRefuse({
          root: output.path,
          output: counter.useref
        }))
        .pipe(plugins.useref({
          searchPath: './'
        }))
        .pipe(plugins.if(file => globsMatch(file.path, tmplGlobs), gulp.dest(tmplDest)))
        .pipe(plugins.if(file => globsMatch(file.path, htmlGlobs), gulp.dest(htmlDest)))
        .pipe(plugins.if(file => !debug && /\.css$/.test(file.path), plugins.csso()))
        .pipe(plugins.if(file => !debug && /\.js$/.test(file.path), plugins.uglify({ ie8: true })))
        .pipe(plugins.filter(file => /\.(?:css|js)$/.test(file.path)))
        .pipe(gulp.dest(output.path))
        .once('end', () => {
          /**
           * 资源内嵌的处理
           * @todo 必须在useref之后处理，否则引用dist目录时，静态资源可能没有生成导致引用错误。
           */
          gulp.src(destGlobs)
            .pipe(plugins.inlineSource({
              rootpath: output.path,
              compress: false,
              handlers: [counter.inline]
            }))
            .pipe(plugins.if(file => globsMatch(file.path, htmlDestGlobs), gulp.dest(htmlDest)))
            .pipe(plugins.filter(file => globsMatch(file.path, tmplDestGlobs)))
            .pipe(gulp.dest(tmplDest))
            .once('end', () => {
              // 记录可以回收的资源
              Object.keys(markers.inline).forEach((key) => {
                if (markers.inline[key] === markers.useref[key]) {
                  grabage.add(key);
                }
              });

              resolve();
            })
            .once('error', reject);
        })
        .once('error', reject);
    });
  });

  /**
   * 替换输出目录下的 模板/CSS/JS 中的引用路径
   * 引用路径替换时会扫描输出目录的所有资源然后生成一张如下结构的资源路径替换表
   * key => 原路径，value => 处理后的路径
   * {
   *   "assets/js/main.js": "{domain}/{prefix}/assets/js/main.js"
   * }
   */
  gulp.task('refs:replace', () => {
    let globs = util.processGlobs(baseDir, assets.template.src);
    let destPath = path.join(output.path, assets.template.dest);
    let copies = assets.copies;
    let globsMap = {};
    let temporary = {
      style: assets.style,
      script: assets.script,
      image: assets.image,
      svg: assets.svg,
      html: assets.html,
      template: assets.template
    };

    for (let count = 0; count < copies.length; count++) {
      temporary[`copy_${count}`] = copies[count];
    }

    Object.entries(temporary).forEach(([key, conf]) => {
      globsMap[key] = util.processGlobs(output.path, util.globRebase(conf.src, conf.dest));
    });

    const manifest = util.createReplacementManifest(Object.values(globsMap), {
      publicPath: output.publicPath,
      inputDir: baseDir,
      outputDir: output.path
    });

    return Promise.all([
      globsMap.style,
      globsMap.script,
      globsMap.html,
      globsMap.template
    ].map(globs => new Promise((resolve, reject) => {
      gulp.src(globs, { base: './' })
        .pipe(replaceReference(manifest))
        .pipe(gulp.dest('./'))
        .once('end', resolve)
        .once('error', reject);
    })));
  });

  function watchTask() {
    // watch css
    gulp.watch(
      util.processGlobs(baseDir, assets.style.src),
      { ignoreInitial: false },
      gulp.parallel('style')
    )

    // watch js
    bundler({ watch: true });
  }

  /**
   * watch CSS/JS
   */
  gulp.task('watch', watchTask);

  /**
   * browser-sync service
   */
  gulp.task('serve', () => {
    let options = config.browserSync;

    if (argv.port && typeof argv.port !== 'boolean') {
      options.port = argv.port;
    }

    if (argv.proxy && typeof argv.proxy !== 'boolean') {
      delete options.server;
      options.proxy = argv.proxy;
    }

    watchTask()
    gulp.watch(assets.template.src).on('change', bs.reload);

    bs.init(options);
  });
}
