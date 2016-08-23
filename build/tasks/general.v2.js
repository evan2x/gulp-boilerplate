
import path from 'path';
import gulp from 'gulp';
import minimatch from 'minimatch';
import pngquant from 'imagemin-pngquant';
import browserSync from 'browser-sync';

import util, { grabage } from '../util';
import config from '../config.v2';

const bs = browserSync.create();
const argv = minimist(process.argv.slice(2));

export default function(plugins, debug) {
  const {
    assets,
    assets: { base, output }
  } = config;

  const processTMPL = (globs, destPath) => {
    let rcwd = new RegExp(`^${process.cwd()}`),
      searchPaths = {
        src: base,
        dest: output
      };

    // 提取searchPaths的第一层目录
    Object.keys(searchPaths).forEach(key => {
      let dirs = path.normalize(searchPaths[key]).split(path.sep);
      searchPaths[key] = dirs.length > 1 ? dirs[0] : './';
    });

    const processInlineSource = () => {
      let destGlobs = util.processGlobs(output, util.globRebase(globs, destPath));

      gulp.src(pattern.target)
        .pipe(plugins.inlineSource({
          rootpath: searchPaths.dest,
          compress: !debug,
          handlers: (source, context, next) => {
            let filePath = source.filepath.replace(rcwd, ''),
              outputPrefix = path.posix.normalize(output);

            // if (!path.isAbsolute(outputPrefix)) {
            //   outputPrefix = `/${outputPrefix}`;
            // }

            // 如果内嵌资源是以输出目录开头的话，则加入回收资源清单
            if (filePath.startsWith(outputPrefix)) {
              grabage.add(filePath);
            }

            next();
          }
        }))
        .pipe(gulp.dest(destPath));
    }

    const matchTmpl = (filePath) => {
      if (Array.isArray(globs)) {
        return globs.some(item => minimatch(filePath, item));
      } else {
        return minimatch(filePath, globs);
      }
    }

    gulp.src(globs)
      // 根据useref标记清除资源
      .pipe(util.userefMarkSweep({
        directory: output
      }))
      .pipe(plugins.useref({
        searchPath: [searchPaths.dest, searchPaths.src, './']
      }))
      .pipe(plugins.if(file => matchTmpl(file.path), gulp.dest(destPath)))
      .pipe(plugins.if(file => !debug && /\.css$/.test(file.path), plugins.csso()))
      .pipe(plugins.if(file => !debug && /\.js$/.test(file.path), plugins.uglify()))
      .pipe(plugins.filter(file => !matchTmpl(file.path)))
      .pipe(gulp.dest(searchPaths.dest))
      .on('end', processInlineSource)
      .on('error', reject);
  }

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('lint', () => {
    let globs = util.processGlobs(base, assets.js.src);

    return gulp.src(globs)
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
    let globs = util.processGlobs(base, assets.img.src),
      destPath = path.join(output, assets.img.dest);

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
      spritePath = path.join(output, assets.img.dest),
      matcher = new RegExp(`\\.(.+)\\.(?:[a-zA-Z0-9]+)$`);

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

    return gulp.src(globs)
      .pipe(plugins.changed(destPath))
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.postcss(processors).on('error', function(e) {
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
  gulp.task('js', () => {
    // bundler(done);
  });

  /**
   * copy other列表中的静态资源
   */
  gulp.task('other', () => {
    let globs, destPath;

    return Promise.all(assets.other.map(item => {
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
  gulp.task('tmpl', () => processTMPL(
    util.processGlobs(base, config.tmpl.src),
    config.tmpl.dest
  ));

  /**
   * 替换输出目录下的 模板/CSS/JS 中的引用路径
   */
  gulp.task('path:replace', () => {
    // todo: 由于接下来要对CSS/JS/模板中引用资源的路径进行替换，所以必须要保证数组前三项是CSS/JS及模板
    let resources = [
      assets.css,
      assets.js,
      config.tmpl,
      assets.img,
      assets.svg,
      ...assets.other
    ].map(item => util.processGlobs(
      output,
      util.globRebase(item.src, item.dest)
    ));

    const replacePrefix = (globs, manifest) => new Promise((resolve, reject) => {
      gulp.src(globs, {base: './'})
        .pipe(util.replaceByManifest(manifest))
        .pipe(gulp.dest('./'))
        .once('end', resolve)
        .once('error', reject);
    });

    return util.manifestRecorder(resources, {
      domain: config.domain,
      prefix: config.prefix
    })
    .then(manifest => Promise.all(resources.slice(0, 3).map(globs => replacePrefix(globs, manifest))));
  });

  /**
   * watch CSS/JS
   */
  gulp.task('watch', () => {
    util.watch(assets.css.src, ['css']);

    // bundler('watch');
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
