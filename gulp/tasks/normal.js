/**
 * Copyright 2015 creditease Inc. All rights reserved.
 * @description normal tasks
 * @author evan2x(evan2zaw@gmail.com/aiweizhang@creditease.cn)
 * @date  2015/09/24
 */

import gulp from 'gulp';
import del from 'del';
import loadPlugins from 'gulp-load-plugins';
import pngquant from 'imagemin-pngquant';
import browserSync from 'browser-sync';
import chalk from 'chalk';
import * as util from '../util';
import config from '../config';
import minimist from 'minimist';
import packer from './packer';
import path from 'path';

const bs = browserSync.create();
const argv = minimist(process.argv.slice(2));
const plugins = loadPlugins();

const assets = config.assets;
const toString = Object.prototype.toString;

export default function(debug){
  // JS模块打包器
  let bundler = packer(assets, debug);

  /**
   * 清理dest目录
   */
  gulp.task('clean', (done) => {
    del([
      assets.rootpath.dest,
      config.tpl.dest,
      path.join(process.cwd(), '.__cache__')
    ])
    .then(() => {
      done();
    });
  });

  /**
   * 使用eslint对JavaScript代码进行检查
   */
  gulp.task('eslint', () => {
    return gulp.src(util.getResourcePath(assets.js).src)
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
    let paths = util.getResourcePath(assets.img);

    return gulp.src(paths.src)
      .pipe(plugins.if(!debug, plugins.cache(plugins.imagemin({
        progressive: true,
        use: [pngquant()]
      }))))
      .pipe(gulp.dest(paths.target));
  });

  /**
   * SCSS样式转换为CSS，并且使用autoprefixer处理前缀
   * @todo debug模式下保留sourcemap
   */
  gulp.task('css', () => {
    let paths = util.getResourcePath(assets.css);

    return gulp.src(paths.src)
      .pipe(plugins.if(debug, plugins.sourcemaps.init()))
      .pipe(plugins.sass(assets.css.sass).on('error', function(e) {
        // 打印Sass抛出的异常
        console.log(chalk.red('\nSass error:\n' + e.messageFormatted));
        this.emit('end');
      }))
      .pipe(plugins.autoprefixer(assets.css.autoprefixer))
      .pipe(plugins.if(!debug, plugins.csso()))
      .pipe(plugins.if(debug, plugins.sourcemaps.write()))
      .pipe(gulp.dest(paths.target))
      .pipe(bs.stream());
  });

  /**
   * 压缩svg文件
   * @todo debug模式不压缩
   */
  gulp.task('svg', () => {
    let paths = util.getResourcePath(assets.svg);

    return gulp.src(paths.src)
      .pipe(plugins.if(!debug, plugins.svgmin(assets.svg.compress)))
      .pipe(gulp.dest(paths.target));
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
    let paths = util.getOtherResourcePath(),
      otherTask = paths.map((resource) => {
        return new Promise((resolve, reject) => {
          gulp.src(resource.src)
            .pipe(gulp.dest(resource.target))
            .on('end', resolve)
            .on('error', reject);
        });
      });

    Promise.all(otherTask).then(() => {
      done();
    });
  });

  /**
   * 从模板中对使用了useref语法的资源进行合并以及压缩
   * 并且对添加了inline标识的资源进行内联
   * @todo debug模式下不对css及js进行压缩
   */
  gulp.task('tpl', (done) => {
    let paths = util.getTemplatePath(),
      opts = {};

    if(config.tpl.base){
      opts.base = config.tpl.base;
    }

    gulp.src(paths.src, opts)
      .pipe(plugins.useref(config.tpl.useref))
      .pipe(plugins.if(!debug, plugins.if('*.css', plugins.csso())))
      .pipe(plugins.if(!debug, plugins.if('*.js', plugins.uglify())))
      .pipe(gulp.dest(paths.target))
      .on('end', () => {
        gulp.src(paths.revsrc)
          .pipe(plugins.inlineSource({
            rootpath: './',
            compress: !debug
          }))
          .pipe(gulp.dest(paths.target))
          .on('end', () => {
            done();
          });
      });
  });

  /**
   * watch js, css
   * @todo 仅对js和css进行watch
   */
  gulp.task('watch', () => {
    // watch CSS/SCSS
    util.watch(util.getResourcePath(assets.css).src, ['css']);
    // 启用打包器的watch模式
    bundler('watch');
  });

  /**
   * browser-sync service
   */
  gulp.task('serve', () => {
    let conf = config.browserSync;

    if(argv.port && typeof argv.port != 'boolean'){
      conf.port = argv.port;
    }

    // proxy port
    if(argv.pport && typeof argv.pport != 'boolean'){
      let proxy = '127.0.0.1:' + argv.pport;
      /*eslint-disable */
      switch (toString.call(conf.proxy)) {
        case '[object Object]':
          conf.proxy.target = proxy;
          break;

        // 字符串或者其他非对象类型重新修正proxy配置项
        case '[object String]':
        default:
          conf.proxy = proxy;
      }
      /*eslint-enable */

      delete conf.server;
    }

    gulp.start('watch');

    let list = [
      ...util.getTemplatePath().src,
      util.getResourcePath(assets.js).target
    ];
    // watch列表变动时触发browser-sync的reload
    util.watch(list).on('change', bs.reload);
    bs.init(conf);
  });

}
