const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  extends: ['airbnb-base', 'plugin:vue/essential'],
  rules: {
    "no-unused-vars": [2, {
      "vars": "local",
      "args": "none"
    }],
    "react-in-jsx-scope":OFF,
    "jsx-filename-extension":OFF,
    "style-prop-object":OFF,
    "prefer-destructuring":OFF,
    "no-unused-vars":OFF,
    "no-tabs":"off",
    "no-dupe-keys":OFF,
    "eqeqeq":OFF,
    'no-console': OFF,
    'no-continue': OFF,
    'no-shadow': OFF,
    'consistent-return': OFF,
    'no-cond-assign': OFF,
    'no-plusplus': OFF,
    'quote-props': OFF,
    'prefer-const': OFF,
    'func-names': OFF,
    'max-len': OFF,
    'no-param-reassign': OFF,
    'no-return-assign': OFF,
    'comma-dangle': [ERROR, 'only-multiline'],
    'import/no-extraneous-dependencies': OFF,
    'import/extensions': OFF,
    'import/no-unresolved': OFF,
    'import/prefer-default-export': OFF
  },
  env: {
    node: true,
    browser: true,
    es6: true,
    worker: true,
    serviceworker: true
  }
}
