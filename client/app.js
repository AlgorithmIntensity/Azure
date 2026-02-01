let socket;
let currentUser = null;
let currentRoom = 'general';
let currentPrivateChat = null;
let usersOnline = [];
let roomsList = [];
let privateChats = [];
let uploadedFiles = [];
let emojiPicker = null;
let typingTimeout = null;
let fileUploadQueue = [];
let isUploading = false;
let eventListenersInitialized = false;
let audioUploadQueue = [];
let isAudioUploading = false;
const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/m4a'];

const EMOJI_CATEGORIES = [
    { name: 'smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳'] },
    { name: 'gestures', emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'] },
    { name: 'animals', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞'] },
    { name: 'food', emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶', '🫒', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯'] },
    { name: 'activities', emojis: ['⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌'] },
    { name: 'objects', emojis: ['💎', '🔪', '🏆', '🎭', '🎨', '🧵', '🪡', '🧶', '🪢', '👓', '🕶', '🥽', '🥼', '🦺', '👔', '👕', '👖', '🧣', '🧤', '🧥', '🧦', '👗', '👘', '🥻', '🩴', '🩱', '🩲', '🩳', '👙', '👚', '👛', '👜'] }
];

document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    setupTabs();
    initEmojiPicker();
    initFileUpload();
    checkRememberedUser();
    loadSettings();
});

function initEventListeners() {
    if (eventListenersInitialized) return;
    eventListenersInitialized = true;
    
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    if (loginBtn) loginBtn.addEventListener('click', login, { once: true });
    if (registerBtn) registerBtn.addEventListener('click', register, { once: true });
    
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const registerUsername = document.getElementById('register-username');
    const registerPassword = document.getElementById('register-password');
    const confirmPassword = document.getElementById('confirm-password');
    
    if (loginUsername) loginUsername.addEventListener('keypress', (e) => e.key === 'Enter' && login());
    if (loginPassword) loginPassword.addEventListener('keypress', (e) => e.key === 'Enter' && login());
    if (registerUsername) registerUsername.addEventListener('keypress', (e) => e.key === 'Enter' && register());
    if (registerPassword) registerPassword.addEventListener('keypress', (e) => e.key === 'Enter' && register());
    if (confirmPassword) confirmPassword.addEventListener('keypress', (e) => e.key === 'Enter' && register());
    
    const showLoginPassword = document.getElementById('show-login-password');
    const showRegisterPassword = document.getElementById('show-register-password');
    if (showLoginPassword) showLoginPassword.addEventListener('click', () => togglePasswordVisibility('login-password'));
    if (showRegisterPassword) showRegisterPassword.addEventListener('click', () => togglePasswordVisibility('register-password'));
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const profileBtn = document.getElementById('profile-btn');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const newPrivateBtn = document.getElementById('new-private-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const clearChatBtn = document.getElementById('clear-chat');
    const emojiBtn = document.getElementById('emoji-btn');
    const fileBtn = document.getElementById('file-btn');
    const cancelUploadBtn = document.getElementById('cancel-upload');
    const settingsBtn = document.getElementById('settings-btn');
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.addEventListener('input', handleTyping);
    }
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (profileBtn) profileBtn.addEventListener('click', showProfile);
    if (adminPanelBtn) adminPanelBtn.addEventListener('click', showAdminPanel);
    if (createRoomBtn) createRoomBtn.addEventListener('click', createRoomDialog);
    if (newPrivateBtn) newPrivateBtn.addEventListener('click', showNewPrivateModal);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
    if (emojiBtn) emojiBtn.addEventListener('click', toggleEmojiPicker);
    if (fileBtn) fileBtn.addEventListener('click', () => {
        const fileUpload = document.getElementById('file-upload');
        if (fileUpload) fileUpload.click();
    });
    if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', cancelUpload);
    if (settingsBtn) settingsBtn.addEventListener('click', showSettings);
    
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.color-option').forEach(o => {
                o.classList.remove('active');
                const icon = o.querySelector('i');
                if (icon) icon.style.opacity = '0';
            });
            this.classList.add('active');
            const icon = this.querySelector('i');
            if (icon) icon.style.opacity = '1';
        });
    });
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.classList.remove('show');
        });
    });
    
    const closeSidebar = document.getElementById('close-sidebar');
    if (closeSidebar) closeSidebar.addEventListener('click', () => {
        const rightSidebar = document.getElementById('right-sidebar');
        if (rightSidebar) rightSidebar.classList.remove('active');
    });
    
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchAdminTab(tabName);
        });
    });
    
    const startPrivateBtn = document.getElementById('start-private-chat-btn');
    if (startPrivateBtn) startPrivateBtn.addEventListener('click', startPrivateChat);
    
    const createPrivateRoomBtn = document.getElementById('create-private-room-btn');
    if (createPrivateRoomBtn) createPrivateRoomBtn.addEventListener('click', createPrivateRoom);
    
    const muteBtn = document.getElementById('mute-user-btn');
    if (muteBtn) muteBtn.addEventListener('click', () => performAdminAction('mute'));
    
    const unmuteBtn = document.getElementById('unmute-user-btn');
    if (unmuteBtn) unmuteBtn.addEventListener('click', () => performAdminAction('unmute'));
    
    const banBtn = document.getElementById('ban-user-btn');
    if (banBtn) banBtn.addEventListener('click', () => performAdminAction('ban'));
    
    const unbanBtn = document.getElementById('unban-user-btn');
    if (unbanBtn) unbanBtn.addEventListener('click', () => performAdminAction('unban'));
    
    const refreshMsgBtn = document.getElementById('refresh-messages-btn');
    if (refreshMsgBtn) refreshMsgBtn.addEventListener('click', refreshAdminMessages);
    
    const adminUpdateBtn = document.getElementById('admin-update-profile-btn');
    if (adminUpdateBtn) adminUpdateBtn.addEventListener('click', updateUserProfile);
    
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', updateOwnProfile);
    
    const roomPrivateCheck = document.getElementById('room-is-private');
    if (roomPrivateCheck) roomPrivateCheck.addEventListener('change', toggleAllowedUsers);
    
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) addUserBtn.addEventListener('click', addAllowedUser);
    
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.addEventListener('input', handleGlobalSearch);
    
    const userSearch = document.getElementById('user-search');
    if (userSearch) userSearch.addEventListener('input', handleUserSearch);
    
    const rememberMe = document.getElementById('remember-me');
    if (rememberMe) rememberMe.addEventListener('change', function() {
        if (this.checked) {
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('rememberMe');
        }
    });
    
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetSettings);

    initAudioUpload();
    document.addEventListener('click', function(e) {
        if (e.target.closest('.play-audio-btn')) {
            const audioUrl = e.target.closest('.play-audio-btn').dataset.audioUrl;
            playAudio(audioUrl);
        }
    });
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchAuthTab(tab);
        });
    });
    
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            
            this.classList.add('active');
            const panel = document.getElementById(`${tabName}-panel`);
            if (panel) panel.classList.add('active');
            
            if (tabName === 'media') {
                loadMediaGallery();
            }
        });
    });
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    const form = document.getElementById(`${tab}-form`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (form) form.classList.add('active');
    
    const authError = document.getElementById('auth-error');
    if (authError) authError.style.display = 'none';
}

