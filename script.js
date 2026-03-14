let peer, myId, localStream, currentCall, currentConn;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatOutput = document.getElementById('chatOutput');
const statusEl = document.getElementById('status');

function log(msg) {
    chatOutput.innerHTML += `<br>${msg}`;
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

async function initPeer() {
    peer = new Peer();
    peer.on('open', id => {
        myId = id;
        document.getElementById('myId').textContent = id;
        log('✅ Твой ID сгенерирован. Кидай его другу!');
        statusEl.textContent = 'Статус: ID получен, готов';
    });

    peer.on('call', async (call) => {
        if (!localStream) {
            log('⚠️ Сначала поделись камерой или экраном!');
            return;
        }
        currentCall = call;
        call.answer(localStream);
        call.on('stream', stream => {
            remoteVideo.srcObject = stream;
            log('📹 Входящее видео получено');
        });
    });

    peer.on('connection', (conn) => {
        currentConn = conn;
        setupDataConnection();
    });
}

function setupDataConnection() {
    if (!currentConn) return;
    currentConn.on('open', () => {
        log('✅ Чат подключён!');
        statusEl.textContent = 'Статус: соединение установлено';
    });
    currentConn.on('data', data => {
        log(`> ${data}`);
    });
    currentConn.on('close', () => log('❌ Соединение закрыто'));
}

async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('📹 Камера + микрофон включены');
    } catch (e) { log('❌ Ошибка камеры: ' + e.message); }
}

async function shareScreen() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        log('🖥️ Экран + системный звук включены (стример-мод)');
    } catch (e) { log('❌ Ошибка экрана: ' + e.message); }
}

async function connectToFriend() {
    const friendId = document.getElementById('friendId').value.trim();
    if (!friendId) { alert('Вставь ID друга!'); return; }
    if (!localStream) { alert('Сначала нажми "Камера" или "Экран"!'); return; }

    // Data channel
    currentConn = peer.connect(friendId);
    setupDataConnection();

    // Video call
    currentCall = peer.call(friendId, localStream);
    currentCall.on('stream', stream => {
        remoteVideo.srcObject = stream;
        log('📹 Видео получено');
    });

    log(`🔗 Подключаемся к ${friendId}...`);
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!currentConn || currentConn.readyState !== 'open') {
        log('⚠️ Сначала подключись!');
        return;
    }
    currentConn.send(input.value);
    log(`Вы: ${input.value}`);
    input.value = '';
}

function copyMyId() {
    navigator.clipboard.writeText(myId);
    log('📋 ID скопирован в буфер!');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        remoteVideo.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

// Запуск
window.onload = initPeer;
