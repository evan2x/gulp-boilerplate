
import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import loadPlugins from 'gulp-load-plugins';

import general from './tasks/general';
import revision from './tasks/revision';
import misc from './tasks/misc';
import * as util from './util';
import config from './config';

const plugins = loadPlugins();
const grabage = util.grabage;

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
  runSequence(
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
