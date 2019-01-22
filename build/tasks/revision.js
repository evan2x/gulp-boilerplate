import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import lazypipe from 'lazypipe';
import del from 'del';

import covertQuery from '../plugins/gulp-rev-covert-query';
import * as util from '../util';

export default function (plugins, config) {
  const { versionType, output, assets } = config;

  /**
   * 输出目录的第一层目录
   * @type {String}
   */
  let outputBase = path.normalize(output.path).split(path.seq)[0];

  /**
   * 预定义的revision处理管道
   */
  let channel = lazypipe()
    .pipe(plugins.rev)
    .pipe(gulp.dest, outputBase)
    .pipe(plugins.rev.manifest, {
      base: path.dirname(assets.manifest),
      merge: true
    })
    .pipe(() => plugins.if(versionType === 'query', covertQuery()));

  /**
   * 获取需要revision的globs
   * @param {Array|String} src
   * @param {String} dest
   * @return {Array|String}
   */
  const getRevGlobs = (src, dest) => util.processGlobs(
    output.path,
    util.globRebase(src, dest)
  );

  /**
   * CSS/JS资源中的引用路径替换
   * @param {Array|String} globs
   */
  const assetsRevTask = (globs, done) => {
    let manifest = gulp.src(assets.manifest);

    gulp.src(globs, { base: outputBase })
      .pipe(plugins.revRewrite({
        manifest
      }))
      .pipe(channel())
      .once('end', done)
      .pipe(gulp.dest(path.dirname(assets.manifest)));
  };

  /**
   * image resource revision
   */
  gulp.task('image:rev', () => {
    let globs = getRevGlobs(assets.image.src, assets.image.dest);

    return gulp.src(globs, { base: outputBase })
      .pipe(channel())
      .pipe(gulp.dest(path.dirname(assets.manifest)));
  });

  /**
   * svg resource revision
   */
  gulp.task('svg:rev', () => {
    let globs = getRevGlobs(assets.svg.src, assets.svg.dest);

    return gulp.src(globs, { base: outputBase })
      .pipe(channel())
      .pipe(gulp.dest(path.dirname(assets.manifest)));
  });

  /**
   * copies resource revision
   */
  gulp.task('copies:rev', () => {
    let taskList = [];

    assets.copies.forEach((item) => {
      if (item.useHash) {
        let globs = getRevGlobs(item.src, item.dest);

        taskList.push(new Promise((resolve, reject) => {
          gulp.src(globs, { base: outputBase })
            .pipe(channel())
            .once('end', resolve)
            .pipe(gulp.dest(path.dirname(assets.manifest)))
            .once('error', reject);
        }));
      }
    });

    return Promise.all(taskList);
  });

  /**
   * style resource revision
   */
  gulp.task('style:rev', (done) => assetsRevTask(getRevGlobs(assets.style.src, assets.style.dest), done));

  /**
   * script resource revision
   */
  gulp.task('script:rev', (done) => assetsRevTask(getRevGlobs(assets.script.src, assets.script.dest), done));

  /**
   * template/html revision
   */
  gulp.task('tmpl:rev', () => {
    let globs = util.concatGlobs(
      getRevGlobs(assets.html.src, assets.html.dest),
      getRevGlobs(assets.template.src, assets.template.dest)
    );
    let manifest = gulp.src(assets.manifest);
    let exts = util.extractExtsByGlobs(globs).map(item => `.${item}`);

    return gulp.src(globs, { base: './' })
      .pipe(plugins.revRewrite({
        manifest,
        replaceInExtensions: exts
      }))
      .pipe(gulp.dest('./'));
  });

  /**
   * 根据rev-manifest.json清理掉旧文件, 只删除dest目录中的旧资源
   */
  gulp.task('rev:garbage:clean', (done) => {
    if (fs.existsSync(assets.manifest)) {
      let manifest = {};

      try {
        manifest = JSON.parse(fs.readFileSync(assets.manifest, 'utf8'));
      } catch (err) {
        done(err);
      }

      Object.entries(manifest).forEach(([key, value]) => {
        let originFilePath = path.posix.join(outputBase, key);
        let newFilePath = path.posix.join(outputBase, util.query2filename(value));

        del.sync(originFilePath);

        if (versionType === 'query') {
          fs.renameSync(newFilePath, originFilePath);
        }
      });
    }

    done();
  });
}
