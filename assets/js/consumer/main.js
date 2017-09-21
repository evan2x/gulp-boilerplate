/* eslint no-console: 0 */
// import 'babel-polyfill';
import { EventEmitter } from 'events';

class Consumer extends EventEmitter {

  constructor(prop = {}) {
    super();

    this.name = prop.name;
    this.age = prop.age;
    this.delete = false;
  }

  say(message) {
    this.emit('say', `${this.name} say: ${message}`);
  }
}

let evan = new Consumer({
  name: 'evan',
  age: 22
});

evan.on('say', (msg) => {
  console.log(`${msg} \n${' '.repeat(msg.length - 4)}----by 'say' event`);
});

evan.say('Hello!');
