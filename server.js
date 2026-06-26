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

        io.emit('onlineUsers', users);
        io.emit('userProfiles', users);
        io.emit('userRoles', moderations.roles);

        socket.emit('chatHistory', {
            chatId: 'main',
            messages: chatHistory['main'] || []
        });

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

// ============ ЛИЧНЫЕ ЧАТЫ ============
function openPrivateChat(userId) {
    const userData = findUserById(userId);
    if (!userData) {
        alert('Пользователь не найден!');
        return;
    }
    const profile = userData.profile;
    const chatId = 'dm_' + userId;
    
    console.log('💬 Открываем ЛС с:', userId, 'чат:', chatId);
    
    // Проверяем, существует ли уже такой чат в списке
    let existingItem = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (existingItem) { 
        switchChat(chatId); 
        return; 
    }
    
    // Создаем новый чат в списке
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.chat = chatId;
    chatItem.innerHTML = `
        <i class="fas fa-user"></i>
        <span class="chat-name">${profile.nick || 'Пользователь'}</span>
        <span class="chat-badge">0</span>
        <button class="chat-close" title="Закрыть чат"><i class="fas fa-times"></i></button>
    `;
    chatList.appendChild(chatItem);
    
    // Закрытие чата
    const closeBtn = chatItem.querySelector('.chat-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePrivateChat(chatId);
    });
    
    // Переключение на чат
    chatItem.addEventListener('click', () => switchChat(chatId));
    
    // Сохраняем в список приватных чатов
    privateChats[userId] = chatId;
    if (!chatHistory[chatId]) {
        chatHistory[chatId] = [];
        console.log('📁 Создана история для чата:', chatId);
    }
    
    // Загружаем историю с сервера
    socket.emit('getChatHistory', { chatId: chatId });
    
    // Переключаемся на новый чат
    switchChat(chatId);
}

function closePrivateChat(chatId) {
    const item = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (item) item.remove();
    for (const [userId, id] of Object.entries(privateChats)) {
        if (id === chatId) { delete privateChats[userId]; break; }
    }
    if (currentChat === chatId) switchChat('main');
}

// ============ ПЕРЕКЛЮЧЕНИЕ ЧАТОВ ============
function switchChat(chatId) {
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chat === chatId);
    });
    currentChat = chatId;
    
    let title = 'Общий чат';
    if (chatId.startsWith('dm_')) {
        const userId = chatId.replace('dm_', '');
        const userData = findUserById(userId);
        if (userData) title = `Личный чат с ${userData.profile.nick || 'пользователем'}`;
    }
    chatTitleEl.textContent = title;
    
    // Очищаем окно чата
    chatWindow.innerHTML = '';
    
    // Загружаем историю
    if (chatId === 'main') {
        socket.emit('getChatHistory', { chatId: 'main' });
    } else if (chatId.startsWith('dm_')) {
        // Сначала показываем локальную историю
        if (chatHistory[chatId] && chatHistory[chatId].length > 0) {
            console.log('📜 Загрузка локальной истории для', chatId, 'сообщений:', chatHistory[chatId].length);
            chatHistory[chatId].forEach(msg => {
                const div = createMessageElement(msg);
                chatWindow.appendChild(div);
            });
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            // Если локальной истории нет, запрашиваем с сервера
            console.log('📡 Запрос истории с сервера для', chatId);
            socket.emit('getChatHistory', { chatId: chatId });
        }
    }
    
    // Сбрасываем бейдж
    const badge = document.querySelector(`.chat-item[data-chat="${chatId}"] .chat-badge`);
    if (badge) badge.textContent = '0';
}

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
