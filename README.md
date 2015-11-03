
# gulp-boilerplate

[![](https://img.shields.io/badge/node.js->=_0.12-brightgreen.svg?style=flat-square)]()

## 启动项目

```bash
# browser-sync service
gulp serve
```

`gulp serve` 有以下两个参数：

* `--port 3000` 指定browser-sync服务监听端口，默认：`3000`
* `--pport 8080` 指定代理端口，如被代理的tomcat服务监听端口为`8080`

访问 `http://127.0.0.1:3000`

## Task执行环境

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

## Task

```bash
# 普通发布
gulp release

# 添加hash版本号发布
gulp rev

# 执行watch
# 实时打包JS模块以及编译Sass
# 使用babel将ES2015(ES6)语法转译为ES5
gulp watch

```
