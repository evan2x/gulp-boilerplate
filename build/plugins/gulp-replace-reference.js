/**
 * 根据指定的资源清单替换文件中的路径
 * gulp plugin
 * @author evan2x(evan2zaw@gmail.com)
 * @date 2015/12/12
 * @example
 * {
 *   "assets/js/main.js": "{domain}/{prefix}/assets/js/main.js"
 * }
 */

import path from 'path';
import through from 'through2';
import gutil from 'gulp-util';
import * as _ from 'lodash';

export default function replaceByManifest(manifest) {
  return through.obj(function (file, enc, next) {
    if (file.isNull()) {
      return next();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('replace-by-manifest', 'Streaming not supported'));
      return next();
    }

    let contents = file.contents.toString();

    Object.entries(manifest).forEach(([key, value]) => {
      key = _.trim(key, path.posix.sep);
      value = _.trim(value, path.posix.sep);
      contents = contents.split(key).join(value);
    });

    file.contents = new Buffer(contents);
    this.push(file);
    next();
  });
}
