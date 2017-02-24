
import path from 'path';
import gulp from 'gulp';

import config from '../config';

export default function (plugins) {
  /**
   * svg图标生成svg symbols
   */
  gulp.task('symbols:gen', () => {
    const {
      src,
      symbols: {
        name,
        dest: destPath,
        doc: docPath
      }
    } = config.icon;

    let globs = path.join(src, '**/*.svg');
    let tmpl = path.resolve(__dirname, '../templates/svg-symbols.html');

    const filter = {
      svg: plugins.filter(file => /\.svg$/.test(file.path), {
        restore: true
      }),
      html: plugins.filter(file => /\.html$/.test(file.path), {
        restore: true
      })
    };

    return gulp.src(globs)
      .pipe(plugins.cheerio({
        run($) {
          $('style').remove();
          $('[class]').removeAttr('class');
          $('[id]').removeAttr('id');
          $('[fill]').removeAttr('fill');
          $('[stroke]').removeAttr('stroke');
        },
        parserOptions: {
          xmlMode: true
        }
      }))
      .pipe(plugins.svgSymbols({
        templates: ['default-svg', tmpl],
        transformData(svg, defaultData) {
          let filePath = path.posix.join(destPath, name);

          if (!filePath.startsWith('/')) {
            filePath = `/${filePath}`;
          }

          return {
            id: defaultData.id,
            className: defaultData.className,
            width: '48px',
            height: '48px',
            filePath
          };
        }
      }))
      .pipe(filter.svg)
      .pipe(plugins.rename(name))
      .pipe(gulp.dest(destPath))
      .pipe(filter.svg.restore)
      .pipe(filter.html)
      .pipe(plugins.rename('demo.html'))
      .pipe(gulp.dest(path.dirname(docPath)));
  });

  /**
   * svg图标生成iconfont
   */
  gulp.task('iconfont:gen', () => {
    const {
      src,
      font: {
        name,
        formats,
        dest: destPath,
        style: stylePath,
        doc: docPath
      }
    } = config.icon;

    let globs = path.join(src, '**/*.svg');
    let docDestPath = path.dirname(docPath);
    let tmpl = {
      css: path.resolve(__dirname, '../templates/iconfont.css'),
      html: path.resolve(__dirname, '../templates/iconfont.html')
    };

    return gulp.src(globs)
      .pipe(plugins.iconfont({
        fontName: name,
        formats,
        timestamp: Math.round(Date.now() / 1000)
      }))
      .on('glyphs', (glyphs) => {
        let fontPath = destPath;
        let data = {
          className: 'icon',
          fontName: name,
          glyphs
        };

        if (!fontPath.startsWith('/')) {
          fontPath = `/${fontPath}`;
        }

        if (!fontPath.endsWith('/')) {
          fontPath = `${fontPath}/`;
        }

        data.fontPath = fontPath;

        // 生成项目所需的CSS
        gulp.src(tmpl.css)
          .pipe(plugins.consolidate('lodash', data))
          .pipe(plugins.rename(path.basename(stylePath)))
          .pipe(gulp.dest(path.dirname(stylePath)));

        // 文档参数
        let docData = {
          ...data,
          fontPath: ''
        };

        // 生成iconfont文档所需的css
        gulp.src(tmpl.css)
          .pipe(plugins.consolidate('lodash', docData))
          .pipe(plugins.rename('style.css'))
          .pipe(gulp.dest(docDestPath));

        // 生成iconfont文档页面
        gulp.src(tmpl.html)
          .pipe(plugins.consolidate('lodash', docData))
          .pipe(plugins.rename(path.basename(docPath)))
          .pipe(gulp.dest(docDestPath));
      })
      .pipe(gulp.dest(docDestPath))
      .pipe(gulp.dest(destPath));
  });
}

