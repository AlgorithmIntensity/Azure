const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads/audio', express.static(path.join(__dirname, 'uploads/audio')));

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIp();

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../client')));

const users = new Map();
const rooms = new Map();
const messages = new Map();
const privateMessages = new Map();
const userCredentials = new Map();
const admins = new Set(['admin', 'AlgorithmIntensity']);
const bannedUsers = new Set();

const USERS_FILE = path.join(__dirname, 'users.json');
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|mp4|avi|mov|wmv|flv|mkv|webm|mp3|mpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения и видео файлы разрешены'));
    }
  }
});

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      const usersData = JSON.parse(data);
      usersData.forEach(user => {
        userCredentials.set(user.username, {
          passwordHash: user.passwordHash,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          avatarColor: user.avatarColor || '0078D4',
          isAdmin: user.isAdmin || false,
          bio: user.bio || '',
          joinDate: user.joinDate || Date.now(),
          settings: user.settings || {
            theme: 'light',
            notifications: true,
            sound: true,
            autoDownload: false,
            messagePreview: true,
            privacy: 'public',
            language: 'ru'
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function saveUsers() {
  try {
    const usersData = Array.from(userCredentials.entries()).map(([username, data]) => ({
      username,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      avatarColor: data.avatarColor,
      isAdmin: data.isAdmin,
      bio: data.bio,
      joinDate: data.joinDate,
      settings: data.settings
    }));
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

loadUsers();

if (!userCredentials.has('admin')) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  userCredentials.set('admin', { 
    passwordHash: adminHash, 
    firstName: 'Admin',
    lastName: 'System',
    avatarColor: '107C10',
    isAdmin: true,
    bio: 'Системный администратор',
    joinDate: Date.now(),
    settings: {
      theme: 'light',
      notifications: true,
      sound: true,
      autoDownload: false,
      messagePreview: true,
      privacy: 'public',
      language: 'ru'
    }
  });
  saveUsers();
}

rooms.set('general', { 
  name: '🌍 Общий чат', 
  users: new Set(), 
  isPrivate: false,
  createdBy: 'system',
  description: 'Основной чат для всех пользователей'
});
rooms.set('random', { 
  name: '🎲 Случайные темы', 
  users: new Set(), 
  isPrivate: false,
  createdBy: 'system',
  description: 'Обсуждайте всё что угодно'
});
rooms.set('media', { 
  name: '📷 Фото и видео', 
  users: new Set(), 
  isPrivate: false,
  createdBy: 'system',
  description: 'Делитесь фотографиями и видео'
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

app.post('/api/settings/save', (req, res) => {
  const { username, settings } = req.body;
  
  if (!username || !settings) {
    return res.status(400).json({ error: 'Неверные данные' });
  }
  
  try {
    const userCreds = userCredentials.get(username);
    if (userCreds) {
      userCreds.settings = settings;
      saveUsers();
      
      const userSocket = Array.from(users.values()).find(u => u.username === username);
      if (userSocket) {
        io.to(userSocket.id).emit('settings-updated', settings);
      }
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
});

app.get('/api/settings/:username', (req, res) => {
  const { username } = req.params;
  
  try {
    const userCreds = userCredentials.get(username);
    if (userCreds && userCreds.settings) {
      res.json({ settings: userCreds.settings });
    } else {
      res.json({ settings: {
        theme: 'light',
        notifications: true,
        sound: true,
        autoDownload: false,
        messagePreview: true,
        privacy: 'public',
        language: 'ru'
      } });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: 'Ошибка загрузки настроек' });
  }
});

io.on('connection', (socket) => {
  socket.on('register', async (data) => {
    const { username, password, firstName, lastName, avatarColor, bio } = data;
    
    if (bannedUsers.has(username)) {
      socket.emit('registration-error', 'Пользователь заблокирован');
      return;
    }
    
    if (userCredentials.has(username)) {
      socket.emit('registration-error', 'Пользователь уже существует');
      return;
    }
    
    if (username.length < 3 || username.length > 30) {
      socket.emit('registration-error', 'Имя пользователя должно быть от 3 до 30 символов');
      return;
    }
    
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
      socket.emit('registration-error', 'Имя пользователя может содержать только латинские буквы, цифры, точки, дефисы и подчеркивания');
      return;
    }
    
    if (password.length < 6) {
      socket.emit('registration-error', 'Пароль должен быть не менее 6 символов');
      return;
    }
    
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const isAdmin = username === 'AlgorithmIntensity' && password === 'qwerty123456' ? true : admins.has(username);
      
      userCredentials.set(username, { 
        passwordHash, 
        firstName: firstName || '',
        lastName: lastName || '',
        avatarColor: avatarColor || '0078D4',
        isAdmin: isAdmin,
        bio: bio || '',
        joinDate: Date.now(),
        settings: {
          theme: 'light',
          notifications: true,
          sound: true,
          autoDownload: false,
          messagePreview: true,
          privacy: 'public',
          language: 'ru'
        }
      });
      saveUsers();
      
      users.set(socket.id, {
        id: socket.id,
        username: username,
        firstName: firstName || '',
        lastName: lastName || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName || username)}&background=${avatarColor || '0078D4'}&color=fff&size=128&bold=true`,
        avatarColor: avatarColor || '0078D4',
        online: true,
        currentRoom: 'general',
        isAdmin: isAdmin,
        isMuted: false,
        joinTime: Date.now(),
        bio: bio || '',
        settings: {
          theme: 'light',
          notifications: true,
          sound: true,
          autoDownload: false,
          messagePreview: true,
          privacy: 'public',
          language: 'ru'
        }
      });
      
      rooms.get('general').users.add(socket.id);
      
      socket.emit('registered', {
        id: socket.id,
        username: username,
        firstName: firstName || '',
        lastName: lastName || '',
        fullName: `${firstName || ''} ${lastName || ''}`.trim() || username,
        avatar: users.get(socket.id).avatar,
        isAdmin: isAdmin,
        bio: bio || '',
        settings: users.get(socket.id).settings,
        rooms: Array.from(rooms).map(([id, room]) => ({ 
          id, 
          name: room.name, 
          isPrivate: room.isPrivate,
          description: room.description,
          userCount: room.users.size 
        }))
      });
      
      broadcastUserList();
      io.to('general').emit('system-message', {
        text: `👋 ${firstName || username} присоединился к чату`,
        type: 'join'
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('registration-error', 'Ошибка при регистрации');
    }
  });
  
  socket.on('login', async (data) => {
    const { username, password } = data;
    
    if (bannedUsers.has(username)) {
      socket.emit('login-error', 'Пользователь заблокирован');
      return;
    }
    
    const userCreds = userCredentials.get(username);
    
    if (username === 'AlgorithmIntensity' && password === 'qwerty123456') {
      const isAdmin = true;
      
      if (!userCreds) {
        const passwordHash = await bcrypt.hash('qwerty123456', 10);
        userCredentials.set(username, { 
          passwordHash, 
          firstName: 'Algorithm',
          lastName: 'Intensity',
          avatarColor: 'FF4500',
          isAdmin: true,
          bio: 'Специальный администратор',
          joinDate: Date.now(),
          settings: {
            theme: 'light',
            notifications: true,
            sound: true,
            autoDownload: false,
            messagePreview: true,
            privacy: 'public',
            language: 'ru'
          }
        });
        saveUsers();
      }
      
      users.set(socket.id, {
        id: socket.id,
        username: username,
        firstName: 'Algorithm',
        lastName: 'Intensity',
        avatar: `https://ui-avatars.com/api/?name=Algorithm+Intensity&background=FF4500&color=fff&size=128&bold=true`,
        avatarColor: 'FF4500',
        online: true,
        currentRoom: 'general',
        isAdmin: true,
        isMuted: false,
        joinTime: Date.now(),
        bio: 'Специальный администратор',
        settings: userCreds?.settings || {
          theme: 'light',
          notifications: true,
          sound: true,
          autoDownload: false,
          messagePreview: true,
          privacy: 'public',
          language: 'ru'
        }
      });
      
      rooms.get('general').users.add(socket.id);
      
      socket.emit('registered', {
        id: socket.id,
        username: username,
        firstName: 'Algorithm',
        lastName: 'Intensity',
        fullName: 'Algorithm Intensity',
        avatar: users.get(socket.id).avatar,
        isAdmin: true,
        bio: 'Специальный администратор',
        settings: users.get(socket.id).settings,
        rooms: Array.from(rooms).map(([id, room]) => ({ 
          id, 
          name: room.name, 
          isPrivate: room.isPrivate,
          description: room.description,
          userCount: room.users.size 
        })),
        privateMessages: getPrivateMessagesForUser(username)
      });
      
      broadcastUserList();
      io.to('general').emit('system-message', {
        text: `👑 Algorithm Intensity вошел в чат`,
        type: 'join'
      });
      return;
    }
    
    if (!userCreds) {
      socket.emit('login-error', 'Пользователь не найден');
      return;
    }
    
    try {
      const passwordMatch = await bcrypt.compare(password, userCreds.passwordHash);
      if (!passwordMatch) {
        socket.emit('login-error', 'Неверный пароль');
        return;
      }
      
      const isAdmin = userCreds.isAdmin;
      
      users.set(socket.id, {
        id: socket.id,
        username: username,
        firstName: userCreds.firstName,
        lastName: userCreds.lastName,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userCreds.firstName || username)}&background=${userCreds.avatarColor}&color=fff&size=128&bold=true`,
        avatarColor: userCreds.avatarColor,
        online: true,
        currentRoom: 'general',
        isAdmin: isAdmin,
        isMuted: false,
        joinTime: Date.now(),
        bio: userCreds.bio || '',
        settings: userCreds.settings || {
          theme: 'light',
          notifications: true,
          sound: true,
          autoDownload: false,
          messagePreview: true,
          privacy: 'public',
          language: 'ru'
        }
      });
      
      rooms.get('general').users.add(socket.id);
      
      socket.emit('registered', {
        id: socket.id,
        username: username,
        firstName: userCreds.firstName,
        lastName: userCreds.lastName,
        fullName: `${userCreds.firstName || ''} ${userCreds.lastName || ''}`.trim() || username,
        avatar: users.get(socket.id).avatar,
        isAdmin: isAdmin,
        bio: userCreds.bio || '',
        settings: users.get(socket.id).settings,
        rooms: Array.from(rooms).map(([id, room]) => ({ 
          id, 
          name: room.name, 
          isPrivate: room.isPrivate,
          description: room.description,
          userCount: room.users.size 
        })),
        privateMessages: getPrivateMessagesForUser(username)
      });
      
      broadcastUserList();
      io.to('general').emit('system-message', {
        text: `👋 ${userCreds.firstName || username} вошел в чат`,
        type: 'join'
      });
      
    } catch (error) {
      console.error('Login error:', error);
      socket.emit('login-error', 'Ошибка при входе');
    }
  });
  
  socket.on('update-settings', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    user.settings = { ...user.settings, ...data.settings };
    
    const userCreds = userCredentials.get(user.username);
    if (userCreds) {
      userCreds.settings = user.settings;
      saveUsers();
    }
    
    socket.emit('settings-updated', user.settings);
    
    if (data.settings.theme) {
      socket.emit('theme-changed', data.settings.theme);
    }
  });
  
  socket.on('join-room', (roomId) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    if (user.isMuted) {
      socket.emit('error-message', 'Вы заглушены и не можете присоединяться к комнатам');
      return;
    }
    
    const oldRoom = user.currentRoom;
    if (oldRoom && rooms.has(oldRoom)) {
      rooms.get(oldRoom).users.delete(socket.id);
      socket.leave(oldRoom);
    }
    
    const room = rooms.get(roomId);
    if (room && room.isPrivate) {
      if (!room.allowedUsers?.has(user.username) && room.createdBy !== user.username) {
        socket.emit('error-message', 'У вас нет доступа к этой комнате');
        return;
      }
    }
    
    user.currentRoom = roomId;
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { 
        name: `Комната ${roomId}`, 
        users: new Set(), 
        isPrivate: false,
        createdBy: user.username,
        description: 'Новая комната'
      });
    }
    
    rooms.get(roomId).users.add(socket.id);
    socket.join(roomId);
    
    const roomMessages = messages.get(roomId) || [];
    const privateConvMessages = user.currentPrivateConversation ? 
      getPrivateMessages(user.username, user.currentPrivateConversation) : [];
    
    socket.emit('room-joined', {
      roomId: roomId,
      roomName: rooms.get(roomId).name,
      description: rooms.get(roomId).description,
      messages: roomMessages.slice(-50),
      isPrivateRoom: false,
      privateMessages: privateConvMessages
    });
    
    socket.to(roomId).emit('system-message', {
      text: `🚪 ${user.firstName || user.username} зашёл в комнату`,
      type: 'room-join'
    });
    broadcastUserList();
  });
  
  socket.on('start-private-chat', (targetUsername) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    if (user.isMuted) {
      socket.emit('error-message', 'Вы заглушены');
      return;
    }
    
    const targetUser = Array.from(users.values()).find(u => u.username === targetUsername);
    if (!targetUser) {
      socket.emit('error-message', 'Пользователь не в сети');
      return;
    }
    
    user.currentPrivateConversation = targetUsername;
    const privateMessages = getPrivateMessages(user.username, targetUsername);
    
    socket.emit('private-chat-started', {
      targetUser: {
        username: targetUser.username,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        fullName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.username,
        avatar: targetUser.avatar,
        online: targetUser.online,
        isAdmin: targetUser.isAdmin
      },
      messages: privateMessages.slice(-50)
    });
    
    socket.to(targetUser.id).emit('private-chat-notification', {
      from: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar
    });
  });
  
  socket.on('send-private-message', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.currentPrivateConversation) return;
    
    if (user.isMuted) {
      socket.emit('error-message', 'Вы заглушены');
      return;
    }
    
    const targetUser = Array.from(users.values()).find(u => u.username === user.currentPrivateConversation);
    if (!targetUser) {
      socket.emit('error-message', 'Пользователь не в сети');
      return;
    }
    
    const message = {
      id: Date.now(),
      from: user.username,
      fromName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      to: targetUser.username,
      text: data.text,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      read: false,
      isFile: !!data.fileUrl
    };
    
    savePrivateMessage(message);
    
    socket.emit('private-message-sent', message);
    
    if (targetUser.settings?.notifications !== false) {
      socket.to(targetUser.id).emit('new-private-message', message);
    }
    
    if (user.currentRoom === 'private') {
      socket.emit('new-private-message', message);
    }
  });
  
  socket.on('send-message', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.currentRoom) return;
    
    if (user.isMuted) {
        socket.emit('error-message', 'Вы заглушены');
        return;
    }
    
    const message = {
      id: Date.now(),
      userId: socket.id,
      username: user.username,
      id: Date.now(),
      userId: socket.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      avatar: user.avatar,
      text: data.text,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
      roomId: user.currentRoom,
      isEdited: false,
      isAdmin: user.isAdmin,
      isFile: !!data.fileUrl,
      emoji: data.emoji,
      isAudio: data.isAudio || false,
      duration: data.duration || 0
    };
    
    if (!messages.has(user.currentRoom)) {
      messages.set(user.currentRoom, []);
    }
    
    const roomMessages = messages.get(user.currentRoom);
    roomMessages.push(message);
    if (roomMessages.length > 500) roomMessages.shift();
    
    const roomUsers = Array.from(rooms.get(user.currentRoom).users);
    roomUsers.forEach(userId => {
      const roomUser = users.get(userId);
      if (roomUser && roomUser.settings?.notifications !== false) {
        io.to(userId).emit('new-message', message);
      }
    });
    
    const mentionMatch = data.text?.match(/@(\w+)/g);
    if (mentionMatch) {
      mentionMatch.forEach(mention => {
        const mentionUsername = mention.substring(1);
        const mentionedUser = Array.from(users.values()).find(u => u.username === mentionUsername);
        if (mentionedUser && mentionedUser.settings?.notifications !== false) {
          io.to(mentionedUser.id).emit('mention', {
            from: user.username,
            fromName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            room: rooms.get(user.currentRoom).name,
            message: data.text,
            roomId: user.currentRoom
          });
        }
      });
    }
  });
  
  socket.on('admin-action', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.isAdmin) return;
    
    switch (data.action) {
      case 'mute':
        const targetUserMute = Array.from(users.values()).find(u => u.username === data.target);
        if (targetUserMute) {
          targetUserMute.isMuted = true;
          io.to(targetUserMute.id).emit('admin-action-result', {
            action: 'muted',
            duration: data.duration || 300,
            reason: data.reason || 'Нарушение правил'
          });
          broadcastUserList();
        }
        break;
        
      case 'unmute':
        const targetUserUnmute = Array.from(users.values()).find(u => u.username === data.target);
        if (targetUserUnmute) {
          targetUserUnmute.isMuted = false;
          io.to(targetUserUnmute.id).emit('admin-action-result', {
            action: 'unmuted'
          });
          broadcastUserList();
        }
        break;
        
      case 'ban':
        bannedUsers.add(data.target);
        const targetUserBan = Array.from(users.values()).find(u => u.username === data.target);
        if (targetUserBan) {
          io.to(targetUserBan.id).emit('admin-action-result', {
            action: 'banned',
            reason: data.reason || 'Нарушение правил'
          });
          setTimeout(() => {
            targetUserBan.socket?.disconnect();
          }, 1000);
        }
        break;
        
      case 'unban':
        bannedUsers.delete(data.target);
        break;
        
      case 'delete-message':
        const roomMsgs = messages.get(data.roomId);
        if (roomMsgs) {
          const index = roomMsgs.findIndex(m => m.id === data.messageId);
          if (index !== -1) {
            roomMsgs.splice(index, 1);
            io.to(data.roomId).emit('message-deleted', data.messageId);
          }
        }
        break;
        
      case 'create-private-room':
        const privateRoomId = `private-${Date.now()}`;
        rooms.set(privateRoomId, {
          name: data.roomName,
          users: new Set(),
          isPrivate: true,
          createdBy: user.username,
          allowedUsers: new Set(data.allowedUsers || []),
          description: data.description || 'Приватная комната'
        });
        io.emit('new-room-created', {
          id: privateRoomId,
          name: data.roomName,
          isPrivate: true,
          createdBy: user.username,
          description: data.description
        });
        break;
        
      case 'update-profile':
        const targetProfileUser = Array.from(users.values()).find(u => u.username === data.target);
        if (targetProfileUser) {
          if (data.firstName !== undefined) targetProfileUser.firstName = data.firstName;
          if (data.lastName !== undefined) targetProfileUser.lastName = data.lastName;
          if (data.bio !== undefined) targetProfileUser.bio = data.bio;
          if (data.avatarColor !== undefined) {
            targetProfileUser.avatarColor = data.avatarColor;
            targetProfileUser.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(targetProfileUser.firstName || targetProfileUser.username)}&background=${data.avatarColor}&color=fff&size=128&bold=true`;
          }
          
          const userCreds = userCredentials.get(data.target);
          if (userCreds) {
            if (data.firstName !== undefined) userCreds.firstName = data.firstName;
            if (data.lastName !== undefined) userCreds.lastName = data.lastName;
            if (data.bio !== undefined) userCreds.bio = data.bio;
            if (data.avatarColor !== undefined) userCreds.avatarColor = data.avatarColor;
            saveUsers();
          }
          
          broadcastUserList();
          io.to(targetProfileUser.id).emit('profile-updated', {
            firstName: targetProfileUser.firstName,
            lastName: targetProfileUser.lastName,
            avatar: targetProfileUser.avatar,
            bio: targetProfileUser.bio
          });
        }
        break;
    }
  });
  
  socket.on('edit-message', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.currentRoom) return;
    
    const roomMsgs = messages.get(user.currentRoom);
    if (roomMsgs) {
      const msg = roomMsgs.find(m => m.id === data.messageId);
      if (msg && (msg.userId === socket.id || user.isAdmin)) {
        msg.text = data.newText;
        msg.isEdited = true;
        io.to(user.currentRoom).emit('message-edited', {
          messageId: data.messageId,
          newText: data.newText
        });
      }
    }
  });
  
  socket.on('update-profile', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    user.firstName = data.firstName || user.firstName;
    user.lastName = data.lastName || user.lastName;
    user.bio = data.bio || user.bio;
    
    if (data.avatarColor) {
      user.avatarColor = data.avatarColor;
      user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || user.username)}&background=${data.avatarColor}&color=fff&size=128&bold=true`;
    }
    
    const userCreds = userCredentials.get(user.username);
    if (userCreds) {
      userCreds.firstName = user.firstName;
      userCreds.lastName = user.lastName;
      userCreds.bio = user.bio;
      if (data.avatarColor) userCreds.avatarColor = data.avatarColor;
      saveUsers();
    }
    
    socket.emit('profile-updated', {
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      bio: user.bio
    });
    
    broadcastUserList();
  });
  
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user && user.currentRoom) {
      socket.to(user.currentRoom).emit('user-typing', {
        username: user.username,
        firstName: user.firstName
      });
    }
  });
  
  socket.on('stop-typing', () => {
    const user = users.get(socket.id);
    if (user && user.currentRoom) {
      socket.to(user.currentRoom).emit('user-stop-typing');
    }
  });
  
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      rooms.forEach(room => room.users.delete(socket.id));
      broadcastUserList();
      io.emit('system-message', {
        text: `👋 ${user.firstName || user.username} покинул чат`,
        type: 'leave'
      });
    }
  });
  
  function broadcastUserList() {
    const userList = Array.from(users.values()).map(user => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      avatar: user.avatar,
      avatarColor: user.avatarColor,
      online: user.online,
      isAdmin: user.isAdmin,
      isMuted: user.isMuted,
      currentRoom: user.currentRoom,
      bio: user.bio || '',
      settings: user.settings
    }));
    
    io.emit('user-list', userList);
    
    rooms.forEach((room, roomId) => {
      const roomUsers = Array.from(room.users)
        .map(id => users.get(id))
        .filter(Boolean)
        .map(user => ({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
          avatar: user.avatar,
          isAdmin: user.isAdmin
        }));
      
      io.to(roomId).emit('room-users', { roomId, users: roomUsers });
    });
  }
  
  function savePrivateMessage(message) {
    const key = [message.from, message.to].sort().join('-');
    if (!privateMessages.has(key)) {
      privateMessages.set(key, []);
    }
    const messagesList = privateMessages.get(key);
    messagesList.push(message);
    if (messagesList.length > 500) messagesList.shift();
  }
  
  function getPrivateMessages(user1, user2) {
    const key = [user1, user2].sort().join('-');
    return privateMessages.get(key) || [];
  }
  
  function getPrivateMessagesForUser(username) {
    const userMessages = [];
    privateMessages.forEach((messages, key) => {
      if (key.includes(username)) {
        const otherUser = key.split('-').find(u => u !== username);
        const lastMessage = messages[messages.length - 1];
        if (otherUser && lastMessage) {
          userMessages.push({
            with: otherUser,
            lastMessage: lastMessage.text || '📎 Файл',
            time: lastMessage.time,
            unread: lastMessage.from !== username && !lastMessage.read
          });
        }
      }
    });
    return userMessages;
  }
});

app.get('/api/rooms', (req, res) => {
  const roomsList = Array.from(rooms).map(([id, room]) => ({ 
    id, 
    name: room.name, 
    userCount: room.users.size,
    isPrivate: room.isPrivate,
    createdBy: room.createdBy,
    description: room.description
  }));
  res.json(roomsList);
});

app.get('/api/users', (req, res) => {
  const usersList = Array.from(users.values()).map(user => ({
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
    avatar: user.avatar,
    isAdmin: user.isAdmin,
    online: user.online,
    bio: user.bio,
    settings: user.settings
  }));
  res.json(usersList);
});

function getLocalIpAddress() {
  const interfaces = require('os').networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const storageAudio = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads/audio');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const uploadAudio = multer({
    storage: storageAudio,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mpeg|mp3|wav|ogg|flac|aac|m4a/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только аудио файлы разрешены'));
        }
    }
});

// Функция для получения длительности аудио
function getAudioDuration(filePath) {
    return new Promise((resolve) => {
        try {
            // Используем ffprobe если установлен
            const { exec } = require('child_process');
            exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`, 
                (error, stdout) => {
                    if (!error && stdout) {
                        resolve(parseFloat(stdout.trim()));
                    } else {
                        resolve(0);
                    }
                });
        } catch (e) {
            resolve(0);
        }
    });
}

