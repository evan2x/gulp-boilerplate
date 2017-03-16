
import path from 'path';
import through from 'through2';

export default function (filename, opts) {
  if (path.extname(filename) !== '.css') return through();

  let chunks = [];

  let stream = through(function (chunk, enc, next) {
    chunks.push(chunk);
    next();
  }, function(next) {
    stream.emit('styleify-css', Buffer.concat(chunks).toString('utf8'));

    this.push(`// ${filename}`);
    next();
  });

  stream.styleify = true;

  return stream;
}
