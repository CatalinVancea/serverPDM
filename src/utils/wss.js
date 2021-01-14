import WebSocket from "ws";
import jwt from "jsonwebtoken";
import { jwtConfig } from "./constants";

let wss;

export const initWss = value => {
  wss = value;
  wss.on('connection', ws => {
    ws.on('message', message => {
      console.log(message);
      const { type, payload: { token } } = JSON.parse(message);
      console.log("ws entry");
      if (type !== 'authorization') {
        console.log("ws close");
        ws.close();
        return;
      }
      try {
        ws.user = jwt.verify(token, jwtConfig.secret);
        console.log("ws jwt verifyed");
      } catch (err) {
        console.log("ws jwt invalid");
        ws.close();
      }
    })
  });
};

export const broadcast = (userId, data) => {
  if (!wss) {
    return;
  }
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && userId === client.user._id) {
      console.log(`broadcast sent to ${client.user.username}`);
      client.send(JSON.stringify(data));
    }
  });
};
