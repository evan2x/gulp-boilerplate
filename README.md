
# gulp-boilerplate

[![Badge](https://img.shields.io/badge/node.js->=_4.0-brightgreen.svg?style=flat)]()
[![David](https://img.shields.io/david/dev/evan2x/gulp-boilerplate.svg)]()

**所有的资源(css, js, image...)引用请使用绝对路径**

## Commands

```bash
# build
npm run build

# build with hash version
npm run revision

# watch css/js
# Use ESNext/Stage-2 translate via babel
# Use css future translate via PostCSS
npm run watch

# browser-sync service
npm run serve -- --port 3000

# browser-sync service proxy URL to another URL
npm run serve -- --port 3000 --proxy "http://127.0.0.1:8080"

# generate svg symbols
npm run symbols:gen

# generate iconfonts
npm run iconfont:gen

# execute gulp task
npm run build [task]
```

`npm run serve` 有以下选项：

* `--port 3000` 指定browser-sync服务监听端口，默认：`3000`
* `--proxy 127.0.0.1:8080` 指定代理地址，如果需要配置更复杂的配置项，请移步到 build/config.js 配置 `browserSync`

访问 `http://127.0.0.1:3000`

## 配置项

以下build/config.js为默认配置项，如果想更改其中的配置，可以修改 `build/config.js` 配置文件，也可以通过 `--buildfile` 参数来指定配置文件，当通过 `--buildfile` 指定配置文件的时候，配置中的配置项会和 `build/config.js` 文件中的配置项进行合并。

如下命令会把 `--buildfile` 指定的配置文件与 `build/config.js` 配置进行合并作为最终配置项。

```shell
$ gulp --cwd=./ --gulpfile build/gulpfile.babel.js --buildfile build.config.js
```

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
2. 业务公用模块打包到一个JS下，默认是 `common.js`。
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
  <script src="/dist/assets/js/vendor.js"></script>
  <!-- endbuild -->
  <!-- build:js /assets/js/common.js -->
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

使用此功能需要在css中的图片引用加上 `?__group=[group]` 此处的`group`表示当前图片将合并到哪个分组中，分组名相同的图片引用会合并到一张图中，如下示例：

```css
/* input */
.foo {
  background: url(/assets/img/foo@2x.png?__group=baz) no-repeat;
}

.bar {
  background: url(/assets/img/bar@2x.png?__group=baz) no-repeat;
}

/* output */
.foo, .bar {
  background-image: (/assets/img/sprite.@2x.baz.png);
  background-size: 200px 200px;
}

.foo {
  background-position: 0 0;
}

.bar {
  background-position: -100px -100px;
}
```

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
