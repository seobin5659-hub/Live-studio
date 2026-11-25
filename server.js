const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create_room', ({ roomCode, teacherName, title }) => {
        socket.join(roomCode);
        rooms[roomCode] = {
            teacherId: socket.id,
            teacherName,
            title,
            latestNotice: null,
            latestFrame: null,
            history: []
        };
        socket.emit('room_created', { roomCode, title });
    });

    socket.on('join_room', ({ roomCode, nickname }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('join_error', '존재하지 않는 참여 코드입니다. 선생님께 6자리 코드를 다시 확인해 주세요.');
            return;
        }

        socket.join(roomCode);
        socket.emit('join_success', {
            roomCode,
            title: room.title,
            latestNotice: room.latestNotice,
            latestFrame: room.latestFrame,
            history: room.history
        });

        io.to(roomCode).emit('system_message', `${nickname} 학생이 수업에 입장했습니다.`);
    });

    socket.on('stream_frame', ({ roomCode, frame }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].latestFrame = frame;
            socket.to(roomCode).emit('stream_frame', { frame });
        }
    });

    socket.on('live_event', (payload) => {
        const { roomCode, type } = payload;
        const room = rooms[roomCode];
        if (!room) return;

        if (type === 'notice') {
            room.latestNotice = payload.message;
        }

        if (type === 'chat' || type === 'donation' || type === 'notice') {
            room.history.push(payload);
            if (room.history.length > 50) room.history.shift();
        }

        io.to(roomCode).emit('live_event', payload);
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
