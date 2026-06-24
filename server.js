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

// ============ ХРАНИЛИЩЕ ============
let messages = { main: [] };
let callRooms = {};
let userProfiles = {};
let userRoles = {};
let userWarnings = {};
let bannedUsers = {};
let bannedIPs = {};
let usedUsernames = {};
let moderationLog = [];
let userIPs = {};
let activeUsers = {};

const ROLES = {
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    USER: 'user'
};

const SETTINGS = {
    maxWarnings: 3,
    banDuration: 24 * 60 * 60 * 1000,
    adminKey: 'bober_admin_2024'
};

function getUserRole(socketId) {
    return userRoles[socketId] || ROLES.USER;
}

function isAdmin(socketId) {
    return getUserRole(socketId) === ROLES.ADMIN;
}

function isModerator(socketId) {
    const role = getUserRole(socketId);
    return role === ROLES.ADMIN || role === ROLES.MODERATOR;
}

function isBanned(socketId) {
    if (!bannedUsers[socketId]) return false;
    const ban = bannedUsers[socketId];
    if (ban.until && Date.now() > ban.until) {
        delete bannedUsers[socketId];
        return false;
    }
    return true;
}

function isIPBanned(ip) {
    return !!bannedIPs[ip];
}

function logModerationAction(action, moderator, target, reason) {
    moderationLog.push({
        action,
        moderator,
        target,
        reason,
        timestamp: new Date().toISOString()
    });
    if (moderationLog.length > 1000) moderationLog.shift();
}

function banUser(socketId, reason, moderator, banIP = false) {
    if (!socketId) return;
    if (isAdmin(socketId)) {
        io.to(socketId).emit('notification', '❌ Нельзя забанить администратора');
        return;
    }
    
    const user = userProfiles[socketId];
    const nick = user?.nick || 'Неизвестный';
    const ip = userIPs[socketId];
    
    bannedUsers[socketId] = {
        reason: reason || 'Нарушение правил',
        until: Date.now() + SETTINGS.banDuration
    };
    
    if (banIP && ip) {
        bannedIPs[ip] = reason || 'Нарушение правил';
    }
    
    logModerationAction('Бан', moderator || 'Система', nick, reason + (banIP ? ' (IP забанен)' : ''));
    io.emit('moderationLog', moderationLog);
    io.emit('bannedUsers', bannedUsers);
    
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
        socket.emit('banned', { reason: reason, until: bannedUsers[socketId].until });
        socket.disconnect();
    }
    
    io.emit('onlineUsers', getOnlineUsers());
    io.emit('notification', `🔒 ${nick} был забанен. Причина: ${reason}`);
}

function unbanUser(socketId, moderator) {
    if (!bannedUsers[socketId]) return;
    const user = userProfiles[socketId];
    const nick = user?.nick || 'Неизвестный';
    const ip = userIPs[socketId];
    
    delete bannedUsers[socketId];
    delete userWarnings[socketId];
    if (ip) delete bannedIPs[ip];
    
    logModerationAction('Разбан', moderator || 'Система', nick, '');
    io.emit('moderationLog', moderationLog);
    io.emit('bannedUsers', bannedUsers);
    io.emit('userWarnings', userWarnings);
    io.emit('notification', `✅ ${nick} был разбанен`);
}

function addWarning(socketId) {
    if (!userWarnings[socketId]) userWarnings[socketId] = 0;
    userWarnings[socketId]++;
    const warnings = userWarnings[socketId];
    io.emit('userWarnings', userWarnings);
    if (warnings >= SETTINGS.maxWarnings) {
        banUser(socketId, 'Превышено количество предупреждений (3)', 'Система');
        io.to(socketId).emit('notification', '⚠️ Вы забанены за превышение предупреждений');
    } else {
        io.to(socketId).emit('notification', `⚠️ Предупреждение ${warnings}/${SETTINGS.maxWarnings}`);
    }
}

