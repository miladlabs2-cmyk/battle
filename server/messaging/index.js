const WebSocket = require('ws');
const { sockets } = require('../state');

function send(ws, event, data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({ event, data });
    ws.send(payload);
}

function broadcast(event, data) {
    const payload = JSON.stringify({ event, data });
    for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    }
}

module.exports = { send, broadcast };


