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
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 1e8
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create_room', ({ roomCode, teacherName, title }) => {
        socket.join(roomCode);
        rooms[roomCode] = {
            teacherId: socket.id,
            teacherName,
            title,
            subscribers: 124,
            likes: 0,
            bgm: 'none',
            latestNotice: null,
            latestQuiz: null
        };
        socket.emit('room_created', { roomCode, title, subscribers: 124, likes: 0 });
    });

    socket.on('join_room', ({ roomCode, nickname }) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('join_error', '존재하지 않는 6자리 참여 코드입니다. 선생님께 코드를 다시 확인해 주세요.');
            return;
        }

        socket.join(roomCode);
        socket.emit('join_success', {
            roomCode,
            title: room.title,
            subscribers: room.subscribers,
            likes: room.likes,
            bgm: room.bgm,
            latestNotice: room.latestNotice,
            latestQuiz: room.latestQuiz
        });

        io.to(roomCode).emit('system_message', `${nickname} 학생이 수업에 입장했습니다.`);
    });

    socket.on('send_chat', ({ roomCode, sender, message, icon, isSecret }) => {
        io.to(roomCode).emit('new_chat', { sender, message, icon, isSecret });
    });

    socket.on('whiteboard_draw', ({ roomCode, drawData }) => {
        socket.to(roomCode).emit('whiteboard_draw', drawData);
    });

    socket.on('toggle_subscribe', ({ roomCode, subscribed }) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.subscribers += subscribed ? 1 : -1;
        io.to(roomCode).emit('stats_update', { subscribers: room.subscribers, likes: room.likes });
    });

    socket.on('add_like', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.likes += 1;
        io.to(roomCode).emit('stats_update', { subscribers: room.subscribers, likes: room.likes });
    });

    socket.on('teacher_quiz', ({ roomCode, quizData }) => {
        const room = rooms[roomCode];
        if (!room) return;
        room.latestQuiz = quizData;
        io.to(roomCode).emit('teacher_quiz', quizData);
    });

    socket.on('live_event', (payload) => {
        const { roomCode, type } = payload;
        const room = rooms[roomCode];
        if (!room) return;
        if (type === 'notice') room.latestNotice = payload.message;
        io.to(roomCode).emit('live_event', payload);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
