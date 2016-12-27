
import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import loadPlugins from 'gulp-load-plugins';
import minimist from 'minimist';
import chalk from 'chalk';
import gutil from 'gulp-util';
import tildify from 'tildify';
import mergeWith from 'lodash.mergewith';

import general from './tasks/general';
import revision from './tasks/revision';
import misc from './tasks/misc';
import * as util from './util';
import config from './config';

const argv = minimist(process.argv.slice(2));

// 当指定buildfile的时候，合并指定的build.config.js配置文件到config中
if (argv.buildfile != null) {
  let buildfile = argv.buildfile;

  if (!path.isAbsolute(buildfile)) {
    buildfile = path.join(process.cwd(), buildfile);
  }

  if (fs.existsSync(buildfile)) {
    let customizer = (v1, v2) => {
        if (Array.isArray(v1)) {
          return v1.concat(v2);
        }
      };

    if (!path.isAbsolute(buildfile)) {
      buildfile = path.join(process.cwd(), buildfile);
    }

    mergeWith(config, require(buildfile), customizer);

    gutil.log('Using buildfile %s', chalk.magenta(tildify(buildfile)));
  } else {
    gutil.log(chalk.red('No build-config found'));
    process.exit(1);
  }
}

const plugins = loadPlugins();
const grabage = util.grabage;
const taskRun = runSequence.use(gulp);

general(plugins, process.env.NODE_ENV !== 'production');
revision(plugins);
misc(plugins);

/**
 * 清理构建后的资源
 */
gulp.task('clean', () => del([
  config.assets.output,
  config.tmpl.dest
]));

/**
 * 删除manifest文件
 */
gulp.task('manifest:clean', () => del([config.assets.manifest]));

/**
 * 删除收集的垃圾资源并清理静态资源目录下的空目录
 */
gulp.task('grabage:clean', () => {
  grabage.clean();
  util.delEmptyDir(config.assets.output);
});

/**
 * 构建项目
 */
gulp.task('build', (done) => {
  runTask(
    'clean',
    'manifest:clean',
    ['css', 'js', 'image', 'svg', 'other'],
    'tmpl',
    'refs:replace',
    'grabage:clean',
    done
  );
});

/**
 * 构建带资源版本号的项目
 */
gulp.task('revision', (done) => {
  runTask(
    'build',
    'manifest:clean',
    ['image:rev', 'svg:rev', 'other:rev'],
    'css:rev',
    'js:rev',
    ['tmpl:rev', 'rev:garbage:clean'],
    done
  );
});

/**
 * 默认task
 */
gulp.task('default', ['build']);
