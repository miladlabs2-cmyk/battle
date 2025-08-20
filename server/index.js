const WebSocket = require('ws');
const { SERVER_PORT } = require('./config');
const { sockets } = require('./state');
const { send, broadcast } = require('./messaging');
const { startStorage } = require('./storage');
const { createOrAttachPlayer, findPlayerBySocket, listPlayers } = require('./players');
const { startBetting, serializeBets, serializeGameState, placeBet } = require('./game');

const wss = new WebSocket.Server({ port: SERVER_PORT });
console.log(`🎮 Battle Game Server started on ws://localhost:${SERVER_PORT}`);

function heartbeat() { this.isAlive = true; }

const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            try { ws.terminate(); } catch { }
            return;
        }
        ws.isAlive = false;
        try { ws.ping(); } catch { }
    });
}, 30000);

wss.on('close', () => clearInterval(pingInterval));

wss.on('connection', (ws) => {
    sockets.add(ws);
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const player = createOrAttachPlayer(ws);
    send(ws, 'game_state', serializeGameState());
    send(ws, 'player_list', listPlayers());
    send(ws, 'bets_update', serializeBets());

    ws.on('message', (raw) => handleMessage(ws, raw));

    ws.on('close', () => {
        sockets.delete(ws);
        const associatedPlayer = findPlayerBySocket(ws);
        if (associatedPlayer) {
            associatedPlayer.ws = null;
            associatedPlayer.lastSeenAt = Date.now();
        }
        send(ws, 'player_list', listPlayers());
    });
});

function handleMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { return send(ws, 'error', { message: 'Invalid JSON' }); }

    const { event, data } = msg || {};
    const player = findPlayerBySocket(ws);
    if (!player) return;

    if (event === 'join') {
        if (data && typeof data.name === 'string' && data.name.trim().length > 0) {
            player.name = data.name.trim().slice(0, 24);
            send(ws, 'player_list', listPlayers());
        }
        send(ws, 'game_state', serializeGameState());
        return;
    }

    if (event === 'start_game') {
        // Start the game loop only when explicitly requested
        startBetting();
        return;
    }

    if (event === 'bet') {
        const result = placeBet(player, data);
        if (!result.ok) return send(ws, 'error', { message: result.error });
        send(ws, 'bets_update', serializeBets());
        send(ws, 'player_list', listPlayers());
        return send(ws, 'bet_accepted', { ...result.bet, balance: player.balance });
    }

    return send(ws, 'error', { message: 'Unknown event' });
}

startStorage();


