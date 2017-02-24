/**
 * 提取babelify在转码的过程中所使用的helpers
 * browserify plugin
 * @author evan2x(aiweizhang@creditease.cn)
 * @date 2015/12/12
 */

import fs from 'fs';
import babelify from 'babelify';
import through from 'through2';
import { transform, buildExternalHelpers } from 'babel-core';

export default function extractBabelHelpers(br, {
  outputType = 'global',
  output = '',
  es3 = true
} = {}) {
  if (!output) return;
  let usedHelpers = new Set();

  br.on('transform', (tr) => {
    if (tr instanceof babelify) {
      tr.once('babelify', (result) => {
        result.metadata.usedHelpers.forEach((method) => {
          usedHelpers.add(method);
        });
      });
    }
  });

  br.pipeline.get('pack').push(through.obj((obj, enc, done) => {
    done(null, obj);
  }, (done) => {
    let helpers = buildExternalHelpers(Array.from(usedHelpers), outputType);
    let options = {};

    if (es3) {
      options.plugins = [
        'transform-es3-member-expression-literals',
        'transform-es3-property-literals'
      ];
    }

    let ret = transform(helpers, options);

    fs.writeFile(output, ret.code, done);
  }));

  return br;
}
