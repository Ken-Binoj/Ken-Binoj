// ══════════════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB — CLIENT WEBRTC NETWORK CONTROLLER (network.js)
// ══════════════════════════════════════════════════════════════════
//  Features:
//    • Connects to WebSocket signaling server (Localhost or ngrok wss:// URL)
//    • RTCPeerConnection with public Google STUN servers
//    • RTCDataChannel for real-time, low-latency UDP-style input streaming
//    • Automatic role assignment: Host (Player 1) vs Guest (Player 2)
// ══════════════════════════════════════════════════════════════════

class NetworkManager {
  constructor() {
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.role = null; // 'host' (Player 1) or 'guest' (Player 2)
    this.roomId = null;
    this.isConnected = false;

    // Callbacks for game loop integration
    this.onConnected = null;
    this.onDisconnected = null;
    this.onOpponentInput = null;
    this.onOpponentAttack = null;
    this.onOpponentSync = null;

    // STUN configuration
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // 1. Connect to Signaling Server (e.g. "ws://localhost:8080" or "wss://xxxx.ngrok-free.app")
  // Automatically detects current host/ngrok URL if signalingUrl is omitted!
  connect(signalingUrl, roomId = 'arena-1') {
    if (!signalingUrl) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      signalingUrl = `${proto}//${window.location.host}`;
    }
    this.roomId = roomId;
    console.log('[Network] Connecting to signaling URL:', signalingUrl);
    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      console.log('[Network] Connected to signaling server. Joining room:', roomId);
      this.ws.send(JSON.stringify({
        type: 'join',
        roomId: this.roomId
      }));
    };

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'joined':
          this.role = msg.role;
          console.log(`[Network] Joined room as: ${this.role.toUpperCase()}`);
          break;

        case 'ready':
          console.log('[Network] Both players present! Initializing WebRTC...');
          await this._initPeerConnection();
          if (this.role === 'host') {
            await this._createOffer();
          }
          break;

        case 'signal':
          await this._handleSignal(msg.payload);
          break;

        case 'peer-disconnected':
          console.warn('[Network] Opponent disconnected.');
          this.isConnected = false;
          if (this.onDisconnected) this.onDisconnected();
          break;

        case 'room-full':
          alert('Room is currently full (2/2 players already connected).');
          break;
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Network] Signaling error:', err);
      if (this.onError) this.onError(err);
    };
    this.ws.onclose = () => {
      console.log('[Network] Signaling server disconnected.');
      this.isConnected = false;
      if (this.onDisconnected) this.onDisconnected();
    };
  }

  // 2. Initialize RTCPeerConnection & DataChannel
  async _initPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Relay local ICE candidates to signaling server
    this.peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal({
          type: 'candidate',
          candidate: e.candidate
        });
      }
    };

    // Connection state logging
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[Network] PeerConnection state:', this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'failed') {
        this.isConnected = false;
        if (this.onDisconnected) this.onDisconnected();
      }
    };

    if (this.role === 'host') {
      // Host creates the DataChannel
      // { ordered: false, maxRetransmits: 0 } provides ultra-low latency UDP semantics ideal for fighters!
      this.dataChannel = this.peerConnection.createDataChannel('gameInputs', {
        ordered: false,
        maxRetransmits: 0
      });
      this._setupDataChannel(this.dataChannel);
    } else {
      // Guest listens for the DataChannel opened by Host
      this.peerConnection.ondatachannel = (e) => {
        this.dataChannel = e.channel;
        this._setupDataChannel(this.dataChannel);
      };
    }
  }

  // 3. Configure DataChannel Listeners
  _setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('[Network] ⚡ RTCDataChannel OPEN! Online match live.');
      this.isConnected = true;
      if (this.onConnected) this.onConnected(this.role);
    };

    channel.onclose = () => {
      console.log('[Network] RTCDataChannel closed.');
      this.isConnected = false;
      if (this.onDisconnected) this.onDisconnected();
    };

    channel.onmessage = (e) => {
      let packet;
      try {
        packet = JSON.parse(e.data);
      } catch (err) {
        return;
      }

      switch (packet.type) {
        case 'input':
          if (this.onOpponentInput) this.onOpponentInput(packet.keys);
          break;

        case 'attack':
          if (this.onOpponentAttack) this.onOpponentAttack(packet.action);
          break;

        case 'sync':
          if (this.onOpponentSync) this.onOpponentSync(packet);
          break;
      }
    };
  }

  // 4. SDP Handshake (Offer / Answer / ICE Candidates)
  async _createOffer() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this._sendSignal({
      type: 'offer',
      sdp: this.peerConnection.localDescription
    });
  }

  async _handleSignal(payload) {
    if (payload.type === 'offer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this._sendSignal({
        type: 'answer',
        sdp: this.peerConnection.localDescription
      });
    } else if (payload.type === 'answer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } else if (payload.type === 'candidate') {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('[Network] Error adding ICE candidate:', err);
      }
    }
  }

  _sendSignal(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'signal',
        payload
      }));
    }
  }

  // 5. Game Outgoing Packet Transmission API
  sendInputs(keys) {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({
      type: 'input',
      keys: {
        left: !!keys.left,
        right: !!keys.right,
        down: !!keys.down,
        up: !!keys.up,
        block: !!keys.block
      },
      t: performance.now()
    }));
  }

  sendAttack(actionName) {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({
      type: 'attack',
      action: actionName, // 'punch' | 'kick' | 'spartanKick' | 'duckHeadbutt' | 'sweepKick' | 'flipKick' | 'groundStomp' | 'dashLeft' | 'dashRight'
      t: performance.now()
    }));
  }

  sendStateSync(x, y, vx, vy, hp, state) {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({
      type: 'sync',
      x, y, vx, vy, hp, state,
      t: performance.now()
    }));
  }
}

// Global Singleton Instance
window.networkManager = new NetworkManager();

