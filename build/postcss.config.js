import path from 'path';
import sprites from 'postcss-sprites';
import cssnext from 'postcss-cssnext';
import willChange from 'postcss-will-change';
import atImport from 'postcss-import';

/**
 * 匹配CSS Sprites 图片的分组
 * @type {RegExp}
 */
const spriteGroupMatcher = /\?__group=([^\\/]+)$/;

let processors = null;

export default function ({
  stylesheetPath = '',
  spritePath = '',
  referencePath = '',
  collectGarbage = function () {}
} = {}, debug = false) {
  if (processors) return processors;

  processors = [
    atImport(),
    willChange(),
    cssnext({
      browsers: ['last 2 versions', '> 1% in CN', 'Firefox ESR', 'Opera 12.1', 'Safari >= 5', 'ie >= 8'],
      warnForDuplicates: false
    })
  ];

  if (!referencePath.startsWith('/')) {
    referencePath = `/${referencePath}`;
  }

  if (!debug) {
    // support css sprites
    processors.push(sprites({
      stylesheetPath,
      spritePath,
      basePath: './',
      retina: true,
      hooks: {
        /**
         * 更新 CSS
         * @reference https://github.com/2createStudio/postcss-sprites/blob/master/src/core.js#L450
         */
        onUpdateRule(rule, token, image) {
          const { ratio, coords, spriteWidth, spriteHeight } = image;
          const posX = -1 * Math.abs(coords.x / ratio);
          const posY = -1 * Math.abs(coords.y / ratio);
          const sizeX = spriteWidth / ratio;
          const sizeY = spriteHeight / ratio;
          const spriteUrl = path.posix.join(referencePath, path.basename(image.spritePath));

          token.cloneAfter({
            type: 'decl',
            prop: 'background-image',
            value: `url(${spriteUrl})`
          }).cloneAfter({
            prop: 'background-position',
            value: `${posX}px ${posY}px`
          }).cloneAfter({
            prop: 'background-size',
            value: `${sizeX}px ${sizeY}px`
          });
        }
      },
      /**
       * 过滤出符合生成sprite的图片
       * @reference https://github.com/2createStudio/postcss-sprites#filterby
       */
      filterBy(image) {
        if (spriteGroupMatcher.test(image.originalUrl)) {
          collectGarbage(image.path);
          return Promise.resolve();
        }

        return Promise.reject();
      },
      /**
       * 从引用路径中提取分组名
       * @reference https://github.com/2createStudio/postcss-sprites#groupby
       */
      groupBy(image) {
        let group = image.originalUrl.match(spriteGroupMatcher);

        if (group && group[1]) {
          return Promise.resolve(group[1]);
        }

        return Promise.reject();
      },
      spritesmith: {
        padding: 1
      }
    }));
  }

  return processors;
}