function checkRememberedUser() {
    if (localStorage.getItem('rememberMe') === 'true') {
        const savedUsername = localStorage.getItem('savedUsername');
        const loginUsername = document.getElementById('login-username');
        const rememberMe = document.getElementById('remember-me');
        if (savedUsername && loginUsername) {
            loginUsername.value = savedUsername;
            if (rememberMe) rememberMe.checked = true;
        }
    }
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    const icon = field.nextElementSibling?.querySelector('i');
    if (!icon) return;
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

async function login() {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const rememberMe = document.getElementById('remember-me')?.checked;
    
    if (!username || !password) {
        showAuthError('Заполните все поля');
        return;
    }
    
    if (rememberMe) {
        localStorage.setItem('savedUsername', username);
    }
    
    try {
        if (!socket || socket.disconnected) {
            const socketHost = window.location.origin.replace(/:\d+$/, '') + ':3000';
            
            socket = io(socketHost, {
                reconnection: true,
                reconnectionAttempts: 3,
                reconnectionDelay: 1000,
                timeout: 5000
            });
            
            setupSocketListeners();
            
            socket.on('connect_error', (error) => {
                console.error('Ошибка подключения:', error);
                showAuthError('Не удалось подключиться к серверу. Проверьте, запущен ли сервер.');
            });
        }
        
        socket.emit('login', { username, password });
        
    } catch (error) {
        console.error('Login error:', error);
        showAuthError('Ошибка подключения к серверу');
    }
}

async function register() {
    const username = document.getElementById('register-username')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const firstName = document.getElementById('register-firstname')?.value.trim();
    const lastName = document.getElementById('register-lastname')?.value.trim();
    const bio = document.getElementById('register-bio')?.value.trim();
    const selectedColor = document.querySelector('.color-option.active')?.dataset.color || '0078D4';
    
    if (!username || !password || !confirmPassword) {
        showAuthError('Заполните обязательные поля');
        return;
    }
    
    if (username.length < 3 || username.length > 30) {
        showAuthError('Имя пользователя должно быть от 3 до 30 символов');
        return;
    }
    
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
        showAuthError('Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания');
        return;
    }
    
    if (password.length < 6) {
        showAuthError('Пароль должен быть не менее 6 символов');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthError('Пароли не совпадают');
        return;
    }
    
    try {
        if (!socket || socket.disconnected) {
            const socketHost = window.location.origin.replace(/:\d+$/, '') + ':3000';
            
            socket = io(socketHost, {
                reconnection: true,
                reconnectionAttempts: 3,
                reconnectionDelay: 1000,
                timeout: 5000
            });
            
            setupSocketListeners();
            
            socket.on('connect_error', (error) => {
                console.error('Ошибка подключения:', error);
                showAuthError('Не удалось подключиться к серверу. Проверьте, запущен ли сервер.');
            });
        }
        
        socket.emit('register', { 
            username, 
            password,
            firstName,
            lastName,
            avatarColor: selectedColor,
            bio
        });
        
    } catch (error) {
        console.error('Register error:', error);
        showAuthError('Ошибка подключения к серверу');
    }
}

function showAuthError(message) {
    const errorElement = document.getElementById('auth-error');
    if (!errorElement) return;
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    errorElement.style.animation = 'shake 0.5s ease';
    
    setTimeout(() => {
        errorElement.style.animation = '';
    }, 500);
}

