const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Un utente si è connesso:', socket.id);

  socket.on('aggiorna-scheda', (data) => {
    socket.broadcast.emit('ricevi-scheda', data);
  });

  socket.on('disconnect', () => {
    console.log('Un utente si è disconnesso:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});