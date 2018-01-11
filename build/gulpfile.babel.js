/* eslint global-require: "off" */

import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import del from 'del';
// import runSequence from 'run-sequence';
import loadPlugins from 'gulp-load-plugins';
import minimist from 'minimist';
import chalk from 'chalk';
import gutil from 'gulp-util';
import tildify from 'tildify';
import * as _ from 'lodash';

import general from './tasks/general';
import revision from './tasks/revision';
import misc from './tasks/misc';
import * as util from './util';
import config from './config';

const argv = minimist(process.argv.slice(2));

// 当指定buildfile的时候，合并指定的build.config.js配置文件到config中
if (argv.buildfile != null) {
  let custom = {
    file: argv.buildfile
  };

  const customizer = (v1, v2) => {
    if (Array.isArray(v1)) {
      return v1.concat(v2);
    }
  };

  if (!path.isAbsolute(custom.file)) {
    custom.file = path.join(process.cwd(), custom.file);
  }

  if (fs.existsSync(custom.file)) {
    if (!path.isAbsolute(custom.file)) {
      custom.file = path.join(process.cwd(), custom.file);
    }

    custom.config = require(custom.file);

    _.mergeWith(config, custom.config.default ? custom.config.default : custom.config, customizer);

    gutil.log('Using buildfile %s', chalk.magenta(tildify(custom.file)));
  } else {
    gutil.log(chalk.red('No buildfile found'));
    process.exit(1);
  }
}

const plugins = loadPlugins();
const grabage = util.grabage;
// const runTask = runSequence.use(gulp);

general(plugins, config, argv, process.env.NODE_ENV !== 'production');
revision(plugins, config, argv);
misc(plugins, config, argv);

/**
 * 清理构建后的资源
 */
gulp.task('clean', () => del([config.output.path]));

/**
 * 删除manifest文件
 */
gulp.task('manifest:clean', () => del([config.assets.manifest]));

/**
 * 删除收集的垃圾资源并清理静态资源目录下的空目录
 */
gulp.task('grabage:clean', (done) => {
  grabage.clean();
  util.delEmptyDir(config.output.path);
  done();
});

/**
 * 构建项目
 */
gulp.task('build', gulp.series(
  'clean', 
  'manifest:clean', 
  gulp.parallel('style', 'script', 'image', 'svg', 'copies'),
  'tmpl',
  'refs:replace',
  'grabage:clean'
));

/**
 * 构建带资源版本号的项目
 */
gulp.task('revision', gulp.series(
  'build',
  'manifest:clean',
  gulp.parallel('image:rev', 'svg:rev', 'copies:rev'),
  'style:rev',
  'script:rev',
  gulp.parallel('tmpl:rev', 'rev:garbage:clean')
))

/**
 * 默认task
 */
gulp.task('default', gulp.parallel('build'));
