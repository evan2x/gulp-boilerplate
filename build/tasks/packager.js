
import path from 'path';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import browserify from 'browserify';
import babelify from 'babelify';
import watchify from 'watchify';
import * as babel from 'babel-core';
import mkdirp from 'mkdirp';
import chalk from 'chalk';
import gulp from 'gulp';
import gutil from 'gulp-util';
import glob, {Glob} from 'glob';
import glob2base from 'glob2base';

import * as util from '../util';
import config from '../config';

export default function(plugins, debug) {
  const {
    base,
    output,
    js: {
      src,
      dest,
      entry,
      commonChunk,
      vendor,
      modulesDirectories
    }
  } = config.assets;

  let entryGlobs = util.processGlobs(base, src);

  if (!Array.isArray(entryGlobs)) {
    entryGlobs = [entryGlobs];
  }

  /**
   * 提取所有browserify入口文件
   * @type {Array}
   */
  let entries = entryGlobs.reduce((arr, item) => {
      let files = glob.sync(path.join(glob2base(new Glob(item)), '**', entry));

      return [
        ...arr,
        ...files
      ];
    }, []),
    /**
     * 模块输出路径
     * @type {String}
     */
    destPath = path.join(output, dest),
    /**
     * 第三方模块
     */
    vendorModules = vendor.modules,
    /**
     * 记录模块输出目录
     * @type {Set}
     */
    outputChunksDirectories = new Set(),
    /**
     * 记录被使用的babel helpers
     * @type {Set}
     */
    usedHelpers = new Set(),
    /**
     * 保存babel helpers代码
     * @type {String}
     */
    babelHelpersCode = '',
    /**
     * 创建browserify打包器
     * @type {Object}
     */
    packager = browserify({
      cache: {},
      packageCache: {},
      entries,
      debug,
      paths: ['node_modules', ...modulesDirectories]
    }).transform(babelify),
    /**
     * 移除文件base
     * @param {Array} filePaths
     * @return {Array}
     */
    removeBase = (filePaths) => {
      let baseList = entryGlobs.map(item => glob2base(new Glob(item)));

      return filePaths.map((filePath) => {
        baseList.forEach((baseItem) => {
          filePath = filePath.replace(baseItem, '');
        });
        return filePath;
      });
    },
    /**
     * 生成各个模块的输出目标，保存对应的目录树
     * @type {Array}
     */
    outputChunks = removeBase(entries).reduce((arr, item) => {
      let filePath = path.join(destPath, item);

      outputChunksDirectories.add(path.resolve(path.dirname(filePath)));
      arr.push(filePath);

      return arr;
    }, []);

  /**
   * factor-bundle plugin
   * @see https://github.com/substack/factor-bundle#api-plugin-example
   */
  packager.plugin('factor-bundle', {
    output: outputChunks
  });

  // 排除第三方模块
  for (let i = 0; i < vendorModules.length; i++) {
    packager.exclude(vendorModules[i]);
  }

  // 提取 babel helpers
  packager.on('transform', (tr) => {
    if (tr instanceof babelify) {
      tr.once('babelify', (result) => {
        let beforeSize = usedHelpers.size;

        result.metadata.usedHelpers.forEach((method) => {
          usedHelpers.add(method);
        });

        if (beforeSize === usedHelpers.size) {
          return;
        }

        let ret = babel.transform(babel.buildExternalHelpers(Array.from(usedHelpers), 'global'), {
          plugins: [
            'transform-es3-member-expression-literals',
            'transform-es3-property-literals'
          ]
        });

        babelHelpersCode = ret.code;
      });
    }
  });

  /**
   * 打包第三方模块
   */
  const vendorBundle = () => {
    if (!Array.isArray(vendorModules) || vendorModules.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let vendorPackager = browserify();

      for (let i = 0; i < vendorModules.length; i++) {
        vendorPackager.require(vendorModules[i]);
      }

      vendorPackager
        .bundle()
        .pipe(source(vendor.chunkName))
        .pipe(gulp.dest(destPath))
        .on('end', resolve)
        .on('error', reject);
    });
  };

  /**
   * 打包业务模块
   */
  const bundle = ({watch = false} = {}) => {
    for (let dir of outputChunksDirectories) {
      mkdirp.sync(dir);
    }

    return new Promise((resolve, reject) => {
      packager
        .bundle()
        .once('error', function(err) {
          console.log(chalk.red(`\Packager error:\n${err.message}`));
          this.emit(watch ? 'end' : 'error');
        })
        .pipe(source(commonChunk))
        .pipe(buffer())
        .pipe(gulp.dest(destPath))
        .once('end', () => {
          gulp.src(path.join(destPath, commonChunk))
            .pipe(util.insertBeforeCode(babelHelpersCode))
            .pipe(plugins.if(!debug, plugins.uglify()))
            .pipe(gulp.dest(destPath))
            .once('end', () => {
              if (debug) {
                resolve();
              } else {
                gulp.src(outputChunks, {base: './'})
                  .pipe(plugins.uglify().once('error', function(err) {
                    this.emit(watch ? 'end' : 'error', err);
                  }))
                  .pipe(gulp.dest('./'))
                  .once('end', resolve)
                  .once('error', reject);
              }
            })
            .once('error', reject);
        })
        .once('error', reject);
    });
  };

  return ({watch = false} = {}) => vendorBundle()
    .then(() => {
      if (watch) {
        packager = watchify(packager);
        packager.on('update', bundle);
        packager.on('log', (msg) => {
          gutil.log(`Watching ${chalk.cyan('\'browserify\'')}: ${chalk.green(msg)}`);
        });
      }

      return bundle({watch});
    });
}
