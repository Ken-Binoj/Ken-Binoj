// ══════════════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB — MINIMAL WEBRTC SIGNALING SERVER (Node.js + ws)
// ══════════════════════════════════════════════════════════════════
//  Prerequisites:
//    npm init -y
//    npm install ws
//
//  Run locally:
//    node signaling-server.js
//
//  Expose via ngrok:
//    ngrok http 8080   (or ngrok tcp 8080)
// ══════════════════════════════════════════════════════════════════

const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Active matchmaking rooms: roomId -> Set<WebSocket> (max 2 peers)
const rooms = new Map();

console.log(`[Signaling Server] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerRole = null; // 'host' (P1) or 'guest' (P2)

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error('[Signaling] Invalid JSON received:', err);
      return;
    }

    const { type, roomId, payload } = data;

    switch (type) {
      // 1. Join or Create a 2-Player Room
      case 'join': {
        currentRoom = roomId || 'default-arena';

        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }

        const roomPeers = rooms.get(currentRoom);

        if (roomPeers.size >= 2) {
          ws.send(JSON.stringify({ type: 'room-full', roomId: currentRoom }));
          return;
        }

        roomPeers.add(ws);

        // First player in room is Host (Player 1), second is Guest (Player 2)
        playerRole = roomPeers.size === 1 ? 'host' : 'guest';

        ws.send(JSON.stringify({
          type: 'joined',
          roomId: currentRoom,
          role: playerRole,
          peerCount: roomPeers.size
        }));

        console.log(`[Signaling] Player joined room "${currentRoom}" as ${playerRole} (${roomPeers.size}/2)`);

        // If 2 players are now in the room, notify the host to initiate the WebRTC offer
        if (roomPeers.size === 2) {
          for (const peer of roomPeers) {
            peer.send(JSON.stringify({
              type: 'ready',
              roomId: currentRoom
            }));
          }
          console.log(`[Signaling] Room "${currentRoom}" is ready for WebRTC handshake!`);
        }
        break;
      }

      // 2. Relay SDP Offer, SDP Answer, or ICE Candidate to the other peer in the room
      case 'signal': {
        if (!currentRoom || !rooms.has(currentRoom)) return;

        const roomPeers = rooms.get(currentRoom);
        for (const peer of roomPeers) {
          if (peer !== ws && peer.readyState === ws.OPEN) {
            peer.send(JSON.stringify({
              type: 'signal',
              payload
            }));
          }
        }
        break;
      }

      default:
        console.warn('[Signaling] Unknown message type:', type);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomPeers = rooms.get(currentRoom);
      roomPeers.delete(ws);

      console.log(`[Signaling] Player left room "${currentRoom}". Remaining peers: ${roomPeers.size}`);

      // Notify the remaining peer that opponent disconnected
      for (const peer of roomPeers) {
        if (peer.readyState === ws.OPEN) {
          peer.send(JSON.stringify({ type: 'peer-disconnected' }));
        }
      }

      if (roomPeers.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[Signaling Error]', err.message);
  });
});
