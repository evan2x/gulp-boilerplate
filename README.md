
# gulp-boilerplate

[![Badge](https://img.shields.io/badge/node.js->=_4.0-brightgreen.svg?style=flat)]()
[![David](https://img.shields.io/david/dev/evan2x/gulp-boilerplate.svg)]()

## Build

```bash
# 构建项目
npm run build

# 带 hash 版本号构建
npm run revision

# watch css/js
# 使用babel将ES2015(ES6)语法转译为ES5
# 使用PostCSS处理CSS
npm run watch

# browser-sync service
npm run serve -- --port 3000

# 执行任意 gulp task
npm run build [task]
```

`npm run serve` 有以下两个参数：

* `--port 3000` 指定browser-sync服务监听端口，默认：`3000`
* `--pport 8080` 指定代理端口，如被代理的tomcat服务监听端口为`8080`

访问 `http://127.0.0.1:3000`

## Environment

### Mac/Linux

```bash
# 生产环境
NODE_ENV=production npm run [script name]
# 开发环境
npm run [script name]
```

### Windows

```bat
rem 生产环境
set NODE_ENV=production && npm run [script name] && set NODE_ENV=
rem 开发环境
npm run [script name]
```

## Misc

### 为了更好的平衡浏览器缓存与模块合并，以下为我们建议的JS组织方式：

1. 第三方模块统一打包到一个JS下，默认是 `vendor.js`，需要打包的第三方模块及最终输出文件名称可以在 `build/config.js` 中自己配置。
2. 业务公用模块打包到一个JS下，默认是 `common.js`，注意该处将 `babelHelpers.js` 合并到 `common.js` 中是因为 `babelHelpers.js` 在打包的过程中只打包需要用到的 `babel-helpers`，同样的可以在 `build/config.js`中配置输出文件名。
3. 当前页面的业务代码打包到一个JS下，默认是 `main.js`，当前页面的入口模块。

**注意：由于打包第三方模块是在 `watchify` 启动时打包的，所以如果您在 `build/config.js` 中添加了第三方模块，需要重新 `watch`**

页面示例：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>example</title>
</head>
<body>
  <h1>Hello World!</h1>
  <!-- build:js /assets/js/vendor.js -->
  <script src="/node_modules/babel-polyfill/dist/polyfill.js"></script>
  <script src="/dist/assets/js/vendor.js"></script>
  <!-- endbuild -->
  <!-- build:js /assets/js/common.js -->
  <script src="/dist/assets/js/babelHelpers.js"></script>
  <script src="/dist/assets/js/common.js"></script>
  <!-- endbuild -->
  <!-- build:js /assets/js/main.js -->
  <script src="/dist/assets/js/main.js"></script>
  <!-- endbuild -->
</body>
</html>
```

### 针对于移动端，提供了内嵌CSS/JS到HTML中的方式来减少请求数量

示例：

```html
<!-- build:css /assets/css/index.css inline -->
<link rel="stylesheet" href="/dist/assets/css/index.css">
<!-- endbuild -->

<!-- build:js /assets/js/main.js inline -->
<script src="/dist/assets/js/main.js"></script>
<!-- endbuild -->
```

### CSS Sprites

该功能只会在非debug模式下启用。

使用此功能需要符合以下要求：

图片格式必须是 `image.[group].png`, 此处的`group`表示当前图片将合并到哪个分组下, 如下示例：

```
// input
picture1.common.png
picture2.common.png
picture3.common.png

picture1.home.png
picture2.home.png
picture3.home.png

// output
sprite.common.png
sprite.home.png
```

**注意：默认仅会处理.png文件，可以在`config.js`下的css#sprite中配置`extensions`**

### 关于 `../../../../` 引用模块的解决方式

在 `build/config.js` 中可以配置 `modulesDirectories` 来避免 `../../../../` 的方式引用模块。

也就是说如果将查找模块的目录添加到 `modulesDirectories` 中的话，则 `browserify` 在打包的时候，会在该目录下搜索模块。

示例：

```
目录结构：

assets/
  common/
    util.js
  components/
    Datepicker/
      index.js
```

未配置 `modulesDirectories` 前：

```js
// Datepicker/index.js

// 引入工具模块
import * as util from '../../common/util';
```

配置 `modulesDirectories: ['assets']` 后：

```js
// Datepicker/index.js

// 引入工具模块
import * as util from 'common/util';
```

### 针对低端浏览器(IE8)的支持

安装两个Babel插件

```shell
npm install --save-dev babel-plugin-transform-es3-member-expression-literals babel-plugin-transform-es3-property-literals
```

配置 `.babelrc`

```json
{
  "presets": [
    "es2015",
    "stage-2"
  ],
  "plugins": [
    "transform-es3-member-expression-literals",
    "transform-es3-property-literals",
    "external-helpers"
  ]
}
```
