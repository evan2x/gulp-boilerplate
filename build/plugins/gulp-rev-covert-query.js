/**
 * 将filename版本号格式转为querystring版本号格式
 * @param  {String} filePath
 * @return {String}
 * @example
 *   /path/to/name-1d746b2ce5.png -> /path/to/name.png?v=1d746b2ce5
 */

import through from 'through2';
import gutil from 'gulp-util';
import * as _ from 'lodash';

export default function covertQuery() {
  let manifest = {};
  let rquery = /\?v=([\da-zA-Z]+)$/;
  let rfilename = /-([\da-zA-Z]{10})(?:\.\S*)*$/;

  const filename2query = (filePath) => {
    if (rquery.test(filePath)) return filePath;

    let match = filePath.match(rfilename);
    let hash = '';

    if (Array.isArray(match) && (hash = match[1])) {
      filePath = filePath.replace(`-${hash}`, '');
      filePath = `${filePath}?v=${hash}`;
    }

    return filePath;
  };

  return through.obj(function (file, enc, next) {
    if (file.isNull()) {
      return next();
    }

    if (file.isStream()) {
      this.emit('error', new gutil.PluginError('rev-covert-query', 'Streaming not supported'));
      return next();
    }

    _.merge(manifest, JSON.parse(file.contents.toString()));

    Object.entries(manifest).forEach(([key, value]) => {
      manifest[key] = filename2query(value);
    });

    file.contents = new Buffer(JSON.stringify(manifest, null, '    '));

    this.push(file);
    next();
  });
}
