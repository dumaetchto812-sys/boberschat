(function() {
    'use strict';

    // ============ КАНВАС ============
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    let mouseX = 0.5;
    let mouseY = 0.5;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
    });

    function drawBackground() {
        const w = canvas.width;
        const h = canvas.height;
        const grad = ctx.createRadialGradient(
            mouseX * w, mouseY * h, 0,
            mouseX * w, mouseY * h, Math.max(w, h) * 0.8
        );
        const hue1 = (Date.now() / 2000 + mouseX * 60) % 360;
        const hue2 = (Date.now() / 3000 + mouseY * 60 + 120) % 360;
        grad.addColorStop(0, `hsla(${hue1}, 80%, 60%, 0.12)`);
        grad.addColorStop(0.5, `hsla(${hue2}, 80%, 40%, 0.08)`);
        grad.addColorStop(1, `hsla(${(hue1 + 180) % 360}, 80%, 20%, 0.02)`);
        ctx.clearRect(0, 0, w, h);
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--custom-bg').trim();
        ctx.fillStyle = bg || '#0a0a1a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        requestAnimationFrame(drawBackground);
    }
    drawBackground();

    // ============ ПОДКЛЮЧЕНИЕ ============
    const socket = io();

    // ============ DOM ============
    const chatWindow = document.getElementById('chatWindow');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendMsgBtn');
    const addImgBtn = document.getElementById('addImgBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const nickDisplay = document.getElementById('nickDisplay');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const avatarEmoji = document.getElementById('avatarEmoji');
    const avatarImg = document.getElementById('avatarImg');
    const chatList = document.getElementById('chatList');
    const chatBadge = document.getElementById('chatBadge');
    const profileArea = document.getElementById('profileArea');
    const chatTitleEl = document.getElementById('chatTitle');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    // ============ ПРОФИЛЬ ============
    const profileOverlay = document.getElementById('profileOverlay');
    const profileModal = document.getElementById('profileModal');
    const viewMode = document.getElementById('viewMode');
    const editModeProfile = document.getElementById('editMode');
    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    const profileStatus = document.getElementById('profileStatus');
    const profileBio = document.getElementById('profileBio');
    const bigAvatarEmoji = document.getElementById('bigAvatarEmoji');
    const bigAvatarImg = document.getElementById('bigAvatarImg');
    const bannerImg = document.getElementById('bannerImg');
    const profileMessageBtn = document.getElementById('profileMessageBtn');
    const profileThemeBtn = document.getElementById('profileThemeBtn');
    const profileEditBtn = document.getElementById('profileEditBtn');
    const profileAdminBtn = document.getElementById('profileAdminBtn');
    const profileCloseBtn = document.getElementById('profileCloseBtn');
    const profileSaveBtn = document.getElementById('profileSaveBtn');
    const profileCancelBtn = document.getElementById('profileCancelBtn');
    const editName = document.getElementById('editName');
    const editUsername = document.getElementById('editUsername');
    const editStatus = document.getElementById('editStatus');
    const editBio = document.getElementById('editBio');
    const bigAvatarOverlay = document.getElementById('bigAvatarOverlay');
    const bannerOverlay = document.getElementById('bannerOverlay');

    // ============ АДМИНКА ============
    const adminPanelAdvanced = document.getElementById('adminPanelAdvanced');
    const adminSearchInput = document.getElementById('adminSearchInput');
    const adminSearchBtn = document.getElementById('adminSearchBtn');
    const adminSearchResults = document.getElementById('adminSearchResults');
    const adminSelectedUser = document.getElementById('adminSelectedUser');
    const adminSelectedAvatar = document.getElementById('adminSelectedAvatar');
    const adminSelectedName = document.getElementById('adminSelectedName');
    const adminSelectedUsername = document.getElementById('adminSelectedUsername');
    const adminSelectedIP = document.getElementById('adminSelectedIP');
    const adminWarnBtn = document.getElementById('adminWarnBtn');
    const adminBanBtn = document.getElementById('adminBanBtn');
    const adminBanIPBtn = document.getElementById('adminBanIPBtn');
    const adminUnbanBtn = document.getElementById('adminUnbanBtn');
    const adminReasonInput = document.getElementById('adminReasonInput');

    // ============ НАСТРОЙКИ ============
    const profileSettingsModal = document.getElementById('profileSettingsModal');
    const profileSettingsClose = document.getElementById('profileSettingsClose');
    const profileColorPicker = document.getElementById('profileColorPicker');
    const profileColorPreview = document.getElementById('profileColorPreview');
    const profileBgPicker = document.getElementById('profileBgPicker');
    const profileBgPreview = document.getElementById('profileBgPreview');
    const saveProfileSettings = document.getElementById('saveProfileSettings');

    // ============ РЕДАКТИРОВАНИЕ ============
    const editToggleBtn = document.getElementById('editToggleBtn');
    const editModeHint = document.getElementById('editModeHint');
    const hintCloseBtn = document.getElementById('hintCloseBtn');
    const textEditModal = document.getElementById('textEditModal');
    const textEditInput = document.getElementById('textEditInput');
    const textEditLabel = document.getElementById('textEditLabel');
    const textEditSave = document.getElementById('textEditSave');
    const textEditCancel = document.getElementById('textEditCancel');
    const adminModal = document.getElementById('adminModal');
    const adminModalClose = document.getElementById('adminModalClose');
    const adminKeyInput = document.getElementById('adminKeyInput');
    const adminClaimBtn = document.getElementById('adminClaimBtn');
    const themeCustomizerBtn = document.getElementById('themeCustomizerBtn');
    const closeCustomizer = document.getElementById('closeCustomizer');
    const themeCustomizer = document.getElementById('themeCustomizer');
    const saveCustomTheme = document.getElementById('saveCustomTheme');

    // ============ ПЕРЕМЕННЫЕ ============
    let currentNick = localStorage.getItem('chatNick') || 'Гость';
    let currentUsername = localStorage.getItem('chatUsername') || 'гость';
    let currentAvatar = localStorage.getItem('chatAvatarEmoji') || '👤';
    let currentBanner = localStorage.getItem('chatBanner') || '';
    let currentStatus = 'В сети';
    let currentBio = 'Привет! Я использую Bober Chat 🦫';
    let profileColor = localStorage.getItem('profileColor') || '#f093fb';
    let currentChat = 'main';
    let onlineUsers = {};
    let userProfiles = {};
    let viewingUserId = null;
    let isOwnProfile = false;
    let chatHistory = {};
    let privateChats = {};
    let adminSelectedTargetId = null;

    // ============ ИНИЦИАЛИЗАЦИЯ ============
    nickDisplay.textContent = currentNick;
    usernameDisplay.textContent = '@' + currentUsername;
    avatarEmoji.textContent = currentAvatar;
    applyProfileColor(profileColor);

    function applyProfileColor(color) {
        document.documentElement.style.setProperty('--profile-color', color);
        document.querySelector('.profile-area').style.borderColor = color;
        document.querySelector('.profile-area').style.boxShadow = `0 0 20px ${color}`;
        localStorage.setItem('profileColor', color);
    }

    // ============ ПОИСК ============
    function findUserByUsername(username) {
        const clean = username.toLowerCase().replace(/^@/, '');
        for (const [id, profile] of Object.entries(userProfiles)) {
            if (profile.username && profile.username.toLowerCase() === clean) {
                return { userId: id, profile: profile };
            }
        }
        return null;
    }

    function findUserById(userId) {
        if (userProfiles[userId]) {
            return { userId: userId, profile: userProfiles[userId] };
        }
        if (userId === socket.id) {
            return { userId: socket.id, profile: { 
                nick: currentNick, 
                username: currentUsername, 
                avatar: currentAvatar,
                status: currentStatus,
                bio: currentBio,
                banner: currentBanner,
                color: profileColor
            }};
        }
        return null;
    }

    // ============ ПОИСК (UI) ============
    function performSearch(query) {
        const q = query.toLowerCase().trim().replace(/^@/, '');
        const results = [];
        if (!q) { searchResults.classList.remove('active'); return; }
        for (const [id, profile] of Object.entries(userProfiles)) {
            if (id === socket.id) continue;
            const nick = (profile.nick || '').toLowerCase();
            const username = (profile.username || '').toLowerCase();
            if (nick.includes(q) || username.includes(q)) {
                results.push({ userId: id, profile: profile });
            }
        }
        if (results.length === 0) {
            searchResults.innerHTML = `<div style="color:rgba(255,255,255,0.3); font-size:0.75rem; padding:4px;">Пользователей не найдено</div>`;
            searchResults.classList.add('active');
            return;
        }
        searchResults.innerHTML = results.map(r => `
            <div class="search-item" data-userid="${r.userId}">
                <span class="s-avatar">${r.profile.avatar || '👤'}</span>
                <span class="s-nick">${r.profile.nick}</span>
                <span class="s-username">@${r.profile.username || 'пользователь'}</span>
                <button class="s-dm-btn" data-userid="${r.userId}"><i class="fas fa-comment"></i> Написать</button>
            </div>
        `).join('');
        searchResults.classList.add('active');
        document.querySelectorAll('.search-item .s-dm-btn').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const userId = this.dataset.userid;
                if (userId && userProfiles[userId]) {
                    searchResults.classList.remove('active');
                    searchInput.value = '';
                    openPrivateChat(userId);
                }
            });
        });
        document.querySelectorAll('.search-item').forEach(el => {
            el.addEventListener('click', function() {
                const userId = this.dataset.userid;
                if (userId && userProfiles[userId]) {
                    searchResults.classList.remove('active');
                    searchInput.value = '';
                    openPrivateChat(userId);
                }
            });
        });
    }

    searchInput.addEventListener('input', (e) => performSearch(e.target.value));
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) performSearch(searchInput.value);
    });
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });

    // ============ ЛИЧНЫЕ ЧАТЫ (ИСПРАВЛЕНО) ============
    function openPrivateChat(userId) {
        const userData = findUserById(userId);
        if (!userData) {
            alert('Пользователь не найден!');
            return;
        }
        const profile = userData.profile;
        const chatId = 'dm_' + userId;
        
        console.log('💬 Открываем ЛС с:', userId, 'чат:', chatId);
        
        let existingItem = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
        if (existingItem) { 
            switchChat(chatId); 
            return; 
        }
        
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
        
        const closeBtn = chatItem.querySelector('.chat-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closePrivateChat(chatId);
        });
        
        chatItem.addEventListener('click', () => switchChat(chatId));
        
        privateChats[userId] = chatId;
        if (!chatHistory[chatId]) {
            chatHistory[chatId] = [];
            console.log('📁 Создана история для чата:', chatId);
        }
        
        socket.emit('getChatHistory', { chatId: chatId });
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

    // ============ ПЕРЕКЛЮЧЕНИЕ ЧАТОВ (ИСПРАВЛЕНО) ============
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
        
        chatWindow.innerHTML = '';
        
        if (chatId === 'main') {
            socket.emit('getChatHistory', { chatId: 'main' });
        } else if (chatId.startsWith('dm_')) {
            if (chatHistory[chatId] && chatHistory[chatId].length > 0) {
                console.log('📜 Загрузка локальной истории для', chatId, 'сообщений:', chatHistory[chatId].length);
                chatHistory[chatId].forEach(msg => {
                    const div = createMessageElement(msg);
                    chatWindow.appendChild(div);
                });
                chatWindow.scrollTop = chatWindow.scrollHeight;
            } else {
                console.log('📡 Запрос истории с сервера для', chatId);
                socket.emit('getChatHistory', { chatId: chatId });
            }
        }
        
        const badge = document.querySelector(`.chat-item[data-chat="${chatId}"] .chat-badge`);
        if (badge) badge.textContent = '0';
    }

    function loadChatHistory(chatId) {
        chatWindow.innerHTML = '';
        if (chatId === 'main') {
            socket.emit('getChatHistory', { chatId: 'main' });
        } else if (chatHistory[chatId]) {
            const history = chatHistory[chatId] || [];
            history.forEach(msg => {
                const div = createMessageElement(msg);
                chatWindow.appendChild(div);
            });
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            chatWindow.innerHTML = `<div class="message message-other">
                <div class="msg-avatar"><span class="avatar-emoji">💬</span></div>
                <div class="msg-content"><strong>Инфо:</strong> Начните диалог...</div>
            </div>`;
        }
    }

    // ============ ОТПРАВКА СООБЩЕНИЙ ============
    function sendMessage() {
        const text = msgInput.value.trim();
        if (!text) return;
        
        console.log('📤 Отправка сообщения в чат:', currentChat);
        
        const msgData = {
            chatId: currentChat,
            message: text,
            nick: currentNick,
            username: currentUsername,
            avatar: currentAvatar,
            senderId: socket.id
        };
        
        if (currentChat.startsWith('dm_')) {
            const targetUserId = currentChat.replace('dm_', '');
            msgData.targetUserId = targetUserId;
            console.log('👤 Личный чат с:', targetUserId);
        }
        
        socket.emit('sendMessage', msgData);
        msgInput.value = '';
    }

    // ============ ПОЛУЧЕНИЕ СООБЩЕНИЙ (ИСПРАВЛЕНО) ============
    socket.on('newMessage', (msg) => {
        const chatId = msg.chatId || 'main';
        console.log('📩 Новое сообщение в чат:', chatId, 'от:', msg.nick, 'текст:', msg.message);
        
        if (chatId.startsWith('dm_')) {
            if (!chatId.includes(socket.id)) {
                console.log('⏭️ Пропускаем сообщение не для нас');
                return;
            }
        }
        
        if (!chatHistory[chatId]) {
            chatHistory[chatId] = [];
            console.log('📁 Создана история для чата:', chatId);
        }
        chatHistory[chatId].push(msg);
        console.log('💾 Сохранено в историю, всего сообщений:', chatHistory[chatId].length);
        
        if (currentChat === chatId) {
            console.log('👀 Показываем сообщение в текущем чате');
            const div = createMessageElement(msg);
            chatWindow.appendChild(div);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            console.log('🔔 Сообщение не в текущем чате, обновляем бейдж');
            const badge = document.querySelector(`.chat-item[data-chat="${chatId}"] .chat-badge`);
            if (badge) {
                const count = parseInt(badge.textContent) || 0;
                badge.textContent = count + 1;
            }
        }
    });

    socket.on('chatHistory', (data) => {
        console.log('📜 Получена история для чата:', data.chatId, 'сообщений:', data.messages.length);
        
        if (!chatHistory[data.chatId]) {
            chatHistory[data.chatId] = [];
        }
        chatHistory[data.chatId] = data.messages;
        
        if (data.chatId === currentChat) {
            chatWindow.innerHTML = '';
            const history = data.messages || [];
            history.forEach(msg => {
                const div = createMessageElement(msg);
                chatWindow.appendChild(div);
            });
            chatWindow.scrollTop = chatWindow.scrollHeight;
            console.log('📜 Отображено', history.length, 'сообщений в чате');
        }
    });

    // ============ СОЗДАНИЕ СООБЩЕНИЯ ============
    function createMessageElement(msg) {
        const div = document.createElement('div');
        const isSelf = msg.senderId === socket.id;
        div.className = `message ${isSelf ? 'message-self' : 'message-other'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'msg-avatar';
        const avatarData = msg.avatar || '👤';
        if (avatarData && avatarData.startsWith('data:image')) {
            avatarDiv.innerHTML = `<img src="${avatarData}" alt="avatar" onerror="this.style.display='none'" />`;
        } else {
            avatarDiv.innerHTML = `<span class="avatar-emoji">${avatarData}</span>`;
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        let messageText = msg.message || '';
        messageText = processMentionsInText(messageText);
        
        const senderData = findUserById(msg.senderId);
        const senderName = senderData ? senderData.profile.nick : (msg.nick || 'Гость');
        const senderUsername = senderData ? senderData.profile.username : (msg.username || '');
        
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = senderName + ':';
        nameSpan.style.cursor = 'pointer';
        nameSpan.dataset.userid = msg.senderId;
        nameSpan.dataset.username = senderUsername;
        nameSpan.title = 'Кликните чтобы открыть профиль';
        
        nameSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            const userId = this.dataset.userid;
            if (userId) {
                const userData = findUserById(userId);
                if (userData) {
                    openProfile(userId);
                }
            }
        });
        
        let contentHTML = '';
        contentHTML += nameSpan.outerHTML + ' ' + messageText;
        
        if (msg.media && msg.media.url) {
            const url = msg.media.url;
            if (url.startsWith('data:image') || url.match(/\.(jpg|jpeg|png|gif|webp)/i) || url.includes('picsum.photos')) {
                contentHTML += `<br><img src="${url}" class="msg-img" alt="image" loading="lazy" onerror="this.style.display='none'" />`;
            } else {
                contentHTML += `<br><a href="${url}" target="_blank">🔗 Ссылка</a>`;
            }
        }
        
        contentDiv.innerHTML = contentHTML;
        div.appendChild(avatarDiv);
        div.appendChild(contentDiv);
        return div;
    }

    function processMentionsInText(text) {
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        let result = text;
        let match;
        const mentions = [];
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({ username: match[1], index: match.index });
        }
        for (let i = mentions.length - 1; i >= 0; i--) {
            const m = mentions[i];
            const userData = findUserByUsername(m.username);
            if (userData) {
                const mentionHtml = `<span class="mention" data-userid="${userData.userId}" data-username="${m.username}" style="color:var(--custom-accent);font-weight:600;cursor:pointer;">@${m.username}</span>`;
                result = result.substring(0, m.index) + mentionHtml + result.substring(m.index + m.username.length + 1);
            }
        }
        return result;
    }

    // ============ ПРОФИЛЬ ============
    function openProfile(userId = null) {
        console.log('🔍 openProfile вызван с userId:', userId);
        if (userId === null || userId === socket.id) {
            isOwnProfile = true;
            viewingUserId = socket.id;
            showProfile({
                nick: currentNick,
                username: currentUsername,
                avatar: currentAvatar,
                status: currentStatus,
                bio: currentBio,
                banner: currentBanner,
                color: profileColor
            }, true);
        } else if (userProfiles[userId]) {
            isOwnProfile = false;
            viewingUserId = userId;
            showProfile(userProfiles[userId], false);
        } else if (onlineUsers[userId]) {
            userProfiles[userId] = onlineUsers[userId];
            isOwnProfile = false;
            viewingUserId = userId;
            showProfile(onlineUsers[userId], false);
        } else {
            console.log('❌ Пользователь не найден');
            alert('Пользователь не найден!');
        }
    }

    window.openProfile = openProfile;

    function showProfile(data, isOwn = false) {
        const savedTheme = JSON.parse(localStorage.getItem('profileTheme') || '{}');
        if (savedTheme.bg) profileModal.style.background = savedTheme.bg;

        if (data.banner && data.banner.startsWith('data:image')) {
            bannerImg.src = data.banner;
            bannerImg.style.display = 'block';
        } else {
            bannerImg.style.display = 'none';
        }

        if (data.avatar && data.avatar.startsWith('data:image')) {
            bigAvatarImg.src = data.avatar;
            bigAvatarImg.style.display = 'block';
            bigAvatarEmoji.style.display = 'none';
        } else {
            bigAvatarImg.style.display = 'none';
            bigAvatarEmoji.style.display = 'block';
            bigAvatarEmoji.textContent = data.avatar || '👤';
        }

        profileName.textContent = data.nick || 'Гость';
        profileUsername.textContent = '@' + (data.username || 'пользователь');
        const statusMap = {
            'В сети': { text: '🟢 В сети', color: '#00ff88' },
            'Отошел': { text: '🟡 Отошел', color: '#ffaa00' },
            'Не беспокоить': { text: '🔴 Не беспокоить', color: '#ff4444' }
        };
        const statusInfo = statusMap[data.status] || statusMap['В сети'];
        profileStatus.textContent = statusInfo.text;
        profileStatus.style.color = statusInfo.color;
        profileBio.textContent = data.bio || 'Пользователь еще не заполнил описание';

        const color = data.color || '#f093fb';
        document.querySelector('.profile-modal').style.borderColor = color;
        document.querySelector('.profile-modal').style.boxShadow = `0 30px 60px var(--custom-shadow), 0 0 40px ${color}`;
        document.querySelector('.profile-banner').style.background = `linear-gradient(135deg, ${color}, var(--custom-accent2))`;
        document.querySelector('.big-avatar').style.borderColor = color;
        document.querySelector('.big-avatar').style.boxShadow = `0 0 30px ${color}`;

        if (isOwn) {
            viewMode.style.display = 'block';
            editModeProfile.style.display = 'none';
            profileEditBtn.style.display = 'inline-block';
            profileThemeBtn.style.display = 'inline-block';
            profileAdminBtn.style.display = 'none';
            profileMessageBtn.style.display = 'none';
            bigAvatarOverlay.style.display = 'flex';
            bannerOverlay.style.display = 'flex';
        } else {
            viewMode.style.display = 'block';
            editModeProfile.style.display = 'none';
            profileEditBtn.style.display = 'none';
            profileThemeBtn.style.display = 'none';
            profileAdminBtn.style.display = 'none';
            profileMessageBtn.style.display = 'inline-block';
            bigAvatarOverlay.style.display = 'none';
            bannerOverlay.style.display = 'none';
            profileMessageBtn.onclick = () => {
                profileOverlay.classList.remove('active');
                if (viewingUserId) openPrivateChat(viewingUserId);
            };
        }
        profileOverlay.classList.add('active');
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
    function startEdit() {
        viewMode.style.display = 'none';
        editModeProfile.style.display = 'block';
        editName.value = currentNick;
        editUsername.value = currentUsername;
        editStatus.value = currentStatus;
        editBio.value = currentBio || '';
    }

    function saveProfile() {
        const newNick = editName.value.trim() || 'Гость';
        let newUsername = editUsername.value.trim().toLowerCase().replace(/^@/, '') || 'пользователь';
        newUsername = newUsername.replace(/[^a-z0-9_]/g, '');
        if (!newUsername) newUsername = 'пользователь';
        const newStatus = editStatus.value.trim() || 'В сети';
        const newBio = editBio.value.trim() || '';

        if (newUsername !== currentUsername) {
            const existing = findUserByUsername(newUsername);
            if (existing && existing.userId !== socket.id) {
                alert('Этот юзернейм уже занят! Попробуйте другой.');
                return;
            }
        }

        currentNick = newNick;
        currentUsername = newUsername;
        currentStatus = newStatus;
        currentBio = newBio;

        nickDisplay.textContent = currentNick;
        usernameDisplay.textContent = '@' + currentUsername;
        localStorage.setItem('chatNick', currentNick);
        localStorage.setItem('chatUsername', currentUsername);

        socket.emit('updateProfile', {
            nick: currentNick,
            username: currentUsername,
            avatar: currentAvatar,
            status: currentStatus,
            bio: currentBio,
            banner: currentBanner,
            color: profileColor
        });

        viewMode.style.display = 'block';
        editModeProfile.style.display = 'none';
        profileOverlay.classList.remove('active');
    }

    function cancelEdit() {
        viewMode.style.display = 'block';
        editModeProfile.style.display = 'none';
    }

    // ============ ЗАГРУЗКА АВАТАРКИ ============
    function loadAvatarFromFile(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение!');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('Файл слишком большой! Максимум 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            currentAvatar = dataUrl;
            avatarImg.src = dataUrl;
            avatarImg.style.display = 'block';
            avatarEmoji.style.display = 'none';
            bigAvatarImg.src = dataUrl;
            bigAvatarImg.style.display = 'block';
            bigAvatarEmoji.style.display = 'none';
            localStorage.setItem('chatAvatarImage', dataUrl);
            socket.emit('updateProfile', {
                nick: currentNick,
                username: currentUsername,
                avatar: dataUrl,
                status: currentStatus,
                bio: currentBio,
                banner: currentBanner,
                color: profileColor
            });
        };
        reader.readAsDataURL(file);
    }

    // ============ WEBSOCKET ============
    socket.on('connect', () => {
        console.log('✅ Подключен к серверу');
        socket.emit('register', { 
            nick: currentNick, 
            username: currentUsername,
            avatar: currentAvatar,
            status: currentStatus,
            bio: currentBio,
            banner: currentBanner,
            color: profileColor
        });
    });

    socket.on('onlineUsers', (users) => {
        onlineUsers = users;
    });

    socket.on('userProfiles', (profiles) => {
        userProfiles = profiles;
        document.querySelectorAll('.chat-item[data-chat^="dm_"]').forEach(item => {
            const chatId = item.dataset.chat;
            const userId = chatId.replace('dm_', '');
            const userData = findUserById(userId);
            if (userData) {
                const nameSpan = item.querySelector('.chat-name');
                if (nameSpan) nameSpan.textContent = userData.profile.nick || 'Пользователь';
            }
        });
    });

    socket.on('userDisconnected', (socketId) => {
        delete onlineUsers[socketId];
        delete userProfiles[socketId];
    });

    // ============ АДМИНКА ============
    socket.on('userRoles', (roles) => {
        const myRole = roles[socket.id] || 'user';
        if (adminPanelAdvanced) {
            adminPanelAdvanced.style.display = (myRole === 'admin') ? 'block' : 'none';
        }
        if (profileAdminBtn) {
            profileAdminBtn.style.display = (myRole === 'admin' || myRole === 'moderator') ? 'none' : 'inline-block';
        }
    });

    function performAdminSearch() {
        const query = adminSearchInput.value.trim();
        if (!query) {
            adminSearchResults.innerHTML = '<div style="color:rgba(255,255,255,0.3); padding:4px;">Введите запрос для поиска</div>';
            return;
        }
        socket.emit('moderation:searchUser', { query: query });
    }

    adminSearchBtn.addEventListener('click', performAdminSearch);
    adminSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performAdminSearch();
    });

    socket.on('moderation:searchResults', (results) => {
        if (!results || !results.length) {
            adminSearchResults.innerHTML = '<div style="color:rgba(255,255,255,0.3); padding:4px;">Пользователей не найдено</div>';
            return;
        }
        adminSearchResults.innerHTML = results.map(r => `
            <div class="admin-search-item" data-userid="${r.socketId}">
                <span>${r.avatar || '👤'}</span>
                <span style="flex:1;">${r.nick}</span>
                <span style="font-size:0.55rem; opacity:0.5;">@${r.username || 'юзер'}</span>
                <span class="admin-item-status ${r.isBanned ? 'banned' : 'active'}">${r.isBanned ? '🚫 Забанен' : '✅ Активен'}</span>
                <span class="admin-item-ip">${r.ip || 'unknown'}</span>
            </div>
        `).join('');
        document.querySelectorAll('.admin-search-item').forEach(el => {
            el.addEventListener('click', function() {
                const userId = this.dataset.userid;
                if (userId && userProfiles[userId]) {
                    adminSelectedTargetId = userId;
                    const profile = userProfiles[userId];
                    adminSelectedAvatar.textContent = profile.avatar || '👤';
                    adminSelectedName.textContent = profile.nick || 'Гость';
                    adminSelectedUsername.textContent = '@' + (profile.username || 'юзер');
                    adminSelectedIP.textContent = 'IP: ' + (profile.ip || 'unknown');
                    adminSelectedUser.style.display = 'block';
                    adminSearchResults.innerHTML = '';
                    adminSearchInput.value = '';
                    if (adminReasonInput) adminReasonInput.placeholder = 'Причина для ' + profile.nick;
                }
            });
        });
    });

    adminWarnBtn.addEventListener('click', function() {
        if (!adminSelectedTargetId) { alert('Сначала найдите пользователя'); return; }
        const reason = adminReasonInput.value || 'Нарушение правил';
        socket.emit('moderation:warn', { targetId: adminSelectedTargetId, reason: reason });
        adminReasonInput.value = '';
    });

    adminBanBtn.addEventListener('click', function() {
        if (!adminSelectedTargetId) { alert('Сначала найдите пользователя'); return; }
        if (!confirm('Забанить этого пользователя?')) return;
        const reason = adminReasonInput.value || 'Нарушение правил';
        socket.emit('moderation:ban', { targetId: adminSelectedTargetId, reason: reason, banIP: false });
        adminReasonInput.value = '';
    });

    adminBanIPBtn.addEventListener('click', function() {
        if (!adminSelectedTargetId) { alert('Сначала найдите пользователя'); return; }
        if (!confirm('Забанить пользователя и его IP?')) return;
        const reason = adminReasonInput.value || 'Нарушение правил (IP бан)';
        socket.emit('moderation:ban', { targetId: adminSelectedTargetId, reason: reason, banIP: true });
        adminReasonInput.value = '';
    });

    adminUnbanBtn.addEventListener('click', function() {
        if (!adminSelectedTargetId) { alert('Сначала найдите пользователя'); return; }
        if (!confirm('Разбанить этого пользователя?')) return;
        socket.emit('moderation:unban', { targetId: adminSelectedTargetId });
    });

    socket.on('usernameTaken', (data) => {
        alert('❌ Юзернейм @"' + data.username + '" уже занят! Выберите другой.');
    });

    socket.on('banned', (data) => {
        alert('🚫 Вас забанили!\nПричина: ' + data.reason + '\nДо: ' + new Date(data.until).toLocaleString());
    });

    socket.on('notification', (msg) => {
        console.log('📢', msg);
        const notif = document.createElement('div');
        notif.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:12px;z-index:9999;font-size:0.9rem;border:1px solid var(--custom-accent);';
        notif.textContent = msg;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    });

    socket.on('roleChanged', (data) => {
        alert('👑 Ваша роль обновлена: ' + data.role);
    });

    // ============ КНОПКИ ============
    sendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    addImgBtn.addEventListener('click', () => sendMedia('img'));
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        uploadOwnImage(file);
    });

    function sendMedia(type) {
        const urls = {
            img: [
                'https://picsum.photos/seed/1/400/300',
                'https://picsum.photos/seed/2/400/300',
                'https://picsum.photos/seed/3/400/300',
                'https://picsum.photos/seed/4/400/300',
                'https://picsum.photos/seed/5/400/300',
                'https://picsum.photos/seed/6/400/300',
                'https://picsum.photos/seed/7/400/300',
                'https://picsum.photos/seed/8/400/300'
            ]
        };
        const url = urls[type][Math.floor(Math.random() * urls[type].length)];
        const msgData = {
            chatId: currentChat,
            message: '🖼️ Картинка',
            nick: currentNick,
            username: currentUsername,
            avatar: currentAvatar,
            senderId: socket.id,
            media: { url: url, type: 'img' }
        };
        if (currentChat.startsWith('dm_')) {
            msgData.targetUserId = currentChat.replace('dm_', '');
        }
        socket.emit('sendMessage', msgData);
    }

    function uploadOwnImage(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение!');
            fileInput.value = '';
            return;
        }
        if (file.size > 1 * 1024 * 1024) {
            alert('Файл слишком большой! Максимум 1MB.');
            fileInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const msgData = {
                chatId: currentChat,
                message: '📷 Фото',
                nick: currentNick,
                username: currentUsername,
                avatar: currentAvatar,
                senderId: socket.id,
                media: { url: e.target.result, type: 'img' }
            };
            if (currentChat.startsWith('dm_')) {
                msgData.targetUserId = currentChat.replace('dm_', '');
            }
            socket.emit('sendMessage', msgData);
            fileInput.value = '';
        };
        reader.onerror = function() {
            alert('Ошибка при чтении файла!');
            fileInput.value = '';
        };
        reader.readAsDataURL(file);
    }

    // ============ ПРОФИЛЬ (СОБЫТИЯ) ============
    profileArea.addEventListener('click', () => openProfile(socket.id));
    profileCloseBtn.addEventListener('click', () => profileOverlay.classList.remove('active'));
    profileOverlay.addEventListener('click', (e) => {
        if (e.target === profileOverlay) profileOverlay.classList.remove('active');
    });
    profileEditBtn.addEventListener('click', startEdit);
    profileSaveBtn.addEventListener('click', saveProfile);
    profileCancelBtn.addEventListener('click', cancelEdit);

    bigAvatarOverlay.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!isOwnProfile) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            const file = e.target.files[0];
            loadAvatarFromFile(file);
            input.remove();
        };
        input.click();
    });

    bannerOverlay.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!isOwnProfile) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Пожалуйста, выберите изображение!');
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alert('Файл слишком большой! Максимум 2MB.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const dataUrl = e.target.result;
                currentBanner = dataUrl;
                bannerImg.src = dataUrl;
                bannerImg.style.display = 'block';
                localStorage.setItem('chatBanner', dataUrl);
                socket.emit('updateProfile', {
                    nick: currentNick,
                    username: currentUsername,
                    avatar: currentAvatar,
                    status: currentStatus,
                    bio: currentBio,
                    banner: dataUrl,
                    color: profileColor
                });
                input.remove();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    // ============ ТЕМЫ ============
    function applyTheme(colors) {
        const root = document.documentElement;
        if (colors.bg) root.style.setProperty('--custom-bg', colors.bg);
        if (colors.text) root.style.setProperty('--custom-text', colors.text);
        if (colors.accent) root.style.setProperty('--custom-accent', colors.accent);
        if (colors.accent2) root.style.setProperty('--custom-accent2', colors.accent2);
        if (colors.radius) root.style.setProperty('--custom-radius', colors.radius + 'px');
        if (colors.blur) root.style.setProperty('--custom-blur', colors.blur + 'px');
        localStorage.setItem('customTheme', JSON.stringify(colors));
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active-custom'));
        document.getElementById('customThemeBtn').classList.add('active-custom');
    }

    function loadCustomTheme() {
        try {
            const saved = localStorage.getItem('customTheme');
            if (saved) {
                const colors = JSON.parse(saved);
                applyTheme(colors);
                document.getElementById('customBg').value = colors.bg || '#0a0a1a';
                document.getElementById('customText').value = colors.text || '#ffffff';
                document.getElementById('customAccent').value = colors.accent || '#f093fb';
                document.getElementById('customAccent2').value = colors.accent2 || '#f5576c';
                document.getElementById('customRadius').value = colors.radius || '32';
                document.getElementById('customBlur').value = colors.blur || '12';
            }
        } catch(e) {}
    }

    window.applyPreset = function(name) {
        const presets = {
            dark: { bg: '#0a0a1a', text: '#ffffff', accent: '#f093fb', accent2: '#f5576c', radius: 32, blur: 12 },
            light: { bg: '#f0f0f0', text: '#111111', accent: '#e070a0', accent2: '#d04060', radius: 32, blur: 12 },
            red: { bg: '#1a0a0a', text: '#ffdddd', accent: '#ff4444', accent2: '#cc2222', radius: 28, blur: 10 },
            blue: { bg: '#0a0a2a', text: '#ddeeff', accent: '#4488ff', accent2: '#2266dd', radius: 30, blur: 14 },
            green: { bg: '#0a1a0a', text: '#ddffdd', accent: '#44ff88', accent2: '#22dd66', radius: 32, blur: 12 },
            purple: { bg: '#1a0a2a', text: '#f0ddff', accent: '#aa44ff', accent2: '#8822dd', radius: 30, blur: 14 }
        };
        const theme = presets[name];
        if (theme) {
            applyTheme(theme);
            document.getElementById('customBg').value = theme.bg;
            document.getElementById('customText').value = theme.text;
            document.getElementById('customAccent').value = theme.accent;
            document.getElementById('customAccent2').value = theme.accent2;
            document.getElementById('customRadius').value = theme.radius;
            document.getElementById('customBlur').value = theme.blur;
        }
    };

    themeCustomizerBtn.addEventListener('click', () => themeCustomizer.classList.add('active'));
    closeCustomizer.addEventListener('click', () => themeCustomizer.classList.remove('active'));
    themeCustomizer.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) themeCustomizer.classList.remove('active');
    });

    saveCustomTheme.addEventListener('click', () => {
        const colors = {
            bg: document.getElementById('customBg').value,
            text: document.getElementById('customText').value,
            accent: document.getElementById('customAccent').value,
            accent2: document.getElementById('customAccent2').value,
            radius: parseInt(document.getElementById('customRadius').value) || 32,
            blur: parseInt(document.getElementById('customBlur').value) || 12
        };
        applyTheme(colors);
        themeCustomizer.classList.remove('active');
    });

    document.querySelectorAll('.preset-themes button').forEach(btn => {
        btn.onclick = function() {
            const name = this.textContent.trim().toLowerCase();
            const map = {
                'тёмная': 'dark',
                'светлая': 'light',
                'красная': 'red',
                'синяя': 'blue',
                'зелёная': 'green',
                'фиолетовая': 'purple'
            };
            window.applyPreset(map[name] || 'dark');
        };
    });

    themeToggles.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-btn');
        if (!btn) return;
        const theme = btn.dataset.theme;
        if (theme === 'custom') {
            themeCustomizer.classList.add('active');
            return;
        }
        const presets = {
            light: { bg: '#f0f0f0', text: '#111111', accent: '#e070a0', accent2: '#d04060', radius: 32, blur: 12 },
            dark: { bg: '#0a0a1a', text: '#ffffff', accent: '#f093fb', accent2: '#f5576c', radius: 32, blur: 12 },
            red: { bg: '#1a0a0a', text: '#ffdddd', accent: '#ff4444', accent2: '#cc2222', radius: 28, blur: 10 },
            blue: { bg: '#0a0a2a', text: '#ddeeff', accent: '#4488ff', accent2: '#2266dd', radius: 30, blur: 14 },
            green: { bg: '#0a1a0a', text: '#ddffdd', accent: '#44ff88', accent2: '#22dd66', radius: 32, blur: 12 },
            purple: { bg: '#1a0a2a', text: '#f0ddff', accent: '#aa44ff', accent2: '#8822dd', radius: 30, blur: 14 }
        };
        const colors = presets[theme];
        if (colors) {
            applyTheme(colors);
            document.getElementById('customBg').value = colors.bg;
            document.getElementById('customText').value = colors.text;
            document.getElementById('customAccent').value = colors.accent;
            document.getElementById('customAccent2').value = colors.accent2;
            document.getElementById('customRadius').value = colors.radius;
            document.getElementById('customBlur').value = colors.blur;
        }
        document.querySelectorAll('.theme-btn').forEach(b => {
            b.classList.remove('active-light', 'active-dark', 'active-red', 'active-blue', 'active-green', 'active-purple', 'active-custom');
        });
        btn.classList.add(`active-${theme}`);
    });

    // ============ НАСТРОЙКИ ПРОФИЛЯ ============
    profileThemeBtn.addEventListener('click', () => {
        profileOverlay.classList.remove('active');
        profileSettingsModal.classList.add('active');
    });

    profileSettingsClose.addEventListener('click', () => {
        profileSettingsModal.classList.remove('active');
    });

    profileSettingsModal.addEventListener('click', (e) => {
        if (e.target === profileSettingsModal) {
            profileSettingsModal.classList.remove('active');
        }
    });

    profileColorPicker.addEventListener('input', function() {
        profileColorPreview.style.background = this.value;
    });

    profileBgPicker.addEventListener('input', function() {
        profileBgPreview.style.background = this.value;
    });

    saveProfileSettings.addEventListener('click', () => {
        const color = document.getElementById('profileColorPicker').value;
        const bg = document.getElementById('profileBgPicker').value;
        const theme = { color: color, bg: bg };
        localStorage.setItem('profileTheme', JSON.stringify(theme));
        applyProfileColor(color);
        profileModal.style.background = bg;
        profileSettingsModal.classList.remove('active');
    });

    // ============ АДМИН-МОДАЛ ======
    profileAdminBtn.addEventListener('click', () => {
        profileOverlay.classList.remove('active');
        adminModal.classList.add('active');
    });

    adminModalClose.addEventListener('click', () => adminModal.classList.remove('active'));
    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) adminModal.classList.remove('active');
    });

    adminClaimBtn.addEventListener('click', () => {
        const key = adminKeyInput.value.trim();
        if (!key) { alert('Введите ключ!'); return; }
        socket.emit('claimAdmin', { key: key });
        adminKeyInput.value = '';
        adminModal.classList.remove('active');
    });

    // ============ РЕЖИМ РЕДАКТИРОВАНИЯ ============
    let editMode = false;
    editToggleBtn.addEventListener('click', () => {
        editMode = !editMode;
        document.body.style.cursor = editMode ? 'grab' : '';
        editToggleBtn.classList.toggle('active', editMode);
        editToggleBtn.querySelector('i').className = editMode ? 'fas fa-check' : 'fas fa-pencil-alt';
        editToggleBtn.querySelector('.tooltip').textContent = editMode ? 'Выйти из режима' : 'Редактировать интерфейс';
        editModeHint.classList.toggle('active', editMode);
    });

    hintCloseBtn.addEventListener('click', () => {
        editModeHint.classList.remove('active');
    });

    // ============ РЕДАКТИРОВАНИЕ ТЕКСТА ============
    document.addEventListener('click', (e) => {
        if (!editMode) return;
        const editable = e.target.closest('.editable-text');
        if (!editable) return;
        e.stopPropagation();
        const target = editable.dataset.target;
        const currentText = editable.textContent.trim();
        textEditInput.value = currentText;
        const labels = {
            'brandName': 'Название приложения',
            'chatTitle': 'Название чата',
            'sidebarTitle': 'Название раздела "Чаты"',
            'mainChatName': 'Название общего чата'
        };
        textEditLabel.textContent = labels[target] || 'Редактировать текст';
        textEditModal.classList.add('active');
        textEditInput.focus();
        textEditInput.select();
    });

    textEditSave.addEventListener('click', () => {
        const newText = textEditInput.value.trim();
        if (newText) {
            const settings = JSON.parse(localStorage.getItem('uiTexts') || '{}');
            settings[textEditTarget.target] = newText;
            localStorage.setItem('uiTexts', JSON.stringify(settings));
        }
        textEditModal.classList.remove('active');
    });

    textEditCancel.addEventListener('click', () => {
        textEditModal.classList.remove('active');
    });

    // ============ ИНИЦИАЛИЗАЦИЯ ============
    loadCustomTheme();
    loadProfileTheme();

    function loadProfileTheme() {
        try {
            const saved = localStorage.getItem('profileTheme');
            if (saved) {
                const theme = JSON.parse(saved);
                if (theme.color) {
                    profileColorPicker.value = theme.color;
                    profileColorPreview.style.background = theme.color;
                    applyProfileColor(theme.color);
                }
                if (theme.bg) {
                    profileBgPicker.value = theme.bg;
                    profileBgPreview.style.background = theme.bg;
                }
            }
        } catch(e) {}
    }

    try {
        const savedImage = localStorage.getItem('chatAvatarImage');
        if (savedImage) {
            avatarImg.src = savedImage;
            avatarImg.style.display = 'block';
            avatarEmoji.style.display = 'none';
            currentAvatar = savedImage;
        }
        const savedBanner = localStorage.getItem('chatBanner');
        if (savedBanner) {
            currentBanner = savedBanner;
            bannerImg.src = savedBanner;
            bannerImg.style.display = 'block';
        }
        const savedColor = localStorage.getItem('profileColor');
        if (savedColor) {
            profileColor = savedColor;
            applyProfileColor(profileColor);
        }
        const savedUsername = localStorage.getItem('chatUsername');
        if (savedUsername) {
            currentUsername = savedUsername;
            usernameDisplay.textContent = '@' + currentUsername;
        }
    } catch(e) {}

    socket.emit('joinChat', 'main');
    console.log('🦫 Bober Chat готов!');
    console.log('💡 Кликните по имени пользователя в чате чтобы открыть профиль');
})();
