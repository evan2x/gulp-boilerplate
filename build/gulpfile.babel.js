
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import loadPlugins from 'gulp-load-plugins';

import general from './tasks/general.v2';
import revision from './tasks/revision.v2';
import misc from './tasks/misc.v2';
import util, { grabage } from './util';
import config from './config.v2';

const plugins = loadPlugins();

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
gulp.task('grabage:clean', () => grabage.clean()
  .then(del)
  .then(() => util.rmEmptyDir(config.assets.output))
);

/**
 * 构建项目
 */
gulp.task('build', (done) => {
  runSequence(
    'clean',
    'manifest:clean',
    ['css', 'js', 'image', 'other', 'svg'],
    'tmpl',
    'path:replace',
    'grabage:clean',
    done
  );
});

/**
 * 构建带资源版本号的项目
 */
gulp.task('revision', (done) => {
  runSequence(
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
