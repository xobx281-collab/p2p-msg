// script.js — версия с явным сервером + отладкой

let peer, myId, localStream, currentCall, currentConn;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatOutput = document.getElementById('chatOutput');
const statusEl = document.getElementById('status');
const myIdEl = document.getElementById('myId');

function log(msg) {
    chatOutput.innerHTML += `<br>${new Date().toLocaleTimeString()} | ${msg}`;
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

async function initPeer() {
    log('Попытка подключения к PeerJS-серверу...');

    // Явно указываем публичный сервер (cloudflare — самый стабильный в 2026)
    peer = new Peer({
        host: 'peerjs.cloudflare.com',
        secure: true,
        port: 443,
        path: '/peerjs',
        debug: 2  // уровень логов — 0 тихо, 3 очень подробно (смотри в консоль браузера!)
    });

    peer.on('open', id => {
        myId = id;
        myIdEl.textContent = id;
        log(`✅ ID получен: ${id}`);
        statusEl.textContent = 'Статус: готов к подключению (ID получен)';
    });

    peer.on('error', err => {
        log(`❌ Ошибка PeerJS: ${err.type} — ${err.message}`);
        if (err.type === 'peer-unavailable') {
            log('→ Это нормально, если пока никто не подключился');
        } else if (err.type === 'network' || err.type === 'websocket') {
            log('→ Проблема с сетью/WebSocket. Проверь adblock, VPN, firewall. Попробуй другой браузер/сеть.');
        }
        statusEl.textContent = 'Статус: ошибка соединения с сервером сигнализации';
    });

    peer.on('disconnected', () => {
        log('⚠️ Отключено от сервера PeerJS. Переподключаемся...');
        peer.reconnect();
    });

    peer.on('close', () => log('❌ Peer полностью закрыт'));

    // Входящий звонок
    peer.on('call', async call => {
        if (!localStream) {
            log('⚠️ Входящий звонок, но нет локального стрима — поделись камерой/экраном');
            return;
        }
        log('📞 Входящий звонок... отвечаем');
        currentCall = call;
        call.answer(localStream);
        call.on('stream', stream => {
            remoteVideo.srcObject = stream;
            log('📹 Входящее видео/экран получено');
        });
        call.on('error', err => log(`Ошибка звонка: ${err}`));
    });

    // Входящее data-соединение
    peer.on('connection', conn => {
        log('🔗 Входящее data-соединение');
        currentConn = conn;
        setupDataConnection();
    });
}

function setupDataConnection() {
    if (!currentConn) return;
    currentConn.on('open', () => {
        log('✅ Data-канал (чат) открыт!');
        statusEl.textContent = 'Статус: соединение установлено (чат + видео)';
    });
    currentConn.on('data', data => {
        log(`> ${data}`);
    });
    currentConn.on('close', () => log('❌ Data-канал закрыт'));
    currentConn.on('error', err => log(`Ошибка data: ${err}`));
}

async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('📹 Камера + микрофон включены');
    } catch (e) {
        log(`❌ Камера/микрофон: ${e.name} — ${e.message}`);
    }
}

async function shareScreen() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('🖥️ Экран + звук включены');
    } catch (e) {
        log(`❌ Экран: ${e.name} — ${e.message}`);
    }
}

async function connectToFriend() {
    const friendId = document.getElementById('friendId').value.trim();
    if (!friendId) {
        alert('Вставь ID друга!');
        return;
    }
    if (!localStream) {
        alert('Сначала поделись камерой или экраном!');
        return;
    }
    if (!myId) {
        alert('Свой ID ещё не сгенерирован — подожди или обнови страницу');
        return;
    }

    log(`Попытка подключения к ${friendId}...`);

    // Data
    currentConn = peer.connect(friendId, { reliable: true });
    setupDataConnection();

    // Media
    currentCall = peer.call(friendId, localStream);
    currentCall.on('stream', stream => {
        remoteVideo.srcObject = stream;
        log('📹 Видео/экран от друга получено');
    });
    currentCall.on('error', err => log(`Ошибка вызова: ${err}`));
    currentCall.on('close', () => log('Звонок закрыт'));
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    if (!currentConn || currentConn.open !== true) {
        log('⚠️ Чат ещё не открыт — подожди соединения');
        return;
    }
    currentConn.send(text);
    log(`Вы: ${text}`);
    input.value = '';
}

function copyMyId() {
    if (!myId) {
        log('ID ещё не готов');
        return;
    }
    navigator.clipboard.writeText(myId).then(() => {
        log('📋 ID скопирован!');
    }).catch(() => {
        log('❌ Не удалось скопировать — скопируй вручную');
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        remoteVideo.requestFullscreen().catch(err => log(`Fullscreen ошибка: ${err}`));
    } else {
        document.exitFullscreen();
    }

}

// Старт
window.onload = () => {
    initPeer();
    log('🚀 Страница загружена — ждём генерации ID');
};

window.onload = initPeer;