function setupSocketListeners() {
    if (!socket) return;
    
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('registered', (userData) => {
        currentUser = userData;
        const authScreen = document.getElementById('auth-screen');
        const chatScreen = document.getElementById('chat-screen');
        
        if (authScreen) authScreen.classList.remove('active');
        if (chatScreen) chatScreen.classList.add('active');
        
        updateUserInterface();
        loadRooms(userData.rooms);
        loadPrivateChats(userData.privateMessages || []);
        
        if (userData.isAdmin) {
            const adminBtn = document.getElementById('admin-panel-btn');
            if (adminBtn) adminBtn.style.display = 'block';
            const roleBadge = document.getElementById('user-role');
            if (roleBadge) roleBadge.classList.add('admin');
        }
        
        if (userData.username === 'AlgorithmIntensity') {
            const roleBadge = document.getElementById('user-role');
            if (roleBadge) {
                roleBadge.classList.add('special-admin');
                roleBadge.innerHTML = '<i class="fas fa-crown"></i> СОЗДАТЕЛЬ';
            }
        }
        
        showNotification(`Добро пожаловать, ${userData.firstName || userData.username}!`, 'success');
    });
    
    socket.on('registration-error', (error) => {
        showAuthError(error);
    });
    
    socket.on('login-error', (error) => {
        showAuthError(error);
    });
    
    socket.on('room-joined', (roomData) => {
        if (roomData.isPrivateRoom) {
            currentPrivateChat = roomData.roomId;
            currentRoom = null;
            updateChatTitle(`Приват: ${roomData.roomName}`, 'private', roomData.description);
            const inviteBtn = document.getElementById('invite-btn');
            if (inviteBtn) inviteBtn.style.display = 'none';
        } else {
            currentRoom = roomData.roomId;
            currentPrivateChat = null;
            updateChatTitle(roomData.roomName, 'public', roomData.description);
            const inviteBtn = document.getElementById('invite-btn');
            if (inviteBtn) inviteBtn.style.display = 'block';
        }
        
        updateChatMessages(roomData.messages);
        updateRoomsList();
        loadMediaGallery();
    });
    
    socket.on('new-message', (message) => {
        if ((currentRoom && message.roomId === currentRoom) || 
            (currentPrivateChat && message.isPrivate)) {
            addMessageToChat(message);
            scrollToBottom();
            
            if (message.isFile) {
                uploadedFiles.push(message);
                loadMediaGallery();
            }
        }
    });
    
    socket.on('private-chat-started', (data) => {
        currentPrivateChat = data.targetUser.username;
        currentRoom = null;
        
        updateChatTitle(`Приват: ${data.targetUser.fullName}`, 'private', `Приватный чат с ${data.targetUser.fullName}`);
        const inviteBtn = document.getElementById('invite-btn');
        if (inviteBtn) inviteBtn.style.display = 'none';
        
        updateChatMessages(data.messages);
        const newPrivateModal = document.getElementById('new-private-modal');
        if (newPrivateModal) newPrivateModal.classList.remove('show');
        
        showNotification(`Чат с ${data.targetUser.fullName} начат`, 'info');
    });
    
    socket.on('new-private-message', (message) => {
        if (currentPrivateChat && 
            (message.from === currentPrivateChat || message.to === currentPrivateChat)) {
            addPrivateMessageToChat(message);
            scrollToBottom();
            
            if (message.isFile) {
                uploadedFiles.push(message);
                loadMediaGallery();
            }
            
            if (message.from !== currentUser.username) {
                updatePrivateChatNotification(message.from);
                playNotificationSound();
            }
        } else {
            showNotification(`Новое сообщение от ${message.fromName || message.from}`, 'info');
            playNotificationSound();
        }
    });
    
    socket.on('private-message-sent', (message) => {
        addPrivateMessageToChat(message);
        scrollToBottom();
        
        if (message.isFile) {
            uploadedFiles.push(message);
            loadMediaGallery();
        }
    });
    
    socket.on('private-chat-notification', (data) => {
        showNotification(`${data.firstName || data.from} начал с вами приватный чат`, 'info');
        playNotificationSound();
    });
    
    socket.on('system-message', (data) => {
        addSystemMessage(data.text);
    });
    
    socket.on('user-list', (users) => {
        usersOnline = users;
        updateUsersList(users);
        const onlineCount = document.getElementById('online-count');
        if (onlineCount) onlineCount.textContent = users.length;
        updateAdminStats();
    });
    
    socket.on('room-users', (data) => {
        if (data.roomId === currentRoom) {
            const participants = document.getElementById('participants-count');
            if (participants) {
                participants.innerHTML = `<i class="fas fa-user"></i> <span>${data.users.length}</span>`;
            }
        }
    });
    
    socket.on('user-typing', (data) => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.textContent = `${data.firstName || data.username} печатает...`;
            indicator.style.display = 'block';
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);
        }
    });
    
    socket.on('user-stop-typing', () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.style.display = 'none';
    });
    
    socket.on('mention', (data) => {
        showNotification(`Вас упомянули в "${data.room}"`, 'mention');
        playNotificationSound();
    });
    
    socket.on('error-message', (message) => {
        showNotification(message, 'error');
    });
    
    socket.on('admin-warning', (message) => {
        showNotification(`Администратор: ${message}`, 'warning');
    });
    
    socket.on('admin-action-result', (data) => {
        let message = '';
        let type = 'info';
        
        switch (data.action) {
            case 'muted':
                message = `Вы заглушены на ${data.duration} секунд. Причина: ${data.reason}`;
                type = 'warning';
                if (currentUser) currentUser.isMuted = true;
                updateMuteStatus(true);
                break;
            case 'unmuted':
                message = 'С вас снято заглушение';
                type = 'success';
                if (currentUser) currentUser.isMuted = false;
                updateMuteStatus(false);
                break;
            case 'banned':
                message = `Вы заблокированы. Причина: ${data.reason}`;
                type = 'error';
                setTimeout(() => {
                    logout();
                    showAuthError('Ваш аккаунт заблокирован');
                }, 1000);
                break;
        }
        if (message) {
            showNotification(message, type);
        }
    });
    
    socket.on('profile-updated', (data) => {
        if (currentUser) {
            currentUser.firstName = data.firstName || currentUser.firstName;
            currentUser.lastName = data.lastName || currentUser.lastName;
            currentUser.avatar = data.avatar || currentUser.avatar;
            currentUser.bio = data.bio || currentUser.bio;
            updateUserInterface();
        }
        showNotification('Профиль обновлен', 'success');
    });
    
    socket.on('message-edited', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = data.newText;
                const editedElement = messageElement.querySelector('.message-edited');
                if (!editedElement) {
                    const editedSpan = document.createElement('span');
                    editedSpan.className = 'message-edited';
                    editedSpan.textContent = ' (ред.)';
                    messageElement.querySelector('.message-content').appendChild(editedSpan);
                }
            }
        }
    });
    
    socket.on('new-room-created', (room) => {
        addRoomToList(room);
        showNotification(`Создана новая комната: ${room.name}`, 'success');
    });
    
    socket.on('message-deleted', (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
    
    socket.on('settings-updated', (settings) => {
        if (currentUser) {
            currentUser.settings = settings;
            applySettings(settings);
            showNotification('Настройки сохранены', 'success');
        }
    });
    
    socket.on('theme-changed', (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    });
}

function updateUserInterface() {
    if (!currentUser) return;
    
    const fullName = currentUser.fullName || currentUser.username;
    const username = currentUser.username;
    const avatar = currentUser.avatar;
    
    const userAvatar = document.getElementById('user-avatar');
    const currentFullname = document.getElementById('current-fullname');
    const currentUsername = document.getElementById('current-username');
    const profileAvatarLarge = document.getElementById('profile-avatar-large');
    const profileFullname = document.getElementById('profile-fullname');
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-bio');
    const profileRole = document.getElementById('profile-role');
    
    if (userAvatar) userAvatar.src = avatar;
    if (currentFullname) currentFullname.textContent = fullName;
    if (currentUsername) currentUsername.textContent = `@${username}`;
    if (profileAvatarLarge) profileAvatarLarge.src = avatar;
    if (profileFullname) profileFullname.textContent = fullName;
    if (profileUsername) profileUsername.textContent = `@${username}`;
    if (profileBio) profileBio.textContent = currentUser.bio || 'Нет информации';
    if (profileRole) {
        profileRole.textContent = currentUser.isAdmin ? 'ADMIN' : 'USER';
        if (currentUser.username === 'AlgorithmIntensity') {
            profileRole.innerHTML = '<i class="fas fa-crown"></i> СОЗДАТЕЛЬ';
            profileRole.className = 'role-badge special-admin';
        }
    }
    
    const editFirstname = document.getElementById('edit-firstname');
    const editLastname = document.getElementById('edit-lastname');
    const editBio = document.getElementById('edit-bio');
    const editColor = document.getElementById('edit-color');
    
    if (editFirstname) editFirstname.value = currentUser.firstName || '';
    if (editLastname) editLastname.value = currentUser.lastName || '';
    if (editBio) editBio.value = currentUser.bio || '';
    if (editColor) editColor.value = `#${currentUser.avatarColor || '0078D4'}`;
    
    updateMuteStatus(currentUser.isMuted || false);
    
    if (currentUser.settings) {
        applySettings(currentUser.settings);
    }
}

function updateMuteStatus(isMuted) {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!messageInput || !sendBtn) return;
    
    if (isMuted) {
        messageInput.disabled = true;
        messageInput.placeholder = '🔇 Вы заглушены и не можете писать';
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
    } else {
        messageInput.disabled = false;
        messageInput.placeholder = 'Введите сообщение... (Shift+Enter для новой строки)';
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
}

function updateChatTitle(title, type, description = '') {
    const titleElement = document.getElementById('current-chat-title');
    const typeElement = document.getElementById('chat-type');
    const descElement = document.getElementById('chat-description');
    
    if (titleElement) titleElement.innerHTML = `<i class="fas fa-${type === 'private' ? 'lock' : 'hashtag'}"></i> ${title}`;
    if (typeElement) typeElement.textContent = type === 'private' ? 'PRIVATE' : 'PUBLIC';
    if (descElement) descElement.textContent = description || '';
}

function sendMessage() {
    if (!socket || !currentUser) return;
    
    const input = document.getElementById('message-input');
    const text = input?.value.trim() || '';
    const file = uploadedFiles[0];
    
    if (!text && !file) return;
    
    if (currentUser.isMuted) {
        showNotification('Вы заглушены и не можете отправлять сообщения', 'error');
        return;
    }
    
    const isAudioFile = file?.type?.startsWith('audio/') || file?.isAudio;
    
    const messageData = {
        text: text,
        fileUrl: file?.url,
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size
    };
    
    if (isAudioFile) {
        messageData.isAudio = true;
        messageData.duration = file?.duration || 0;
    }
    
    if (currentPrivateChat) {
        socket.emit('send-private-message', messageData);
    } else if (currentRoom) {
        socket.emit('send-message', messageData);
    }
    
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    
    uploadedFiles = [];
    updateUploadPreview();
    socket.emit('stop-typing');
    if (input) input.focus();
}

function sendAudioMessage(audioData) {
    if (!socket || !currentUser) return;
    
    if (currentUser.isMuted) {
        showNotification('Вы заглушены и не можете отправлять сообщения', 'error');
        return;
    }
    
    const messageData = {
        text: `🎵 ${audioData.fileName}`,
        fileUrl: audioData.url,
        fileName: audioData.name,
        fileType: audioData.type,
        fileSize: audioData.size,
        isAudio: true,
        duration: audioData.duration || 0
    };
    
    if (currentPrivateChat) {
        socket.emit('send-private-message', messageData);
    } else if (currentRoom) {
        socket.emit('send-message', messageData);
    }
}

function handleTyping() {
    const input = document.getElementById('message-input');
    if (!input || !socket) return;
    
    if (input.value.trim()) {
        socket.emit('typing');
    } else {
        socket.emit('stop-typing');
    }
    
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
}

function joinRoom(roomId) {
    if (socket) {
        socket.emit('join-room', roomId);
    }
}

function startPrivateChat() {
    const select = document.getElementById('private-user-select');
    const targetUsername = select?.value;
    
    if (targetUsername && socket) {
        socket.emit('start-private-chat', targetUsername);
    }
}

function startPrivateChatWith(username) {
    if (socket) {
        socket.emit('start-private-chat', username);
    }
}

function createRoomDialog() {
    const roomName = prompt('Введите название новой комнаты:');
    if (roomName && roomName.trim()) {
        const roomId = roomName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        joinRoom(roomId);
    }
}

function createPrivateRoom() {
    const roomName = document.getElementById('new-room-name')?.value.trim();
    const description = document.getElementById('new-room-description')?.value.trim();
    const isPrivate = document.getElementById('room-is-private')?.checked;
    
    if (!roomName) {
        showNotification('Введите название комнаты', 'error');
        return;
    }
    
    const allowedUsers = Array.from(document.querySelectorAll('#allowed-users-list .user-tag'))
        .map(tag => tag.dataset.username);
    
    if (socket && currentUser) {
        socket.emit('admin-action', {
            action: 'create-private-room',
            roomName: roomName,
            description: description,
            allowedUsers: isPrivate ? [...allowedUsers, currentUser.username] : [],
            isPrivate: isPrivate
        });
        
        showNotification('Комната создана', 'success');
        document.getElementById('new-room-name').value = '';
        document.getElementById('new-room-description').value = '';
        document.getElementById('allowed-users-list').innerHTML = '';
    }
}

function performAdminAction(action) {
    const userSelect = document.getElementById('admin-user-select');
    const targetUsername = userSelect?.value;
    const duration = document.getElementById('mute-duration')?.value;
    const reason = document.getElementById('admin-reason')?.value;
    
    if (!targetUsername) {
        showNotification('Выберите пользователя', 'error');
        return;
    }
    
    if (socket && currentUser && currentUser.isAdmin) {
        socket.emit('admin-action', {
            action: action,
            target: targetUsername,
            duration: duration ? parseInt(duration) : 300,
            reason: reason || 'Нарушение правил'
        });
        
        showNotification(`Действие "${action}" выполнено для ${targetUsername}`, 'success');
        
        document.getElementById('mute-duration').value = '';
        document.getElementById('admin-reason').value = '';
    }
}

function updateUserProfile() {
    const userSelect = document.getElementById('admin-user-select');
    const targetUsername = userSelect?.value;
    const firstName = document.getElementById('admin-edit-firstname')?.value.trim();
    const lastName = document.getElementById('admin-edit-lastname')?.value.trim();
    const bio = document.getElementById('admin-edit-bio')?.value.trim();
    const color = document.getElementById('admin-edit-color')?.value.replace('#', '');
    
    if (!targetUsername) {
        showNotification('Выберите пользователя', 'error');
        return;
    }
    
    if (socket && currentUser && currentUser.isAdmin) {
        socket.emit('admin-action', {
            action: 'update-profile',
            target: targetUsername,
            firstName: firstName,
            lastName: lastName,
            bio: bio,
            avatarColor: color
        });
        
        showNotification('Профиль пользователя обновлен', 'success');
    }
}

function updateOwnProfile() {
    const firstName = document.getElementById('edit-firstname')?.value.trim();
    const lastName = document.getElementById('edit-lastname')?.value.trim();
    const bio = document.getElementById('edit-bio')?.value.trim();
    const color = document.getElementById('edit-color')?.value.replace('#', '');
    
    if (socket && currentUser) {
        socket.emit('update-profile', {
            firstName: firstName,
            lastName: lastName,
            bio: bio,
            avatarColor: color
        });
    }
}

function updateChatMessages(messages) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fab fa-microsoft"></i>
                </div>
                <h2>Начните общение</h2>
                <p>Будьте первым, кто напишет в этом чате!</p>
                <div class="welcome-features">
                    <div class="feature">
                        <i class="fas fa-smile"></i>
                        <span>Эмодзи</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-file-upload"></i>
                        <span>Файлы до 500МБ</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-user-friends"></i>
                        <span>Приватные чаты</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        if (message.isPrivate || message.from) {
            addPrivateMessageToChat(message);
        } else {
            addMessageToChat(message);
        }
    });
    
    scrollToBottom();
}

