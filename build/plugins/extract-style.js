
import fs from 'fs';
import through from 'through2';

export default function extractStyle(bundle, {
  output = ''
} = {}) {
  if (!output) return;

  let styles = new Map();

  const noop = (chunk, enc, done) => {
    done(null, chunk);
  };

  const addHooks = () => {
    bundle.pipeline.get('pack').push(through.obj(noop, (done) => {
      let content = '';

      styles.forEach((value) => {
        content += value;
      });
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
