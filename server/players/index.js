const { v4: uuidv4 } = require('uuid');
const { playersById } = require('../state');
const { STARTING_BALANCE } = require('../config');
const { generateRandomName } = require('../utils');
const { recordBlock } = require('../storage');

function createOrAttachPlayer(ws) {
    const id = uuidv4();
    const name = generateRandomName();
    const player = {
        id,
        name,
        balance: STARTING_BALANCE,
        ws,
        lastSeenAt: Date.now(),
    };
    playersById.set(id, player);
    return player;
}

function findPlayerBySocket(ws) {
    for (const player of playersById.values()) {
        if (player.ws === ws) return player;
    }
    return null;
}

function listPlayers() {
    return Array.from(playersById.values()).map(p => ({ id: p.id, name: p.name, balance: p.balance }));
}

module.exports = {
    createOrAttachPlayer,
    findPlayerBySocket,
    listPlayers,
};


