'use strict';

// Web sitesinde boş bırakılırsa aynı alan adındaki sunucuya bağlanır.
// HTML dosyaları bir APK içine yerel olarak konulacaksa buraya yayımladığın
// HTTPS adresini yaz: const SERVER_URL = 'https://turksohbet-ornek.onrender.com';
const SERVER_URL = '';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_NAME_LENGTH = 16;
const MIN_NAME_LENGTH = 3;
const NAME_PATTERN = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9]{3,16}$/u;
const AVATAR_COLORS = [
  ['#3879ef', '#5f9cff'], ['#865ee8', '#a18af5'], ['#e26a54', '#f39b75'],
  ['#168c89', '#38b6ad'], ['#ba6091', '#dc8ab2'], ['#4e7a4d', '#7eaa70'],
  ['#c17d34', '#e8ae5f'], ['#5267c7', '#8293ec']
];

const homeScreen = document.getElementById('homeScreen');
const chatScreen = document.getElementById('chatScreen');
const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('usernameInput');
const usernameField = document.getElementById('usernameField');
const usernameCount = document.getElementById('usernameCount');
const usernameError = document.getElementById('usernameError');
const joinButton = document.getElementById('joinButton');
const messageList = document.getElementById('messageList');
const emptyState = document.getElementById('emptyState');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messageCount = document.getElementById('messageCount');
const onlineCount = document.getElementById('onlineCount');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const welcomeTitle = document.getElementById('welcomeTitle');
const connectionState = document.getElementById('connectionState');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

let socket = null;
let currentUsername = '';
let isJoined = false;
let isJoining = false;
let intentionallyLeaving = false;
let toastTimer = null;
let displayedMessageIds = new Set();

function showToast(text, duration = 2900) {
  toastMessage.textContent = text;
  toast.classList.add('is-visible');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), duration);
}

function setJoinLoading(loading) {
  isJoining = loading;
  joinButton.disabled = loading;
  joinButton.classList.toggle('is-loading', loading);
  joinButton.querySelector('.button-label').textContent = loading ? 'Bağlanıyor' : 'Katıl';
}

function setNameError(message) {
  usernameError.textContent = message;
  usernameError.classList.toggle('is-visible', Boolean(message));
  usernameField.classList.toggle('has-error', Boolean(message));
  usernameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) {
    usernameField.classList.remove('is-valid');
    usernameInput.focus({ preventScroll: true });
  }
}

function isValidUsername(value) {
  return value.length >= MIN_NAME_LENGTH && value.length <= MAX_NAME_LENGTH && NAME_PATTERN.test(value);
}

function updateNameStatus() {
  const value = usernameInput.value;
  usernameCount.textContent = `${Array.from(usernameInput.value).length}/${MAX_NAME_LENGTH}`;
  if (!value) {
    usernameField.classList.remove('is-valid', 'has-error');
    usernameError.classList.remove('is-visible');
    usernameError.textContent = '';
    usernameInput.setAttribute('aria-invalid', 'false');
    return;
  }
  if (isValidUsername(value)) {
    usernameField.classList.add('is-valid');
    usernameField.classList.remove('has-error');
    usernameError.classList.remove('is-visible');
    usernameError.textContent = '';
    usernameInput.setAttribute('aria-invalid', 'false');
  } else {
    usernameField.classList.remove('is-valid');
  }
}

function setConnectionLabel(state, text) {
  connectionState.classList.remove('is-connecting', 'is-offline');
  if (state === 'connecting') connectionState.classList.add('is-connecting');
  if (state === 'offline') connectionState.classList.add('is-offline');
  connectionState.lastElementChild.textContent = text;
}

function showChat() {
  homeScreen.classList.remove('is-active');
  homeScreen.setAttribute('aria-hidden', 'true');
  chatScreen.classList.add('is-active');
  chatScreen.setAttribute('aria-hidden', 'false');
  welcomeTitle.textContent = `Hoş geldin, ${currentUsername}!`;
  currentUserAvatar.textContent = Array.from(currentUsername)[0]?.toLocaleUpperCase('tr-TR') || 'T';
  currentUserAvatar.style.background = avatarBackground(currentUsername);
  window.setTimeout(() => messageInput.focus({ preventScroll: true }), 250);
}

