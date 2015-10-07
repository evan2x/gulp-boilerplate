# gulp-boilerplate

[![](https://img.shields.io/badge/node.js->=_0.12-brightgreen.svg?style=flat-square)]()

## 启动项目

```bash
gulp serve
```

访问 `http://127.0.0.1:3000`

## 运行模式

> 默认情况下是`debug`模式

### Mac/Linux

```bash
# 关闭debug模式
DEBUG=false gulp [task]
# 开启debug模式
DEBUG=true gulp [task]
```

### Windows

```bat
rem 关闭debug模式
set DEBUG=false
gulp [task]
rem 开启debug模式
set DEBUG=true
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
# 使用babel支持ES2015(ES6)语法
gulp watch
```
