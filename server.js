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
    // 선생님 방 개설
    socket.on('create_room', ({ roomCode, teacherName, title }) => {
        socket.join(roomCode);
        rooms[roomCode] = {
            teacherId: socket.id,
            teacherName,
            title,
            subscribers: 124,
            likes: 0
        };
        socket.emit('room_created', { roomCode, title, subscribers: 124, likes: 0 });
    });

    // 학생 방 입장 (6자리 참여 코드 확실한 매칭)
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
            likes: room.likes
        });

        io.to(roomCode).emit('system_message', nickname + ' 학생이 수업에 입장했습니다.');
    });

    // 실시간 카메라 및 화면 스트리밍 프레임
    socket.on('stream_frame', ({ roomCode, frame }) => {
        socket.to(roomCode).emit('stream_frame', { frame });
    });

    // 스마트 칠판 드로잉 동기화
    socket.on('whiteboard_draw', ({ roomCode, drawData }) => {
        socket.to(roomCode).emit('whiteboard_draw', drawData);
    });

    // 실시간 라이브 채팅 및 비밀채팅
    socket.on('send_chat', ({ roomCode, sender, message, icon, isSecret }) => {
        io.to(roomCode).emit('new_chat', { sender, message, icon, isSecret });
    });

    // 구독 및 좋아요 업데이트
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

    // 공지 및 후원 이벤트
    socket.on('live_event', (payload) => {
        const { roomCode } = payload;
        io.to(roomCode).emit('live_event', payload);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Live Studio Server running on port ' + PORT);
});
