/*eslint no-console: 0 */

import {EventEmitter} from 'events';

class Person extends EventEmitter {

  constructor(prop = {}) {
    super();
    
    this.name = prop.name;
    this.age = prop.age;
  }

  say(message){
    this.emit('say', `${this.name} say: ${message}`);
  }
}

let evan = new Person({
  name: 'evan',
  age: 22
});

evan.on('say', (msg) => {
  console.log(`${msg} \n${' '.repeat(msg.length - 4)}----by 'say' event`);
});

evan.say('Hello!');