function addMessageToChat(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    if (container.querySelector('.welcome-message')) {
        container.innerHTML = '';
    }
    
    const isOwnMessage = message.userId === socket?.id || message.username === currentUser?.username;
    const isAdminMessage = message.isAdmin;
    const isSpecialAdmin = message.username === 'AlgorithmIntensity';
    const isFileMessage = message.isFile;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-sender', message.username);
    
    let adminBadge = '';
    if (isAdminMessage) {
        if (isSpecialAdmin) {
            adminBadge = '<span class="special-admin-badge"><i class="fas fa-crown"></i> ADMIN</span>';
        } else {
            adminBadge = '<span class="admin-badge">ADMIN</span>';
        }
    }
    
    let fileContent = '';
    if (isFileMessage && message.fileUrl) {
        const isImage = message.fileType?.startsWith('image/');
        const isVideo = message.fileType?.startsWith('video/');
        const isAudio = message.isAudio || message.fileType?.startsWith('audio/');
        const fileSize = formatFileSize(message.fileSize);
        
        if (isImage) {
            fileContent = `
                <div class="message-file">
                    <div class="file-preview">
                        <img src="${message.fileUrl}" alt="${message.fileName}" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fullName || message.username}', '${message.time}', '${fileSize}', 'image')">
                        <div class="play-overlay">
                            <button class="play-button" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fullName || message.username}', '${message.time}', '${fileSize}', 'image')">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            <i class="fas fa-image"></i> ${message.fileName}
                        </div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            `;
        } else if (isVideo) {
            fileContent = `
                <div class="message-file">
                    <div class="file-preview">
                        <video controls>
                            <source src="${message.fileUrl}" type="${message.fileType}">
                            Ваш браузер не поддерживает видео.
                        </video>
                        <div class="play-overlay">
                            <button class="play-button" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fullName || message.username}', '${message.time}', '${fileSize}', 'video')">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            <i class="fas fa-video"></i> ${message.fileName}
                        </div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            `;
        } else if (isAudio) {
            const duration = formatDuration(message.duration);
            fileContent = `
                <div class="message-file audio-message">
                    <div class="audio-player">
                        <div class="audio-info">
                            <div class="audio-icon">
                                <i class="fas fa-music"></i>
                            </div>
                            <div class="audio-details">
                                <div class="audio-name">${message.fileName}</div>
                                <div class="audio-meta">
                                    <span class="audio-duration">${duration}</span>
                                    <span class="audio-size">${fileSize}</span>
                                </div>
                            </div>
                        </div>
                        <button class="play-audio-btn" data-audio-url="${message.fileUrl}">
                            <i class="fas fa-play"></i>
                        </button>
                        <audio class="audio-element" src="${message.fileUrl}" preload="metadata"></audio>
                    </div>
                </div>
            `;
        } else {
            fileContent = `
                <div class="message-file">
                    <div class="file-info">
                        <div class="file-name">
                            <i class="fas fa-file"></i> ${message.fileName}
                        </div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            `;
        }
    }
    
    const messageText = message.text ? `<div class="message-text">${formatMessageText(message.text)}</div>` : '';
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            <img src="${message.avatar}" alt="${message.fullName || message.username}">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${message.fullName || message.username} ${adminBadge}</span>
                <span class="message-time">${message.time}</span>
            </div>
            ${messageText}
            ${fileContent}
            ${message.isEdited ? '<span class="message-edited"> (ред.)</span>' : ''}
            ${isOwnMessage ? `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="editMessage(${message.id})">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="message-action-btn" onclick="deleteMessage(${message.id})">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    if (message.text && (message.text.includes('youtube.com') || message.text.includes('youtu.be'))) {
        enhanceYouTubeEmbeds();
    }

    container.appendChild(messageElement);
}

function addPrivateMessageToChat(message) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    if (container.querySelector('.welcome-message')) {
        container.innerHTML = '';
    }
    
    const isOwnMessage = message.from === currentUser?.username;
    const isFileMessage = message.isFile;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message private-message ${isOwnMessage ? 'own' : ''}`;
    messageElement.setAttribute('data-message-id', message.id);
    messageElement.setAttribute('data-sender', message.from);
    
    let fileContent = '';
    if (isFileMessage && message.fileUrl) {
        const isImage = message.fileType?.startsWith('image/');
        const isVideo = message.fileType?.startsWith('video/');
        const fileSize = formatFileSize(message.fileSize);
        
        if (isImage) {
            fileContent = `
                <div class="message-file">
                    <div class="file-preview">
                        <img src="${message.fileUrl}" alt="${message.fileName}" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fromName || message.from}', '${message.time}', '${fileSize}', 'image')">
                        <div class="play-overlay">
                            <button class="play-button" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fromName || message.from}', '${message.time}', '${fileSize}', 'image')">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            <i class="fas fa-image"></i> ${message.fileName}
                        </div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            `;
        } else if (isVideo) {
            fileContent = `
                <div class="message-file">
                    <div class="file-preview">
                        <video controls>
                            <source src="${message.fileUrl}" type="${message.fileType}">
                            Ваш браузер не поддерживает видео.
                        </video>
                        <div class="play-overlay">
                            <button class="play-button" onclick="previewFile('${message.fileUrl}', '${message.fileName}', '${message.fromName || message.from}', '${message.time}', '${fileSize}', 'video')">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                    <div class="file-info">
                        <div class="file-name">
                            <i class="fas fa-video"></i> ${message.fileName}
                        </div>
                        <div class="file-size">${fileSize}</div>
                    </div>
                </div>
            `;
        }
    }
    
    const messageText = message.text ? `<div class="message-text">${formatMessageText(message.text)}</div>` : '';
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            <img src="${isOwnMessage ? currentUser.avatar : getAvatarForUser(message.from)}" 
                 alt="${isOwnMessage ? currentUser.fullName : message.fromName}">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${isOwnMessage ? 'Вы' : message.fromName || message.from}</span>
                <span class="message-time">${message.time}</span>
            </div>
            ${messageText}
            ${fileContent}
        </div>
    `;
    
    container.appendChild(messageElement);
}

function addSystemMessage(text) {
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message message-system';
    systemMessage.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
        </div>
    `;
    container.appendChild(systemMessage);
    scrollToBottom();
}

function formatMessageText(text) {
    if (!text) return '';
    
    let formattedText = text;

    const smileyMap = {
        ':)': '😊',
        '(:': '😊',
        ':(': '😔',
        ';)': '😉',
        ':D': '😃',
        ':P': '😛',
        ':O': '😮',
        ':*': '😘',
        '<3': '❤️',
        '</3': '💔',
        ':3': '😺'
    };
    
    Object.keys(smileyMap).forEach(smiley => {
        const regex = new RegExp(smiley.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        formattedText = formattedText.replace(regex, smileyMap[smiley]);
    });
    
    formattedText = formattedText.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s<]*)?/g;
    
    const originalText = formattedText;
    const youtubeMatches = [];
    let match;
    while ((match = youtubeRegex.exec(text)) !== null) {
        youtubeMatches.push({
            fullUrl: match[0],
            videoId: match[1],
            index: match.index
        });
    }
    
    if (youtubeMatches.length > 0) {
        const lastMatch = youtubeMatches[youtubeMatches.length - 1];
        
        formattedText = originalText.replace(lastMatch.fullUrl, 
            `<div class="youtube-embed-container">
                <div class="youtube-link">
                    <a href="${lastMatch.fullUrl}" target="_blank" class="message-link">
                        <i class="fab fa-youtube"></i> YouTube: ${lastMatch.fullUrl}
                    </a>
                </div>
                <div class="youtube-video">
                    <iframe width="560" height="315" src="https://www.youtube.com/embed/${lastMatch.videoId}" title="Azure iFrame" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                </div>
            </div>`
        );
        
        youtubeMatches.slice(0, -1).forEach(ytMatch => {
            const regex = new RegExp(ytMatch.fullUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            formattedText = formattedText.replace(regex, 
                `<a href="${ytMatch.fullUrl}" target="_blank" class="message-link youtube-mini">
                    <i class="fab fa-youtube"></i> ${ytMatch.fullUrl}
                </a>`
            );
        });
    }
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    formattedText = formattedText.replace(urlRegex, (url) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return url;
        }
        return `<a href="${url}" target="_blank" class="message-link">${url}</a>`;
    });
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateUsersList(users) {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    const userSearch = document.getElementById('user-search')?.value.toLowerCase() || '';
    
    container.innerHTML = '';
    
    const filteredUsers = users.filter(user => 
        (user.fullName?.toLowerCase().includes(userSearch) || 
         user.username.toLowerCase().includes(userSearch)) && 
        user.username !== currentUser?.username
    );
    
    filteredUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.setAttribute('data-username', user.username);
        
        const avatarUrl = user.avatar || getAvatarForUser(user.username);
        
        userItem.innerHTML = `
            <img src="${avatarUrl}" alt="${user.fullName}" class="user-avatar-small">
            <div class="user-info-small">
                <div class="user-name-small">
                    ${user.fullName || user.username}
                    ${user.isAdmin ? (user.username === 'AlgorithmIntensity' ? '<i class="fas fa-crown" style="color: #FF4500;"></i>' : '👑') : ''}
                    ${user.isMuted ? '🔇' : ''}
                </div>
                <div class="user-status-small ${user.online ? 'online' : ''}">
                    ${user.online ? '🟢 В сети' : '⚫ Не в сети'}
                </div>
            </div>
            ${!user.isMuted ? `
                <button class="icon-btn" onclick="startPrivateChatWith('${user.username}')" title="Начать приватный чат">
                    <i class="fas fa-comment"></i>
                </button>
            ` : ''}
        `;
        
        userItem.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                showUserProfile(user);
            }
        });
        
        container.appendChild(userItem);
    });
    
    updateAdminUserSelect(users);
    updatePrivateUserSelect(users);
}

