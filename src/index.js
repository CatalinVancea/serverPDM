import Koa from 'koa';
import WebSocket from 'ws';
import http from 'http';
import Router from 'koa-router';
import bodyParser from "koa-bodyparser";
import { timingLogger, exceptionHandler, jwtConfig, initWss, verifyClient } from './utils';
import { router as noteRouter } from './note';
import { router as authRouter } from './auth';
import { router as studentRouter } from './student';
import jwt from 'koa-jwt';
import cors from '@koa/cors';

const app = new Koa();
const server = http.createServer(app.callback());
const wss = new WebSocket.Server({ server });
initWss(wss);

/*
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');
*/

app.use(cors());
app.use(timingLogger);
app.use(exceptionHandler);
app.use(bodyParser());

const prefix = '/api';

// public
const publicApiRouter = new Router({ prefix });
publicApiRouter
    .use('/auth', authRouter.routes());
app
    .use(publicApiRouter.routes())
    .use(publicApiRouter.allowedMethods());

app.use(jwt(jwtConfig));


// protected
const protectedApiRouter = new Router({ prefix });
protectedApiRouter
    .use('/student', studentRouter.routes());
app
    .use(protectedApiRouter.routes())
    .use(protectedApiRouter.allowedMethods());


server.listen(3000);
console.log('started on port 3000');

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  console.log('addr: '+add);
})
