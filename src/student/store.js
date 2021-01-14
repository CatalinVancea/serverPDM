import dataStore from 'nedb-promise';

export class StudentStore {
  constructor({ filename, autoload }) {
    this.store = dataStore({ filename, autoload });
  }
  
  async find(props) {
    return this.store.find(props);
  }
  
  async findOne(props) {
    return this.store.findOne(props);
  }
  
  async insert(student) {
    let studentName = student.name;
    if (!studentName) { // validation
      throw new Error('Name is missing')
    }
    return this.store.insert(student);
  };
  
  async update(props, student) {
    return this.store.update(props, student);
  }
  
  async remove(props) {
    return this.store.remove(props);
  }
}

export default new StudentStore({ filename: './db/students.json', autoload: true });