function updateAdminUserSelect(users) {
    const select = document.getElementById('admin-user-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите пользователя</option>';
    
    users.forEach(user => {
        if (user.username !== currentUser?.username) {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = `${user.fullName || user.username} ${user.isAdmin ? '(Admin)' : ''} ${user.isMuted ? '(Muted)' : ''}`;
            select.appendChild(option);
        }
    });
}

function updatePrivateUserSelect(users) {
    const select = document.getElementById('private-user-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите пользователя</option>';
    
    users.forEach(user => {
        if (user.username !== currentUser?.username && !user.isMuted) {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = `${user.fullName || user.username} ${user.isAdmin ? '👑' : ''}`;
            select.appendChild(option);
        }
    });
}

function loadRooms(rooms) {
    roomsList = rooms;
    const container = document.getElementById('rooms-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    rooms.forEach(room => {
        addRoomToList(room);
    });
}

function addRoomToList(room) {
    const container = document.getElementById('rooms-list');
    if (!container) return;
    
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.setAttribute('data-room-id', room.id);
    
    const icon = room.isPrivate ? 'fas fa-lock' : 'fas fa-hashtag';
    const color = room.isPrivate ? '#FFB900' : '#0078D4';
    
    roomItem.innerHTML = `
        <div class="room-icon" style="background: ${color}">
            <i class="${icon}"></i>
        </div>
        <div class="room-info">
            <div class="room-name">
                ${room.name}
                ${room.isPrivate ? '<span class="badge" style="background: #605E5C; font-size: 10px; padding: 1px 6px;">PRIVATE</span>' : ''}
            </div>
            <div class="room-stats">${room.userCount || 0} участников</div>
            <div class="room-description">${room.description || ''}</div>
        </div>
    `;
    
    roomItem.addEventListener('click', () => {
        if (room.isPrivate && !room.allowedUsers?.includes(currentUser?.username) && room.createdBy !== currentUser?.username) {
            showNotification('У вас нет доступа к этой комнате', 'error');
            return;
        }
        joinRoom(room.id);
    });
    
    container.appendChild(roomItem);
}

function updateRoomsList() {
    document.querySelectorAll('#rooms-list .room-item').forEach(item => {
        if (item.dataset.roomId === currentRoom) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function loadPrivateChats(privateMessages) {
    privateChats = privateMessages;
    const container = document.getElementById('private-chats-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    privateMessages.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `private-chat-item ${chat.unread ? 'unread' : ''}`;
        chatItem.setAttribute('data-user', chat.with);
        
        chatItem.innerHTML = `
            <img src="${getAvatarForUser(chat.with)}" alt="${chat.with}" class="private-chat-avatar">
            <div class="private-chat-info">
                <div class="private-chat-name">${chat.with}</div>
                <div class="private-last-message">${chat.lastMessage || 'Нет сообщений'}</div>
            </div>
            ${chat.unread ? '<div class="unread-badge">!</div>' : ''}
        `;
        
        chatItem.addEventListener('click', () => startPrivateChatWith(chat.with));
        container.appendChild(chatItem);
    });
    
    updateUnreadCount();
}

function updatePrivateChatNotification(username) {
    const chatItem = document.querySelector(`#private-chats-list .private-chat-item[data-user="${username}"]`);
    if (chatItem) {
        chatItem.classList.add('unread');
        if (!chatItem.querySelector('.unread-badge')) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = '!';
            chatItem.appendChild(badge);
        }
        updateUnreadCount();
    }
}

function updateUnreadCount() {
    const unreadItems = document.querySelectorAll('#private-chats-list .private-chat-item.unread').length;
    const unreadBadge = document.getElementById('unread-private-count');
    
    if (!unreadBadge) return;
    
    if (unreadItems > 0) {
        unreadBadge.textContent = unreadItems;
        unreadBadge.style.display = 'inline-block';
    } else {
        unreadBadge.style.display = 'none';
    }
}

function loadMediaGallery() {
    const container = document.getElementById('media-gallery');
    if (!container) return;
    
    container.innerHTML = '';
    
    const mediaFiles = uploadedFiles.filter(file => 
        file.fileType?.startsWith('image/') || file.fileType?.startsWith('video/')
    );
    
    if (mediaFiles.length === 0) {
        container.innerHTML = `
            <div class="media-empty">
                <i class="fas fa-photo-video"></i>
                <p>Здесь будут отображаться фото и видео из чата</p>
            </div>
        `;
        return;
    }
    
    mediaFiles.slice(-12).reverse().forEach(file => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        
        if (file.fileType?.startsWith('image/')) {
            mediaItem.innerHTML = `
                <img src="${file.fileUrl}" alt="${file.fileName}" onclick="previewFile('${file.fileUrl}', '${file.fileName}', '${file.fullName || file.username}', '${file.time}', '${formatFileSize(file.fileSize)}', 'image')">
            `;
        } else if (file.fileType?.startsWith('video/')) {
            mediaItem.innerHTML = `
                <video onclick="previewFile('${file.fileUrl}', '${file.fileName}', '${file.fullName || file.username}', '${file.time}', '${formatFileSize(file.fileSize)}', 'video')">
                    <source src="${file.fileUrl}" type="${file.fileType}">
                </video>
                <div class="play-icon">
                    <i class="fas fa-play"></i>
                </div>
            `;
        }
        
        container.appendChild(mediaItem);
    });
}

function showUserProfile(user) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-user-circle"></i> Профиль пользователя</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="profile-info">
                    <img src="${user.avatar}" alt="${user.fullName}" class="profile-avatar-large">
                    <h4>${user.fullName || user.username}</h4>
                    <p class="profile-username">@${user.username}</p>
                    <p class="profile-bio">${user.bio || 'Нет информации'}</p>
                    <div class="profile-stats">
                        <div class="stat">
                            <i class="fas fa-user-tag"></i>
                            <span>Роль: ${user.isAdmin ? (user.username === 'AlgorithmIntensity' ? '<span class="role-badge special-admin"><i class="fas fa-crown"></i> СОЗДАТЕЛЬ</span>' : '<span class="role-badge">ADMIN</span>') : '<span class="role-badge">USER</span>'}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-circle"></i>
                            <span>Статус: ${user.online ? '<span style="color: #28a745;">🟢 В сети</span>' : '<span style="color: #6c757d;">⚫ Не в сети</span>'}</span>
                        </div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button onclick="startPrivateChatWith('${user.username}'); this.closest('.modal').remove()" class="primary-btn" ${user.isMuted ? 'disabled' : ''}>
                        <i class="fas fa-comment"></i> Написать сообщение
                    </button>
                    ${currentUser?.isAdmin ? `
                        <button onclick="showAdminUserActions('${user.username}')" class="primary-btn" style="margin-top: 10px;">
                            <i class="fas fa-shield-alt"></i> Действия администратора
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showAdminUserActions(username) {
    document.querySelectorAll('.modal').forEach(m => m.remove());
    
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-shield-alt"></i> Действия администратора</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="admin-actions">
                    <h4>Пользователь: ${username}</h4>
                    <div class="action-buttons" style="grid-template-columns: 1fr;">
                        <button onclick="adminMuteUser('${username}')" class="admin-action-btn warning">
                            <i class="fas fa-volume-mute"></i> Заглушить
                        </button>
                        <button onclick="adminUnmuteUser('${username}')" class="admin-action-btn success">
                            <i class="fas fa-volume-up"></i> Снять заглушение
                        </button>
                        <button onclick="adminBanUser('${username}')" class="admin-action-btn danger">
                            <i class="fas fa-ban"></i> Заблокировать
                        </button>
                        <button onclick="adminEditProfile('${username}')" class="admin-action-btn">
                            <i class="fas fa-user-edit"></i> Редактировать профиль
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function adminMuteUser(username) {
    const duration = prompt('Введите длительность заглушения (в секундах):', '300');
    const reason = prompt('Введите причину:');
    
    if (duration && !isNaN(duration)) {
        performAdminAction('mute', username, parseInt(duration), reason);
    }
}

function adminUnmuteUser(username) {
    performAdminAction('unmute', username);
}

function adminBanUser(username) {
    const reason = prompt('Введите причину блокировки:');
    if (reason) {
        performAdminAction('ban', username, null, reason);
    }
}

function adminEditProfile(username) {
    const firstName = prompt('Новое имя:');
    const lastName = prompt('Новая фамилия:');
    const bio = prompt('Новая информация о себе:');
    
    if (socket && currentUser && currentUser.isAdmin) {
        socket.emit('admin-action', {
            action: 'update-profile',
            target: username,
            firstName: firstName,
            lastName: lastName,
            bio: bio
        });
    }
}

function showProfile() {
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.add('show');
}

function showSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (!settingsModal) return;
    
    settingsModal.classList.add('show');
    loadCurrentSettings();
}

function loadCurrentSettings() {
    if (!currentUser) return;
    
    const settings = currentUser.settings || {
        theme: 'light',
        notifications: true,
        sound: true,
        autoDownload: false,
        messagePreview: false,
        privacy: 'everyone',
        onlineStatus: true,
        language: 'ru',
        timeFormat: '24',
        fontSize: 'medium'
    };
    
    document.getElementById('setting-theme').checked = settings.theme === 'dark';
    document.getElementById('setting-notifications').checked = settings.notifications;
    document.getElementById('setting-sound').checked = settings.sound;
    document.getElementById('setting-auto-download').checked = settings.autoDownload;
    document.getElementById('setting-message-preview').checked = settings.messagePreview;
    document.getElementById('setting-privacy').value = settings.privacy;
    document.getElementById('setting-online-status').checked = settings.onlineStatus;
    document.getElementById('setting-language').value = settings.language;
    document.getElementById('setting-time-format').value = settings.timeFormat;
    document.getElementById('setting-font-size').value = settings.fontSize;
}

function saveSettings() {
    if (!currentUser) return;
    
    const settings = {
        theme: document.getElementById('setting-theme').checked ? 'dark' : 'light',
        notifications: document.getElementById('setting-notifications').checked,
        sound: document.getElementById('setting-sound').checked,
        autoDownload: document.getElementById('setting-auto-download').checked,
        messagePreview: document.getElementById('setting-message-preview').checked,
        privacy: document.getElementById('setting-privacy').value,
        onlineStatus: document.getElementById('setting-online-status').checked,
        language: document.getElementById('setting-language').value,
        timeFormat: document.getElementById('setting-time-format').value,
        fontSize: document.getElementById('setting-font-size').value
    };
    
    if (socket) {
        socket.emit('update-settings', { settings });
    }
    
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.classList.remove('show');
    }
}

function resetSettings() {
    const defaultSettings = {
        theme: 'light',
        notifications: true,
        sound: true,
        autoDownload: false,
        messagePreview: false,
        privacy: 'everyone',
        onlineStatus: true,
        language: 'ru',
        timeFormat: '24',
        fontSize: 'medium'
    };
    
    document.getElementById('setting-theme').checked = defaultSettings.theme === 'dark';
    document.getElementById('setting-notifications').checked = defaultSettings.notifications;
    document.getElementById('setting-sound').checked = defaultSettings.sound;
    document.getElementById('setting-auto-download').checked = defaultSettings.autoDownload;
    document.getElementById('setting-message-preview').checked = defaultSettings.messagePreview;
    document.getElementById('setting-privacy').value = defaultSettings.privacy;
    document.getElementById('setting-online-status').checked = defaultSettings.onlineStatus;
    document.getElementById('setting-language').value = defaultSettings.language;
    document.getElementById('setting-time-format').value = defaultSettings.timeFormat;
    document.getElementById('setting-font-size').value = defaultSettings.fontSize;
    
    showNotification('Настройки сброшены к значениям по умолчанию', 'info');
}

function applySettings(settings) {
    if (!settings) return;
    
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    } else {
        document.body.classList.remove('dark-theme');
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
    
    document.body.style.fontSize = {
        small: '14px',
        medium: '15px',
        large: '16px'
    }[settings.fontSize] || '15px';
    
    localStorage.setItem('userSettings', JSON.stringify(settings));
}

function loadSettings() {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            applySettings(settings);
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

function showAdminPanel() {
    if (!currentUser || !currentUser.isAdmin) return;
    
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.add('show');
    
    refreshAdminMessages();
    updateAdminStats();
}

function showNewPrivateModal() {
    const newPrivateModal = document.getElementById('new-private-modal');
    if (newPrivateModal) newPrivateModal.classList.add('show');
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.remove('active'));
    
    const tab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
    const panel = document.getElementById(`admin-${tabName}-tab`);
    
    if (tab) tab.classList.add('active');
    if (panel) panel.classList.add('active');
}

function toggleAllowedUsers() {
    const isPrivate = document.getElementById('room-is-private')?.checked;
    const allowedUsersGroup = document.getElementById('allowed-users-group');
    if (allowedUsersGroup) {
        allowedUsersGroup.style.display = isPrivate ? 'block' : 'none';
    }
}

function addAllowedUser() {
    const input = document.getElementById('add-allowed-user');
    const username = input?.value.trim();
    
    if (!username || !input) return;
    
    const tagsContainer = document.getElementById('allowed-users-list');
    if (!tagsContainer) return;
    
    const tag = document.createElement('div');
    tag.className = 'user-tag';
    tag.dataset.username = username;
    tag.innerHTML = `
        ${username}
        <button class="remove-tag" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    tagsContainer.appendChild(tag);
    input.value = '';
}

function refreshAdminMessages() {
    if (!currentRoom) return;
    
    const messageList = document.getElementById('admin-message-list');
    if (!messageList) return;
    
    const messages = Array.from(document.querySelectorAll('.message')).slice(-20);
    
    messageList.innerHTML = '';
    
    messages.forEach(msg => {
        const messageId = msg.dataset.messageId;
        const username = msg.querySelector('.message-username')?.textContent || 'Неизвестно';
        const text = msg.querySelector('.message-text')?.textContent || '';
        const time = msg.querySelector('.message-time')?.textContent || '';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'admin-message-item';
        messageElement.innerHTML = `
            <div class="admin-message-header">
                <strong>${username}</strong>
                <span class="message-time-small">${time}</span>
            </div>
            <div class="admin-message-text">${text.substring(0, 100)}${text.length > 100 ? '...' : ''}</div>
            <div class="admin-message-actions">
                <button onclick="adminDeleteMessage('${messageId}')" class="small-btn danger">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        `;
        messageList.appendChild(messageElement);
    });
}

function updateAdminStats() {
    const statTotalUsers = document.getElementById('stat-total-users');
    const statOnlineUsers = document.getElementById('stat-online-users');
    const statTotalMessages = document.getElementById('stat-total-messages');
    const statTotalFiles = document.getElementById('stat-total-files');
    
    if (statTotalUsers) statTotalUsers.textContent = usersOnline.length;
    if (statOnlineUsers) statOnlineUsers.textContent = usersOnline.filter(u => u.online).length;
    if (statTotalMessages) statTotalMessages.textContent = '0';
    if (statTotalFiles) statTotalFiles.textContent = uploadedFiles.length;
}

function adminDeleteMessage(messageId) {
    if (socket && currentUser && currentUser.isAdmin && currentRoom) {
        socket.emit('admin-action', {
            action: 'delete-message',
            messageId: messageId,
            roomId: currentRoom
        });
    }
}

function editMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const textElement = messageElement.querySelector('.message-text');
    const currentText = textElement?.textContent || '';
    
    const newText = prompt('Редактировать сообщение:', currentText);
    if (newText !== null && newText.trim() && newText !== currentText) {
        if (socket) {
            socket.emit('edit-message', {
                messageId: messageId,
                newText: newText.trim()
            });
        }
    }
}

