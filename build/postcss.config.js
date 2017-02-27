import sprites from 'postcss-sprites';
import cssnext from 'postcss-cssnext';
import willChange from 'postcss-will-change';

import { createRuleUpdater } from './util';

/**
 * 匹配CSS Sprites 图片的分组
 * @type {RegExp}
 */
export const matchGroup = /\.(.+)\.(?:[a-zA-Z0-9]+)$/;

let processors = [];

export default function ({
  spritePath = '',
  stylesheetPath = '',
  refPath = ''
} = {}) {
  processors.push(willChange());
  processors.push(cssnext({
    browsers: ['last 2 versions', '> 1% in CN', 'Firefox ESR', 'Opera 12.1', 'Safari >= 5', 'ie >= 8'],
    warnForDuplicates: false
  }));

  if (!refPath.startsWith('/')) {
    refPath = `/${refPath}`;
  }

  // support css sprites
  processors.push(sprites({
    stylesheetPath,
    spritePath,
    basePath: './',
    retina: true,
    hooks: {
      onUpdateRule: createRuleUpdater(refPath)
    },
    filterBy(image) {
      if (matchGroup.test(image.url)) {
        return Promise.resolve();
      }

      return Promise.reject();
    },
    groupBy(image) {
      let match = image.url.match(matchGroup);

      image.groups = [];

      if (match && match[1]) {
        return Promise.resolve(match[1]);
      }

      return Promise.reject();
    },
    spritesmith: {
      padding: 1
    }
  }));

  return processors;
}
