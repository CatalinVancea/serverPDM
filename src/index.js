const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');

app.use(bodyparser());
app.use(cors());
app.use(async (ctx, next) => {
  const start = new Date();
  await next();
  const ms = new Date() - start;
  console.log(`${ctx.method} ${ctx.url} ${ctx.response.status} - ${ms}ms`);
});
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.body = { issue: [{ error: err.message || 'Unexpected error' }] };
    ctx.response.status = 500;
  }
});


class Student {
  constructor({ id, name, graduated, grade, enrollment, date, version }) {
    this.id = id;
    this.name=name;
    this.graduated=graduated;
    this.grade=grade;
    this.enrollment=enrollment;
    this.date = date;
    this.version = version;
  }
}

const students = [];
for (let i = 0; i < 3; i++) {
  students.push(new Student({ id: `${i}`, name: `student ${i}`, graduated: new Boolean('true'),
    grade: Number(20), enrollment: new Date(Date.now() + i), date: new Date(Date.now() + i), version: 1 }));
}

let lastUpdated = students[students.length - 1].date;
let lastId = students[students.length - 1].id;
const pageSize = 10;

const broadcast = data =>
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });

const router = new Router();

router.get('/student', ctx => {

  const ifModifiedSince = ctx.request.get('If-Modif ied-Since');
  if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= lastUpdated.getTime() - lastUpdated.getMilliseconds()) {
    ctx.response.status = 304; // NOT MODIFIED
    return;
  }
  const name = ctx.request.query.name;
  const page = parseInt(ctx.request.query.page) || 1;
  ctx.response.set('Last-Modified', lastUpdated.toUTCString());
  const sortedStudents = students
    .filter(student => name ? student.name.indexOf(name) !== -1 : true)
    .sort((n1, n2) => -(n1.date.getTime() - n2.date.getTime()));
  const offset = (page - 1) * pageSize;
  // ctx.response.body = {
  //   page,
  //   items: sortedItems.slice(offset, offset + pageSize),
  //   more: offset + pageSize < sortedItems.length
  // };
  ctx.response.body = students;
  ctx.response.status = 200;
});

router.get('/student/:id', async (ctx) => {
  console.log(`get one student`);
  const studentId = ctx.request.params.id;
  const student = students.find(student => studentId === student.id);
  console.log(`${student.name} ${student.grade} ${student.enrollment} ${student.date} ${student.graduated}`);
  if (student) {
    ctx.response.body = student;
    ctx.response.status = 200; // ok
  } else {
    ctx.response.body = { issue: [{ warning: `students with id ${studentId} not found` }] };
    ctx.response.status = 404; // NOT FOUND (if you know the resource was deleted, then return 410 GONE)
  }
});

const createStudent = async (ctx) => {
  const student = ctx.request.body;
  if (!student.name) { // validation
    ctx.response.body = { issue: [{ error: 'Name is missing' }] };
    ctx.response.status = 400; //  BAD REQUEST
    return;
  }
  student.id = `${parseInt(lastId) + 1}`;
  lastId = student.id;
  student.date = Date.now();
  student.version = 1;
  students.push(student);
  ctx.response.body = student;
  ctx.response.status = 201; // CREATED
  broadcast({ event: 'created', payload: { student } });
};

router.post('/student', async (ctx) => {
  await createStudent(ctx);
});

router.put('/student/:id', async (ctx) => {
  const id = ctx.params.id;
  const student = ctx.request.body;
  console.log(`${student.id} ${student.name} ${student.grade} ${student.enrollment} ${student.date} ${student.graduated}`);
  const studentId = student.id;
  if (studentId && id !== student.id) {
    ctx.response.body = { issue: [{ error: `Param id and body id should be the same` }] };
    ctx.response.status = 400; // BAD REQUEST
    return;
  }
  if (!studentId) {
    await createStudent(ctx);
    return;
  }
  const index = students.findIndex(student => student.id === id);
  if (index === -1) {
    ctx.response.body = { issue: [{ error: `student with id ${id} not found` }] };
    ctx.response.status = 400; // BAD REQUEST
    return;
  }
  const studentVersion = parseInt(ctx.request.get('ETag')) || student.version;
  if (studentVersion < students[index].version) {
    ctx.response.body = { issue: [{ error: `Version conflict` }] };
    ctx.response.status = 409; // CONFLICT
    return;
  }
  student.version++;
  students[index] = student;
  lastUpdated = new Date();
  ctx.response.body = student;
  ctx.response.status = 200; // OK
  broadcast({ event: 'updated', payload: { student } });
});

router.del('/student/:id', ctx => {
  const id = ctx.params.id;
  const index = students.findIndex(student => id === student.id);
  if (index !== -1) {
    const student = students[index];
    students.splice(index, 1);
    lastUpdated = new Date();
    broadcast({ event: 'deleted', payload: { student } });
  }
  ctx.response.status = 204; // no content
});

setInterval(() => {
  lastUpdated = new Date();
  lastId = `${parseInt(lastId) + 1}`;

  const student = new Student({ id: lastId, name: `student ${lastId}`, graduated: new Boolean('true'),
    grade: Number(20), enrollment: lastUpdated, date: lastUpdated, version: 1 });
  students.push(student);

  console.log(`caca ${student.name}`);
  broadcast({ event: 'created', payload: { student } });
}, 15000);

app.use(router.routes());
app.use(router.allowedMethods());

server.listen(3000);


require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  console.log('addr: '+add);
})