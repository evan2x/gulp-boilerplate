
# gulp-boilerplate

[![Badge](https://img.shields.io/badge/node.js->=_4.0-brightgreen.svg?style=flat)]()
[![David](https://img.shields.io/david/dev/evan2x/gulp-boilerplate.svg)]()

## gulp task说明

```bash
# browser-sync service
gulp serve

# 通用构建
gulp build

# 带 hash 版本号的构建任务
gulp prod

# watch css/js
# 使用babel将ES2015(ES6)语法转译为ES5
# 使用PostCSS处理css
gulp watch
```

`gulp serve` 有以下两个参数：

* `--port 3000` 指定browser-sync服务监听端口，默认：`3000`
* `--pport 8080` 指定代理端口，如被代理的tomcat服务监听端口为`8080`

访问 `http://127.0.0.1:3000`

## task执行环境

### Mac/Linux

```bash
# 生产环境
NODE_ENV=production gulp [task]
# 开发环境
gulp [task]
```

### Windows

```bat
rem 生产环境
set NODE_ENV=production && gulp [task] && set NODE_ENV=
rem 开发环境
gulp [task]
```
