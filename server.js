const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ ПРОСТОЕ ХРАНИЛИЩЕ ============
let messages = [];
let users = {};

io.on('connection', (socket) => {
    console.log('🟢 Подключен:', socket.id);

    // Регистрация пользователя
    socket.on('register', (data) => {
        const nick = data.nick || 'Гость';
        socket.data.nick = nick;
        socket.data.avatar = data.avatar || '👤';
        socket.data.username = data.username || 'гость';
        
        users[socket.id] = {
            nick: nick,
            avatar: socket.data.avatar,
            username: socket.data.username
        };
        
        console.log(`👤 ${nick} зарегистрирован`);
        
        // Отправляем историю
        socket.emit('chatHistory', messages);
        
        // Обновляем список пользователей
        io.emit('onlineUsers', users);
    });

    // Получение сообщения
    socket.on('sendMessage', (data) => {
        console.log('📨 Сообщение от', socket.data.nick, ':', data.message);
        
        const msgData = {
            id: Date.now().toString(),
            nick: socket.data.nick || 'Гость',
            avatar: socket.data.avatar || '👤',
            message: data.message || '',
            timestamp: new Date().toISOString()
        };
        
        messages.push(msgData);
        
        // Отправляем всем
        io.emit('newMessage', msgData);
    });

    // Отключение
    socket.on('disconnect', () => {
        console.log('🔴 Отключен:', socket.id);
        delete users[socket.id];
        io.emit('onlineUsers', users);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
