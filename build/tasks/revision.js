
import path from 'path';
import fs from 'fs';
import gulp from 'gulp';
import del from 'del';
import lazypipe from 'lazypipe';
import * as util from '../util';

export default function(config, plugins) {
  let assets = config.assets,
    rootpath = assets.rootpath,
    /**
     * 根输出目录
     * @type {String}
     */
    basedir = path.normalize(rootpath.dest).split(path.sep)[0],
    /**
     * 解析manifest的文件路径
     * @type {Object}
     */
    opts = path.parse(config.manifest),
    channel = lazypipe()
      .pipe(plugins.rev, opts.base)
      .pipe(gulp.dest, basedir)
      .pipe(plugins.rev.manifest, {
        base: opts.dir,
        merge: true
      })
      .pipe(function() {
        return plugins.if(!assets.overlay, util.revRewriteQuery());
      })
      .pipe(gulp.dest, opts.dir);

  /**
   * image revision
   */
  gulp.task('image:rev', () => {
    let pattern = util.createPattern({
      ...assets.img,
      rootpath
    });

    return gulp.src(pattern.target, {base: basedir})
      .pipe(channel());
  });

  /**
   * svg revision
   */
  gulp.task('svg:rev', () => {
    let pattern = util.createPattern({
      ...assets.svg,
      rootpath
    });

    return gulp.src(pattern.target, {base: basedir})
      .pipe(channel());
  });

  gulp.task('other:rev', () => {
    let otherTasks = [];

    assets.other.filter((item) => {
      let pattern = util.createPattern({
        ...item,
        rootpath
      });

      if (item.useHash) {
        otherTasks.push(new Promise((resolve, reject) => {
          gulp.src(pattern.target, {base: basedir})
            .pipe(channel())
            .on('end', resolve)
            .on('error', reject);
        }));
      }
    });

    return Promise.all(otherTasks);
  });

  /**
   * js css替换hash文件路径task
   */
  function resourceRevTask(src) {
    let manifest = gulp.src(config.manifest);

    return gulp.src(src, {base: basedir})
      .pipe(plugins.revReplace({
        manifest
      }))
      .pipe(channel());
  }

  /**
   * css revision
   */
  gulp.task('css:rev', () => {
    let pattern = util.createPattern({
      ...assets.css,
      rootpath
    });

    return resourceRevTask(pattern.target);
  });

  /**
   * js revision
   */
  gulp.task('js:rev', () => {
    let pattern = util.createPattern({
      ...assets.js,
      rootpath
    });

    return resourceRevTask(pattern.target);
  });

  /**
   * HTML/模板文件替换hash文件名的task
   */
  function htmlRevTask(pattern, ext) {
    let manifest = gulp.src(config.manifest);

    return gulp.src(pattern.target)
      .pipe(plugins.revReplace({
        manifest,
        replaceInExtensions: ext.map((suffix) => `.${suffix}`)
      }))
      .pipe(gulp.dest(pattern.destPath));
  }

  gulp.task('html:rev', () => {
    let pattern = util.createPattern({
      ...assets.html,
      rootpath
    });

    return htmlRevTask(pattern, assets.html.extensions);
  });

  /**
   * 替换模板中的资源路径
   */
  gulp.task('tpl:rev', () => {
    let pattern = util.createPattern({...config.tpl});

    return htmlRevTask(pattern, config.tpl.extensions);
  });

  /**
   * 清理掉旧文件, 只删除dest目录中的旧资源
   */
  gulp.task('garbage:rev:clean', (done) => {
    if (util.existsSync(config.manifest)) {
      let manifest = {},
        files = [];

      try {
        manifest = JSON.parse(fs.readFileSync(config.manifest, 'utf8'));
      } catch (err) {
        done(err);
      }

      for (let [key, value] of Object.entries(manifest)) {
        let filePath = key;

        if (!assets.overlay) {
          filePath = util.revisionConverter.toFilename(value);
        }

        files.push(path.join(basedir, filePath));
      }

      del(files).then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });
    } else {
      done();
    }
  });
}
