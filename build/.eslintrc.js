
const WARN = 1;

module.exports = {
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      experimentalObjectRestSpread: true
    }
  },

  rules: {
    'no-console': 0,
    'max-len': [WARN, 120, 2]
  },

  env: {
    node: true,
    browser: false,
    es6: true,
    jquery: false,
    mocha: false,
  }
}
