const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// Хранилище данных
const users = {};
const chatHistory = {
    'main': []
};
const privateChats = {};
const moderations = {
    bans: {},
    warnings: {},
    roles: {}
};

// Обработка подключений
io.on('connection', (socket) => {
    console.log('🟢 Пользователь подключен:', socket.id);

    // Регистрация пользователя
    socket.on('register', (data) => {
        const { nick, username, avatar, status, bio, banner, color } = data;
        
        // Проверка на уникальность юзернейма
        const existingUser = Object.values(users).find(u => 
            u.username === username && u.socketId !== socket.id
        );
        
        if (existingUser) {
            socket.emit('usernameTaken', { username });
            return;
        }

        users[socket.id] = {
            socketId: socket.id,
            nick: nick || 'Гость',
            username: username || 'гость',
            avatar: avatar || '👤',
            status: status || 'В сети',
            bio: bio || '',
            banner: banner || '',
            color: color || '#f093fb',
            ip: socket.handshake.address
        };

        // Применяем роль (если есть)
        if (!moderations.roles[socket.id]) {
            moderations.roles[socket.id] = 'user';
        }

        // Отправляем список пользователей
        io.emit('onlineUsers', users);
        io.emit('userProfiles', users);
        io.emit('userRoles', moderations.roles);

        // Отправляем историю чата
        socket.emit('chatHistory', {
            chatId: 'main',
            messages: chatHistory['main'] || []
        });

        console.log(`👤 ${nick} (@${username}) подключился`);
    });

    // Отправка сообщения
    socket.on('sendMessage', (msgData) => {
        const { chatId, message, nick, username, avatar, senderId, targetUserId, media } = msgData;
        
        const msg = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            senderId: socket.id,
            nick: nick,
            username: username,
            avatar: avatar,
            message: message,
            timestamp: new Date().toISOString(),
            media: media || null
        };

        if (chatId === 'main') {
            // Общий чат
            if (!chatHistory['main']) chatHistory['main'] = [];
            chatHistory['main'].push(msg);
            // Ограничиваем историю
            if (chatHistory['main'].length > 1000) {
                chatHistory['main'] = chatHistory['main'].slice(-1000);
            }
            io.emit('newMessage', { ...msg, chatId: 'main' });
        } else if (chatId.startsWith('dm_')) {
            // Личные сообщения
            const targetId = chatId.replace('dm_', '');
            const chatKey = `dm_${[socket.id, targetId].sort().join('_')}`;
            
            if (!privateChats[chatKey]) {
                privateChats[chatKey] = [];
            }
            privateChats[chatKey].push(msg);
            
            // Отправляем отправителю и получателю
            io.to(socket.id).emit('newMessage', { ...msg, chatId });
            if (users[targetId]) {
                io.to(targetId).emit('newMessage', { ...msg, chatId });
            }
        }
    });

    // Получение истории чата
    socket.on('getChatHistory', ({ chatId }) => {
        if (chatId === 'main') {
            socket.emit('chatHistory', {
                chatId: 'main',
                messages: chatHistory['main'] || []
            });
        } else if (chatId.startsWith('dm_')) {
            const chatKey = `dm_${[socket.id, chatId.replace('dm_', '')].sort().join('_')}`;
            socket.emit('chatHistory', {
                chatId,
                messages: privateChats[chatKey] || []
            });
        }
    });

    // Обновление профиля
    socket.on('updateProfile', (data) => {
        if (users[socket.id]) {
            users[socket.id] = { ...users[socket.id], ...data };
            io.emit('onlineUsers', users);
            io.emit('userProfiles', users);
        }
    });

    // ===== МОДЕРАЦИЯ =====
    socket.on('moderation:searchUser', ({ query }) => {
        // Только для админов
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', 'У вас нет прав администратора');
            return;
        }

        const results = Object.values(users).filter(u => {
            const search = query.toLowerCase();
            return u.nick.toLowerCase().includes(search) ||
                   u.username.toLowerCase().includes(search);
        });

        socket.emit('moderation:searchResults', results.map(u => ({
            ...u,
            isBanned: !!moderations.bans[u.socketId]
        })));
    });

    socket.on('moderation:warn', ({ targetId, reason }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', 'У вас нет прав администратора');
            return;
        }

        if (!users[targetId]) {
            socket.emit('notification', 'Пользователь не найден');
            return;
        }

        if (!moderations.warnings[targetId]) {
            moderations.warnings[targetId] = [];
        }
        moderations.warnings[targetId].push({
            moderator: socket.id,
            reason: reason || 'Нарушение правил',
            timestamp: new Date().toISOString()
        });

        // Уведомляем пользователя
        io.to(targetId).emit('notification', `⚠️ Вы получили предупреждение: ${reason || 'Нарушение правил'}`);
        io.to(socket.id).emit('notification', `✅ Предупреждение выдано пользователю ${users[targetId].nick}`);
        
        console.log(`⚠️ ${users[socket.id].nick} выдал предупреждение ${users[targetId].nick}: ${reason}`);
    });

    socket.on('moderation:ban', ({ targetId, reason, banIP }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', 'У вас нет прав администратора');
            return;
        }

        if (!users[targetId]) {
            socket.emit('notification', 'Пользователь не найден');
            return;
        }

        const banData = {
            reason: reason || 'Нарушение правил',
            moderator: socket.id,
            timestamp: new Date().toISOString(),
            until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ip: banIP ? users[targetId].ip : null
        };

        moderations.bans[targetId] = banData;

        // Отключаем пользователя
        io.to(targetId).emit('banned', banData);
        
        setTimeout(() => {
            io.to(targetId).disconnectSockets(true);
        }, 1000);

        io.to(socket.id).emit('notification', `✅ Пользователь ${users[targetId].nick} забанен до ${new Date(banData.until).toLocaleString()}`);
        console.log(`🚫 ${users[socket.id].nick} забанил ${users[targetId].nick}: ${reason}`);
    });

    socket.on('moderation:unban', ({ targetId }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', 'У вас нет прав администратора');
            return;
        }

        if (!moderations.bans[targetId]) {
            socket.emit('notification', 'Пользователь не забанен');
            return;
        }

        delete moderations.bans[targetId];
        io.to(socket.id).emit('notification', `✅ Пользователь разбанен`);
        console.log(`🔓 ${users[socket.id].nick} разбанил пользователя`);
    });

    // ===== ОТКЛЮЧЕНИЕ =====
    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log(`🔴 ${users[socket.id].nick} отключился`);
            delete users[socket.id];
            io.emit('onlineUsers', users);
            io.emit('userProfiles', users);
            io.emit('userDisconnected', socket.id);
        }
    });

    // ===== АДМИН КЛЮЧ =====
    socket.on('claimAdmin', ({ key }) => {
        const ADMIN_KEY = 'bober_admin_2024';
        
        if (key === ADMIN_KEY) {
            moderations.roles[socket.id] = 'admin';
            socket.emit('roleChanged', { role: 'admin' });
            io.emit('userRoles', moderations.roles);
            socket.emit('notification', '👑 Вы стали администратором!');
            console.log(`👑 ${users[socket.id]?.nick} стал администратором`);
        } else {
            socket.emit('notification', '❌ Неверный ключ');
        }
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