function deleteMessage(messageId) {
    if (confirm('Удалить это сообщение?')) {
        adminDeleteMessage(messageId);
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
    }
    
    const theme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    showNotification(`Тема изменена на ${theme === 'dark' ? 'тёмную' : 'светлую'}`, 'info');
    
    if (socket && currentUser) {
        socket.emit('update-settings', { 
            settings: { 
                ...currentUser.settings, 
                theme: theme 
            } 
        });
    }
}

function initEmojiPicker() {
    emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    const pickerContent = document.createElement('div');
    pickerContent.className = 'emoji-picker-content';
    
    EMOJI_CATEGORIES.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.className = 'emoji-category';
        categorySection.innerHTML = `<h4>${category.name}</h4>`;
        
        const emojisGrid = document.createElement('div');
        emojisGrid.className = 'emoji-grid';
        
        category.emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-btn';
            emojiBtn.textContent = emoji;
            emojiBtn.addEventListener('click', () => insertEmoji(emoji));
            emojisGrid.appendChild(emojiBtn);
        });
        
        categorySection.appendChild(emojisGrid);
        pickerContent.appendChild(categorySection);
    });
    
    emojiPicker.appendChild(pickerContent);
    
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target.id !== 'emoji-btn') {
            emojiPicker.classList.remove('show');
        }
    });
}

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (!emojiPicker) return;
    
    emojiPicker.classList.toggle('show');
    
    if (emojiPicker.classList.contains('show')) {
        const emojiBtn = document.getElementById('emoji-btn');
        if (emojiBtn) {
            const rect = emojiBtn.getBoundingClientRect();
            emojiPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
            emojiPicker.style.right = `${window.innerWidth - rect.right}px`;
        }
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    if (!input) return;
    
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    
    input.value = text.substring(0, start) + emoji + text.substring(end);
    input.focus();
    input.setSelectionRange(start + emoji.length, start + emoji.length);
    
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) emojiPicker.classList.remove('show');
    
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
}

