// ══════════════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB — ALL-IN-ONE WEB & SIGNALING SERVER (Node.js + ws)
// ══════════════════════════════════════════════════════════════════
//  Serves static game files (HTML, CSS, JS) AND handles WebRTC signaling
//  on the same port for easy 1-step ngrok testing on mobile phones.
//
//  Prerequisites:
//    npm install ws
//
//  Run locally:
//    node signaling-server.js
//
//  Expose with ngrok for mobile testing:
//    ngrok http 8080
// ══════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// 1. Built-in HTTP Server (serves game files to mobile phones)
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
});

// 2. WebRTC WebSocket Signaling Server mounted on same HTTP server
const wss = new WebSocketServer({ server });

// Active matchmaking rooms: roomId -> Set<WebSocket> (max 2 peers)
const rooms = new Map();

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
      // Join or Create a 2-Player Room
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

      // Relay SDP Offer, SDP Answer, or ICE Candidate to the other peer in the room
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

server.listen(PORT, () => {
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  SHADOW FIGHT WEB — ALL-IN-ONE SERVER RUNNING!`);
  console.log(`  Local Web & Signaling URL: http://localhost:${PORT}`);
  console.log(`  To test on 2 mobile phones: run "ngrok http ${PORT}"`);
  console.log(`═══════════════════════════════════════════════════════`);
});