// Добавьте маршрут для загрузки аудио
app.post('/api/upload-audio', uploadAudio.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Аудио файл не загружен' });
        }
        
        const audioUrl = `/uploads/audio/${req.file.filename}`;
        const duration = await getAudioDuration(req.file.path);
        
        res.json({ 
            success: true, 
            audioUrl: audioUrl,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            duration: duration
        });
    } catch (error) {
        console.error('Audio upload error:', error);
        res.status(500).json({ error: 'Ошибка загрузки аудио файла' });
    }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🚀 Сервер запущен!`);
    console.log(`📍 Локальный доступ: http://localhost:${PORT}`);
    console.log(`📱 Для других устройств в сети:`);
    
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    let foundRealIp = false;
    
    console.log(`🔍 Поиск реального IP адреса...`);
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Ищем IPv4 адреса, которые не loopback и не виртуальные
            if (iface.family === 'IPv4' && 
                !iface.internal && 
                !iface.address.startsWith('169.') && // APIPA
                !iface.address.startsWith('172.16.') && // Docker
                !iface.address.startsWith('192.168.56.') && // VirtualBox
                !iface.address.startsWith('192.168.176.') && // VM
                !iface.address.startsWith('172.2') && // Docker
                !iface.address.startsWith('172.1') && // Docker
                !name.includes('Virtual') &&
                !name.includes('VPN') &&
                !name.includes('Hyper-V')) {
                
                console.log(`IP: http://${iface.address}:${PORT}`);
                console.log(`   (адаптер: ${name})`);
                foundRealIp = true;
            }
        }
    }
    
    if (!foundRealIp) {
        // ничего
    }
});