function showHome() {
  chatScreen.classList.remove('is-active');
  chatScreen.setAttribute('aria-hidden', 'true');
  homeScreen.classList.add('is-active');
  homeScreen.setAttribute('aria-hidden', 'false');
  setJoinLoading(false);
  currentUsername = '';
  isJoined = false;
  intentionallyLeaving = false;
  usernameInput.value = '';
  updateNameStatus();
  messageInput.value = '';
  updateMessageCount();
  window.setTimeout(() => usernameInput.focus({ preventScroll: true }), 250);
}

function avatarBackground(name) {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash + char.codePointAt(0)) | 0;
  const colors = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return `linear-gradient(140deg, ${colors[0]}, ${colors[1]})`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function scrollToLatest() {
  requestAnimationFrame(() => { messageList.scrollTop = messageList.scrollHeight; });
}

function hideEmptyState() {
  if (emptyState?.isConnected) emptyState.remove();
}

function addSystemMessage(message) {
  if (!message || !message.id || displayedMessageIds.has(message.id)) return;
  displayedMessageIds.add(message.id);
  hideEmptyState();
  const row = document.createElement('div');
  row.className = 'system-message';
  row.dataset.messageId = message.id;
  row.textContent = message.text || '';
  messageList.appendChild(row);
  scrollToLatest();
}

function addChatMessage(message) {
  if (!message || !message.id || displayedMessageIds.has(message.id)) return;
  displayedMessageIds.add(message.id);
  hideEmptyState();

  const ownMessage = message.username === currentUsername;
  const row = document.createElement('article');
  row.className = `message-row${ownMessage ? ' is-own' : ''}`;
  row.dataset.messageId = message.id;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.style.background = avatarBackground(message.username || '?');
  avatar.textContent = Array.from(message.username || '?')[0].toLocaleUpperCase('tr-TR');
  avatar.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'message-content';
  const nameLine = document.createElement('div');
  nameLine.className = 'message-name-line';
  const name = document.createElement('span');
  name.textContent = ownMessage ? 'Sen' : (message.username || 'Kullanıcı');
  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = message.createdAt || '';
  time.textContent = formatTime(message.createdAt);
  nameLine.append(name, time);

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  // Güvenlik: mesaj, HTML olarak yorumlanmaz.
  bubble.textContent = message.text || '';
  content.append(nameLine, bubble);
  row.append(avatar, content);
  messageList.appendChild(row);
  scrollToLatest();
}

function renderHistory(items) {
  messageList.replaceChildren();
  displayedMessageIds = new Set();
  if (!Array.isArray(items) || items.length === 0) {
    messageList.appendChild(emptyState);
    return;
  }
  for (const message of items) {
    if (message.type === 'system') addSystemMessage(message);
    else addChatMessage(message);
  }
  scrollToLatest();
}

