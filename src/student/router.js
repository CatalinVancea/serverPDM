import Router from 'koa-router';
import studentStore from './store';
import { broadcast } from "../utils";
import {lastUpdatedDateGet, lastUpdatedDateSet} from '../auth/router'

export const router = new Router();

let lastUpdated = -1;
let lastId = -1;
let lastIdUser = -1;
const pageSize = 10;



router.get('/', async (ctx) => {
  const response = ctx.response;
  const userId = ctx.state.user._id;
  response.body = await studentStore.find({ userId: userId });
  response.status = 200; // ok
});

router.get('/modified', async (ctx) => {

  const response = ctx.response;
  const request = ctx.request;
  const userId = ctx.state.user._id;


  const ifModifiedSince = request.get('If-Modified-Since');
  const dateee = new Date(ifModifiedSince);
  console.log('get all modified1 ' + ifModifiedSince);
  console.log('get all modified2 ' + Date.now());
  console.log('get all modified3 ' + dateee);
  console.log('get all modified4 ' + dateee.getTime());

  lastUpdated = await lastUpdatedDateGet(userId);

  console.log('get all modified5 ' + lastUpdated);
  console.log('get all modified6 ' + lastUpdated.getTime);
  console.log('get all modified7 ' + lastUpdated.getMilliseconds);

  if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= lastUpdated.getTime() - lastUpdated.getMilliseconds()) {
    response.status = 304; // NOT MODIFIED
    console.log('get all modified8 not modified');
    response.body = { message: 'NOT MODIFIED' };
    return;
  }

  response.body = await studentStore.find({ userId: userId });
  response.status = 200; // ok
});

router.get('/:id', async (ctx) => {
  const userId = ctx.state.user._id;
  const studentId = ctx.params.id.toString();

  const student = await studentStore.findOne({ id: studentId, userId: userId });
  const response = ctx.response;
  if (student) {
    if (student.userId === userId) {
      response.body = student;
      response.status = 200; // ok
    } else {
      response.status = 403; // forbidden
    }
  } else {
    response.status = 404; // not found
  }
});

const createStudent = async (ctx, student, response) => {
  try {
    const userId = ctx.state.user._id;
    student.userId = userId;

    student.date = Date.now();
    student.version = 1;
    console.log("create 0");
    if(lastId == -1 || lastIdUser != userId){
      let students = [];
      students = await studentStore.find({ userId });
      lastId = 0;
      students.forEach(student =>{
        let id = parseInt(student.id);
        if(id > lastId){
          lastId = id;
        }
      })
    }
    console.log("create 1/2");
    student.id = `${parseInt(lastId) + 1}`;
    lastId = student.id;
    console.log("create 1/3");
    response.body = await studentStore.insert(student);
    response.status = 201; // created
    console.log("create 1"+ new Date(Date.now()));
    await lastUpdatedDateSet(userId, Date.now());
    console.log("create 2");
    broadcast(userId, { event: 'created', payload:  student });
  } catch (err) {
    response.body = { message: err.message };
    response.status = 400; // bad request
  }
};

router.post('/', async ctx => await createStudent(ctx, ctx.request.body, ctx.response));

router.put('/:id', async (ctx) => {
  const student = ctx.request.body;
  const userId = ctx.state.user._id;
  const id = ctx.params.id;
  let studentId = ctx.params.id;
  //const studentPk = student._id;
  const response = ctx.response;
/*
  if (studentId && studentId !== id) {
    response.body = { message: 'Param id and body id should be the same' };
    response.status = 400; // bad request
    return;
  }
*/

  let studentFound = null;

  try {
    studentFound = await studentStore.findOne({id: id, userId: userId});
  }catch (err){
    studentFound = null;
  }

  if (studentFound == null) {
    await createStudent(ctx, student, response);
  } else {

    studentFound.name = student.name;
    studentFound.graduated = student.graduated;
    studentFound.grade = student.grade;
    studentFound.enrollment = student.enrollment;
    console.log("update: "+student.version);

    if (student.version != studentFound.version) {
      ctx.response.body = { issue: [{ error: `Version conflict` }] };
      ctx.response.status = 409; // CONFLICT
      return;
    }

    studentFound.version++;

    const updatedCount = await studentStore.update({ id: studentId, userId: userId }, studentFound);

    if (updatedCount === 1) {
      response.body = student;
      response.status = 200; // ok
      await lastUpdatedDateSet(userId, Date.now())
      broadcast(userId, { event: 'updated', payload:  studentFound });
    } else {
      response.body = { message: 'Resource no longer exists' };
      response.status = 405; // method not allowed
    }
  }
});

router.del('/:id', async (ctx) => {
  const userId = ctx.state.user._id;
  const id = ctx.params.id.toString();
  console.log('id '+id);

  const student = await studentStore.findOne({ id: id, userId: userId });
  if (student && userId !== student.userId) {
    ctx.response.status = 403; // forbidden
    console.log('forbiden ');
  } else {
    await studentStore.remove({ id: id, userId: userId });
    ctx.response.status = 204; // no content
    ctx.response.body = student; // no content
    console.log('no content ');
    console.log('student: '+student.id);
    await lastUpdatedDateSet(userId, Date.now())
    broadcast(userId,{ event: 'deleted', payload: student });
  }

});
