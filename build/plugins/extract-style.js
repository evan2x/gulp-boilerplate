import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import through from 'through2';

export default function extractStyle(bundle, {
  output = ''
} = {}) {
  if (!output) return;

  const styles = new Map();

  const noop = (chunk, enc, done) => {
    done(null, chunk);
  };

  const addHooks = () => {
    bundle.pipeline.get('pack').push(through.obj(noop, (done) => {
      let content = '';

      styles.forEach((value) => {
        content += value;
      });

      if (!fs.existsSync(output)) {
        mkdirp.sync(path.dirname(output));
      }

      fs.writeFile(output, content, done);
    }));
  };

  bundle.on('transform', (tr, file) => {
    if (tr.styleify) {
      tr.once('styleify-css', (css) => {
        styles.set(file, css);
      });
    }
  });

  bundle.on('reset', addHooks);
  addHooks();
}
