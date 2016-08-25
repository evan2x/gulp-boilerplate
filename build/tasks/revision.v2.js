
import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import lazypipe from 'lazypipe';
import del from 'del';

import * as util from '../util';
import config from '../config.v2';

export default function(plugins) {
  const {
    assets: {
      output,
      versionFormat,
      manifest,
      img,
      css,
      js,
      svg,
      other
    },
    tmpl
  } = config;

  /**
   * 输出目录的第一级目录
   * @type {String}
   */
  const outputBase = path.normalize(output).split(path.seq)[0],
    /**
     * 预定义的revision处理管道
     */
    channel = lazypipe()
      .pipe(plugins.rev)
      .pipe(gulp.dest, outputBase)
      .pipe(plugins.rev.manifest, {
        base: path.dirname(manifest),
        merge: true
      })
      .pipe(() => plugins.if(versionFormat === 'query', util.revRewriteQuery()))
      .pipe(gulp.dest, path.dirname(manifest)),
    /**
     * 获取需要revision的globs
     * @param {Array|String} src
     * @param {String} dest
     * @return {Array|String}
     */
    getRevGlobs = (src, dest) => {
      return util.processGlobs(
        output,
        util.globRebase(src, dest)
      );
    },
    /**
     * 从globs中提取后缀
     * @param {Array|String} globs
     * @return {Array}
     */
    extractExtsForGlobs = globs => {
      if (!Array.isArray(globs)) {
        globs = [globs];
      }

      let ext = globs.reduce((arr, item) => {
        let ext = item.slice(
          item.lastIndexOf('.') + 1,
          globs.length
        ).replace(/^{+|}+$/g, '').split(',');

        return [
          ...arr,
          ...ext
        ];
      }, []);

      return Array.from(new Set(ext));
    },
    /**
     * CSS/JS资源中的引用路径替换
     * @param {Array|String} globs
     */
    assetsRevTask = globs => {
      let manifest = gulp.src(config.manifest);

      return gulp.src(globs, {base: outputBase})
        .pipe(plugins.revReplace({
          manifest
        }))
        .pipe(channel());
    },
    /**
     * 模板中的引用路径替换
     * @param {Array|String} globs
     */
    tmplRevTask = globs => {
      let manifest = gulp.src(config.manifest);
        exts = extractExtsForGlobs(globs);

      return gulp.src(globs, {base: './'})
        .pipe(plugins.revReplace({
          manifest,
          replaceInExtensions: exts
        }))
        .pipe(gulp.dest('./'));
    };

  /**
   * image resource revision
   */
  gulp.task('image:rev', () => {
    let globs = getRevGlobs(img.src, img.dest);

    return gulp.src(globs, {base: outputBase})
      .pipe(channel());
  });

  /**
   * svg resource revision
   */
  gulp.task('svg:rev', () => {
    let globs = getRevGlobs(svg.src, svg.dest);

    return gulp.src(globs, {base: outputBase})
      .pipe(channel());
  });

  /**
   * other resource revision
   */
  gulp.task('other:rev', () => {
    let taskList = [];

    for (let item of other) {
      if (item.useHash) {
        let globs = getRevGlobs(item.src, item.dest);

        taskList.push(new Promise((resolve, reject) => {
          gulp.src(globs, {base: outputBase})
            .pipe(channel())
            .on('end', resolve)
            .on('error', reject);
        }));
      }
    }

    return Promise.all(taskList);
  });

  /**
   * css resource revision
   */
  gulp.task('css:rev', () => {
    return assetsRevTask(getRevGlobs(css.src, css.dest));
  });

  /**
   * js resource revision
   */
  gulp.task('js:rev', () => {
    return assetsRevTask(getRevGlobs(js.src, js.dest));
  });

  /**
   * template revision
   */
  gulp.task('tmpl:rev', () => {
    let globs = getRevGlobs(tmpl.src, tmpl.dest),
      manifest = gulp.src(config.manifest);
      exts = extractExtsForGlobs(globs);

    return gulp.src(globs, {base: './'})
      .pipe(plugins.revReplace({
        manifest,
        replaceInExtensions: exts
      }))
      .pipe(gulp.dest('./'));
  });

  /**
   * 根据rev-manifest.json清理掉旧文件, 只删除dest目录中的旧资源
   */
  gulp.task('rev:garbage:clean', (done) => {
    if (fs.existsSync(config.manifest)) {
      let manifest = {},
        files = [];

      try {
        manifest = JSON.parse(fs.readFileSync(config.manifest, 'utf8'));
      } catch (err) {
        done(err);
      }

      for (let [key, value] of Object.entries(manifest)) {
        let oldFile = path.join(outputBase, key),
          newFile = path.join(outputBase, util.versionFormatter.toFilename(value));

        del.sync(oldFile);
        fs.renameSync(newFile, oldFile);
      }
    }

    done();
  });
}
