'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // APK içindeki file:// WebView'ların da HTTPS sunucusuna bağlanabilmesi için
  // Origin yansıtılır. Kimlik bilgisi/cookie kullanılmaz.
  cors: { origin: true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e6,
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = Number(process.env.PORT) || 3000;
const MAX_NAME_LENGTH = 16;
const MIN_NAME_LENGTH = 3;
const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_LIMIT = 80;
const MESSAGE_WINDOW_MS = 7000;
const MESSAGE_WINDOW_LIMIT = 6;
const NAME_PATTERN = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9]{3,16}$/u;

const users = new Map(); // socket.id -> { username, normalizedName, messageTimes: [] }
const activeNames = new Map(); // normalizedName -> socket.id
const history = []; // In-memory only. Restarting the server clears it.

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.socket.io'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'https:', 'http:', 'wss:', 'ws:'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/health', (_req, res) => {
  res.json({ durum: 'çalışıyor', çevrimiçi: users.size });
});

function normalizeName(name) {
  return name.toLocaleLowerCase('tr-TR');
}

function isValidName(name) {
  return typeof name === 'string'
    && name.length >= MIN_NAME_LENGTH
    && name.length <= MAX_NAME_LENGTH
    && NAME_PATTERN.test(name);
}

function sendNotice(socket, text) {
  socket.emit('server_notice', { text, createdAt: new Date().toISOString() });
}

function broadcastOnlineCount() {
  io.emit('online_count', { count: users.size });
}

function makeSystemMessage(text) {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'system',
    text,
    createdAt: new Date().toISOString()
  };
}

function rememberAndBroadcast(message) {
  history.push(message);
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  io.emit(message.type === 'system' ? 'system_message' : 'new_message', message);
}

io.on('connection', (socket) => {
  socket.on('join_chat', (payload) => {
    const candidate = payload && typeof payload.username === 'string'
      ? payload.username
      : '';

    if (!isValidName(candidate)) {
      socket.emit('join_error', { code: 'INVALID_NAME', text: 'Hatalı İsim' });
      return;
    }

    // Aynı socket tekrar join gönderirse kayıtları güvenli biçimde yenile.
    const oldUser = users.get(socket.id);
    if (oldUser) {
      activeNames.delete(oldUser.normalizedName);
      users.delete(socket.id);
    }

    const normalizedName = normalizeName(candidate);
    const existingSocketId = activeNames.get(normalizedName);
    if (existingSocketId && existingSocketId !== socket.id) {
      socket.emit('join_error', { code: 'NAME_TAKEN', text: 'Bu isim şu anda kullanımda' });
      return;
    }

    const user = { username: candidate, normalizedName, messageTimes: [] };
    users.set(socket.id, user);
    activeNames.set(normalizedName, socket.id);

    socket.emit('join_success', {
      username: candidate,
      onlineCount: users.size,
      history: history.slice(-HISTORY_LIMIT)
    });

    const safeName = candidate;
    rememberAndBroadcast(makeSystemMessage(`${safeName} sohbete katıldı.`));
    broadcastOnlineCount();
  });

  socket.on('send_message', (payload) => {
    const user = users.get(socket.id);
    if (!user) {
      sendNotice(socket, 'Önce sohbete katılmalısın.');
      return;
    }

    if (!payload || typeof payload.text !== 'string') {
      sendNotice(socket, 'Mesaj gönderilemedi.');
      return;
    }

    // Mesaj metnindeki görünmez kontrol karakterlerini çıkar; kullanıcı metni
    // istemcide HTML olarak değil, textContent ile gösterilir.
    const text = payload.text
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim();
    const charCount = Array.from(text).length;

    if (!text) return;
    if (charCount > MAX_MESSAGE_LENGTH) {
      sendNotice(socket, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
      return;
    }

    const now = Date.now();
    user.messageTimes = user.messageTimes.filter((time) => now - time < MESSAGE_WINDOW_MS);
    if (user.messageTimes.length >= MESSAGE_WINDOW_LIMIT) {
      sendNotice(socket, 'Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene.');
      return;
    }
    user.messageTimes.push(now);

    const message = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 10)}`,
      type: 'message',
      username: user.username,
      text,
      createdAt: new Date(now).toISOString()
    };
    rememberAndBroadcast(message);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);
    if (activeNames.get(user.normalizedName) === socket.id) {
      activeNames.delete(user.normalizedName);
    }

    rememberAndBroadcast(makeSystemMessage(`${user.username} sohbetten ayrıldı.`));
    broadcastOnlineCount();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TürkSohbet sunucusu ${PORT} portunda çalışıyor.`);
});