function updateMessageCount() {
  const length = Array.from(messageInput.value).length;
  messageCount.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
  messageCount.style.color = length > MAX_MESSAGE_LENGTH * 0.9 ? '#d77b43' : '';
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 145)}px`;
}

function destroySocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

function tryJoin(username) {
  if (isJoining) return;
  if (typeof window.io !== 'function') {
    setNameError('Bağlantı kitaplığı yüklenemedi. İnternetini kontrol et.');
    return;
  }
  if (window.location.protocol === 'file:' && !SERVER_URL) {
    setNameError('Sunucu adresi ayarlanmadı. app.js içindeki SERVER_URL alanına sunucu adresini yaz.');
    return;
  }

  setNameError('');
  currentUsername = username;
  intentionallyLeaving = false;
  setJoinLoading(true);
  destroySocket();

  const endpoint = SERVER_URL.trim() || undefined;
  socket = window.io(endpoint, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 800,
    reconnectionDelayMax: 3000,
    timeout: 12000
  });

  socket.on('connect', () => {
    setConnectionLabel('connecting', 'Katılıyor');
    socket.emit('join_chat', { username: currentUsername });
  });

  socket.on('join_success', (data) => {
    const firstJoin = !isJoined;
    currentUsername = data.username || currentUsername;
    isJoined = true;
    setJoinLoading(false);
    onlineCount.textContent = String(Number(data.onlineCount) || 1);
    setConnectionLabel('online', 'Bağlandı');
    renderHistory(data.history || []);
    if (firstJoin) showChat();
    if (!firstJoin) showToast('Bağlantı yeniden kuruldu.');
    messageInput.focus({ preventScroll: true });
  });

  socket.on('join_error', (data) => {
    setJoinLoading(false);
    isJoined = false;
    currentUsername = '';
    const text = data?.code === 'INVALID_NAME' ? 'Hatalı İsim' : (data?.text || 'Sohbete katılınamadı.');
    setNameError(text);
    destroySocket();
  });

  socket.on('new_message', addChatMessage);
  socket.on('system_message', addSystemMessage);
  socket.on('online_count', (data) => { onlineCount.textContent = String(Number(data?.count) || 0); });
  socket.on('server_notice', (data) => { if (data?.text) showToast(data.text); });

  socket.on('disconnect', (reason) => {
    if (intentionallyLeaving) return;
    if (isJoined) {
      isJoined = false;
      setConnectionLabel('connecting', 'Yeniden bağlanıyor');
      showToast('Bağlantı kesildi. Yeniden bağlanılıyor...', 3500);
    }
    // Bağlantı kurulmadan kapandıysa butonu yeniden etkinleştir.
    if (isJoining && !document.hidden) {
      setJoinLoading(false);
      showToast('Sunucu bağlantısı kesildi. Tekrar deneyebilirsin.');
    }
  });

  socket.io.on('reconnect_failed', () => {
    setConnectionLabel('offline', 'Bağlantı yok');
    setJoinLoading(false);
    showToast('Sunucuya ulaşılamadı. Biraz sonra tekrar dene.', 4200);
  });

  socket.on('connect_error', () => {
    if (!chatScreen.classList.contains('is-active')) {
      setJoinLoading(false);
      setNameError('Sunucuya bağlanılamadı. İnternetini kontrol et.');
    } else {
      setConnectionLabel('offline', 'Bağlantı yok');
    }
  });

  socket.connect();
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = usernameInput.value;
  if (!isValidUsername(username)) {
    setNameError('Hatalı İsim');
    return;
  }
  tryJoin(username);
});

usernameInput.addEventListener('input', updateNameStatus);
usernameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    joinForm.requestSubmit();
  }
});

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = messageInput.value.replace(/\r\n?/g, '\n').trim();
  if (!text || !socket || !isJoined) {
    if (!isJoined) showToast('Sohbet bağlantısı kuruluyor.');
    return;
  }
  const count = Array.from(text).length;
  if (count > MAX_MESSAGE_LENGTH) {
    showToast(`Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
    return;
  }
  socket.emit('send_message', { text });
  messageInput.value = '';
  updateMessageCount();
  messageInput.focus({ preventScroll: true });
});

messageInput.addEventListener('input', updateMessageCount);
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    messageForm.requestSubmit();
  }
});

document.getElementById('leaveButton').addEventListener('click', () => {
  intentionallyLeaving = true;
  destroySocket();
  showHome();
});

window.addEventListener('online', () => {
  if (socket && !socket.connected) socket.connect();
});
window.addEventListener('offline', () => {
  if (chatScreen.classList.contains('is-active')) {
    setConnectionLabel('offline', 'İnternet yok');
    showToast('İnternet bağlantısı kesildi.');
  }
});

updateNameStatus();
updateMessageCount();
