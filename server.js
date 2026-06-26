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

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// Хранилище
const users = {};
const chatHistory = { 'main': [] };
const privateChats = {};
const moderations = { bans: {}, warnings: {}, roles: {} };

function getPrivateChatKey(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
}

io.on('connection', (socket) => {
    console.log('🟢 Подключен:', socket.id);

    socket.on('register', (data) => {
        const { nick, username, avatar, status, bio, banner, color } = data;
        
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

        if (!moderations.roles[socket.id]) {
            moderations.roles[socket.id] = 'user';
        }

        // Отправляем всем обновленные списки
        io.emit('onlineUsers', users);
        io.emit('userProfiles', users);
        io.emit('userRoles', moderations.roles);

        // Отправляем историю общего чата
        socket.emit('chatHistory', {
            chatId: 'main',
            messages: chatHistory['main'] || []
        });

        // Отправляем историю личных чатов
        for (const [key, messages] of Object.entries(privateChats)) {
            if (key.includes(socket.id)) {
                socket.emit('chatHistory', {
                    chatId: key,
                    messages: messages
                });
            }
        }

        console.log(`👤 ${nick} (@${username}) подключился`);
    });

    socket.on('sendMessage', (msgData) => {
        const { chatId, message, nick, username, avatar, senderId, targetUserId, media } = msgData;
        
        if (moderations.bans[socket.id]) {
            socket.emit('banned', moderations.bans[socket.id]);
            return;
        }

        const msg = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            senderId: socket.id,
            nick: nick || users[socket.id]?.nick || 'Гость',
            username: username || users[socket.id]?.username || 'гость',
            avatar: avatar || users[socket.id]?.avatar || '👤',
            message: message || '',
            timestamp: new Date().toISOString(),
            media: media || null
        };

        // ОБЩИЙ ЧАТ
        if (chatId === 'main') {
            if (!chatHistory['main']) chatHistory['main'] = [];
            chatHistory['main'].push(msg);
            if (chatHistory['main'].length > 1000) {
                chatHistory['main'] = chatHistory['main'].slice(-1000);
            }
            io.emit('newMessage', { ...msg, chatId: 'main' });
            console.log(`📨 ${msg.nick} -> общий чат: ${msg.message.substring(0, 30)}`);
        }

        // ЛИЧНЫЙ ЧАТ
        else if (chatId.startsWith('dm_')) {
            // Получаем ID получателя
            const parts = chatId.split('_');
            const targetId = parts[1] === socket.id ? parts[2] : parts[1];
            
            if (!users[targetId]) {
                socket.emit('notification', '❌ Пользователь не найден');
                return;
            }

            const chatKey = getPrivateChatKey(socket.id, targetId);
            
            if (!privateChats[chatKey]) {
                privateChats[chatKey] = [];
            }
            privateChats[chatKey].push(msg);
            if (privateChats[chatKey].length > 1000) {
                privateChats[chatKey] = privateChats[chatKey].slice(-1000);
            }

            // Отправляем отправителю
            socket.emit('newMessage', { ...msg, chatId: chatKey });
            
            // Отправляем получателю
            if (users[targetId]) {
                io.to(targetId).emit('newMessage', { ...msg, chatId: chatKey });
                console.log(`📨 ${msg.nick} -> ${users[targetId].nick}: ${msg.message.substring(0, 30)}`);
            } else {
                console.log(`📨 ${msg.nick} -> офлайн: ${msg.message.substring(0, 30)}`);
            }
        }
    });

    socket.on('getChatHistory', ({ chatId }) => {
        if (chatId === 'main') {
            socket.emit('chatHistory', {
                chatId: 'main',
                messages: chatHistory['main'] || []
            });
        } else if (chatId.startsWith('dm_') && chatId.includes(socket.id)) {
            socket.emit('chatHistory', {
                chatId: chatId,
                messages: privateChats[chatId] || []
            });
        }
    });

    socket.on('updateProfile', (data) => {
        if (users[socket.id]) {
            users[socket.id] = { ...users[socket.id], ...data };
            io.emit('onlineUsers', users);
            io.emit('userProfiles', users);
        }
    });

    // Модерация
    socket.on('moderation:searchUser', ({ query }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', '⛔ Нет прав');
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
        if (moderations.roles[socket.id] !== 'admin') return;
        if (!users[targetId]) return;
        if (!moderations.warnings[targetId]) {
            moderations.warnings[targetId] = [];
        }
        moderations.warnings[targetId].push({
            moderator: socket.id,
            reason: reason || 'Нарушение правил',
            timestamp: new Date().toISOString()
        });
        const count = moderations.warnings[targetId].length;
        io.to(targetId).emit('notification', `⚠️ Предупреждение (${count}/3)`);
        if (count >= 3) {
            moderations.bans[targetId] = {
                reason: 'Автобан (3 предупреждения)',
                moderator: 'system',
                timestamp: new Date().toISOString(),
                until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };
            io.to(targetId).emit('banned', moderations.bans[targetId]);
            setTimeout(() => io.to(targetId).disconnectSockets(true), 1000);
        }
    });

    socket.on('moderation:ban', ({ targetId, reason, banIP }) => {
        if (moderations.roles[socket.id] !== 'admin') return;
        if (!users[targetId]) return;
        moderations.bans[targetId] = {
            reason: reason || 'Нарушение правил',
            moderator: socket.id,
            timestamp: new Date().toISOString(),
            until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ip: banIP ? users[targetId].ip : null
        };
        io.to(targetId).emit('banned', moderations.bans[targetId]);
        setTimeout(() => io.to(targetId).disconnectSockets(true), 1000);
    });

    socket.on('moderation:unban', ({ targetId }) => {
        if (moderations.roles[socket.id] !== 'admin') return;
        if (!moderations.bans[targetId]) return;
        delete moderations.bans[targetId];
        socket.emit('notification', '✅ Пользователь разбанен');
    });

    socket.on('claimAdmin', ({ key }) => {
        if (key === 'bober_admin_2024') {
            moderations.roles[socket.id] = 'admin';
            socket.emit('roleChanged', { role: 'admin' });
            io.emit('userRoles', moderations.roles);
            socket.emit('notification', '👑 Вы администратор!');
        }
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            console.log(`🔴 ${users[socket.id].nick} отключился`);
            delete users[socket.id];
            io.emit('onlineUsers', users);
            io.emit('userProfiles', users);
            io.emit('userDisconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
