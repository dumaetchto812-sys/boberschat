const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

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
app.use(express.json());

// ============ БАЗА ДАННЫХ SQLITE ============
const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключен к SQLite базе данных');
    }
});

// Создаем таблицы
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        socket_id TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        nick TEXT NOT NULL,
        avatar TEXT DEFAULT '👤',
        status TEXT DEFAULT 'В сети',
        bio TEXT DEFAULT '',
        banner TEXT DEFAULT '',
        color TEXT DEFAULT '#f093fb',
        ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        nick TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT DEFAULT '👤',
        message TEXT NOT NULL,
        media TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        reason TEXT,
        moderator TEXT,
        until DATETIME,
        ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        moderator TEXT,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS roles (
        user_id TEXT PRIMARY KEY,
        role TEXT DEFAULT 'user'
    )
`);

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function getPrivateChatKey(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
}

function isUserOnline(userId) {
    return !!onlineUsers[userId];
}

// Хранилище онлайн-пользователей
const onlineUsers = {};
const onlineSockets = {};
const chatHistory = {};
const privateChats = {};
const moderations = { bans: {}, warnings: {}, roles: {} };

// Загружаем данные из БД при старте
function loadDataFromDB() {
    // Загружаем роли
    db.all('SELECT * FROM roles', (err, rows) => {
        if (!err && rows) {
            rows.forEach(row => {
                moderations.roles[row.user_id] = row.role;
            });
        }
    });

    // Загружаем баны
    db.all('SELECT * FROM bans WHERE until > datetime("now")', (err, rows) => {
        if (!err && rows) {
            rows.forEach(row => {
                moderations.bans[row.user_id] = {
                    reason: row.reason,
                    moderator: row.moderator,
                    until: row.until,
                    ip: row.ip
                };
            });
        }
    });

    // Загружаем предупреждения
    db.all('SELECT * FROM warnings', (err, rows) => {
        if (!err && rows) {
            rows.forEach(row => {
                if (!moderations.warnings[row.user_id]) {
                    moderations.warnings[row.user_id] = [];
                }
                moderations.warnings[row.user_id].push({
                    moderator: row.moderator,
                    reason: row.reason,
                    timestamp: row.created_at
                });
            });
        }
    });

    // Загружаем историю сообщений (последние 1000)
    db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 1000', (err, rows) => {
        if (!err && rows) {
            rows.reverse().forEach(row => {
                const chatId = row.chat_id;
                if (!chatHistory[chatId]) {
                    chatHistory[chatId] = [];
                }
                chatHistory[chatId].push({
                    id: row.id,
                    senderId: row.sender_id,
                    nick: row.nick,
                    username: row.username,
                    avatar: row.avatar,
                    message: row.message,
                    media: row.media ? JSON.parse(row.media) : null,
                    timestamp: row.timestamp
                });
            });
            console.log(`📜 Загружено ${rows.length} сообщений из БД`);
        }
    });
}

loadDataFromDB();

// ============ ОБРАБОТКА ПОДКЛЮЧЕНИЙ ============
io.on('connection', (socket) => {
    console.log('🟢 Подключен:', socket.id);
    onlineSockets[socket.id] = socket;

    // ============ РЕГИСТРАЦИЯ ============
    socket.on('register', (data) => {
        const { nick, username, avatar, status, bio, banner, color } = data;
        
        // Проверяем, существует ли пользователь в БД
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
            if (err) {
                socket.emit('notification', '❌ Ошибка базы данных');
                return;
            }

            // Если пользователь уже существует в БД, но не онлайн - загружаем его данные
            if (existingUser) {
                // Проверяем, не занят ли юзернейм другим онлайн-пользователем
                const isUsernameTaken = Object.values(onlineUsers).some(u => 
                    u.username === username && u.socketId !== socket.id
                );

                if (isUsernameTaken) {
                    socket.emit('usernameTaken', { username });
                    return;
                }

                // Обновляем данные в БД
                db.run(`
                    UPDATE users 
                    SET socket_id = ?, nick = ?, avatar = ?, status = ?, bio = ?, banner = ?, color = ?, ip = ?, last_seen = CURRENT_TIMESTAMP
                    WHERE username = ?
                `, [socket.id, nick, avatar, status, bio, banner, color, socket.handshake.address, username]);

                // Добавляем в онлайн
                onlineUsers[socket.id] = {
                    socketId: socket.id,
                    nick: existingUser.nick || nick,
                    username: existingUser.username,
                    avatar: existingUser.avatar || avatar,
                    status: existingUser.status || status,
                    bio: existingUser.bio || bio,
                    banner: existingUser.banner || banner,
                    color: existingUser.color || color,
                    ip: socket.handshake.address
                };

                // Загружаем роль
                db.get('SELECT role FROM roles WHERE user_id = ?', [username], (err, roleRow) => {
                    if (!err && roleRow) {
                        moderations.roles[socket.id] = roleRow.role;
                    } else {
                        moderations.roles[socket.id] = 'user';
                        db.run('INSERT OR IGNORE INTO roles (user_id, role) VALUES (?, ?)', [username, 'user']);
                    }
                    sendUserData(socket);
                });

                console.log(`👤 ${nick} (@${username}) вошел (существующий пользователь)`);
                return;
            }

            // Новый пользователь - проверяем уникальность юзернейма
            db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    socket.emit('notification', '❌ Ошибка базы данных');
                    return;
                }

                if (row) {
                    socket.emit('usernameTaken', { username });
                    return;
                }

                // Сохраняем нового пользователя в БД
                db.run(`
                    INSERT INTO users (socket_id, username, nick, avatar, status, bio, banner, color, ip)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [socket.id, username, nick, avatar, status, bio, banner, color, socket.handshake.address], function(err) {
                    if (err) {
                        socket.emit('notification', '❌ Ошибка при регистрации');
                        return;
                    }

                    // Добавляем роль по умолчанию
                    db.run('INSERT INTO roles (user_id, role) VALUES (?, ?)', [username, 'user']);

                    // Добавляем в онлайн
                    onlineUsers[socket.id] = {
                        socketId: socket.id,
                        nick: nick,
                        username: username,
                        avatar: avatar,
                        status: status,
                        bio: bio,
                        banner: banner,
                        color: color,
                        ip: socket.handshake.address
                    };
                    moderations.roles[socket.id] = 'user';

                    sendUserData(socket);
                    console.log(`👤 ${nick} (@${username}) зарегистрировался`);
                });
            });
        });
    });

    function sendUserData(socket) {
        // Отправляем списки
        io.emit('onlineUsers', onlineUsers);
        io.emit('userProfiles', onlineUsers);
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
    }

    // ============ ОТПРАВКА СООБЩЕНИЯ ============
    socket.on('sendMessage', (msgData) => {
        const { chatId, message, nick, username, avatar, senderId, targetUserId, media } = msgData;
        
        if (moderations.bans[socket.id]) {
            socket.emit('banned', moderations.bans[socket.id]);
            return;
        }

        const msg = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            senderId: socket.id,
            nick: nick || onlineUsers[socket.id]?.nick || 'Гость',
            username: username || onlineUsers[socket.id]?.username || 'гость',
            avatar: avatar || onlineUsers[socket.id]?.avatar || '👤',
            message: message || '',
            timestamp: new Date().toISOString(),
            media: media || null
        };

        // Сохраняем в БД
        const mediaStr = media ? JSON.stringify(media) : null;
        db.run(`
            INSERT INTO messages (chat_id, sender_id, nick, username, avatar, message, media)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [chatId, socket.id, msg.nick, msg.username, msg.avatar, msg.message, mediaStr]);

        // ===== ОБЩИЙ ЧАТ =====
        if (chatId === 'main') {
            if (!chatHistory['main']) {
                chatHistory['main'] = [];
            }
            chatHistory['main'].push(msg);
            if (chatHistory['main'].length > 1000) {
                chatHistory['main'] = chatHistory['main'].slice(-1000);
            }
            io.emit('newMessage', { ...msg, chatId: 'main' });
            console.log(`📨 ${msg.nick} -> общий чат: ${msg.message.substring(0, 30)}`);
        }

        // ===== ЛИЧНЫЙ ЧАТ =====
        else if (chatId && chatId.startsWith('dm_')) {
            const parts = chatId.split('_');
            const targetId = parts[1] === socket.id ? parts[2] : parts[1];
            
            if (!onlineUsers[targetId]) {
                socket.emit('notification', '❌ Пользователь не найден или офлайн');
                return;
            }

            if (moderations.bans[targetId]) {
                socket.emit('notification', '❌ Пользователь забанен');
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

            io.to(socket.id).emit('newMessage', { ...msg, chatId: chatKey });
            if (onlineUsers[targetId]) {
                io.to(targetId).emit('newMessage', { ...msg, chatId: chatKey });
            }
        }
    });

    // ============ ПОЛУЧЕНИЕ ИСТОРИИ ============
    socket.on('getChatHistory', ({ chatId }) => {
        if (chatId === 'main') {
            socket.emit('chatHistory', {
                chatId: 'main',
                messages: chatHistory['main'] || []
            });
        } else if (chatId && chatId.startsWith('dm_') && chatId.includes(socket.id)) {
            if (privateChats[chatId]) {
                socket.emit('chatHistory', {
                    chatId: chatId,
                    messages: privateChats[chatId] || []
                });
            } else {
                socket.emit('chatHistory', {
                    chatId: chatId,
                    messages: []
                });
            }
        }
    });

    // ============ ОБНОВЛЕНИЕ ПРОФИЛЯ ============
    socket.on('updateProfile', (data) => {
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id] = { ...onlineUsers[socket.id], ...data };
            
            // Обновляем в БД
            db.run(`
                UPDATE users 
                SET nick = ?, avatar = ?, status = ?, bio = ?, banner = ?, color = ?
                WHERE socket_id = ?
            `, [data.nick, data.avatar, data.status, data.bio, data.banner, data.color, socket.id]);

            io.emit('onlineUsers', onlineUsers);
            io.emit('userProfiles', onlineUsers);
        }
    });

    // ============ МОДЕРАЦИЯ ============
    socket.on('moderation:searchUser', ({ query }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', '⛔ Нет прав');
            return;
        }
        const results = Object.values(onlineUsers).filter(u => {
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
            socket.emit('notification', '⛔ Нет прав');
            return;
        }
        if (!onlineUsers[targetId]) {
            socket.emit('notification', '❌ Пользователь не найден');
            return;
        }
        const username = onlineUsers[targetId].username;
        
        db.run(`
            INSERT INTO warnings (user_id, moderator, reason)
            VALUES (?, ?, ?)
        `, [username, socket.id, reason || 'Нарушение правил']);

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
            const banData = {
                reason: 'Автобан (3 предупреждения)',
                moderator: 'system',
                timestamp: new Date().toISOString(),
                until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };
            moderations.bans[targetId] = banData;
            
            db.run(`
                INSERT INTO bans (user_id, reason, moderator, until, ip)
                VALUES (?, ?, ?, ?, ?)
            `, [username, banData.reason, banData.moderator, banData.until, onlineUsers[targetId].ip || null]);

            io.to(targetId).emit('banned', banData);
            setTimeout(() => {
                const sock = onlineSockets[targetId];
                if (sock) sock.disconnect(true);
            }, 1000);
        }
    });

    socket.on('moderation:ban', ({ targetId, reason, banIP }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', '⛔ Нет прав');
            return;
        }
        if (!onlineUsers[targetId]) {
            socket.emit('notification', '❌ Пользователь не найден');
            return;
        }
        const username = onlineUsers[targetId].username;
        const banData = {
            reason: reason || 'Нарушение правил',
            moderator: socket.id,
            timestamp: new Date().toISOString(),
            until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ip: banIP ? onlineUsers[targetId].ip : null
        };
        moderations.bans[targetId] = banData;
        
        db.run(`
            INSERT INTO bans (user_id, reason, moderator, until, ip)
            VALUES (?, ?, ?, ?, ?)
        `, [username, banData.reason, banData.moderator, banData.until, banData.ip]);

        io.to(targetId).emit('banned', banData);
        setTimeout(() => {
            const sock = onlineSockets[targetId];
            if (sock) sock.disconnect(true);
        }, 1000);
    });

    socket.on('moderation:unban', ({ targetId }) => {
        if (moderations.roles[socket.id] !== 'admin') {
            socket.emit('notification', '⛔ Нет прав');
            return;
        }
        if (!moderations.bans[targetId]) {
            socket.emit('notification', '❌ Пользователь не забанен');
            return;
        }
        const username = onlineUsers[targetId]?.username || targetId;
        delete moderations.bans[targetId];
        db.run('DELETE FROM bans WHERE user_id = ?', [username]);
        socket.emit('notification', '✅ Пользователь разбанен');
    });

    socket.on('claimAdmin', ({ key }) => {
        if (key === 'bober_admin_2024') {
            const username = onlineUsers[socket.id]?.username;
            if (username) {
                moderations.roles[socket.id] = 'admin';
                db.run(`
                    INSERT OR REPLACE INTO roles (user_id, role)
                    VALUES (?, ?)
                `, [username, 'admin']);
                socket.emit('roleChanged', { role: 'admin' });
                io.emit('userRoles', moderations.roles);
                socket.emit('notification', '👑 Вы администратор!');
            }
        }
    });

    // ============ ОТКЛЮЧЕНИЕ ============
    socket.on('disconnect', () => {
        if (onlineUsers[socket.id]) {
            const user = onlineUsers[socket.id];
            console.log(`🔴 ${user.nick} отключился`);
            
            // Обновляем last_seen в БД
            db.run('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE socket_id = ?', [socket.id]);
            
            delete onlineUsers[socket.id];
            delete onlineSockets[socket.id];
            io.emit('onlineUsers', onlineUsers);
            io.emit('userProfiles', onlineUsers);
            io.emit('userDisconnected', socket.id);
        }
    });
});

// ============ ЗАПУСК СЕРВЕРА ============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🦫 Bober Chat готов!`);
});