function initFileUpload() {
    const fileInput = document.getElementById('file-upload');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        
        for (const file of files) {
            if (file.size > 500 * 1024 * 1024) {
                showNotification(`Файл "${file.name}" слишком большой (макс. 500МБ)`, 'error');
                continue;
            }
            
            if (!file.type.match(/(image|video)\//)) {
                showNotification(`Файл "${file.name}" не является изображением или видео`, 'error');
                continue;
            }
            
            fileUploadQueue.push(file);
        }
        
        if (fileUploadQueue.length > 0 && !isUploading) {
            processUploadQueue();
        }
        
        fileInput.value = '';
    });
}

async function processUploadQueue() {
    if (fileUploadQueue.length === 0 || isUploading) return;
    
    isUploading = true;
    const file = fileUploadQueue.shift();
    
    showUploadProgress(file.name, 0);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            
            uploadedFiles = [{
                url: result.fileUrl,
                name: file.name,
                type: file.type,
                size: file.size
            }];
            
            updateUploadPreview();
            showNotification(`Файл "${file.name}" загружен`, 'success');
        } else {
            throw new Error('Ошибка загрузки');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification(`Ошибка загрузки файла "${file.name}"`, 'error');
    } finally {
        hideUploadProgress();
        isUploading = false;
        
        if (fileUploadQueue.length > 0) {
            setTimeout(() => processUploadQueue(), 100);
        }
    }
}

function showUploadProgress(fileName, progress) {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (!progressBar || !progressFill || !progressText) return;
    
    progressBar.style.display = 'flex';
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Загрузка: ${fileName} (${progress}%)`;
}

function hideUploadProgress() {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressBar) progressBar.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
}

function cancelUpload() {
    fileUploadQueue = [];
    hideUploadProgress();
    isUploading = false;
    showNotification('Загрузка отменена', 'warning');
}

function updateUploadPreview() {
    const inputArea = document.querySelector('.input-container');
    const existingPreview = document.querySelector('.upload-preview');
    
    if (!inputArea) return;
    
    if (existingPreview) {
        existingPreview.remove();
    }
    
    if (uploadedFiles.length > 0) {
        const file = uploadedFiles[0];
        const preview = document.createElement('div');
        preview.className = 'upload-preview';
        
        if (file.type.startsWith('image/')) {
            preview.innerHTML = `
                <img src="${file.url}" alt="Preview" style="max-width: 100px; max-height: 100px; border-radius: 8px;">
                <button onclick="removeUploadedFile()" class="cancel-btn">
                    <i class="fas fa-times"></i>
                </button>
            `;
        } else {
            preview.innerHTML = `
                <div style="padding: 10px; background: #f0f0f0; border-radius: 8px;">
                    <i class="fas fa-file" style="font-size: 24px; margin-right: 10px;"></i>
                    <span>${file.name}</span>
                    <button onclick="removeUploadedFile()" class="cancel-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        inputArea.parentNode.insertBefore(preview, inputArea);
    }
}

function removeUploadedFile() {
    uploadedFiles = [];
    updateUploadPreview();
}

function previewFile(url, name, sender, time, size, type) {
    const modal = document.getElementById('file-preview-modal');
    const content = document.getElementById('file-preview-content');
    const title = document.getElementById('file-preview-title');
    const senderEl = document.getElementById('file-sender');
    const timeEl = document.getElementById('file-time');
    const sizeEl = document.getElementById('file-size');
    const downloadLink = document.getElementById('file-download-link');
    
    if (!modal || !content || !title || !senderEl || !timeEl || !sizeEl || !downloadLink) return;
    
    title.textContent = name;
    senderEl.textContent = sender;
    timeEl.textContent = time;
    sizeEl.textContent = size;
    downloadLink.href = url;
    downloadLink.download = name;
    
    if (type === 'image') {
        content.innerHTML = `<img src="${url}" alt="${name}" style="max-width: 100%; max-height: 60vh; border-radius: 8px;">`;
    } else if (type === 'video') {
        content.innerHTML = `
            <video controls autoplay style="max-width: 100%; max-height: 60vh; border-radius: 8px;">
                <source src="${url}" type="video/mp4">
                Ваш браузер не поддерживает видео.
            </video>
        `;
    }
    
    modal.classList.add('show');
}

