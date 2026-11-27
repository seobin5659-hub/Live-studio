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
            likes: 0
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
            likes: room.likes
        });

        io.to(roomCode).emit('system_message', nickname + ' 학생이 수업에 입장했습니다.');
    });

    socket.on('stream_frame', ({ roomCode, frame }) => {
        socket.to(roomCode).emit('stream_frame', { frame });
    });

    socket.on('whiteboard_draw', ({ roomCode, drawData }) => {
        socket.to(roomCode).emit('whiteboard_draw', drawData);
    });

    socket.on('send_chat', ({ roomCode, sender, message, icon }) => {
        io.to(roomCode).emit('new_chat', { sender, message, icon });
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
    console.log('Server running on port ' + PORT);
});
```eof

에러 로그를 보니 `server.js` 파일 맨 끝부분이 잘리거나 문법 오류(`SyntaxError: Unexpected end of input`)가 발생했습니다! 위 코드를 깃허브의 **`server.js`** 파일에 전체 복사해서 덮어씌워 주시면 이제 에러 없이 정상적으로 포트 바인딩이 완료될 것입니다.
