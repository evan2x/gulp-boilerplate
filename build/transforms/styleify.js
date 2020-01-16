import path from 'path';
import fs from 'fs';
import through from 'through2';
import postcss from 'postcss';
import url from 'postcss-url';
import mkdirp from 'mkdirp';
import isBase64 from 'is-base64';

export default function (filename, options) {
  if (path.extname(filename) !== '.css') return through();

  const chunks = [];

  let stream = through((chunk, enc, next) => {
    chunks.push(chunk);
    next();
  }, function (next) {
    const data = Buffer.concat(chunks).toString('utf8');
    const assetPaths = [];

    postcss([
      url({
        url(p) {
          if (!isBase64(p.url, { allowMime: true }) && !/^(?:https?:)?\/\//.test(p.url)) {
            assetPaths.push(p.url);
          }

          return p
        }
      })
    ]).process(data).then(result => {
      assetPaths.forEach(assetPath => {
        const src = path.resolve(path.dirname(filename), assetPath);
        const dest = path.resolve(options.stylePath, assetPath);

        mkdirp.sync(path.dirname(dest));

        fs.createReadStream(src).pipe(fs.createWriteStream(dest));
      })
    });

    stream.emit('styleify-css', data);

    this.push(`/* ${filename} */`);
    next();
  });

  stream.styleify = true;

  return stream;
}
