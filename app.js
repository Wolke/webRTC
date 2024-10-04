console.log('Attempting to connect to Socket.IO server at', SOCKET_SERVER_URL);
socket.on('connect', () => {
    console.log('Connected to Socket.IO server');
});
socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

let localStream;
let remoteStream;
let peerConnection;
let dataChannel;

const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;
sendButton.onclick = sendMessage;

socket.on('offer', handleOffer);
socket.on('answer', handleAnswer);
socket.on('ice-candidate', handleNewICECandidate);

// 在文件頂部添加這行
console.log('app.js loaded');

// 修改 start 函數
async function start() {
    console.log('Start button clicked');
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia is not supported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('Media stream obtained');
        localVideo.srcObject = stream;
        localStream = stream;
        startButton.disabled = true;
        callButton.disabled = false;
    } catch (e) {
        console.error('獲取媒體流失敗:', e);
        alert('無法訪問攝像頭和麥克風。請確保您已授予權限，並使用支持的瀏覽器。');
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    peerConnection.onicecandidate = handleICECandidate;
    peerConnection.ontrack = handleTrack;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onmessage = handleDataChannelMessage;
    dataChannel.onopen = handleDataChannelStatusChange;
    dataChannel.onclose = handleDataChannelStatusChange;

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onmessage = handleDataChannelMessage;
        dataChannel.onopen = handleDataChannelStatusChange;
        dataChannel.onclose = handleDataChannelStatusChange;
    };
}

function handleICECandidate(event) {
    if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
    }
}

function handleTrack(event) {
    remoteVideo.srcObject = event.streams[0];
    remoteStream = event.streams[0];
}

async function call() {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
    callButton.disabled = true;
    hangupButton.disabled = false;
}

async function handleOffer(offer) {
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
}

async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleNewICECandidate(candidate) {
    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (e) {
        console.error('錯誤添加 ICE 候選者:', e);
    }
}

function hangup() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    startButton.disabled = false;
    callButton.disabled = true;
    hangupButton.disabled = true;
    sendButton.disabled = true;
}

function handleDataChannelMessage(event) {
    const message = event.data;
    appendMessage('對方', message);
}

function handleDataChannelStatusChange() {
    if (dataChannel) {
        const state = dataChannel.readyState;
        if (state === 'open') {
            sendButton.disabled = false;
        } else {
            sendButton.disabled = true;
        }
    }
}

function sendMessage() {
    const message = chatInput.value;
    if (message && dataChannel) {
        dataChannel.send(message);
        appendMessage('你', message);
        chatInput.value = '';
    }
}

function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}