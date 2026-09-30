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

// Memoria centrale delle stanze attive
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log('Un utente si è connesso:', socket.id);

  // 1. Richiesta della lista delle stanze attive
  socket.on('get_rooms', () => {
      socket.emit('rooms_list_update', Array.from(activeRooms.values()));
  });

  // 2. Creazione di una nuova stanza da parte dell'Host
  socket.on('create_room', (data) => {
      socket.join(data.code);
      activeRooms.set(data.code, {
          code: data.code,
          circuit: data.circuit,
          host: data.host,
          hostId: data.hostId,
          date: data.date || new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          weather: data.weather,
          pilots: [data.pilot],
          lastActivity: Date.now()
      });
      console.log(`Stanza creata: ${data.code} (${data.circuit}) da ${data.host}`);
      io.emit('rooms_list_update', Array.from(activeRooms.values()));
  });

  // 3. Ingresso di un partecipante nella stanza
  socket.on('join_room', (data) => {
      socket.join(data.code);
      const room = activeRooms.get(data.code);
      if (room) {
          room.lastActivity = Date.now();
          room.pilots = room.pilots.filter(p => p.id !== data.pilot.id);
          room.pilots.push(data.pilot);
          
          io.to(data.code).emit('room_update', room);
          io.emit('rooms_list_update', Array.from(activeRooms.values()));
      }
  });

  // 4. Aggiornamento dello stato della scheda
  socket.on('update_pilot_status', (data) => {
      const room = activeRooms.get(data.code);
      if (room) {
          room.lastActivity = Date.now();
          const pilot = room.pilots.find(p => p.id === data.pilotId);
          if (pilot) {
              pilot.sheetStatus = data.sheetStatus;
              pilot.boardData = data.boardData;
          }
          io.to(data.code).emit('room_update', room);
      }
  });

  // 5. Eliminazione manuale della stanza
  socket.on('delete_room', (data) => {
      const room = activeRooms.get(data.code);
      if (room) {
          activeRooms.delete(data.code);
          io.to(data.code).emit('room_closed', { message: "La stanza è stata eliminata dall'Host." });
          io.emit('rooms_list_update', Array.from(activeRooms.values()));
      }
  });

  // Evento di compatibilità
  socket.on('aggiorna-scheda', (data) => {
    socket.broadcast.emit('ricevi-scheda', data);
  });

  socket.on('disconnect', () => {
    console.log('Un utente si è disconnesso:', socket.id);
  });
});

// --- PULIZIA AUTOMATICA DOPO 4 ORE DI INATTIVITÀ ---
setInterval(() => {
    const adesso = Date.now();
    const SOGLIA_INATTIVITA = 4 * 60 * 60 * 1000; // 4 ore in millisecondi

    for (const [code, room] of activeRooms.entries()) {
        if (adesso - room.lastActivity > SOGLIA_INATTIVITA) {
            activeRooms.delete(code);
            io.to(code).emit('room_closed', { message: "Stanza chiusa automaticamente per inattività prolungata (4 ore)." });
            io.emit('rooms_list_update', Array.from(activeRooms.values()));
            console.log(`Stanza ${code} rimossa automaticamente per inattività.`);
        }
    }
}, 30 * 60 * 1000); // Controlla ogni 30 minuti

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server in ascolto sulla porta ${PORT}`);
});
