const WebSocket = require("ws");
const http = require("http");
const express = require("express");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const chatRooms = new Map();

wss.on("connection", (ws) => {
  console.log("New connection...");

  ws.send(
    JSON.stringify({
      type: "auth",
      message: "Join a chat room",
    })
  );

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      ws.send(
        JSON.stringify({ type: "error", message: "Invalid message format" })
      );
      return;
    }

    if (data.type === "auth") {
      const { key: roomKey, name: roomName } = data;

      if (!chatRooms.has(roomKey)) {
        chatRooms.set(roomKey, {
          name: roomName,
          clients: new Set(),
          history: [],
        });
      }

      // Join the room
      ws.roomKey = roomKey;
      ws.authenticated = true;
      chatRooms.get(roomKey).clients.add(ws);

      // Send chat history to the new user
      ws.send(
        JSON.stringify({
          type: "history",
          messages: chatRooms.get(roomKey).history,
        })
      );

      ws.send(
        JSON.stringify({
          type: "success",
          message: `Joined room: ${chatRooms.get(roomKey).name}`,
        })
      );
    } else if (data.type === "message" && ws.authenticated) {
      const chatMessage = {
        type: "chat",
        user: data.user,
        message: data.message,
      };

      // Save message in chat history
      chatRooms.get(ws.roomKey).history.push(chatMessage);

      // Broadcast message to the room
      broadcast(chatMessage, ws.roomKey);
    }
  });

  ws.on("close", () => {
    if (ws.roomKey && chatRooms.has(ws.roomKey)) {
      chatRooms.get(ws.roomKey).clients.delete(ws);
      if (chatRooms.get(ws.roomKey).clients.size === 0) {
        chatRooms.delete(ws.roomKey);
      }
    }
  });
});

// Broadcast message to all clients in the room
function broadcast(message, roomKey) {
  if (chatRooms.has(roomKey)) {
    chatRooms.get(roomKey).clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

server.listen(4000, () => {
  console.log("Server running on http://localhost:3000");
});
