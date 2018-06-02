/**
 * 收集因useref产生的垃圾资源
 * gulp plugin
 * @author evan2x(evan2zaw@gmail.com)
 * @date 2015/12/12
 */

import path from 'path';
import through from 'through2';
import useref from 'useref';
import gutil from 'gulp-util';
import * as _ from 'lodash';

export default function collectRefuse({
  root = '',
  output = _.noop
} = {}) {
  let grabage = new Set();
  let ret = {};

  root = _.trimStart(path.posix.normalize(root), path.posix.sep);

  const collect = (obj) => {
    Object.keys(obj).forEach((key) => {
      let replacedFiles = obj[key].assets;
      if (replacedFiles && Array.isArray(replacedFiles)) {
        replacedFiles.forEach((filePath) => {
          filePath = _.trimStart(path.posix.normalize(filePath), path.posix.sep);

          // 文件路径以指定的根路径开头及文件不是同意路径的情况下加入到垃圾资源列表中
          if (filePath.startsWith(root) && !filePath.endsWith(key)) {
            grabage.add(filePath);
          }
        });
      }
    });
  };

  return through.obj(function (file, enc, next) {
    if (file.isNull()) {
      return next();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('collect-refush', 'Streaming not supported'));
      return next();
    }

    ret[file.path] = useref(file.contents.toString())[1];

    this.push(file);
    next();
  }, (next) => {
    if (_.isFunction(output)) {
      Object.values(ret).forEach((assets) => {
        if (assets.css) collect(assets.css);
        if (assets.js) collect(assets.js);
      });

      output(Array.from(grabage), ret);
    }
    next();
  });
}