function clearChat() {
    if (confirm('Очистить всю историю чата в этой комнате?')) {
        const container = document.getElementById('messages-container');
        if (container) {
            container.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <i class="fab fa-microsoft"></i>
                    </div>
                    <h2>Чат очищен</h2>
                    <p>Начните новое общение!</p>
                </div>
            `;
        }
        showNotification('История чата очищена', 'info');
    }
}

function handleGlobalSearch() {
    const query = document.getElementById('global-search')?.value.toLowerCase();
    if (!query) return;
    
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
        const text = msg.querySelector('.message-text')?.textContent.toLowerCase() || '';
        const sender = msg.querySelector('.message-username')?.textContent.toLowerCase() || '';
        
        if (text.includes(query) || sender.includes(query)) {
            msg.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
            msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            msg.style.backgroundColor = '';
        }
    });
    
    const users = document.querySelectorAll('.user-item');
    users.forEach(user => {
        const name = user.querySelector('.user-name-small')?.textContent.toLowerCase() || '';
        if (name.includes(query)) {
            user.style.backgroundColor = 'rgba(0, 120, 212, 0.1)';
        } else {
            user.style.backgroundColor = '';
        }
    });
}

function handleUserSearch() {
    const query = document.getElementById('user-search')?.value.toLowerCase();
    if (!query) return;
    
    updateUsersList(usersOnline);
    
    const users = document.querySelectorAll('.user-item');
    users.forEach(user => {
        const name = user.querySelector('.user-name-small')?.textContent.toLowerCase() || '';
        if (!name.includes(query)) {
            user.style.display = 'none';
        } else {
            user.style.display = 'flex';
        }
    });
}

function logout() {
    if (socket) {
        socket.disconnect();
    }
    
    currentUser = null;
    currentRoom = 'general';
    currentPrivateChat = null;
    usersOnline = [];
    roomsList = [];
    privateChats = [];
    uploadedFiles = [];
    eventListenersInitialized = false;
    
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    if (authScreen) authScreen.classList.add('active');
    if (chatScreen) chatScreen.classList.remove('active');
    
    showAuthError('');
    showNotification('Вы вышли из системы', 'info');
}

function getAvatarForUser(username) {
    const onlineUser = usersOnline.find(u => u.username === username);
    if (onlineUser) return onlineUser.avatar;
    
    const colors = ['0078D4', 'E81123', '107C10', 'FFB900', '5D5FEF', 'FF8C00', '00BCF2', '881798'];
    const color = colors[username.length % colors.length];
    const name = username.split(' ')[0] || username;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=128&bold=true`;
}

function showNotification(message, type = 'info') {
    if (currentUser?.settings?.notifications === false && type !== 'error') return;
    
    const container = document.getElementById('notification-center');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        'info': 'fas fa-info-circle',
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'mention': 'fas fa-at'
    };
    
    notification.innerHTML = `
        <div class="notification-header">
            <span class="notification-title">
                <i class="${icons[type] || 'fas fa-info-circle'}"></i>
                Azure Messenger
            </span>
            <span class="notification-close">&times;</span>
        </div>
        <div class="notification-body">${message}</div>
        <div class="notification-progress"></div>
    `;
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    if (type !== 'info' && currentUser?.settings?.sound !== false) {
        playNotificationSound();
    }
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 500;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not supported');
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function initAudioUpload() {
    const audioInput = document.createElement('input');
    audioInput.type = 'file';
    audioInput.id = 'audio-upload';
    audioInput.accept = 'audio/*';
    audioInput.style.display = 'none';
    document.body.appendChild(audioInput);
    
    const audioBtn = document.createElement('button');
    audioBtn.id = 'audio-btn';
    audioBtn.className = 'icon-btn tooltip';
    audioBtn.setAttribute('data-tooltip', 'Отправить музыку (MP3, WAV)');
    audioBtn.innerHTML = '<i class="fas fa-music"></i>';
    
    const inputActions = document.querySelector('.input-actions');
    if (inputActions) {
        inputActions.appendChild(audioBtn);
    }
    
    audioBtn.addEventListener('click', () => {
        audioInput.click();
    });

    audioInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.size > 50 * 1024 * 1024) {
                showNotification(`Аудио "${file.name}" слишком большое (макс. 50МБ)`, 'error');
                continue;
            }
            
            if (!SUPPORTED_AUDIO_TYPES.includes(file.type)) {
                showNotification(`Формат "${file.name}" не поддерживается`, 'error');
                continue;
            }
            
            audioUploadQueue.push(file);
        }
        
        if (audioUploadQueue.length > 0 && !isAudioUploading) {
            processAudioUploadQueue();
        }
        
        audioInput.value = '';
    });
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

async function processAudioUploadQueue() {
    if (audioUploadQueue.length === 0 || isAudioUploading) return;
    
    isAudioUploading = true;
    const file = audioUploadQueue.shift();
    
    showAudioUploadProgress(file.name, 0);
    
    const formData = new FormData();
    formData.append('audio', file);
    
    try {
        const response = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            const fullAudioUrl = window.location.origin + result.audioUrl;
            
            const audioData = {
                url: fullAudioUrl,
                name: result.fileName || file.name,
                type: result.mimeType || file.type,
                size: result.fileSize || file.size,
                duration: result.duration || 0,
                isAudio: true
            };
            
            sendAudioMessage(audioData);
            
            showNotification(`Аудио "${file.name}" отправлено`, 'success');
            
        } else {
            throw new Error('Ошибка загрузки аудио: ' + response.status);
        }
    } catch (error) {
        console.error('Audio upload error:', error);
        showNotification(`Ошибка загрузки аудио "${file.name}"`, 'error');
    } finally {
        hideAudioUploadProgress();
        isAudioUploading = false;
        
        if (audioUploadQueue.length > 0) {
            setTimeout(() => processAudioUploadQueue(), 100);
        }
    }
}

function showAudioUploadProgress(fileName, progress) {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (!progressBar || !progressFill || !progressText) return;
    
    progressBar.style.display = 'flex';
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Загрузка аудио: ${fileName} (${progress}%)`;
}

function hideAudioUploadProgress() {
    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    
    if (progressBar) progressBar.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
}

function playAudio(audioUrl) {
    const audioPlayer = document.getElementById('global-audio-player');
    
    if (!audioPlayer) {
        const player = document.createElement('audio');
        player.id = 'global-audio-player';
        player.controls = true;
        player.style.position = 'fixed';
        player.style.bottom = '20px';
        player.style.right = '20px';
        player.style.width = '300px';
        player.style.zIndex = '9999';
        player.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        player.style.borderRadius = '10px';
        document.body.appendChild(player);
    }
    
    const player = document.getElementById('global-audio-player');
    player.src = audioUrl;
    player.play().catch(e => {
        showNotification('Ошибка воспроизведения аудио', 'error');
    });
}

function enhanceYouTubeEmbeds() {
    setTimeout(() => {
        const youtubeEmbeds = document.querySelectorAll('.youtube-video iframe');
        
        youtubeEmbeds.forEach(iframe => {
            const container = iframe.closest('.youtube-video');
            
            iframe.addEventListener('load', () => {
                if (container) {
                    container.classList.add('loaded');
                }
            });
            
            iframe.addEventListener('error', () => {
                if (container) {
                    container.innerHTML = `
                        <div class="youtube-error" style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            background: #f8f9fa;
                            color: #6c757d;
                            text-align: center;
                            padding: 20px;
                        ">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; color: #ffc107;"></i>
                            <p style="font-size: 14px; margin: 0;">Не удалось загрузить видео</p>
                            <button onclick="retryYouTubeLoad(this)" style="
                                margin-top: 10px;
                                padding: 8px 16px;
                                background: #0078D4;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                cursor: pointer;
                            ">
                                <i class="fas fa-redo"></i> Попробовать снова
                            </button>
                        </div>
                    `;
                }
            });
        });
    }, 100);
}

function retryYouTubeLoad(button) {
    const errorContainer = button.closest('.youtube-error');
    const youtubeContainer = errorContainer.closest('.youtube-video');
    const iframe = youtubeContainer.querySelector('iframe');
    
    if (iframe && iframe.src) {
        const originalSrc = iframe.src;
        iframe.src = '';
        setTimeout(() => {
            iframe.src = originalSrc;
            errorContainer.remove();
        }, 100);
    }
}

window.startPrivateChatWith = startPrivateChatWith;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.adminDeleteMessage = adminDeleteMessage;
window.previewFile = previewFile;
window.removeUploadedFile = removeUploadedFile;
window.showUserProfile = showUserProfile;
window.adminMuteUser = adminMuteUser;
window.adminUnmuteUser = adminUnmuteUser;
window.adminBanUser = adminBanUser;
window.adminEditProfile = adminEditProfile;
window.showSettings = showSettings;

window.addEventListener('load', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeIcon = document.querySelector('#theme-toggle i');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
    }
});