io.on('connection', (socket) => {
    // Получаем реальный IP
    const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
    userIPs[socket.id] = clientIP;
    
    console.log('🟢 Подключен:', socket.id, 'IP:', clientIP);

    // Проверка на IP-бан
    if (isIPBanned(clientIP)) {
        socket.emit('banned', { reason: bannedIPs[clientIP] || 'Ваш IP забанен', until: Date.now() + 86400000 });
        socket.disconnect();
        return;
    }

    // Проверка на бан пользователя
    if (isBanned(socket.id)) {
        socket.emit('banned', { reason: bannedUsers[socket.id]?.reason || 'Вы забанены', until: bannedUsers[socket.id]?.until });
        socket.disconnect();
        return;
    }

    socket.on('register', (data) => {
        console.log('📝 Регистрация:', data);
        
        // Проверка данных
        const username = (data.username || 'гость').toLowerCase().replace(/[^a-z0-9_]/g, '');
        const nick = data.nick || 'Гость';
        
        // Проверка на занятость юзернейма
        if (usedUsernames[username] && usedUsernames[username] !== socket.id) {
            socket.emit('notification', '❌ Этот юзернейм уже занят!');
            socket.emit('usernameTaken', { username: username });
            return;
        }
        
        // Регистрируем юзернейм
        if (usedUsernames[username] === socket.id || !usedUsernames[username]) {
            usedUsernames[username] = socket.id;
        }
        
        // Сохраняем данные пользователя
        socket.data.nick = nick;
        socket.data.username = username;
        socket.data.avatar = data.avatar || '👤';
        socket.data.status = data.status || 'В сети';
        socket.data.bio = data.bio || '';
        socket.data.banner = data.banner || '';
        socket.data.color = data.color || '#f093fb';
        socket.data.ip = clientIP;
        socket.data.registered = true;
        
        // Назначаем роль
        if (!userRoles[socket.id]) {
            const sockets = io.sockets.sockets;
            const existingUsers = Array.from(sockets.keys()).filter(id => id !== socket.id);
            // Проверяем, есть ли уже админы
            let hasAdmin = false;
            for (const id of existingUsers) {
                if (userRoles[id] === ROLES.ADMIN) {
                    hasAdmin = true;
                    break;
                }
            }
            if (!hasAdmin) {
                userRoles[socket.id] = ROLES.ADMIN;
                socket.emit('roleChanged', { role: ROLES.ADMIN });
                console.log(`👑 ${nick} стал первым админом!`);
            } else {
                userRoles[socket.id] = ROLES.USER;
            }
        }
        
        userProfiles[socket.id] = {
            nick: nick,
            username: username,
            avatar: socket.data.avatar,
            status: socket.data.status,
            bio: socket.data.bio,
            banner: socket.data.banner,
            color: socket.data.color,
            role: userRoles[socket.id],
            ip: clientIP
        };
        
        activeUsers[socket.id] = {
            nick: nick,
            username: username,
            connected: true
        };
        
        console.log(`👤 ${nick} (@${username}) зарегистрирован [${userRoles[socket.id]}] IP: ${clientIP}`);
        
        // Отправляем данные всем
        io.emit('onlineUsers', getOnlineUsers());
        io.emit('userProfiles', userProfiles);
        io.emit('userRoles', userRoles);
        io.emit('moderationLog', moderationLog);
        io.emit('bannedUsers', bannedUsers);
        
        // Подключаем к чату
        socket.join('main');
        if (messages['main']) {
            socket.emit('chatHistory', { chatId: 'main', messages: messages['main'] });
        }
    });

    socket.on('claimAdmin', (key) => {
        if (key === SETTINGS.adminKey) {
            userRoles[socket.id] = ROLES.ADMIN;
            socket.emit('roleChanged', { role: ROLES.ADMIN });
            io.emit('userRoles', userRoles);
            io.emit('onlineUsers', getOnlineUsers());
            logModerationAction('Повышение до админа', socket.data.nick || 'Неизвестный', socket.data.nick || 'Неизвестный', 'Через ключ');
            socket.emit('notification', 'Вы стали администратором! 👑');
        } else {
            socket.emit('notification', 'Неверный ключ администратора');
        }
    });

    socket.on('joinChat', (chatId) => {
        if (isBanned(socket.id)) {
            socket.emit('banned', { reason: bannedUsers[socket.id]?.reason || 'Вы забанены' });
            return;
        }
        socket.join(chatId);
        socket.data.currentChat = chatId;
        console.log(`📌 ${socket.data.nick} присоединился к чату ${chatId}`);
        if (messages[chatId]) {
            socket.emit('chatHistory', { chatId: chatId, messages: messages[chatId] });
        } else {
            messages[chatId] = [];
            socket.emit('chatHistory', { chatId: chatId, messages: [] });
        }
    });

    socket.on('sendMessage', (data) => {
        console.log('📨 Получено сообщение от', socket.data.nick, ':', data);
        
        if (isBanned(socket.id)) {
            socket.emit('banned', { reason: bannedUsers[socket.id]?.reason || 'Вы забанены' });
            return;
        }
        
        if (!socket.data.registered) {
            console.log('⚠️ Пользователь не зарегистрирован');
            return;
        }
        
        try {
            const { chatId, message, media, targetUserId } = data;
            
            if (!message && !media) {
                console.log('⚠️ Пустое сообщение');
                return;
            }
            
            // Фильтр плохих слов
            const badWords = ['мат', 'ругательство', 'плохое_слово'];
            let filteredMessage = message || '';
            let isBad = false;
            badWords.forEach(word => {
                if (message && message.toLowerCase().includes(word.toLowerCase())) {
                    filteredMessage = filteredMessage.replace(new RegExp(word, 'gi'), '***');
                    isBad = true;
                }
            });
            if (isBad) {
                socket.emit('notification', '⚠️ Сообщение содержит запрещенные слова');
                addWarning(socket.id);
                return;
            }
            
            const msgData = {
                id: Date.now().toString(),
                chatId: chatId || 'main',
                senderId: socket.id,
                nick: socket.data.nick || 'Гость',
                username: socket.data.username || '',
                message: filteredMessage,
                avatar: socket.data.avatar || '👤',
                media_url: media?.url || null,
                media_type: media?.type || null,
                created_at: new Date().toISOString(),
                isDeleted: false
            };
            
            console.log('📨 Сохранение сообщения:', msgData);
            
            if (!messages[chatId]) messages[chatId] = [];
            messages[chatId].push(msgData);
            
            console.log(`📨 Отправка в чат ${chatId}`);
            io.to(chatId).emit('newMessage', msgData);
            
            if (targetUserId && chatId.startsWith('dm_')) {
                console.log(`📨 Отправка личного сообщения пользователю ${targetUserId}`);
                io.to(targetUserId).emit('newMessage', msgData);
            }
        } catch (err) {
            console.error('❌ Ошибка отправки:', err);
            socket.emit('error', 'Не удалось отправить сообщение');
        }
    });

    // ============ МОДЕРАЦИЯ ============
    socket.on('moderation:warn', (data) => {
        if (!isModerator(socket.id)) { socket.emit('notification', '❌ Нет прав'); return; }
        if (isAdmin(data.targetId)) { socket.emit('notification', '❌ Нельзя предупредить админа'); return; }
        addWarning(data.targetId);
        logModerationAction('Предупреждение', socket.data.nick || 'Модератор', userProfiles[data.targetId]?.nick || 'Неизвестный', data.reason || 'Нарушение');
        io.emit('moderationLog', moderationLog);
        io.emit('userWarnings', userWarnings);
        socket.emit('notification', '✅ Предупреждение выдано');
    });

    socket.on('moderation:ban', (data) => {
        if (!isModerator(socket.id)) { socket.emit('notification', '❌ Нет прав'); return; }
        if (isAdmin(data.targetId)) { socket.emit('notification', '❌ Нельзя забанить админа'); return; }
        banUser(data.targetId, data.reason || 'Нарушение правил', socket.data.nick || 'Модератор', data.banIP || false);
        io.emit('bannedUsers', bannedUsers);
        socket.emit('notification', '✅ Пользователь забанен');
    });

    socket.on('moderation:unban', (data) => {
        if (!isModerator(socket.id)) { socket.emit('notification', '❌ Нет прав'); return; }
        unbanUser(data.targetId, socket.data.nick || 'Модератор');
        socket.emit('notification', '✅ Пользователь разбанен');
    });

    socket.on('moderation:getLogs', () => {
        if (!isModerator(socket.id)) { socket.emit('notification', '❌ Нет прав'); return; }
        socket.emit('moderationLog', moderationLog);
    });

    socket.on('moderation:searchUser', (data) => {
        if (!isModerator(socket.id)) { socket.emit('notification', '❌ Нет прав'); return; }
        const query = data.query.toLowerCase().trim();
        const results = [];
        for (const [id, profile] of Object.entries(userProfiles)) {
            const nick = (profile.nick || '').toLowerCase();
            const username = (profile.username || '').toLowerCase();
            if (nick.includes(query) || username.includes(query)) {
                results.push({
                    socketId: id,
                    nick: profile.nick,
                    username: profile.username,
                    avatar: profile.avatar,
                    status: profile.status,
                    role: userRoles[id] || ROLES.USER,
                    isBanned: !!bannedUsers[id],
                    ip: userIPs[id] || 'unknown'
                });
            }
        }
        socket.emit('moderation:searchResults', results);
    });

    // ============ ЗВОНКИ ============
    socket.on('startCall', (data) => {
        if (isBanned(socket.id)) return;
        const { chatId } = data;
        const nick = socket.data.nick || 'Гость';
        if (callRooms[chatId] && callRooms[chatId].participants.length > 0) {
            socket.emit('error', 'Звонок уже активен');
            return;
        }
        callRooms[chatId] = {
            participants: [socket.id],
            startedBy: socket.id,
            startedByNick: nick
        };
        io.to(chatId).emit('callStarted', {
            chatId,
            startedBy: socket.id,
            startedByNick: nick,
            participants: callRooms[chatId].participants
        });
    });

    socket.on('joinCall', (data) => {
        if (isBanned(socket.id)) return;
        const { chatId } = data;
        const nick = socket.data.nick || 'Гость';
        if (callRooms[chatId]) {
            if (!callRooms[chatId].participants.includes(socket.id)) {
                callRooms[chatId].participants.push(socket.id);
            }
            io.to(chatId).emit('callParticipantJoined', {
                chatId,
                participantId: socket.id,
                nick,
                participants: callRooms[chatId].participants
            });
            socket.emit('callState', {
                chatId,
                participants: callRooms[chatId].participants,
                startedBy: callRooms[chatId].startedBy,
                startedByNick: callRooms[chatId].startedByNick
            });
        }
    });

    socket.on('leaveCall', (data) => {
        const { chatId } = data;
        const nick = socket.data.nick || 'Гость';
        if (callRooms[chatId]) {
            callRooms[chatId].participants = callRooms[chatId].participants.filter(id => id !== socket.id);
            io.to(chatId).emit('callParticipantLeft', {
                chatId,
                participantId: socket.id,
                nick,
                participants: callRooms[chatId].participants
            });
            if (callRooms[chatId].participants.length === 0) {
                io.to(chatId).emit('callEnded', { chatId });
                delete callRooms[chatId];
            }
        }
    });

    socket.on('endCall', (data) => {
        const { chatId } = data;
        if (callRooms[chatId] && callRooms[chatId].startedBy === socket.id) {
            io.to(chatId).emit('callEnded', { chatId });
            delete callRooms[chatId];
        } else {
            socket.emit('error', 'Только инициатор может завершить звонок');
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Отключен:', socket.id);
        const username = socket.data?.username;
        if (username && usedUsernames[username] === socket.id) {
            delete usedUsernames[username];
        }
        delete userProfiles[socket.id];
        delete userIPs[socket.id];
        delete activeUsers[socket.id];
        for (const chatId in callRooms) {
            if (callRooms[chatId].participants.includes(socket.id)) {
                callRooms[chatId].participants = callRooms[chatId].participants.filter(id => id !== socket.id);
                if (callRooms[chatId].participants.length === 0) {
                    io.to(chatId).emit('callEnded', { chatId });
                    delete callRooms[chatId];
                }
            }
        }
        io.emit('onlineUsers', getOnlineUsers());
        io.emit('userProfiles', userProfiles);
        io.emit('userRoles', userRoles);
        io.emit('bannedUsers', bannedUsers);
    });
});

function getOnlineUsers() {
    const users = {};
    const sockets = io.sockets.sockets;
    for (const [id, socket] of sockets) {
        if (socket.data && socket.data.nick && socket.data.registered) {
            users[id] = {
                socketId: id,
                nick: socket.data.nick,
                username: socket.data.username || '',
                avatar: socket.data.avatar || '👤',
                status: isBanned(id) ? 'Забанен' : (socket.data.status || 'В сети'),
                role: userRoles[id] || ROLES.USER,
                isBanned: isBanned(id)
            };
        }
    }
    return users;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`👑 Админ-ключ: ${SETTINGS.adminKey}`);
});
