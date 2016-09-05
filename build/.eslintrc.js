
const OFF = 0;
const WARN = 1;

module.exports = {
  rules: {
    'no-console': OFF,
    'max-len': [WARN, 120, 2]
  },
  env: {
    node: true,
    browser: false,
    es6: true,
    jquery: false,
    serviceworker: false,
    mocha: false,
  }
}
