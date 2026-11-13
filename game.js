// ═══════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB  ·  game.js
//  LEFT CLICK: Punch  |  RIGHT CLICK: Kick
//  A/D: Move  |  W: Jump  |  S: Crouch  |  SHIFT: Block
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const DW = 900;
const getGravity = () => canvas.height * 3.46; // Dynamically scaled gravity: ~1945 on PC, ~1300 on mobile
const getJumpVelocity = () => -canvas.height * 1.32; // Consistent jump height (~25% of screen) & 0.76s airtime
const FLOOR_FRAC = 0.82;
const PUSH_DIST = 55;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

let isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
let showTouchControls = isTouchDevice;

// ══════════════════════════════════════════════════════════════
//  TOUCH CONTROLS & VIRTUAL JOYSTICK STATE (MOBILE INTERFACE)
// ══════════════════════════════════════════════════════════════
const touchControls = {
  joystick: {
    baseX: 110,
    baseY: 420,
    baseR: 58,
    knobX: 110,
    knobY: 420,
    knobR: 25,
    active: false,
    touchId: null,
    vx: 0,
    vy: 0,
    left: false,
    right: false,
    up: false,
    down: false,
    upLeft: false,
    upRight: false,
    downLeft: false,
    downRight: false,
    lastJumpTriggered: false,
    lastTapLeft: 0,
    lastTapRight: 0
  },
  qButton: {
    x: 110,
    y: 330,
    r: 28,
    pressed: false,
    touchId: null,
    visible: false
  },
  buttons: {
    block: { x: 0, y: 0, r: 31, pressed: false, touchId: null, label: 'BLOCK', sub: 'GUARD' },
    punch: { x: 0, y: 0, r: 33, pressed: false, touchId: null, label: 'PUNCH', sub: 'COMBO' },
    kick:  { x: 0, y: 0, r: 37, pressed: false, touchId: null, label: 'KICK',  sub: 'SPARTAN' }
  },
  pauseButton: {
    x: 0,
    y: 0,
    w: 36,
    h: 36,
    pressed: false
  }
};

function updateTouchLayout() {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 500);

  // 1. Left Joystick Position
  const joy = touchControls.joystick;
  joy.baseR = Math.max(50, Math.min(68, 56 * sc));
  joy.knobR = Math.max(22, Math.min(30, 24 * sc));
  joy.baseX = Math.max(joy.baseR + 24 * sc, 80 * sc);
  joy.baseY = H - Math.max(joy.baseR + 26 * sc, 75 * sc);
  if (!joy.active) {
    joy.knobX = joy.baseX;
    joy.knobY = joy.baseY;
  }

  // 2. Q Ground Stomp Pop-Up Button (Directly above the Joystick)
  const qBtn = touchControls.qButton;
  qBtn.r = Math.max(24, Math.min(32, 28 * sc));
  qBtn.x = joy.baseX;
  qBtn.y = joy.baseY - joy.baseR - qBtn.r - 12 * sc;

  // 3. Right Action Buttons: Triangular Formation
  const btns = touchControls.buttons;
  const clusterCenterX = W - Math.max(105 * sc, 95);
  const clusterCenterY = H - Math.max(95 * sc, 90);

  const horizontalSpread = Math.max(42, 46 * sc);
  const verticalKickDrop = Math.max(42, 44 * sc);

  // Block (top-left of cluster)
  btns.block.r = Math.max(28, Math.min(36, 31 * sc));
  btns.block.x = clusterCenterX - horizontalSpread;
  btns.block.y = clusterCenterY - 32 * sc;

  // Punch (top-right of cluster, same horizontal level)
  btns.punch.r = Math.max(30, Math.min(38, 33 * sc));
  btns.punch.x = clusterCenterX + horizontalSpread;
  btns.punch.y = clusterCenterY - 32 * sc;

  // Kick (centered beneath Block & Punch in triangular formation)
  btns.kick.r = Math.max(34, Math.min(42, 37 * sc));
  btns.kick.x = clusterCenterX;
  btns.kick.y = clusterCenterY + verticalKickDrop;

  // 4. Mobile Pause Button (Top-Right)
  const pause = touchControls.pauseButton;
  pause.w = Math.max(34, 38 * sc);
  pause.h = Math.max(34, 38 * sc);
  pause.x = W - pause.w - 18 * sc;
  pause.y = 16 * sc;
}

function checkOrientation() {
  const overlay = document.getElementById('rotateOverlay');
  const isPortrait = window.innerHeight > window.innerWidth;
  const isMobile = Math.min(window.innerWidth, window.innerHeight) <= 640 || isTouchDevice;
  if (overlay) {
    if (isPortrait && isMobile) {
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }
}

function resize() {
  checkOrientation();
  const isMobileLandscape = isTouchDevice && (window.innerWidth <= 1100 || window.innerHeight <= 560);
  if (isMobileLandscape) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  } else {
    canvas.width = Math.min(window.innerWidth - 20, 1000);
    canvas.height = Math.min(window.innerHeight - 40, 562);
  }
  updateTouchLayout();
}
resize();

window.addEventListener('resize', () => {
  resize();
  if (player) player.y = canvas.height * FLOOR_FRAC;
  if (enemy) enemy.y = canvas.height * FLOOR_FRAC;
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resize();
    if (player) player.y = canvas.height * FLOOR_FRAC;
    if (enemy) enemy.y = canvas.height * FLOOR_FRAC;
  }, 120);
});

// ── Particles & Blood Effects ─────────────────────────────────
const particles = [];
function spawnParticles(x, y, n = 9, color = '#000') {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(60, 230);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100,
      life: 1, decay: rnd(2.5, 4.5), r: rnd(2, 5),
      color: color, alpha: 0.65, gravity: 500
    });
  }
}

// Red blood splatter & arterial spray on confirmed hits
function spawnBlood(x, y, dir = 1, n = 18) {
  const bloodColors = ['#ff0d38', '#d60029', '#ff2449', '#a8001d', '#e6002b', '#800014'];
  for (let i = 0; i < n; i++) {
    // Kinetic arterial spray outward in hit direction with vertical spread
    const angle = (dir > 0 ? 0 : Math.PI) + rnd(-0.55, 0.55);
    const speed = rnd(90, 340);
    const vx = Math.cos(angle) * speed + dir * rnd(40, 110);
    const vy = Math.sin(angle) * speed - rnd(50, 190);
    particles.push({
      x: x + rnd(-5, 5),
      y: y + rnd(-7, 7),
      vx: vx,
      vy: vy,
      gravity: 700,
      life: 1,
      decay: rnd(1.3, 2.5),
      r: rnd(1.8, 4.2),
      color: bloodColors[Math.floor(Math.random() * bloodColors.length)],
      alpha: rnd(0.85, 0.98)
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity || 500) * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color || '#000';
    ctx.globalAlpha = Math.max(0, p.life) * (p.alpha || 0.65);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Ground Seismic Shockwaves ────────────────────────────────
const groundShockwaves = [];
function spawnGroundShockwave(x, y) {
  const sc = canvas.width / DW;
  groundShockwaves.push({
    x: x,
    y: y,
    radius: 12,
    maxRadius: canvas.width * 1.1,
    speed: 1500 * sc,
    alpha: 1.0
  });
}
function updateGroundShockwaves(dt) {
  for (let i = groundShockwaves.length - 1; i >= 0; i--) {
    const sw = groundShockwaves[i];
    sw.radius += sw.speed * dt;
    sw.alpha = Math.max(0, 1 - (sw.radius / sw.maxRadius));
    if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
      groundShockwaves.splice(i, 1);
    }
  }
}
function drawGroundShockwaves() {
  if (groundShockwaves.length === 0) return;
  const sc = canvas.width / DW;
  ctx.save();
  for (const sw of groundShockwaves) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, 4 * sc);
    ctx.globalAlpha = sw.alpha * 0.9;

    const leftX = sw.x - sw.radius;
    const rightX = sw.x + sw.radius;
    const floorY = sw.y;

    // Ground fissure line
    ctx.beginPath();
    ctx.moveTo(Math.max(0, leftX), floorY);
    ctx.lineTo(Math.min(canvas.width, rightX), floorY);
    ctx.stroke();

    // Rising seismic spikes at leading edges of shockwave
    for (const sx of [leftX, rightX]) {
      if (sx >= -40 && sx <= canvas.width + 40) {
        ctx.beginPath();
        ctx.moveTo(sx, floorY);
        ctx.lineTo(sx, floorY - 24 * sw.alpha * sc);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ── Screen shake ────────────────────────────────────────────
let shakeAmt = 0, shakeDur = 0;
function shake(a, d) { shakeAmt = a; shakeDur = d; }

// ═══════════════════════════════════════════════════════════
//  ANGLE CONVENTION
//  Limb drawn from (0,0) DOWNWARD (+y). After ctx.rotate(θ):
//    tip = ( -sin(θ)*len,  cos(θ)*len )
//  → NEGATIVE θ = tip goes forward (+x, toward opponent)
//  → POSITIVE θ = tip goes backward
//  Forearm/calf angles are RELATIVE to their parent (0 = straight)
// ═══════════════════════════════════════════════════════════

class Fighter {
  constructor(x, isPlayer, name) {
    this.isPlayer = isPlayer;
    this.name = name;
    this.x = x;
    this.y = canvas.height * FLOOR_FRAC;
    this.vy = 0;
    this.facing = isPlayer ? 1 : -1;
    this.onGround = true;
    this.maxHp = 100;
    this.hp = 100;
    this.state = 'idle';
    this.stateDur = 0;
    this.stateElapsed = 0;
    this.atkCooldown = 0;
    this.hitCooldown = 0;
    this.stunTimer = 0;
    this.blocking = false;
    this.crouching = false;
    this.walkCycle = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.aiTimer = 0;
    this.aiMoveX = 0;
    this.landedShake = false;
    this.kbVx = 0;
    this.kbDecel = 0;
    this.dashDir = 0;
    this.dashVx = 0;
    this.dashGhosts = [];
    this.kdTimestamps = [];
    this.reversalReady = false;
    this.spartanHitTimestamps = [];
    this.groundStompReady = false;
    this.hasStomped = false;
    this.hasHit = false;
    this.punchComboCount = 0;
    this.punchComboTimer = 0;
    this.punchLockoutTimer = 0;
    this.punchHand = 0;
    this.currentPunchNum = 1;
    this.mainColor = isPlayer ? '#000000' : '#000000';
    this.backColor = isPlayer ? '#333333' : '#333333';
    this.displayName = name;
  }

  get sc() { return canvas.width / DW; }
  get floor() { return canvas.height * FLOOR_FRAC; }
  get stateProgress() { return this.stateDur > 0 ? this.stateElapsed / this.stateDur : 1; }

  move(dx) {
    if (this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (this.blocking || this.state === 'block') return; // High guard blocks walking; guard posture takes priority!
    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'dash', 'groundStomp'].includes(this.state)) return;
    if (this.state === 'crouch') {
      const isTouchDown = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.joystick && touchControls.joystick.down);
      if (this.isPlayer && !(keys['KeyS'] || keys['ArrowDown'] || isTouchDown)) {
        this.state = 'idle';
      } else {
        return;
      }
    }
    this.x = clamp(this.x + dx, 55, canvas.width - 55);
    if (Math.abs(dx) > 0.5 && this.onGround) this.state = 'walk';
  }

  dash(dir) {
    if (!this.onGround || this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (this.blocking || this.state === 'block') return;
    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'dash', 'groundStomp'].includes(this.state)) return;
    const dur = 0.20;
    this.state = 'dash';
    this.stateDur = dur;
    this.stateElapsed = 0;
    this.dashDir = dir;
    // Exactly half of Spartan kick's 368px knockback: 184 * sc!
    const dist = 184 * this.sc;
    this.dashVx = (dist / dur) * dir;
    spawnParticles(this.x, this.floor, 10);
    shake(2, 0.08);
  }

  jump() {
    if (!this.onGround || this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (this.blocking || this.state === 'block') return; // Cannot jump while holding guard
    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'dash'].includes(this.state)) return;
    if (this.state === 'crouch') {
      const isTouchDown = (typeof showTouchControls !== 'undefined' && showTouchControls && touchControls && touchControls.joystick && touchControls.joystick.down);
      if (this.isPlayer && !(keys['KeyS'] || keys['ArrowDown'] || isTouchDown)) {
        this.state = 'idle';
      } else {
        return;
      }
    }
    this.vy = getJumpVelocity();
    this.onGround = false;
    this.state = 'jump';
  }

  block(on) {
    this.blocking = on;
    if (this.state === 'dead' || this.state === 'knockdown') return;
    if (on && this.onGround && !['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'crouch', 'dash', 'groundStomp'].includes(this.state)) this.state = 'block';
    if (!on && this.state === 'block') this.state = 'idle';
  }

  crouch(on) {
    this.crouching = on;
    if (this.state === 'dead' || this.state === 'knockdown') return;
    if (on && this.onGround && !['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'block', 'dash', 'groundStomp'].includes(this.state)) this.state = 'crouch';
    if (!on && this.state === 'crouch') this.state = 'idle';
  }

  attack(type) {
    if (this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (this.state === 'crouch' && type !== 'sweepKick' && type !== 'crouchPunch') this.state = 'idle';

    if (type === 'punch') {
      // Punch Combo move: fast succession alternates hands, max 5 punches, 0.5s lockout
      if (this.punchLockoutTimer > 0) return;

      // If already punching, allow chaining into next combo punch once current punch has struck/extended
      if (this.state === 'punch') {
        if (this.stateElapsed < this.stateDur * 0.40) return;
      } else {
        if (this.atkCooldown > 0) return;
      }

      if (this.punchComboTimer > 0 && this.punchComboCount > 0) {
        this.punchComboCount++;
      } else {
        this.punchComboCount = 1;
      }
      this.currentPunchNum = this.punchComboCount;
      this.punchHand = (this.currentPunchNum - 1) % 2; // 0 = front hand, 1 = back hand
      this.punchComboTimer = 0.45; // Window to chain next punch

      if (this.punchComboCount >= 5) {
        this.punchLockoutTimer = 0.50; // Cannot punch for 0.5 sec after 5 punches
        this.punchComboCount = 0;
        this.punchComboTimer = 0;
      }
      this.hitCooldown = 0; // Fresh punch is ready to hit
    } else {
      if (this.atkCooldown > 0) return;
    }

    let dur = 0.28;
    if (type === 'punch') dur = 0.20; // Ultra snappy rapid flurry punches
    else if (type === 'crouchPunch') dur = 0.28; // Faster low punch!
    else if (type === 'duckHeadbutt') dur = 0.56; // Duck under attacks & 45-deg lean forward headbutt!
    else if (type === 'kick') dur = 0.38; // Faster snappy kick!
    else if (type === 'spartanKick') dur = 0.62;
    else if (type === 'sweepKick') dur = 0.50;
    else if (type === 'flipKick') {
      dur = 0.68;
      // Athletic acrobatic aerial lift for Front Flip Axe Kick
      if (!this.onGround && this.vy > -240) this.vy = -canvas.height * 0.42;
    } else if (type === 'groundStomp') {
      dur = 0.58;
      this.hasStomped = false;
      this.y = this.floor;
      this.vy = 0;
      this.onGround = true;
    }
    this.state = type;
    this.stateDur = dur;
    this.stateElapsed = 0;
    this.hasHit = false; // Reset hit flag: this attack animation can only connect once!
    this.atkCooldown = (type === 'punch') ? (dur * 0.40) : (dur * 0.70);
  }

  takeHit(dmg, kbk, attacker) {
    if (this.state === 'dead' || this.state === 'knockdown') return false;

    // Track receiving Spartan Kicks (3 Spartan Kicks received in span of 5s -> unlocks Ground Stomp "Q"!)
    if (attacker && attacker.state === 'spartanKick') {
      const now = performance.now();
      this.spartanHitTimestamps.push(now);
      this.spartanHitTimestamps = this.spartanHitTimestamps.filter(t => now - t <= 5000);
      if (this.spartanHitTimestamps.length >= 3) {
        this.groundStompReady = true;
      }
    }

    // Both "Q" Ground Stomp attacks are completely uninterruptible (hyper-armor)!
    if (this.state === 'groundStomp') {
      this.hp = Math.max(0, this.hp - dmg);
      shake(5, 0.12);
      spawnParticles(this.x, this.y - 80 * this.sc, 8);
      if (this.hp <= 0) { this.state = 'dead'; this.vy = -canvas.height * 0.5; }
      return true;
    }

    if (this.blocking) {
      this.hp = Math.max(0, this.hp - Math.floor(dmg * 0.1));
      if (kbk > 150 * this.sc) {
        // Massive hits (like 4x Spartan kick) push through guard smoothly with animation
        const blockKbk = kbk * 0.35;
        const dur = 0.22;
        this.kbVx = (2 * blockKbk / dur) * attacker.facing;
        this.kbDecel = Math.abs(this.kbVx) / dur;
      }
      shake(3, 0.10);
      spawnParticles(this.x, this.y - 90 * this.sc, 8);
      return true;
    }
    this.hp = Math.max(0, this.hp - dmg);

    // Dynamic animated knockback slide physics (no instant teleporting!)
    // Duration scales with knockback distance: 0.28s for standard hits, up to 0.52s for 4x Spartan kick!
    const dur = Math.max(0.28, Math.min(0.52, kbk / (650 * this.sc)));
    this.kbVx = (2 * kbk / dur) * attacker.facing;
    this.kbDecel = Math.abs(this.kbVx) / dur;

    this.stunTimer = dur;
    this.state = 'hurt';
    this.stateDur = dur;
    this.stateElapsed = 0;
    this.hitCooldown = 0.55;

    // Red blood effects on unblocked hits (no blood on Spartan Kick and Sweep Kick)
    if (attacker && (attacker.state === 'spartanKick' || attacker.state === 'sweepKick')) {
      spawnParticles(this.x, this.y - 90 * this.sc, 15);
    } else {
      const bloodCount = (attacker && attacker.state === 'punch' && attacker.currentPunchNum > 1) ? 10 : 20;
      spawnBlood(this.x, this.y - 88 * this.sc, attacker ? attacker.facing : 1, bloodCount);
      spawnParticles(this.x, this.y - 90 * this.sc, 6);
    }
    shake(5, 0.15);
    if (this.hp <= 0) { this.state = 'dead'; this.vy = -canvas.height * 0.5; }
    return true;
  }

  knockdown(attacker, customDmg = 10, customKbk = null) {
    if (this.state === 'dead' || this.state === 'knockdown') return;
    // Both "Q" Ground Stomp attacks are completely uninterruptible!
    if (this.state === 'groundStomp') return;
    this.hp = Math.max(0, this.hp - customDmg);

    // Track knockdown timestamp for 3 knockdowns in 5 seconds [Q] reversal
    const now = performance.now();
    this.kdTimestamps.push(now);
    this.kdTimestamps = this.kdTimestamps.filter(t => now - t <= 5000);
    if (this.kdTimestamps.length >= 3) {
      this.reversalReady = true;
    }

    // Smooth animated slide as feet are swept out (no instant teleporting!)
    const sweepKbk = customKbk !== null ? customKbk : 60 * this.sc;
    const sweepSlideDur = 0.32;
    const dir = attacker ? (this.x >= attacker.x ? 1 : -1) : (this.facing > 0 ? -1 : 1);
    this.kbVx = (2 * sweepKbk / sweepSlideDur) * dir;
    this.kbDecel = Math.abs(this.kbVx) / sweepSlideDur;

    this.state = 'knockdown';
    this.stateDur = 1.65; // ~0.33s fall + ~1.0s grounded in sleeping position + ~0.32s get up
    this.stateElapsed = 0;
    this.hitCooldown = 0.6;
    this.stunTimer = 1.65;
    this.landedShake = false;
    spawnParticles(this.x, this.floor - 40, 10);
    if (this.hp <= 0) { this.state = 'dead'; this.vy = -canvas.height * 0.5; }
  }

  update(dt, opp) {
    // Maintain 5-second rolling window for Spartan kicks received and knockdowns
    const now = performance.now();
    this.spartanHitTimestamps = this.spartanHitTimestamps.filter(t => now - t <= 5000);
    if (this.spartanHitTimestamps.length >= 3) {
      this.groundStompReady = true;
    }
    this.kdTimestamps = this.kdTimestamps.filter(t => now - t <= 5000);
    if (this.kdTimestamps.length >= 3) {
      this.groundStompReady = true;
      this.reversalReady = true;
    }

    // Player direct key/touch synchronization (guarantees player NEVER gets stuck in crouch or block)
    if (this.isPlayer) {
      const isTouchDown = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.joystick && touchControls.joystick.down);
      const isTouchBlock = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.buttons && touchControls.buttons.block && touchControls.buttons.block.pressed);
      const downHeld = !!(keys['KeyS'] || keys['ArrowDown'] || isTouchDown);
      this.crouching = downHeld;
      if (downHeld && this.onGround && !['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'dash', 'groundStomp'].includes(this.state)) {
        this.state = 'crouch';
      } else if (this.state === 'crouch' && !downHeld) {
        this.state = 'idle';
      }

      const blockHeld = !!(keys['ShiftLeft'] || keys['ShiftRight'] || isTouchBlock);
      this.blocking = blockHeld;
      if (blockHeld && this.onGround && !['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'dash', 'groundStomp'].includes(this.state)) {
        this.state = 'block';
      } else if (this.state === 'block' && !blockHeld) {
        this.state = 'idle';
      }
    }

    // Punch combo timers
    if (this.punchLockoutTimer > 0) this.punchLockoutTimer -= dt;
    if (this.punchComboTimer > 0) {
      this.punchComboTimer -= dt;
      if (this.punchComboTimer <= 0) {
        this.punchComboCount = 0;
      }
    }

    if (this.atkCooldown > 0) this.atkCooldown -= dt;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt; else this.comboCount = 0;

    // Knockback slide physics update (smooth deceleration & wall collision)
    if (Math.abs(this.kbVx) > 0) {
      const step = this.kbVx * dt;
      this.x = clamp(this.x + step, 55, canvas.width - 55);

      // Hit arena perimeter wall: stop knockback with thud
      if (this.x === 55 || this.x === canvas.width - 55) {
        if (Math.abs(this.kbVx) > 100 * this.sc) {
          shake(6, 0.14);
          spawnParticles(this.x, this.y - 80 * this.sc, 8);
        }
        this.kbVx = 0;
      } else {
        const sign = Math.sign(this.kbVx);
        this.kbVx -= sign * this.kbDecel * dt;
        if (Math.sign(this.kbVx) !== sign) this.kbVx = 0;
      }

      // Kick up skid dust when sliding across the floor
      if (this.onGround && Math.abs(this.kbVx) > 50 * this.sc && Math.random() < 0.60) {
        spawnParticles(this.x, this.floor, 2);
      }
    }

    // Dash movement physics
    if (this.state === 'dash') {
      const step = this.dashVx * dt;
      this.x = clamp(this.x + step, 55, canvas.width - 55);
      if (this.x === 55 || this.x === canvas.width - 55) {
        this.dashVx = 0;
      }
      if (this.onGround && Math.random() < 0.65) {
        spawnParticles(this.x, this.floor, 2);
      }
      // Record ghost afterimage
      if (this.dashGhosts.length === 0 || Math.abs(this.x - this.dashGhosts[this.dashGhosts.length - 1].x) > 20 * this.sc) {
        this.dashGhosts.push({ x: this.x, y: this.y, facing: this.facing, alpha: 0.40 });
      }
    }
    // Fade out dash ghost afterimages
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      this.dashGhosts[i].alpha -= dt * 3.0;
      if (this.dashGhosts[i].alpha <= 0) this.dashGhosts.splice(i, 1);
    }

    // Front Flip Axe Kick: automatically propels forward toward the enemy through the air
    if (this.state === 'flipKick') {
      const sp = this.stateProgress;
      // Active forward dive during first 70% of flip (launch, inversion, and 220° axe slam)
      if (sp < 0.70) {
        const forwardSpeed = 200 * this.sc;
        this.x = clamp(this.x + forwardSpeed * this.facing * dt, 55, canvas.width - 55);
      }
    }

    // Ass slam shake trigger for knockdown fall
    if (this.state === 'knockdown') {
      const sp = this.stateProgress;
      if (sp >= 0.20 && !this.landedShake) {
        this.landedShake = true;
        shake(10, 0.24); // Screen shake on ass impact!
        spawnParticles(this.x - this.facing * 20, this.floor, 22); // Landing dust burst right where butt hits mat
      }
    }

    // Ground Stomp seismic impact
    if (this.state === 'groundStomp') {
      const sp = this.stateProgress;
      if (sp >= 0.38 && !this.hasStomped) {
        this.hasStomped = true;
        shake(22, 0.45);
        spawnParticles(this.x, this.floor - 15, 45);
        spawnGroundShockwave(this.x, this.floor);

        // Ground Stomp effect: Opponent gets knocked down wherever they are on screen!
        if (opp && opp.state !== 'dead') {
          spawnParticles(opp.x, opp.floor - 20, 25);
          opp.knockdown(this, 0, 110 * opp.sc);
        }
      }
    }

    // Duck Headbutt forward momentum surge during 45-degree strike phase
    if (this.state === 'duckHeadbutt' && this.stateProgress >= 0.38 && this.stateProgress < 0.62) {
      this.x = clamp(this.x + this.facing * 190 * dt, 55, canvas.width - 55);
    }

    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'dash', 'groundStomp'].includes(this.state)) {
      this.stateElapsed += dt;
      if (this.stateElapsed >= this.stateDur) {
        const isTouchDown = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.joystick && touchControls.joystick.down);
        const isTouchBlock = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.buttons && touchControls.buttons.block && touchControls.buttons.block.pressed);
        const downHeld = this.isPlayer ? !!(keys['KeyS'] || keys['ArrowDown'] || isTouchDown) : this.crouching;
        const blockHeld = this.isPlayer ? !!(keys['ShiftLeft'] || keys['ShiftRight'] || isTouchBlock) : this.blocking;

        if (!this.onGround) {
          this.state = 'jump';
        } else if (downHeld) {
          this.state = 'crouch';
        } else if (blockHeld) {
          this.state = 'block';
        } else {
          this.state = 'idle';
        }
      }
    }

    if (!this.onGround) { this.vy += getGravity() * dt; this.y += this.vy * dt; }
    if (this.y >= this.floor) {
      this.y = this.floor; this.vy = 0;
      if (!this.onGround) { this.onGround = true; if (this.state === 'jump') this.state = 'idle'; }
    } else { this.onGround = false; }

    this.walkCycle += dt * (this.state === 'walk' ? 8 : 1.5);

    const isAttacking = ['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'dash', 'groundStomp'].includes(this.state);
    const isGroundedKnockdown = (this.state === 'knockdown' && this.stateProgress < 0.80);
    if (opp && this.state !== 'dead' && !isAttacking && !isGroundedKnockdown) {
      const dx = opp.x - this.x;
      if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
    }
  }

  // ══════════════════════════════════════════════════════
  //  DRAW
  // ══════════════════════════════════════════════════════
  draw() {
    const sc = this.sc;
    const sp = this.stateProgress;

    // Design dimensions
    const LEG_H = 80;
    const THIGH_L = 44;
    const CALF_L = 42;
    const TORSO_H = 70;
    const U_ARM_L = 32;   // upper arm
    const FORE_L = 30;   // forearm
    const HEAD_R = 22;
    const LIMB_W = 13;
    const FOOT_W = 20;
    const FOOT_H = 9;
    const hipY = -LEG_H;
    const shoulderY = hipY - TORSO_H;   // = -150

    // Render fading shadow afterimages for dash move
    if (this.dashGhosts && this.dashGhosts.length > 0) {
      for (const g of this.dashGhosts) {
        ctx.save();
        ctx.globalAlpha = g.alpha;
        ctx.fillStyle = this.mainColor || '#000';
        ctx.translate(g.x, g.y);
        ctx.scale(g.facing * sc, sc);
        ctx.beginPath();
        ctx.ellipse(0, -60, 16, 50, -0.25 * g.facing, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Pose variables — all degrees, negative=forward
    let bodyDip = 0;
    let bodyLean = 0;
    let charRot = 0;
    let fThigh = -5, fCalf = 5;
    let bThigh = 8, bCalf = 5;
    // Double-jointed arms: upper arm (abs) + forearm (relative to upper arm)
    let fUpper = -35, fFore = 65;
    let bUpper = -15, bFore = 50;
    let fArmX = 0, fArmY = -TORSO_H + 6;
    let bArmX = 0, bArmY = -TORSO_H + 6;

    const idleBob = Math.sin(Date.now() * 0.0022) * 3;

    switch (this.state) {

      case 'idle':
        fThigh = -5; fCalf = 5; bThigh = 8; bCalf = 5;
        // Fighter ready guard: hands held up near chest
        fUpper = -35; fFore = 65;
        bUpper = -15; bFore = 50;
        bodyDip = idleBob;
        break;

      case 'walk': {
        const wc = this.walkCycle;
        const sw = Math.sin(wc) * 32;
        fThigh = sw; fCalf = Math.max(0, sw) * 0.55 + 3;
        bThigh = -sw; bCalf = Math.max(0, -sw) * 0.55 + 3;
        fUpper = Math.cos(wc) * 22 - 30; fFore = 55;
        bUpper = -Math.cos(wc) * 22 - 15; bFore = 45;
        bodyDip = Math.abs(Math.sin(wc)) * -4 + idleBob;
        break;
      }

      case 'jump':
        fThigh = -22; fCalf = 22; bThigh = -16; bCalf = 28;
        fUpper = -48; fFore = -20; bUpper = 48; bFore = -20;
        break;

      case 'punch': {
        // Karate Straight Punch (Gyaku-zuki / Oi-zuki):
        // Punching arm fires straight forward; opposite arm pulls back tight to the hip (Hikite)
        let D = 26;
        let pLean = 0;
        let pDip = 0;
        let sShift = 0;
        let bShift = 0;
        let bUp = -15, bFo = 50;

        if (sp < 0.16) {
          // 0 -> 0.16: Chamber / load
          const t = sp / 0.16;
          D = lerp(30, 22, t);
          sShift = lerp(0, -4, t);
          pLean = lerp(0, -4, t);
          // Opposite arm starts pulling back to the hip
          bUp = lerp(-15, 30, t);
          bFo = lerp(50, -45, t);
          bShift = lerp(0, -6, t);
        } else if (sp < 0.48) {
          // 0.16 -> 0.48: Explosive straight forward punch thrust!
          const t = (sp - 0.16) / 0.32;
          const ease = 1 - (1 - t) * (1 - t);
          D = lerp(22, 61.2, ease);
          sShift = lerp(-4, 18, ease);
          pLean = lerp(-4, -16, ease);
          pDip = lerp(0, -4, ease);
          // Opposite arm drives back firmly to the hip (Karate Hikite)
          bUp = lerp(30, 52, ease);
          bFo = lerp(-45, -88, ease);
          bShift = lerp(-6, -12, ease);
        } else if (sp < 0.66) {
          // 0.48 -> 0.66: Full extension impact hold
          D = 61.2;
          sShift = 18;
          pLean = -16;
          pDip = -4;
          // Hikite locked tight at hip
          bUp = 52;
          bFo = -88;
          bShift = -12;
        } else {
          // 0.66 -> 1.0: Snappy retraction straight back into stance
          const t = (sp - 0.66) / 0.34;
          const ease = t * t;
          D = lerp(61.2, 30, ease);
          sShift = lerp(18, 0, ease);
          pLean = lerp(-16, 0, ease);
          pDip = lerp(-4, 0, ease);
          // Opposite arm returns to ready guard
          bUp = lerp(52, -15, ease);
          bFo = lerp(-88, 50, ease);
          bShift = lerp(-12, 0, ease);
        }

        // Exact horizontal straight-line IK: fist moves along a direct horizontal beam forward
        const u = U_ARM_L, f = FORE_L;
        const clampedD = clamp(D, 18, u + f - 0.6);
        const cosShoulder = (u * u + clampedD * clampedD - f * f) / (2 * u * clampedD);
        const sAngle = Math.acos(clamp(cosShoulder, -1, 1));
        const cosElbow = (u * u + f * f - clampedD * clampedD) / (2 * u * f);
        const eAngle = Math.acos(clamp(cosElbow, -1, 1));

        const punchArmUpper = -(90 - sAngle * 180 / Math.PI);
        const punchArmFore = -(180 - eAngle * 180 / Math.PI);

        if (this.punchHand === 1) {
          // Rear/Back arm punches forward with IK
          bUpper = punchArmUpper;
          bFore = punchArmFore;
          bArmX = sShift;
          bArmY = -TORSO_H + 6;

          // Lead/Front arm pulls back into Hikite at hip
          fUpper = bUp;
          fFore = bFo;
          fArmX = bShift;
          fArmY = -TORSO_H + 10;
        } else {
          // Lead/Front arm punches forward with IK
          fUpper = punchArmUpper;
          fFore = punchArmFore;
          fArmX = sShift;
          fArmY = -TORSO_H + 6;

          // Rear/Back arm pulls back into Hikite at hip
          bUpper = bUp;
          bFore = bFo;
          bArmX = bShift;
          bArmY = -TORSO_H + 10;
        }

        bodyLean = pLean;
        bodyDip = pDip;
        fThigh = -8; fCalf = 10;
        bThigh = 8; bCalf = 6;
        break;
      }

      case 'crouchPunch': {
        // Karate Low Punch from Crouch (Gedan Tsuki):
        // Fighter remains crouched low to duck under high punches; fires straight low punch
        bodyDip = 28; // Stays crouched low!
        fThigh = -68; fCalf = 68; // Crouched stance legs
        bThigh = 58; bCalf = -58;

        let D = 24;
        let pLean = -15;
        let sShift = 0;
        let bShift = 0;
        let bUp = 20, bFo = -30;

        if (sp < 0.16) {
          const t = sp / 0.16;
          D = lerp(26, 20, t);
          sShift = lerp(0, -3, t);
          pLean = lerp(-15, -12, t);
          bUp = lerp(14, 35, t);
          bFo = lerp(20, -60, t);
        } else if (sp < 0.48) {
          const t = (sp - 0.16) / 0.32;
          const ease = 1 - (1 - t) * (1 - t);
          D = lerp(20, 60.5, ease);
          sShift = lerp(-3, 16, ease);
          pLean = lerp(-12, -22, ease); // lean forward into low punch
          bUp = lerp(35, 52, ease);
          bFo = lerp(-60, -88, ease);
          bShift = lerp(0, -10, ease);
        } else if (sp < 0.66) {
          D = 60.5;
          sShift = 16;
          pLean = -22;
          bUp = 52;
          bFo = -88;
          bShift = -10;
        } else {
          const t = (sp - 0.66) / 0.34;
          const ease = t * t;
          D = lerp(60.5, 26, ease);
          sShift = lerp(16, 0, ease);
          pLean = lerp(-22, -15, ease);
          bUp = lerp(52, 14, ease);
          bFo = lerp(-88, 20, ease);
          bShift = lerp(-10, 0, ease);
        }

        const u = U_ARM_L, f = FORE_L;
        const clampedD = clamp(D, 18, u + f - 0.6);
        const cosShoulder = (u * u + clampedD * clampedD - f * f) / (2 * u * clampedD);
        const sAngle = Math.acos(clamp(cosShoulder, -1, 1));
        const cosElbow = (u * u + f * f - clampedD * clampedD) / (2 * u * f);
        const eAngle = Math.acos(clamp(cosElbow, -1, 1));

        fUpper = -(90 - sAngle * 180 / Math.PI);
        fFore = -(180 - eAngle * 180 / Math.PI);
        fArmX = sShift;

        // Hikite at hip
        bUpper = bUp;
        bFore = bFo;
        bArmX = bShift;
        bArmY = -TORSO_H + 12;

        bodyLean = pLean;
        break;
      }

      case 'kick': {
        // Normal swing-up kick (Roundhouse / High Snap Kick)
        if (sp < 0.22) {
          const t = sp / 0.22;
          fThigh = lerp(-5, 22, t); fCalf = lerp(5, 28, t);
          bodyLean = lerp(0, 6, t);
        } else if (sp < 0.62) {
          const t = (sp - 0.22) / 0.40;
          fThigh = lerp(22, -74, t); fCalf = lerp(28, 0, t);
          bodyLean = lerp(6, -26, t);
        } else if (sp < 0.77) {
          fThigh = -74; fCalf = 0; bodyLean = -26;
        } else {
          const t = (sp - 0.77) / 0.23;
          fThigh = lerp(-74, -5, t); fCalf = lerp(0, 5, t);
          bodyLean = lerp(-26, 0, t);
        }
        bThigh = 10; bCalf = 12;
        // Arms out for balance
        fUpper = 44; fFore = -38;
        bUpper = -55; bFore = 32;
        break;
      }

      case 'spartanKick': {
        // Iconic Spartan Kick ("THIS IS SPARTA!")
        // Knee chambers high, torso bends back dramatically (-40°), foot thrusts straight into chest!
        if (sp < 0.22) {
          // 0 -> 0.22: High chamber - knee pulled high to chest
          const t = sp / 0.22;
          fThigh = lerp(-5, -92, t);    // high knee lift
          fCalf = lerp(5, 120, t);    // leg folded tight
          bThigh = lerp(8, 0, t);
          bCalf = lerp(5, 12, t);
          bodyLean = lerp(0, -8, t);
          bodyDip = lerp(0, -4, t);
          fUpper = lerp(-35, -45, t); fFore = lerp(65, 45, t);
          bUpper = lerp(-15, 30, t); bFore = lerp(50, 20, t);
        } else if (sp < 0.52) {
          // 0.22 -> 0.52: Ferocious linear forward thrust + bend backwards!
          const t = (sp - 0.22) / 0.30;
          const ease = 1 - (1 - t) * (1 - t);
          fThigh = lerp(-92, -88, ease); // straight horizontal kick
          fCalf = lerp(120, 0, ease); // snaps completely straight!
          bThigh = lerp(0, 20, ease); // supporting leg drives forward
          bCalf = lerp(12, 12, ease);
          bodyLean = lerp(-8, -40, ease); // BENDS BACKWARDS DRAMATICALLY!
          bodyDip = lerp(-4, 0, ease);
          fUpper = lerp(-45, 50, ease); fFore = lerp(45, 20, ease);
          bUpper = lerp(30, -65, ease); bFore = lerp(20, 50, ease);
        } else if (sp < 0.70) {
          // 0.52 -> 0.70: Full Spartan extension hold
          fThigh = -88;
          fCalf = 0;
          bThigh = 20;
          bCalf = 12;
          bodyLean = -40; // BENT BACKWARDS
          bodyDip = 0;
          fUpper = 50; fFore = 20;
          bUpper = -65; bFore = 50;
        } else {
          // 0.70 -> 1.0: Powerful snap-back to stance
          const t = (sp - 0.70) / 0.30;
          const ease = t * t;
          fThigh = lerp(-88, -5, ease);
          fCalf = lerp(0, 5, ease);
          bThigh = lerp(20, 8, ease);
          bCalf = lerp(12, 5, ease);
          bodyLean = lerp(-40, 0, ease);
          bodyDip = 0;
          fUpper = lerp(50, -35, ease); fFore = lerp(20, 65, ease);
          bUpper = lerp(-65, -15, ease); bFore = lerp(50, 50, ease);
        }
        break;
      }

      case 'sweepKick': {
        // Low Ground Sweep Kick (performed from crouch)
        // Stays low to the floor, braces hand on ground, sweeps leg flat at ankle level
        if (sp < 0.20) {
          // 0 -> 0.20: Drop low and coil sweep leg
          const t = sp / 0.20;
          bodyDip = lerp(28, 42, t);
          bodyLean = lerp(-15, 12, t);
          fThigh = lerp(-68, -45, t);
          fCalf = lerp(68, 55, t);
          bThigh = lerp(58, 72, t);
          bCalf = lerp(-58, -72, t);
          fUpper = lerp(-18, -45, t);
          fFore = lerp(32, 30, t);
          fArmY = -TORSO_H + 16;
        } else if (sp < 0.58) {
          // 0.20 -> 0.58: Sweeping leg shoots straight across the floor!
          const t = (sp - 0.20) / 0.38;
          const ease = 1 - (1 - t) * (1 - t);
          bodyDip = 44;
          bodyLean = lerp(12, 18, ease);
          fThigh = lerp(-45, -88, ease);
          fCalf = lerp(55, 0, ease);
          bThigh = 74;
          bCalf = -74;
          fUpper = -50;
          fFore = 35;
          fArmY = -TORSO_H + 20; // hand braced on ground
          bUpper = 20;
          bFore = 30;
        } else if (sp < 0.74) {
          // 0.58 -> 0.74: Full sweep follow-through along the ground
          bodyDip = 44;
          bodyLean = 18;
          fThigh = -88;
          fCalf = 0;
          bThigh = 74;
          bCalf = -74;
          fUpper = -50;
          fFore = 35;
          fArmY = -TORSO_H + 20;
          bUpper = 20;
          bFore = 30;
        } else {
          // 0.74 -> 1.0: Recover back up to crouch stance
          const t = (sp - 0.74) / 0.26;
          const ease = t * t;
          bodyDip = lerp(44, 28, ease);
          bodyLean = lerp(18, -15, ease);
          fThigh = lerp(-88, -68, ease);
          fCalf = lerp(0, 68, ease);
          bThigh = lerp(74, 58, ease);
          bCalf = lerp(-74, -58, ease);
          fUpper = lerp(-50, -18, ease);
          fFore = lerp(35, 32, ease);
          fArmY = -TORSO_H + 6;
        }
        break;
      }

      case 'flipKick': {
        // Front Flip Axe Kick (Acrobatic forward somersault with axe kick slam at 220°!)
        // Whole character somersaults forward 360° around body center
        charRot = sp * 360;

        if (sp < 0.30) {
          // 0° -> 108°: Forward roll launch & tuck
          const t = sp / 0.30;
          bodyLean = lerp(0, 25, t);          // curling forward into front flip
          fThigh = lerp(-10, -80, t);       // chambering knees high
          fCalf = lerp(10, 85, t);
          bThigh = lerp(10, -50, t);
          bCalf = lerp(10, 80, t);
          fUpper = lerp(-35, -80, t);       // arms driving forward flip rotation
          fFore = lerp(65, 30, t);
          bUpper = lerp(-15, -70, t);
          bFore = lerp(50, 30, t);
        } else if (sp < 0.55) {
          // 108° -> 198°: Inversion & high chamber of the axe blade
          const t = (sp - 0.30) / 0.25;
          bodyLean = lerp(25, -5, t);
          fThigh = lerp(-80, -100, t);      // kicking leg raises and uncoils
          fCalf = lerp(85, 10, t);
          bThigh = lerp(-50, 35, t);        // supporting leg tucked
          bCalf = lerp(80, 75, t);
          fUpper = lerp(-80, 35, t);
          fFore = lerp(30, 20, t);
          bUpper = lerp(-70, -50, t);
          bFore = lerp(30, 40, t);
        } else if (sp < 0.68) {
          // 198° -> 245° (PEAK AT 220°): DEVASTATING DOWNWARD AXE KICK!
          // Leg snaps completely straight like a guillotine axe blade!
          fThigh = -105;                    // locked straight, slicing downward
          fCalf = 0;                       // fully extended axe blade
          bThigh = 45;                      // supporting leg tucked
          bCalf = 85;
          bodyLean = -10;
          fUpper = 40; fFore = 20;         // arms spread for balance
          bUpper = -60; bFore = 35;
        } else {
          // 245° -> 360°: Follow-through and landing tuck onto feet
          const t = (sp - 0.68) / 0.32;
          bodyLean = lerp(-10, 0, t);
          fThigh = lerp(-105, -15, t);
          fCalf = lerp(0, 30, t);
          bThigh = lerp(45, 5, t);
          bCalf = lerp(85, 20, t);
          fUpper = lerp(40, -35, t);
          fFore = lerp(20, 65, t);
          bUpper = lerp(-60, -15, t);
          bFore = lerp(35, 50, t);
        }
        break;
      }

      case 'dash': {
        const isForward = (this.dashDir === this.facing);
        if (isForward) {
          // Low aerodynamic forward ninja dash
          bodyLean = -26;
          bodyDip = 16;
          fThigh = -58; fCalf = 72;
          bThigh = 62; bCalf = 22;
          fUpper = -68; fFore = 42;
          bUpper = 42; bFore = 35;
        } else {
          // Evasive martial arts back-hop
          bodyLean = 14;
          bodyDip = 10;
          fThigh = 22; fCalf = 32;
          bThigh = -32; bCalf = 48;
          fUpper = -38; fFore = 50;
          bUpper = -25; bFore = 50;
        }
        break;
      }

      case 'groundStomp': {
        // Martial Arts Ground Stomp Attack ("Q"):
        // 0.0 -> 0.38: Dramatic high knee raise chamber (charging kinetic seismic energy)
        // 0.38 -> 0.52: Violent downward foot stomp impact onto the arena floor!
        // 0.52 -> 1.0: Deep grounded crater stance and recovery back to idle
        if (sp < 0.38) {
          const t = sp / 0.38;
          const ease = t * (2 - t);
          bodyLean = lerp(0, 14, ease); // Leaning back slightly to chamber leg
          bodyDip = lerp(0, -6, ease);
          // Front leg lifts high into chest chamber
          fThigh = lerp(-5, -108, ease);
          fCalf = lerp(5, 102, ease);
          // Back leg firmly planted
          bThigh = lerp(8, 6, ease);
          bCalf = lerp(5, 12, ease);
          // Power arms flare outward
          fUpper = lerp(-35, -75, ease);
          fFore = lerp(65, 30, ease);
          bUpper = lerp(-15, 60, ease);
          bFore = lerp(50, 30, ease);
        } else if (sp < 0.52) {
          // Violent stomping slam into the ground!
          const t = (sp - 0.38) / 0.14;
          const ease = t * t;
          bodyLean = lerp(14, -14, ease);
          bodyDip = lerp(-6, 20, ease); // Deep drop into the earth
          // Front leg stomps straight into the ground
          fThigh = lerp(-108, -6, ease);
          fCalf = lerp(102, 6, ease);
          bThigh = lerp(6, 45, ease);
          bCalf = lerp(12, -35, ease);
          // Arms thrust down in power kiai
          fUpper = lerp(-75, 45, ease);
          fFore = lerp(30, 40, ease);
          bUpper = lerp(60, -35, ease);
          bFore = lerp(30, 45, ease);
        } else {
          // Deep power stance recovery back to idle
          const t = (sp - 0.52) / 0.48;
          const ease = 1 - (1 - t) * (1 - t);
          bodyLean = lerp(-14, 0, ease);
          bodyDip = lerp(20, 0, ease);
          fThigh = lerp(-6, -5, ease);
          fCalf = lerp(6, 5, ease);
          bThigh = lerp(45, 8, ease);
          bCalf = lerp(-35, 5, ease);
          fUpper = lerp(45, -35, ease);
          fFore = lerp(40, 65, ease);
          bUpper = lerp(-35, -15, ease);
          bFore = lerp(45, 50, ease);
        }
        break;
      }

      case 'duckHeadbutt': {
        // Duck Headbutt Attack:
        // 0.0 -> 0.38: Deep martial arts duck (DODGES SPARTAN KICKS AND HIGH PUNCHES!)
        // 0.38 -> 0.65: Explodes into 45-DEGREE LEAN FORWARD HEADBUTT!
        // 0.65 -> 1.0: Recovery back to stance
        if (sp < 0.38) {
          const t = sp / 0.38;
          // Deep ducking frames: body dips close to floor, coiling forward
          bodyDip = lerp(0, 28, t);
          bodyLean = lerp(0, 15, t);
          fThigh = lerp(-5, -45, t);
          fCalf = lerp(5, 82, t);
          bThigh = lerp(8, 30, t);
          bCalf = lerp(5, 68, t);
          // Arms tucked tightly protecting chin
          fUpper = lerp(-35, -20, t);
          fFore = lerp(65, 82, t);
          bUpper = lerp(-15, 0, t);
          bFore = lerp(50, 78, t);
        } else if (sp < 0.65) {
          // 45-DEGREE LEAN FORWARD HEADBUTT EXPLOSION!
          const t = (sp - 0.38) / 0.27;
          bodyLean = 45; // Exactly 45 degree lean forward!
          bodyDip = lerp(28, 6, t);
          // Legs drive forcefully forward
          fThigh = lerp(-45, -16, t);
          fCalf = lerp(82, 32, t);
          bThigh = lerp(30, -28, t);
          bCalf = lerp(68, 12, t);
          // Arms thrust back for ramming momentum
          fUpper = 46; fFore = 22;
          bUpper = 52; bFore = 26;
        } else {
          // Recovery from 45-degree lean back to neutral stance
          const t = (sp - 0.65) / 0.35;
          bodyLean = lerp(45, 0, t);
          bodyDip = lerp(6, 0, t);
          fThigh = lerp(-16, -5, t);
          fCalf = lerp(32, 5, t);
          bThigh = lerp(-28, 8, t);
          bCalf = lerp(12, 5, t);
          fUpper = lerp(46, -35, t);
          fFore = lerp(22, 65, t);
          bUpper = lerp(52, -15, t);
          bFore = lerp(26, 50, t);
        }
        break;
      }

      case 'crouch':
        bodyDip = 28;
        bodyLean = -15;
        fThigh = -68; fCalf = 68;
        bThigh = 58; bCalf = -58;
        fUpper = -18; fFore = 32;
        bUpper = 14; bFore = 20;
        break;

      case 'knockdown': {
        // Dynamic Knockdown Fall Animation:
        // 1. Swept off feet (0 -> 0.20): Legs fly high UP into the air, torso leans backward
        // 2. Slams hard on ass (0.20 -> 0.34): Butt impacts floor (shake & dust), legs kick up high from impact
        // 3. Sleeping position flat on back (0.34 -> 0.80): Head, torso, hips, and legs rest flat along floor in natural sleeping pose
        // 4. Wake up & push up (0.80 -> 1.0): Plants hands, tucks legs, smoothly rises back up to stance

        if (sp < 0.20) {
          // Phase 1: Swept off feet! Legs fly high up into the air!
          const t = sp / 0.20;
          const ease = t * t;
          bodyLean = lerp(0, -52, ease);       // leaning BACKWARD
          bodyDip = lerp(0, 42, ease);        // dropping toward floor
          fThigh = lerp(-5, -125, ease);     // lead leg flies straight UP!
          fCalf = lerp(5, 20, ease);
          bThigh = lerp(8, -105, ease);      // back leg also swept high!
          bCalf = lerp(5, 25, ease);
          // Arms flail backward to break fall
          fUpper = lerp(-35, -75, ease);
          fFore = lerp(65, 25, ease);
          bUpper = lerp(-15, -60, ease);
          bFore = lerp(50, 20, ease);
        } else if (sp < 0.34) {
          // Phase 2: SLAMS HARD ON ASS! Impact rebounds legs high into air
          const t = (sp - 0.20) / 0.14;
          bodyLean = lerp(-52, -80, t);        // torso rocking back from ass impact
          bodyDip = lerp(42, 58, t);          // ass firmly on the mat!
          // Legs kick up to max vertical height at impact
          fThigh = lerp(-125, -135, Math.sin(t * Math.PI)); // peaks up in the air!
          fCalf = lerp(20, 28, t);
          bThigh = lerp(-105, -118, Math.sin(t * Math.PI));
          bCalf = lerp(25, 30, t);
          // Hands slapping the mat / floor
          fUpper = lerp(-75, 12, t);
          fFore = lerp(25, 15, t);
          bUpper = lerp(-60, 10, t);
          bFore = lerp(20, 15, t);
        } else if (sp < 0.80) {
          // Phase 3: RELAXED SLEEPING POSITION FLAT ON BACK (~1 full sec grounded)
          const t = Math.min(1, (sp - 0.34) / 0.10); // smooth settle into sleeping pose
          bodyLean = lerp(-80, -90, t);        // torso flat on back (horizontal along floor)
          bodyDip = 58;                       // head, torso & hips resting on floor

          // Legs settle down from air and lie relaxed along the floor
          fThigh = lerp(-135, -76, t);       // lead leg extended along floor
          fCalf = lerp(20, -10, t);         // knee slightly relaxed, heel on floor
          bThigh = lerp(-118, -70, t);       // back leg resting beside it
          bCalf = lerp(25, -8, t);

          // Subtle sleeping breathing rhythm
          const breathe = Math.sin((sp - 0.34) * 14) * 2;

          // Arms resting in natural sleeping pose
          // Front arm resting folded comfortably across the abdomen / chest
          fUpper = 28 + breathe;
          fFore = 80 - breathe;
          // Back arm resting relaxed along the side on the floor
          bUpper = 8;
          bFore = 10;
        } else {
          // Phase 4: WAKING UP & STANDING BACK UP onto feet
          const t = (sp - 0.80) / 0.20;
          const ease = t * (2 - t);            // smooth ease out
          bodyLean = lerp(-90, 0, ease);       // rising from back to upright
          bodyDip = lerp(58, 0, ease);        // hips rising from floor
          // Legs tucking in and planting feet firmly on ground
          fThigh = lerp(-76, -5, ease);
          fCalf = lerp(-10, 5, ease);
          bThigh = lerp(-70, 8, ease);
          bCalf = lerp(-8, 5, ease);
          // Pushing up with hands and returning to guard stance
          fUpper = lerp(28, -35, ease);
          fFore = lerp(80, 65, ease);
          bUpper = lerp(8, -15, ease);
          bFore = lerp(10, 50, ease);
        }
        break;
      }

      case 'block':
        // Boxer high guard: both hands raised tight right in front of the face
        fThigh = -12; fCalf = 16;
        bThigh = 10; bCalf = 8;
        bodyLean = -6;     // tucked chin, head down
        bodyDip = 4;     // solid boxer stance

        // Front arm (guards face & nose):
        fUpper = -98;      // upper arm points forward & slightly up
        fFore = -116;     // forearm angles up-back: fist directly in front of face/eyes!
        fArmX = 8;
        fArmY = -TORSO_H + 2;

        // Back arm (guards cheek & jaw):
        bUpper = -92;
        bFore = -118;
        bArmX = -4;
        bArmY = -TORSO_H + 4;
        break;

      case 'hurt': {
        const t = 1 - sp;
        bodyLean = 18 * t; bodyDip = 8 * t;
        fThigh = lerp(-5, 18, t); fCalf = lerp(5, 5, t);
        bThigh = lerp(8, -15, t); bCalf = lerp(5, 5, t);
        fUpper = lerp(-35, 35, t); fFore = lerp(65, 25, t);
        bUpper = lerp(-15, 28, t); bFore = lerp(50, 18, t);
        break;
      }

      case 'dead':
        bodyLean = -90;
        bodyDip = 58;
        fThigh = -76; fCalf = -10;
        bThigh = -70; bCalf = -8;
        fUpper = 28; fFore = 80;
        bUpper = 8; bFore = 10;
        break;

      case 'victory':
        fUpper = -88; fFore = -20; bUpper = -78; bFore = -20;
        fThigh = -5; bThigh = 5;
        bodyDip = Math.sin(Date.now() * 0.005) * 4;
        break;
    }

    // ── Enter character space ───────────────────────────
    ctx.save();
    ctx.translate(this.x, this.y + bodyDip * sc);
    ctx.scale(this.facing * sc, sc);

    // Apply backflip somersault INSIDE character space around mid-body
    if (charRot !== 0) {
      ctx.translate(0, hipY * 0.5);
      ctx.rotate(charRot * Math.PI / 180);
      ctx.translate(0, -hipY * 0.5);
    }

    const mainCol = this.mainColor || '#000';
    const backCol = this.backColor || '#333';

    // 1) Back leg
    this._leg(-4, hipY, bThigh, bCalf, THIGH_L, CALF_L, LIMB_W, FOOT_W, FOOT_H, backCol);

    // 2) Torso block (torso + head + both double-jointed arms, all lean together)
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(bodyLean * Math.PI / 180);

    // back arm (behind torso)
    this._arm(bArmX, bArmY, bUpper, bFore, U_ARM_L, FORE_L, LIMB_W, backCol);

    // torso
    ctx.fillStyle = mainCol;
    ctx.beginPath(); ctx.roundRect(-15, -TORSO_H, 30, TORSO_H, 6); ctx.fill();

    // head
    const headCY = shoulderY - hipY - HEAD_R - 2;
    ctx.beginPath(); ctx.arc(0, headCY, HEAD_R, 0, Math.PI * 2); ctx.fill();
    // eye (sleeping slit if knocked down or defeated, otherwise alert glowing eye)
    if ((this.state === 'knockdown' && sp > 0.20 && sp < 0.80) || this.state === 'dead') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // In -90° torso space, varying along Y produces a crisp horizontal line in world space parallel to floor
      ctx.moveTo(11, headCY - 4);
      ctx.lineTo(11, headCY + 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11, headCY - 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(12.5, headCY - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // front arm (over torso)
    this._arm(fArmX, fArmY, fUpper, fFore, U_ARM_L, FORE_L, LIMB_W, mainCol);

    ctx.restore(); // end torso+lean

    // 3) Front leg
    this._leg(4, hipY, fThigh, fCalf, THIGH_L, CALF_L, LIMB_W, FOOT_W, FOOT_H, mainCol);

    ctx.restore(); // end character space
    ctx.globalAlpha = 1;

    // 4) Combo badge (screen space, no health bar)
    if (this.comboCount >= 2) this._comboBadge(sc);

    // 5) Dizzy / Stun stars while stunned from 1.5s Duck Headbutt
    if (this.stunTimer > 0 && this.state === 'hurt' && this.state !== 'dead') {
      const starAngle = (Date.now() * 0.007) % (Math.PI * 2);
      const starRadius = 24 * sc;
      const headTopY = this.y - 128 * sc;
      for (let i = 0; i < 3; i++) {
        const a = starAngle + (i * Math.PI * 2 / 3);
        const sx = this.x + Math.cos(a) * starRadius;
        const sy = headTopY + Math.sin(a) * (starRadius * 0.35);
        ctx.save();
        ctx.fillStyle = '#facc15'; // Bright golden yellow
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ── Double-jointed arm ──────────────────────────────────
  // upperA = upper arm angle (absolute), foreA = forearm angle RELATIVE to upper arm
  _arm(ox, oy, upperA, foreA, uLen, fLen, w, color) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = color;

    ctx.save();
    ctx.rotate(upperA * Math.PI / 180);
    // upper arm
    ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, uLen, w / 2); ctx.fill();
    // elbow joint
    ctx.beginPath(); ctx.arc(0, uLen, w * 0.6, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, uLen);
    ctx.rotate(foreA * Math.PI / 180); // relative to upper arm
    // forearm
    ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, fLen, w / 2); ctx.fill();
    // fist
    ctx.beginPath(); ctx.arc(0, fLen, w * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ── Double-jointed leg ─────────────────────────────────
  _leg(ox, oy, thighA, calfA, tLen, cLen, w, fw, fh, color) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = color;

    ctx.save();
    ctx.rotate(thighA * Math.PI / 180);
    ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, tLen, w / 2); ctx.fill();
    // knee joint
    ctx.beginPath(); ctx.arc(0, tLen, w * 0.6, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, tLen);
    ctx.rotate(calfA * Math.PI / 180);
    ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, cLen, w / 2); ctx.fill();
    ctx.translate(0, cLen);
    ctx.beginPath(); ctx.roundRect(-w / 2, -fh / 2, fw, fh, fh / 2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ── Combo badge (above fighter, no health bar) ──────────
  _comboBadge(sc) {
    const sx = this.x, sy = this.y;
    ctx.textAlign = 'center';
    ctx.font = `bold ${13 * sc}px monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText(`COMBO ×${this.comboCount}`, sx, sy - 220 * sc);
  }
}

// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════
let gameState = 'menu';
let menuView = 'main'; // 'main' | 'moves'
let moveScrollY = 0;
let isDraggingScroll = false;
let dragScrollStartY = 0;
let dragScrollStartScroll = 0;
let difficulty = 'medium'; // 'easy' | 'medium' (default) | 'hard'
let isPaused = false;
let playerWins = 0, enemyWins = 0;
const WIN_ROUNDS = 2;
let roundTimer = 99, roundTimerAcc = 0;
let countdown = 3, countdownTimer = 0;
let roundNum = 1, resultText = '';
let roundBannerText = '', roundBannerTimer = 0;
let player, enemy;

// ═══════════════════════════════════════════════════════════
//  COMPLETE COMBAT MOVES DATABASE (ALL 11 TECHNIQUES)
// ═══════════════════════════════════════════════════════════
const ALL_MOVES = [
  {
    category: 'STRIKES & COMBOS',
    name: 'Rapid Punch Combo',
    input: 'V / L-CLICK (or PUNCH Button)',
    badge: '9 / 2.25 DMG · BLOOD',
    badgeBg: '#000000',
    summary: 'High-speed flurry alternating rapidly between lead and rear fists.',
    bullets: [
      '• Rapidly tap V, Left-Click, or [PUNCH] button to chain a lightning flurry of up to 5 punches.',
      '• 1st punch deals 9 DMG; following 4 chain punches deal 2.25 DMG each. 0.5s recovery after 5 punches.'
    ]
  },
  {
    category: 'TACTICAL COUNTERS',
    name: 'Duck Headbutt',
    input: 'Back + V (or Joy Back + PUNCH)',
    badge: '14 DMG · 1.5s STUN',
    badgeBg: '#dc2626',
    summary: 'Ducks beneath high strikes, then surges forward into an explosive 45° skull strike.',
    bullets: [
      '• Directional Input: Hold Back (A or D away from foe) and press V or [PUNCH]. Dodges punches & Spartan kicks!',
      '• 45° Ram Strike: Deals 14 DMG with red blood and STUNS the enemy for 1.5 seconds with spinning dizzy stars!'
    ]
  },
  {
    category: 'LOW OFFENSE',
    name: 'Low Crouch Punch',
    input: 'S + V (or Down + PUNCH)',
    badge: '9 DMG · LOW HIT',
    badgeBg: '#1e293b',
    summary: 'Gedan Tsuki low body strike delivered while maintaining a full crouch posture.',
    bullets: [
      '• Hold S (or Down Arrow / Joy Down) + V or [PUNCH]. Torso stays submerged below head level.',
      '• Deals 9 DMG with arterial blood spray; fast frame recovery for safe close-quarter poke pressure.'
    ]
  },
  {
    category: 'MID POKES',
    name: 'Snap Thrust Kick',
    input: 'B / R-CLICK (or KICK Button)',
    badge: '12 DMG · 152px REACH',
    badgeBg: '#1e293b',
    summary: 'Swift linear round thrust kick extending 152px outward at mid-body level.',
    bullets: [
      '• Press B, Right-Click, or [KICK] button. Primary mid-range spacing and poke tool (152px reach).',
      '• Deals 12 DMG with red blood spray and interrupts aggressive forward dashes when properly timed.'
    ]
  },
  {
    category: 'WALL-BOUNCE POWER',
    name: 'Spartan Kick',
    input: 'Fwd + B (or Joy Fwd + KICK)',
    badge: '18 DMG · 4X KNOCKBACK',
    badgeBg: '#b91c1c',
    summary: 'Torso leans back 40° as heel delivers a devastating linear chest battering ram.',
    bullets: [
      '• Directional Input: Hold Forward towards enemy (D or A / Joy Fwd) and press B or [KICK].',
      '• 4X Colossal Knockback (368px!): Hurls opponents across the arena into perimeter walls with skidding dust clouds.'
    ]
  },
  {
    category: 'AERIAL CRUSH',
    name: 'Front Flip Axe Kick',
    input: 'Air + B (Jump + KICK)',
    badge: '21 DMG · FLATTENS FOE',
    badgeBg: '#7c2d12',
    summary: 'Full 360° airborne somersault bringing heel crashing downward at 220° rotation.',
    bullets: [
      '• Airborne Execution: Press W (or push Joystick Up) to leap, then press B or [KICK] while in mid-air.',
      '• Untechable Knockdown: Deals 21 massive DMG and smashes opponent flat on their back for a 1.0s floor knockdown!'
    ]
  },
  {
    category: 'GUARD BREAK',
    name: 'Low Sweep Kick',
    input: 'S + B (or Down + KICK)',
    badge: '7 DMG · TRIPS ON ASS',
    badgeBg: '#0f766e',
    summary: 'Ground-level 360° spinning foot sweep with grounded hand plant.',
    bullets: [
      '• Hold S (or Down Arrow / Joy Down) + B or [KICK]. Ground-level 360° spinning foot sweep.',
      '• Bypasses High Guard: Trips standing opponents onto floor for 1.0s. Deals 7 DMG with ground dust clouds.'
    ]
  },
  {
    category: 'DEFENSE',
    name: 'Martial Arts Crouch',
    input: 'Hold S (or Joystick Down)',
    badge: 'DEFENSE · DUCK HIGH',
    badgeBg: '#334155',
    summary: 'Deep crouching martial posture dropping fighter below standing punch plane.',
    bullets: [
      '• Hold S (or Down Arrow / pull Joystick Down). Deep martial crouch; passively ducks under all standing punches.',
      '• Seamlessly combos into Low Crouch Punch, Low Sweep Kick, or Duck Headbutt counter-attacks.'
    ]
  },
  {
    category: 'DEFENSE',
    name: 'Boxer High Guard Block',
    input: 'Hold Shift (or BLOCK Button)',
    badge: 'DEFENSE · 90% ABSORPTION',
    badgeBg: '#334155',
    summary: 'Peek-a-boo boxing guard with both forearms shielding chin, nose, and head.',
    bullets: [
      '• Hold Shift or hold the [BLOCK] button. Peek-a-boo guard absorbing 90% incoming damage.',
      '• Negates knockback slide; highly effective against punches and kicks, but vulnerable to Sweeps & Ground Stomp!'
    ]
  },
  {
    category: 'MOBILITY',
    name: 'Tactical Dash Burst',
    input: 'Double-Tap A/D (or Joy Side Double-Tap)',
    badge: 'MOBILITY · 184px BURST',
    badgeBg: '#0284c7',
    summary: 'High-speed directional burst propulsion leaving transparent shadow afterimages.',
    bullets: [
      '• Double-tap A (Left) / D (Right), or double-tap sides of joystick. Propels fighter 184px in 0.20s.',
      '• Double-tap forward = rush burst; double-tap backward = evasive retreat. Leaves shadow afterimages!'
    ]
  },
  {
    category: 'ULTIMATE REVERSAL',
    name: 'Ground Stomp ("Q")',
    input: 'Q (or STOMP Button)',
    badge: 'ULTIMATE · UNINTERRUPTIBLE',
    badgeBg: '#000000',
    summary: 'Cataclysmic shockwave unlocked after receiving 3 Spartan Kicks or 3 KDs in 5 seconds.',
    bullets: [
      '• Press Q (or tap pop-up [STOMP] button above joystick when ready). 100% UNINTERRUPTIBLE hyper-armor!',
      '• Screen-Wide Shockwave: Knocks down the opponent wherever they are standing on screen!'
    ]
  }
];

function initRound() {
  player = new Fighter(canvas.width * 0.25, true, 'PLAYER');
  enemy = new Fighter(canvas.width * 0.75, false, difficulty === 'pvp' ? 'PLAYER 2' : 'CPU');

  // Configure enemy appearance & traits by difficulty / game mode
  if (difficulty === 'pvp') {
    enemy.mainColor = '#1d4ed8'; // Royal blue for Player 2
    enemy.backColor = '#1e3a8a'; // Deep navy blue for P2 back limbs
    enemy.displayName = 'P2 [BLUE]';
    player.displayName = 'P1 [ORANGE]';
  } else if (difficulty === 'easy') {
    enemy.mainColor = '#16a34a'; // Vibrant emerald green
    enemy.backColor = '#15803d'; // Deep green for back limbs
    enemy.displayName = 'CPU [EASY]';
    player.displayName = 'PLAYER';
  } else if (difficulty === 'hard') {
    enemy.mainColor = '#dc2626'; // Vibrant crimson red
    enemy.backColor = '#991b1b'; // Deep dark red for back limbs
    enemy.displayName = 'CPU [HARD]';
    player.displayName = 'PLAYER';
  } else {
    enemy.mainColor = '#000000'; // Classic black shadow (medium default)
    enemy.backColor = '#333333';
    enemy.displayName = 'CPU [MEDIUM]';
    player.displayName = 'PLAYER';
  }

  roundTimer = 99; roundTimerAcc = 0;
  countdown = 3; countdownTimer = 1;
  gameState = 'countdown';
  menuView = 'main';
  moveScrollY = 0;
  isDraggingScroll = false;
  isPaused = false;
  particles.length = 0;
  groundShockwaves.length = 0;
  keys = {};
  roundBannerText = '';
  roundBannerTimer = 0;

  // Reset touch controls
  if (typeof touchControls !== 'undefined') {
    const joy = touchControls.joystick;
    joy.active = false; joy.touchId = null;
    joy.knobX = joy.baseX; joy.knobY = joy.baseY;
    joy.vx = 0; joy.vy = 0;
    joy.left = false; joy.right = false; joy.up = false; joy.down = false;
    joy.upLeft = false; joy.upRight = false; joy.downLeft = false; joy.downRight = false;
    joy.lastJumpTriggered = false;
    touchControls.buttons.block.pressed = false;
    touchControls.buttons.block.touchId = null;
    touchControls.buttons.punch.pressed = false;
    touchControls.buttons.punch.touchId = null;
    touchControls.buttons.kick.pressed = false;
    touchControls.buttons.kick.touchId = null;
    touchControls.qButton.pressed = false;
    touchControls.qButton.touchId = null;
    updateTouchLayout();
  }
}

// ── Combat Attack Dispatchers ─────────────────────────────────
function triggerPlayer1Punch() {
  if (!player || player.hp <= 0 || gameState !== 'fight' || isPaused) return;
  const joy = typeof touchControls !== 'undefined' ? touchControls.joystick : null;
  const joyLeft = joy ? (joy.left || joy.downLeft || joy.upLeft) : false;
  const joyRight = joy ? (joy.right || joy.downRight || joy.upRight) : false;
  const joyDown = joy ? joy.down : false;

  const isBack = (player.facing > 0 && (keys['KeyA'] || keys['ArrowLeft'] || joyLeft)) ||
                 (player.facing < 0 && (keys['KeyD'] || keys['ArrowRight'] || joyRight));
  if (isBack) {
    player.attack('duckHeadbutt');
  } else if (player.crouching || player.state === 'crouch' || joyDown) {
    player.attack('crouchPunch');
  } else {
    player.attack('punch');
  }
}

function triggerPlayer1Kick() {
  if (!player || player.hp <= 0 || gameState !== 'fight' || isPaused) return;
  const joy = typeof touchControls !== 'undefined' ? touchControls.joystick : null;
  const joyLeft = joy ? (joy.left || joy.downLeft || joy.upLeft) : false;
  const joyRight = joy ? (joy.right || joy.downRight || joy.upRight) : false;
  const joyDown = joy ? joy.down : false;

  const isFwd = (player.facing > 0 && (keys['KeyD'] || keys['ArrowRight'] || joyRight)) ||
                (player.facing < 0 && (keys['KeyA'] || keys['ArrowLeft'] || joyLeft));
  if (!player.onGround) {
    player.attack('flipKick');
  } else if (player.crouching || player.state === 'crouch' || joyDown) {
    player.attack('sweepKick');
  } else {
    player.attack(isFwd ? 'spartanKick' : 'kick');
  }
}

function triggerPlayer2Punch() {
  if (!enemy || enemy.hp <= 0 || gameState !== 'fight' || isPaused) return;
  const isLeft = keys['Numpad4'] || keys['Digit4'] || keys['4'];
  const isRight = keys['Numpad6'] || keys['Digit6'] || keys['6'];
  const isBack = (enemy.facing > 0 && isLeft) || (enemy.facing < 0 && isRight);
  if (isBack) {
    enemy.attack('duckHeadbutt');
  } else if (enemy.crouching || enemy.state === 'crouch') {
    enemy.attack('crouchPunch');
  } else {
    enemy.attack('punch');
  }
}

function triggerPlayer2Kick() {
  if (!enemy || enemy.hp <= 0 || gameState !== 'fight' || isPaused) return;
  const isLeft = keys['Numpad4'] || keys['Digit4'] || keys['4'];
  const isRight = keys['Numpad6'] || keys['Digit6'] || keys['6'];
  const isFwd = (enemy.facing > 0 && isRight) || (enemy.facing < 0 && isLeft);
  if (!enemy.onGround) {
    enemy.attack('flipKick');
  } else if (enemy.crouching || enemy.state === 'crouch') {
    enemy.attack('sweepKick');
  } else {
    enemy.attack(isFwd ? 'spartanKick' : 'kick');
  }
}

// ── Input ────────────────────────────────────────────────────
let keys = {};
let lastTap = { left: 0, right: 0 };
let lastTapP2 = { left: 0, right: 0 };
const DOUBLE_TAP_WINDOW = 280; // ms

document.addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;
  keys[e.key] = true;

  // Toggle Pause Menu with P or Escape during fight
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameState === 'fight') {
      isPaused = !isPaused;
      if (isPaused) {
        moveScrollY = 0;
        isDraggingScroll = false;
      } else {
        lastTime = performance.now();
      }
      return;
    }
  }

  // Keyboard scrolling when in Pause Menu or Menu Move List
  if (isPaused || (gameState === 'menu' && menuView === 'moves')) {
    const layout = getMoveListModalLayout(isPaused ? 'pause' : 'menu');
    if (e.code === 'ArrowDown') {
      moveScrollY = clamp(moveScrollY + 60 * layout.sc, 0, layout.maxScrollY);
      return;
    }
    if (e.code === 'ArrowUp') {
      moveScrollY = clamp(moveScrollY - 60 * layout.sc, 0, layout.maxScrollY);
      return;
    }
    if (e.code === 'PageDown') {
      moveScrollY = clamp(moveScrollY + layout.contentH * 0.75, 0, layout.maxScrollY);
      return;
    }
    if (e.code === 'PageUp') {
      moveScrollY = clamp(moveScrollY - layout.contentH * 0.75, 0, layout.maxScrollY);
      return;
    }
    if (e.code === 'Home') {
      moveScrollY = 0;
      return;
    }
    if (e.code === 'End') {
      moveScrollY = layout.maxScrollY;
      return;
    }
    if (gameState === 'menu' && menuView === 'moves') {
      if (e.code === 'Escape' || e.code === 'KeyM') {
        menuView = 'main';
        return;
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
        return;
      }
    }
    return;
  }

  if (gameState === 'fight' && !isPaused) {
    const now = Date.now();

    // ── PLAYER 1 CONTROLS (Left Fighter) ──
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      if (now - lastTap.left < DOUBLE_TAP_WINDOW) {
        player.dash(-1);
        lastTap.left = 0;
      } else {
        lastTap.left = now;
      }
    }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      if (now - lastTap.right < DOUBLE_TAP_WINDOW) {
        player.dash(1);
        lastTap.right = 0;
      } else {
        lastTap.right = now;
      }
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') player.jump();
    if (e.code === 'KeyS' || e.code === 'ArrowDown') player.crouch(true);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.block(true);
    if (e.code === 'KeyQ') {
      if (player && (player.groundStompReady || player.reversalReady)) {
        triggerGroundStomp(player, enemy);
      }
    }
    if (e.code === 'KeyV') {
      triggerPlayer1Punch();
    }
    if (e.code === 'KeyB') {
      triggerPlayer1Kick();
    }

    // ── PLAYER 2 CONTROLS (Multiplayer Mode) ──
    if (difficulty === 'pvp' && enemy && enemy.hp > 0) {
      // 4 = Move Left / Dash Left
      if (e.code === 'Numpad4' || e.code === 'Digit4' || e.key === '4') {
        if (now - lastTapP2.left < DOUBLE_TAP_WINDOW) {
          enemy.dash(-1);
          lastTapP2.left = 0;
        } else {
          lastTapP2.left = now;
        }
      }
      // 6 = Move Right / Dash Right
      if (e.code === 'Numpad6' || e.code === 'Digit6' || e.key === '6') {
        if (now - lastTapP2.right < DOUBLE_TAP_WINDOW) {
          enemy.dash(1);
          lastTapP2.right = 0;
        } else {
          lastTapP2.right = now;
        }
      }
      // 8 = Jump
      if (e.code === 'Numpad8' || e.code === 'Digit8' || e.key === '8') {
        enemy.jump();
      }
      // 5 = Crouch
      if (e.code === 'Numpad5' || e.code === 'Digit5' || e.key === '5') {
        enemy.crouch(true);
      }
      // 0 = Block
      if (e.code === 'Numpad0' || e.code === 'Digit0' || e.key === '0') {
        enemy.block(true);
      }
      // 7 = Ground Stomp
      if (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7') {
        if (enemy.groundStompReady || enemy.reversalReady) {
          triggerGroundStomp(enemy, player);
        }
      }
      // - = Punch
      if (e.code === 'NumpadSubtract' || e.code === 'Minus' || e.key === '-') {
        triggerPlayer2Punch();
      }
      // + = Kick
      if (e.code === 'NumpadAdd' || e.code === 'Equal' || e.key === '+' || e.key === '=') {
        triggerPlayer2Kick();
      }
    }
  }

  if (gameState === 'menu' && menuView === 'main') {
    if (e.code === 'KeyM') {
      menuView = 'moves';
      moveScrollY = 0;
      return;
    }
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
      difficulty = 'easy';
      return;
    }
    if (e.code === 'Digit2' || e.code === 'Numpad2') {
      difficulty = 'medium';
      return;
    }
    if (e.code === 'Digit3' || e.code === 'Numpad3') {
      difficulty = 'hard';
      return;
    }
    if (e.code === 'Digit4' || e.code === 'Numpad4') {
      difficulty = 'pvp';
      return;
    }
    const diffs = ['easy', 'medium', 'hard', 'pvp'];
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      const idx = diffs.indexOf(difficulty);
      if (idx > 0) difficulty = diffs[idx - 1];
      return;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      const idx = diffs.indexOf(difficulty);
      if (idx < diffs.length - 1) difficulty = diffs[idx + 1];
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
      return;
    }
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
  keys[e.key] = false;
  if (player) {
    if (e.code === 'KeyS' || e.code === 'ArrowDown') player.crouch(false);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.block(false);
  }
  if (enemy && difficulty === 'pvp') {
    if (e.code === 'Numpad5' || e.code === 'Digit5' || e.key === '5') enemy.crouch(false);
    if (e.code === 'Numpad0' || e.code === 'Digit0' || e.key === '0') enemy.block(false);
  }
});

// ── Menu and Button Layouts ──────────────────────────────────
function getMenuLayout() {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 560);

  const gap = 12 * sc;
  const cardW = Math.min(214 * sc, (W - 40 * sc - gap * 3) / 4);
  const cardH = Math.min(210 * sc, H * 0.42);
  const totalW = cardW * 4 + gap * 3;
  const startX = (W - totalW) / 2;
  const cardY = H * 0.30;

  const cards = [
    {
      id: 'easy',
      title: 'EASY',
      sub: 'GENTLE TRAINING',
      color: '#16a34a',
      accentBg: 'rgba(22, 163, 74, 0.08)',
      bullets: [
        '• Enemy deals -35% damage',
        '• NO berserk rage (<50% HP)',
        '• Slower reflexes & defense',
        '• Green Enemy Silhouette'
      ],
      x: startX,
      y: cardY,
      w: cardW,
      h: cardH
    },
    {
      id: 'medium',
      title: 'MEDIUM',
      sub: 'AUTHENTIC CHALLENGE',
      badge: 'DEFAULT',
      color: '#000000',
      accentBg: 'rgba(0, 0, 0, 0.05)',
      bullets: [
        '• Standard 100% damage',
        '• Enrages below 50% HP!',
        '• Smart tactical blocking/AI',
        '• Classic Black Silhouette'
      ],
      x: startX + cardW + gap,
      y: cardY,
      w: cardW,
      h: cardH
    },
    {
      id: 'hard',
      title: 'HARD',
      sub: 'EXTREME DEFENSE',
      color: '#dc2626',
      accentBg: 'rgba(220, 38, 38, 0.08)',
      bullets: [
        '• Extremely dodgy & defensive',
        '• 95% High Guard & reflex ducks',
        '• Twitch backdashes & enrage',
        '• Crimson Red Silhouette'
      ],
      x: startX + (cardW + gap) * 2,
      y: cardY,
      w: cardW,
      h: cardH
    },
    {
      id: 'pvp',
      title: '2P VERSUS',
      sub: 'LOCAL MULTIPLAYER',
      color: '#2563eb',
      accentBg: 'rgba(37, 99, 235, 0.08)',
      bullets: [
        '• Same-Keyboard 1v1 Battle',
        '• P1 [Orange]: WASD + V, B',
        '• P2 [Blue]: 8456 + -, +',
        '• Blue P2 Silhouette & Shadow'
      ],
      x: startX + (cardW + gap) * 3,
      y: cardY,
      w: cardW,
      h: cardH
    }
  ];

  // Side-by-side action buttons: [ 📖 MOVE LIST & GUIDE [M] ] and [ ▶ START FIGHT [ENTER] ]
  const btnW = Math.min(280 * sc, (W - 56 * sc) / 2);
  const btnH = Math.max(38, 44 * sc);
  const btnGap = 16 * sc;
  const btnTotalW = btnW * 2 + btnGap;
  const btnStartX = (W - btnTotalW) / 2;
  const btnY = cardY + cardH + 18 * sc;

  const movesBtn = { x: btnStartX, y: btnY, w: btnW, h: btnH };
  const startBtn = { x: btnStartX + btnW + btnGap, y: btnY, w: btnW, h: btnH };

  return { sc, cards, movesBtn, startBtn };
}

function getMoveListModalLayout(footerMode = 'pause') {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 560);

  const modalW = Math.min(W * 0.94, 940 * sc);
  const modalH = Math.min(H * 0.94, 530 * sc);
  const modalX = (W - modalW) / 2;
  const modalY = (H - modalH) / 2;

  const headerH = 62 * sc;
  const footerH = 50 * sc;
  const padding = 14 * sc;

  const contentX = modalX + padding;
  const contentY = modalY + headerH;
  const contentW = modalW - padding * 2;
  const contentH = modalH - headerH - footerH - 6 * sc;

  const scrollbarW = 12 * sc;
  const cardW = contentW - scrollbarW - 12 * sc;
  const cardH = 106 * sc;
  const cardGap = 12 * sc;

  const totalContentH = ALL_MOVES.length * (cardH + cardGap) - cardGap;
  const maxScrollY = Math.max(0, totalContentH - contentH);

  // Scrollbar
  const trackX = contentX + contentW - scrollbarW;
  const trackY = contentY;
  const trackW = scrollbarW;
  const trackH = contentH;

  const thumbH = Math.max(34 * sc, (contentH / Math.max(contentH, totalContentH)) * trackH);
  const thumbY = maxScrollY > 0 ? trackY + (moveScrollY / maxScrollY) * (trackH - thumbH) : trackY;

  // Footer Buttons
  let footerButtons = {};
  if (footerMode === 'pause') {
    const resumeBtnW = modalW - padding * 2;
    const resumeBtnH = 38 * sc;
    const resumeBtnY = modalY + modalH - resumeBtnH - 7 * sc;
    footerButtons.resume = { x: modalX + padding, y: resumeBtnY, w: resumeBtnW, h: resumeBtnH };
  } else {
    // Menu mode: Back to Menu button & Start Fight button
    const btnW = (modalW - padding * 2 - 14 * sc) / 2;
    const btnH = 38 * sc;
    const btnY = modalY + modalH - btnH - 7 * sc;
    footerButtons.back = { x: modalX + padding, y: btnY, w: btnW, h: btnH };
    footerButtons.start = { x: modalX + padding + btnW + 14 * sc, y: btnY, w: btnW, h: btnH };
  }

  return {
    sc, modalX, modalY, modalW, modalH,
    headerH, footerH, padding,
    contentX, contentY, contentW, contentH,
    cardW, cardH, cardGap, totalContentH, maxScrollY,
    scrollbar: { trackX, trackY, trackW, trackH, thumbH, thumbY },
    footerButtons
  };
}

function drawScrollableMoveListModal(title, subtitle, footerMode = 'pause') {
  const W = canvas.width, H = canvas.height;
  const layout = getMoveListModalLayout(footerMode);
  const sc = layout.sc;

  // Translucent backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, W, H);

  // Modal Outer Box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(layout.modalX, layout.modalY, layout.modalW, layout.modalH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2.5, 3 * sc);
  ctx.strokeRect(layout.modalX, layout.modalY, layout.modalW, layout.modalH);

  // Inner subtle border accent
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(layout.modalX + 4 * sc, layout.modalY + 4 * sc, layout.modalW - 8 * sc, layout.modalH - 8 * sc);

  // Header Left: Title & Subtitle (Larger prominent typography)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${Math.max(18, Math.floor(22 * sc))}px monospace`;
  ctx.fillText(title, layout.contentX + 2 * sc, layout.modalY + 28 * sc);

  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${Math.max(11, Math.floor(12.5 * sc))}px monospace`;
  ctx.fillText(subtitle, layout.contentX + 2 * sc, layout.modalY + 48 * sc);

  // Header Right: Controls Guide Badge
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.max(10.5, Math.floor(12 * sc))}px monospace`;
  ctx.fillText('11 MOVES · SCROLL WHEEL / DRAG / ↑ ↓ KEYS', layout.modalX + layout.modalW - layout.padding - 4 * sc, layout.modalY + 38 * sc);

  // Header separator line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.modalX + layout.padding, layout.contentY - 6 * sc);
  ctx.lineTo(layout.modalX + layout.modalW - layout.padding, layout.contentY - 6 * sc);
  ctx.stroke();

  // Scrollable Content Viewport with Clipping
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.contentX, layout.contentY, layout.cardW + 4 * sc, layout.contentH);
  ctx.clip();

  ALL_MOVES.forEach((m, idx) => {
    const cardY = layout.contentY - moveScrollY + idx * (layout.cardH + layout.cardGap);
    // Viewport Culling
    if (cardY + layout.cardH < layout.contentY || cardY > layout.contentY + layout.contentH) return;

    const cardX = layout.contentX;
    const cardW = layout.cardW;
    const cardH = layout.cardH;

    // Card background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1, 1.4 * sc);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Left category color stripe
    ctx.fillStyle = m.badgeBg || '#000000';
    ctx.fillRect(cardX, cardY, 5 * sc, cardH);

    // Move index pill: e.g. "01" (Enlarged)
    const numText = (idx + 1 < 10 ? '0' : '') + (idx + 1);
    const pillW = 26 * sc;
    const pillH = 20 * sc;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cardX + 12 * sc, cardY + 10 * sc, pillW, pillH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = `bold ${Math.max(10, Math.floor(11.5 * sc))}px monospace`;
    ctx.fillText(numText, cardX + 12 * sc + pillW / 2, cardY + 10 * sc + pillH * 0.72);

    // Move Title (Prominent larger font!)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `900 ${Math.max(15, Math.floor(17 * sc))}px monospace`;
    const titleX = cardX + 46 * sc;
    ctx.fillText(m.name, titleX, cardY + 25 * sc);
    const titleWidth = ctx.measureText(m.name).width;

    // Input Key Badge Pill (Prominent larger font and generous padding)
    const tagX = titleX + titleWidth + 12 * sc;
    ctx.font = `bold ${Math.max(11, Math.floor(12.5 * sc))}px monospace`;
    const tagTextW = ctx.measureText(m.input).width;
    const tagW = tagTextW + 16 * sc;
    const tagH = 22 * sc;
    const tagY = cardY + 9 * sc;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(m.input, tagX + 8 * sc, tagY + tagH * 0.72);

    // Consequence / Damage Badge on far right (Prominent larger font!)
    ctx.font = `900 ${Math.max(11, Math.floor(12.5 * sc))}px monospace`;
    const badgeTextW = ctx.measureText(m.badge).width;
    const badgeW = badgeTextW + 18 * sc;
    const badgeH = 24 * sc;
    const badgeX = cardX + cardW - badgeW - 12 * sc;
    const badgeY = cardY + 8 * sc;
    ctx.fillStyle = m.badgeBg || '#000000';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(m.badge, badgeX + badgeW / 2, badgeY + badgeH * 0.72);

    // Summary Line (Larger font, clear contrast)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = `bold ${Math.max(12, Math.floor(14 * sc))}px monospace`;
    ctx.fillText(m.summary, cardX + 14 * sc, cardY + 52 * sc);

    // Bullet Points (Combat Consequences & Frame Data - enlarged & spacious)
    ctx.fillStyle = '#475569';
    ctx.font = `${Math.max(11, Math.floor(12.5 * sc))}px monospace`;
    ctx.fillText(m.bullets[0], cardX + 14 * sc, cardY + 72 * sc);
    ctx.fillText(m.bullets[1], cardX + 14 * sc, cardY + 91 * sc);
  });

  ctx.restore();

  // Overflow Fade Gradients
  if (moveScrollY > 4) {
    const gradTop = ctx.createLinearGradient(0, layout.contentY, 0, layout.contentY + 16 * sc);
    gradTop.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradTop.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(layout.contentX, layout.contentY, layout.cardW, 16 * sc);
  }
  if (moveScrollY < layout.maxScrollY - 4) {
    const gradBot = ctx.createLinearGradient(0, layout.contentY + layout.contentH - 16 * sc, 0, layout.contentY + layout.contentH);
    gradBot.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradBot.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
    ctx.fillStyle = gradBot;
    ctx.fillRect(layout.contentX, layout.contentY, layout.cardW, 16 * sc);
  }

  // Scrollbar Track & Thumb
  const sb = layout.scrollbar;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(sb.trackX, sb.trackY, sb.trackW, sb.trackH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(sb.trackX, sb.trackY, sb.trackW, sb.trackH);

  // Scrollbar Thumb
  ctx.fillStyle = isDraggingScroll ? '#000000' : '#94a3b8';
  ctx.fillRect(sb.trackX + 2 * sc, sb.thumbY, sb.trackW - 4 * sc, sb.thumbH);
  ctx.strokeStyle = isDraggingScroll ? '#000000' : '#64748b';
  ctx.strokeRect(sb.trackX + 2 * sc, sb.thumbY, sb.trackW - 4 * sc, sb.thumbH);

  // Footer separator
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.modalX + layout.padding, layout.modalY + layout.modalH - layout.footerH);
  ctx.lineTo(layout.modalX + layout.modalW - layout.padding, layout.modalY + layout.modalH - layout.footerH);
  ctx.stroke();

  // Footer Action Buttons
  if (footerMode === 'pause') {
    const btn = layout.footerButtons.resume;
    ctx.fillStyle = '#000000';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(12, Math.floor(13.5 * sc))}px monospace`;
    ctx.fillText('▶  CLICK TO RESUME FIGHT  [ OR PRESS P / ESC ]', btn.x + btn.w / 2, btn.y + btn.h * 0.65);
  } else {
    // Menu Mode: Back to Menu & Start Fight buttons
    const backBtn = layout.footerButtons.back;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.font = `900 ${Math.max(11.5, Math.floor(13 * sc))}px monospace`;
    ctx.fillText('←  BACK TO MAIN MENU  [ ESC / M ]', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h * 0.65);

    const startBtn = layout.footerButtons.start;
    ctx.fillStyle = '#000000';
    ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.max(11.5, Math.floor(13 * sc))}px monospace`;
    ctx.fillText('▶  START FIGHT  [ ENTER ]', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h * 0.65);
  }
}

function getGameOverBtns() {
  const W = canvas.width, H = canvas.height, sc = Math.min(W / DW, H / 560);
  const btnW = Math.min(270 * sc, (W - 60 * sc) / 2);
  const btnH = Math.max(40, 46 * sc);
  const gap = 18 * sc;
  const totalW = btnW * 2 + gap;
  const startX = (W - totalW) / 2;
  const btnY = H * 0.62;
  return {
    rematch: { x: startX, y: btnY, w: btnW, h: btnH },
    menu: { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH }
  };
}

function getRematchBtnRect() {
  return getGameOverBtns().rematch;
}

// Mouse Wheel Scrolling for Move List (Pause Menu & Main Menu Move List)
canvas.addEventListener('wheel', e => {
  if (isPaused || (gameState === 'menu' && menuView === 'moves')) {
    e.preventDefault();
    const layout = getMoveListModalLayout(isPaused ? 'pause' : 'menu');
    moveScrollY = clamp(moveScrollY + e.deltaY, 0, layout.maxScrollY);
  }
}, { passive: false });

// ══════════════════════════════════════════════════════════════
//  TOUCH CONTROLS & VIRTUAL JOYSTICK ENGINE (MOBILE INTERFACE)
// ══════════════════════════════════════════════════════════════

function drawJoyArrow(cx, cy, angle, isHighlighted, sc) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = isHighlighted ? '#000000' : 'rgba(0, 0, 0, 0.22)';
  ctx.strokeStyle = isHighlighted ? '#000000' : 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = isHighlighted ? 2 * sc : 1 * sc;

  ctx.beginPath();
  const sz = (isHighlighted ? 9.5 : 7.5) * sc;
  ctx.moveTo(sz, 0);
  ctx.lineTo(-sz * 0.75, -sz * 0.65);
  ctx.lineTo(-sz * 0.30, 0);
  ctx.lineTo(-sz * 0.75, sz * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTouchControls() {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 500);
  const joy = touchControls.joystick;
  const qBtn = touchControls.qButton;
  const btns = touchControls.buttons;
  const pause = touchControls.pauseButton;

  // ── 1. Left 8-Way Joystick ─────────────────────────────────
  ctx.save();
  // Translucent circular base
  ctx.beginPath();
  ctx.arc(joy.baseX, joy.baseY, joy.baseR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fill();
  ctx.strokeStyle = joy.active ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.30)';
  ctx.lineWidth = 2.5 * sc;
  ctx.stroke();

  // Subtle inner perimeter guide
  ctx.beginPath();
  ctx.arc(joy.baseX, joy.baseY, joy.baseR * 0.52, 0, Math.PI * 2);
  ctx.setLineDash([4 * sc, 4 * sc]);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1.5 * sc;
  ctx.stroke();
  ctx.setLineDash([]);

  // 8-Directional Arrows around Joystick Perimeter
  const arrowDist = joy.baseR * 0.74;
  const isRightActive = joy.right && !joy.up && !joy.down;
  const isDownRightActive = joy.right && joy.down;
  const isDownActive = joy.down && !joy.left && !joy.right;
  const isDownLeftActive = joy.left && joy.down;
  const isLeftActive = joy.left && !joy.up && !joy.down;
  const isUpLeftActive = joy.left && joy.up;
  const isUpActive = joy.up && !joy.left && !joy.right;
  const isUpRightActive = joy.right && joy.up;

  drawJoyArrow(joy.baseX + Math.cos(0) * arrowDist, joy.baseY + Math.sin(0) * arrowDist, 0, isRightActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(Math.PI / 4) * arrowDist, joy.baseY + Math.sin(Math.PI / 4) * arrowDist, Math.PI / 4, isDownRightActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(Math.PI / 2) * arrowDist, joy.baseY + Math.sin(Math.PI / 2) * arrowDist, Math.PI / 2, isDownActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(3 * Math.PI / 4) * arrowDist, joy.baseY + Math.sin(3 * Math.PI / 4) * arrowDist, 3 * Math.PI / 4, isDownLeftActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(Math.PI) * arrowDist, joy.baseY + Math.sin(Math.PI) * arrowDist, Math.PI, isLeftActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(-3 * Math.PI / 4) * arrowDist, joy.baseY + Math.sin(-3 * Math.PI / 4) * arrowDist, -3 * Math.PI / 4, isUpLeftActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(-Math.PI / 2) * arrowDist, joy.baseY + Math.sin(-Math.PI / 2) * arrowDist, -Math.PI / 2, isUpActive, sc);
  drawJoyArrow(joy.baseX + Math.cos(-Math.PI / 4) * arrowDist, joy.baseY + Math.sin(-Math.PI / 4) * arrowDist, -Math.PI / 4, isUpRightActive, sc);

  // Joystick Knob
  ctx.beginPath();
  ctx.arc(joy.knobX, joy.knobY, joy.knobR, 0, Math.PI * 2);
  ctx.fillStyle = joy.active ? 'rgba(0, 0, 0, 0.70)' : 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * sc;
  ctx.stroke();

  // Center white dot on Knob
  ctx.beginPath();
  ctx.arc(joy.knobX, joy.knobY, 5 * sc, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Dash Instruction beneath Joystick
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.font = `bold ${Math.floor(8.5 * sc)}px monospace`;
  ctx.fillText('TAP SIDES TO DASH', joy.baseX, joy.baseY + joy.baseR + 15 * sc);
  ctx.restore();

  // ── 2. Ground Stomp ("Q") Pop-Up Button (Above Joystick) ───
  qBtn.visible = !!(player && (player.groundStompReady || player.reversalReady));
  if (qBtn.visible) {
    ctx.save();
    const pulse = 0.75 + Math.sin(Date.now() * 0.009) * 0.25;

    // Pulsing halo
    ctx.beginPath();
    ctx.arc(qBtn.x, qBtn.y, qBtn.r * (1 + (1 - pulse) * 0.22), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(234, 88, 12, ${pulse * 0.65})`;
    ctx.lineWidth = 2.5 * sc;
    ctx.stroke();

    // Button body
    ctx.beginPath();
    ctx.arc(qBtn.x, qBtn.y, qBtn.r, 0, Math.PI * 2);
    ctx.fillStyle = qBtn.pressed ? '#ea580c' : '#000000';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5 * sc;
    ctx.stroke();

    // Button Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(10.5 * sc)}px monospace`;
    ctx.fillText('💥 STOMP', qBtn.x, qBtn.y - 2 * sc);
    ctx.font = `bold ${Math.floor(8 * sc)}px monospace`;
    ctx.fillText('[ Q ]', qBtn.x, qBtn.y + 11 * sc);
    ctx.restore();
  }

  // ── 3. Right Action Buttons (Triangular Formation) ──────────
  function drawActBtn(btn, title, sub) {
    ctx.save();
    const scale = btn.pressed ? 0.94 : 1;
    ctx.translate(btn.x, btn.y);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.arc(0, 0, btn.r, 0, Math.PI * 2);
    ctx.fillStyle = btn.pressed ? '#000000' : 'rgba(0, 0, 0, 0.08)';
    ctx.fill();
    ctx.strokeStyle = btn.pressed ? '#000000' : 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 2.5 * sc;
    ctx.stroke();

    // Inner subtle ring
    ctx.beginPath();
    ctx.arc(0, 0, btn.r * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = btn.pressed ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1 * sc;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = btn.pressed ? '#ffffff' : '#000000';
    ctx.font = `900 ${Math.floor((btn.r * 0.36) * sc)}px monospace`;
    ctx.fillText(title, 0, sub ? -2 * sc : 4 * sc);
    if (sub) {
      ctx.font = `bold ${Math.floor((btn.r * 0.25) * sc)}px monospace`;
      ctx.fillStyle = btn.pressed ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(sub, 0, 12 * sc);
    }
    ctx.restore();
  }

  // BLOCK (top-left of cluster)
  drawActBtn(btns.block, 'BLOCK', 'GUARD');

  // PUNCH (top-right of cluster, same horizontal level as Block)
  drawActBtn(btns.punch, 'PUNCH', 'COMBO');

  // KICK (centered beneath Block & Punch in triangular formation)
  drawActBtn(btns.kick, 'KICK', 'SPARTAN');

  // ── 4. Mobile Pause Button (Top Right) ──────────────────────
  ctx.save();
  ctx.fillStyle = pause.pressed ? '#000000' : 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(pause.x, pause.y, pause.w, pause.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2 * sc;
  ctx.strokeRect(pause.x, pause.y, pause.w, pause.h);

  // Two pause vertical bars
  const barW = 4 * sc, barH = 14 * sc, barGap = 5 * sc;
  const barColor = pause.pressed ? '#ffffff' : '#000000';
  ctx.fillStyle = barColor;
  ctx.fillRect(pause.x + (pause.w - barW * 2 - barGap) / 2, pause.y + (pause.h - barH) / 2, barW, barH);
  ctx.fillRect(pause.x + (pause.w - barW * 2 - barGap) / 2 + barW + barGap, pause.y + (pause.h - barH) / 2, barW, barH);
  ctx.restore();
}

function updateJoystick(tx, ty) {
  const joy = touchControls.joystick;
  const dx = tx - joy.baseX;
  const dy = ty - joy.baseY;
  const dist = Math.hypot(dx, dy);

  // Clamp knob position to base radius
  const maxR = joy.baseR;
  if (dist > maxR) {
    joy.knobX = joy.baseX + (dx / dist) * maxR;
    joy.knobY = joy.baseY + (dy / dist) * maxR;
  } else {
    joy.knobX = tx;
    joy.knobY = ty;
  }

  // Deadzone check
  const DEADZONE = 12 * (canvas.width / DW);
  if (dist < DEADZONE) {
    joy.vx = 0; joy.vy = 0;
    joy.left = false; joy.right = false;
    joy.up = false; joy.down = false;
    joy.upLeft = false; joy.upRight = false;
    joy.downLeft = false; joy.downRight = false;
    joy.lastJumpTriggered = false;
    if (player && player.state === 'crouch' && !keys['KeyS'] && !keys['ArrowDown']) {
      player.crouch(false);
    }
    return;
  }

  joy.vx = dx / dist;
  joy.vy = dy / dist;

  // Determine horizontal directions
  joy.left = (joy.vx < -0.35);
  joy.right = (joy.vx > 0.35);

  // Determine vertical directions
  const wasUp = joy.up;
  joy.up = (joy.vy < -0.45);
  joy.down = (joy.vy > 0.45);

  // Determine 8 diagonals for arrow highlighting
  joy.upLeft = joy.up && joy.left;
  joy.upRight = joy.up && joy.right;
  joy.downLeft = joy.down && joy.left;
  joy.downRight = joy.down && joy.right;

  // Jump trigger: when moving into Up sector
  if (joy.up && !wasUp && !joy.lastJumpTriggered && player) {
    player.jump();
    joy.lastJumpTriggered = true;
  } else if (!joy.up) {
    joy.lastJumpTriggered = false;
  }

  // Crouch trigger
  if (player) {
    if (joy.down) {
      player.crouch(true);
    } else if (!keys['KeyS'] && !keys['ArrowDown']) {
      player.crouch(false);
    }
  }
}

function onTouchBlockStart() {
  if (!player || player.hp <= 0 || gameState !== 'fight' || isPaused) return;
  player.block(true);
}

function onTouchBlockEnd() {
  if (!player) return;
  const isTouchBlock = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.buttons && touchControls.buttons.block && touchControls.buttons.block.pressed);
  if (!keys['ShiftLeft'] && !keys['ShiftRight'] && !isTouchBlock) {
    player.block(false);
  }
}

function onTouchStomp() {
  if (!player || player.hp <= 0 || gameState !== 'fight' || isPaused) return;
  if (player.groundStompReady || player.reversalReady) {
    triggerGroundStomp(player, enemy);
  }
}

function handlePauseClick(mx, my) {
  const layout = getMoveListModalLayout('pause');
  const sb = layout.scrollbar;

  // Check click on Scrollbar Track or Thumb
  if (mx >= sb.trackX - 10 * layout.sc && mx <= sb.trackX + sb.trackW + 10 * layout.sc &&
      my >= sb.trackY && my <= sb.trackY + sb.trackH) {
    if (my >= sb.thumbY && my <= sb.thumbY + sb.thumbH) {
      isDraggingScroll = true;
      dragScrollStartY = my;
      dragScrollStartScroll = moveScrollY;
    } else {
      const trackScrollableH = sb.trackH - sb.thumbH;
      if (trackScrollableH > 0) {
        const pct = clamp((my - sb.trackY - sb.thumbH / 2) / trackScrollableH, 0, 1);
        moveScrollY = pct * layout.maxScrollY;
      }
      isDraggingScroll = true;
      dragScrollStartY = my;
      dragScrollStartScroll = moveScrollY;
    }
    return true;
  }

  // Check click on Resume Button
  const btn = layout.footerButtons.resume;
  if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
    isPaused = false;
    lastTime = performance.now();
    return true;
  }

  // Clicking inside the cards content viewport: record start Y for touch drag
  if (mx >= layout.modalX && mx <= layout.modalX + layout.modalW &&
      my >= layout.modalY && my <= layout.modalY + layout.modalH) {
    isDraggingScroll = true;
    dragScrollStartY = my;
    dragScrollStartScroll = moveScrollY;
    return true;
  }

  // Clicking outside modal veil: resume fight
  isPaused = false;
  lastTime = performance.now();
  return true;
}

function handleMenuClick(mx, my) {
  if (menuView === 'moves') {
    const layout = getMoveListModalLayout('menu');
    const sb = layout.scrollbar;

    // Check click on Scrollbar Track or Thumb
    if (mx >= sb.trackX - 10 * layout.sc && mx <= sb.trackX + sb.trackW + 10 * layout.sc &&
        my >= sb.trackY && my <= sb.trackY + sb.trackH) {
      if (my >= sb.thumbY && my <= sb.thumbY + sb.thumbH) {
        isDraggingScroll = true;
        dragScrollStartY = my;
        dragScrollStartScroll = moveScrollY;
      } else {
        const trackScrollableH = sb.trackH - sb.thumbH;
        if (trackScrollableH > 0) {
          const pct = clamp((my - sb.trackY - sb.thumbH / 2) / trackScrollableH, 0, 1);
          moveScrollY = pct * layout.maxScrollY;
        }
        isDraggingScroll = true;
        dragScrollStartY = my;
        dragScrollStartScroll = moveScrollY;
      }
      return true;
    }

    // Check click on Back Button
    const backBtn = layout.footerButtons.back;
    if (mx >= backBtn.x && mx <= backBtn.x + backBtn.w && my >= backBtn.y && my <= backBtn.y + backBtn.h) {
      menuView = 'main';
      return true;
    }

    // Check click on Start Fight Button
    const startBtn = layout.footerButtons.start;
    if (mx >= startBtn.x && mx <= startBtn.x + startBtn.w && my >= startBtn.y && my <= startBtn.y + startBtn.h) {
      playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
      return true;
    }

    // Content area swipe scroll
    if (mx >= layout.modalX && mx <= layout.modalX + layout.modalW &&
        my >= layout.modalY && my <= layout.modalY + layout.modalH) {
      isDraggingScroll = true;
      dragScrollStartY = my;
      dragScrollStartScroll = moveScrollY;
      return true;
    }
    return false;
  }

  // Main Menu View
  const layout = getMenuLayout();

  // Check click on difficulty cards
  for (const card of layout.cards) {
    if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
      difficulty = card.id;
      return true;
    }
  }

  // Check click on Move List Button
  const movesBtn = layout.movesBtn;
  if (mx >= movesBtn.x && mx <= movesBtn.x + movesBtn.w && my >= movesBtn.y && my <= movesBtn.y + movesBtn.h) {
    menuView = 'moves';
    moveScrollY = 0;
    return true;
  }

  // Check click on Start Button
  const btn = layout.startBtn;
  if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
    playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
    return true;
  }
  return false;
}

function handleGameOverClick(mx, my) {
  const btns = getGameOverBtns();
  if (mx >= btns.rematch.x && mx <= btns.rematch.x + btns.rematch.w &&
      my >= btns.rematch.y && my <= btns.rematch.y + btns.rematch.h) {
    playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
    return true;
  }
  if (mx >= btns.menu.x && mx <= btns.menu.x + btns.menu.w &&
      my >= btns.menu.y && my <= btns.menu.y + btns.menu.h) {
    playerWins = 0; enemyWins = 0; roundNum = 1; gameState = 'menu'; menuView = 'main';
    return true;
  }
  return false;
}

// Mouse: left = punch, right = kick
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  if (isPaused) {
    handlePauseClick(mx, my);
    return;
  }

  if (gameState === 'fight') {
    // Check Mobile Pause Button click
    const pause = touchControls.pauseButton;
    if (mx >= pause.x && mx <= pause.x + pause.w && my >= pause.y && my <= pause.y + pause.h) {
      isPaused = true;
      moveScrollY = 0;
      isDraggingScroll = false;
      return;
    }

    if (e.button === 0) {
      triggerPlayer1Punch();
    }
    if (e.button === 2) {
      triggerPlayer1Kick();
    }
    return;
  }

  if (gameState === 'gameOver') {
    handleGameOverClick(mx, my);
    return;
  }

  if (gameState === 'menu') {
    handleMenuClick(mx, my);
    return;
  }
});

// ── Multi-Touch Event Handlers for Mobile ────────────────────
canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

function onTouchStart(e) {
  e.preventDefault();
  isTouchDevice = true;
  showTouchControls = true;
  checkOrientation();

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const tx = (t.clientX - rect.left) * scaleX;
    const ty = (t.clientY - rect.top) * scaleY;

    if (isPaused) {
      handlePauseClick(tx, ty);
      continue;
    }

    if (gameState === 'gameOver') {
      handleGameOverClick(tx, ty);
      continue;
    }

    if (gameState === 'menu') {
      handleMenuClick(tx, ty);
      continue;
    }

    if (gameState === 'fight' || gameState === 'countdown') {
      const joy = touchControls.joystick;
      const qBtn = touchControls.qButton;
      const btns = touchControls.buttons;
      const pause = touchControls.pauseButton;
      const sc = Math.min(canvas.width / DW, canvas.height / 500);

      // 1. Check Mobile Pause Button (top-right)
      if (tx >= pause.x - 8 * sc && tx <= pause.x + pause.w + 8 * sc &&
          ty >= pause.y - 8 * sc && ty <= pause.y + pause.h + 8 * sc) {
        if (gameState === 'fight') {
          isPaused = true;
          moveScrollY = 0;
          isDraggingScroll = false;
        }
        continue;
      }

      // 2. Check Q Pop-Up Button (above joystick)
      if (qBtn.visible && Math.hypot(tx - qBtn.x, ty - qBtn.y) <= qBtn.r * 1.35) {
        qBtn.pressed = true;
        qBtn.touchId = t.identifier;
        if (gameState === 'fight') {
          onTouchStomp();
        }
        continue;
      }

      // 3. Check Block Button (Right cluster, top-left)
      const blockHitR = Math.max(btns.block.r * 1.55, 46 * sc);
      if (Math.hypot(tx - btns.block.x, ty - btns.block.y) <= blockHitR) {
        btns.block.pressed = true;
        btns.block.touchId = t.identifier;
        if (gameState === 'fight' || gameState === 'countdown') {
          onTouchBlockStart();
        }
        continue;
      }

      // 4. Check Punch Button (Right cluster, top-right)
      const punchHitR = Math.max(btns.punch.r * 1.55, 46 * sc);
      if (Math.hypot(tx - btns.punch.x, ty - btns.punch.y) <= punchHitR) {
        btns.punch.pressed = true;
        btns.punch.touchId = t.identifier;
        if (gameState === 'fight') {
          triggerPlayer1Punch();
        }
        continue;
      }

      // 5. Check Kick Button (Right cluster, bottom center)
      const kickHitR = Math.max(btns.kick.r * 1.55, 48 * sc);
      if (Math.hypot(tx - btns.kick.x, ty - btns.kick.y) <= kickHitR) {
        btns.kick.pressed = true;
        btns.kick.touchId = t.identifier;
        if (gameState === 'fight') {
          triggerPlayer1Kick();
        }
        continue;
      }

      // 6. Check Joystick Zone (Left half of canvas)
      if (tx < canvas.width * 0.48) {
        // Double-tap on the sides of joystick to Dash
        const relX = tx - joy.baseX;
        const now = Date.now();
        if (relX < -14 * sc) {
          if (now - joy.lastTapLeft < DOUBLE_TAP_WINDOW) {
            if (player) player.dash(-1);
            joy.lastTapLeft = 0;
          } else {
            joy.lastTapLeft = now;
          }
        } else if (relX > 14 * sc) {
          if (now - joy.lastTapRight < DOUBLE_TAP_WINDOW) {
            if (player) player.dash(1);
            joy.lastTapRight = 0;
          } else {
            joy.lastTapRight = now;
          }
        }

        joy.active = true;
        joy.touchId = t.identifier;
        updateJoystick(tx, ty);
        continue;
      }
    }
  }
}

function onTouchMove(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const tx = (t.clientX - rect.left) * scaleX;
    const ty = (t.clientY - rect.top) * scaleY;

    if (isDraggingScroll) {
      const modalMode = isPaused ? 'pause' : 'menu';
      const layout = getMoveListModalLayout(modalMode);
      const deltaY = ty - dragScrollStartY;
      moveScrollY = clamp(dragScrollStartScroll - deltaY * 1.25, 0, layout.maxScrollY);
      continue;
    }

    if (t.identifier === touchControls.joystick.touchId) {
      updateJoystick(tx, ty);
      continue;
    }

    if (gameState === 'fight' || gameState === 'countdown') {
      const btns = touchControls.buttons;
      const sc = Math.min(canvas.width / DW, canvas.height / 500);
      if (t.identifier === btns.block.touchId) {
        const dist = Math.hypot(tx - btns.block.x, ty - btns.block.y);
        if (dist <= Math.max(btns.block.r * 2.0, 60 * sc)) {
          btns.block.pressed = true;
          if (player) player.block(true);
        } else {
          btns.block.pressed = false;
          btns.block.touchId = null;
          onTouchBlockEnd();
        }
        continue;
      }
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  const joy = touchControls.joystick;
  const btns = touchControls.buttons;
  const qBtn = touchControls.qButton;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];

    if (isDraggingScroll) {
      isDraggingScroll = false;
    }

    if (t.identifier === joy.touchId) {
      joy.active = false;
      joy.touchId = null;
      joy.knobX = joy.baseX;
      joy.knobY = joy.baseY;
      joy.vx = 0; joy.vy = 0;
      joy.left = false; joy.right = false;
      joy.up = false; joy.down = false;
      joy.upLeft = false; joy.upRight = false;
      joy.downLeft = false; joy.downRight = false;
      joy.lastJumpTriggered = false;
      if (player && !keys['KeyS'] && !keys['ArrowDown']) {
        player.crouch(false);
      }
    }

    if (t.identifier === btns.block.touchId) {
      btns.block.pressed = false;
      btns.block.touchId = null;
      onTouchBlockEnd();
    }

    if (t.identifier === btns.punch.touchId) {
      btns.punch.pressed = false;
      btns.punch.touchId = null;
    }

    if (t.identifier === btns.kick.touchId) {
      btns.kick.pressed = false;
      btns.kick.touchId = null;
    }

    if (t.identifier === qBtn.touchId) {
      qBtn.pressed = false;
      qBtn.touchId = null;
    }
  }
}

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  // Handle Dragging Scrollbar
  if (isDraggingScroll) {
    const layout = getMoveListModalLayout(isPaused ? 'pause' : 'menu');
    const sb = layout.scrollbar;
    const trackScrollableH = sb.trackH - sb.thumbH;
    if (trackScrollableH > 0) {
      const deltaY = my - dragScrollStartY;
      moveScrollY = clamp(dragScrollStartScroll + (deltaY / trackScrollableH) * layout.maxScrollY, 0, layout.maxScrollY);
    }
    canvas.style.cursor = 'pointer';
    return;
  }

  if (isPaused) {
    const layout = getMoveListModalLayout('pause');
    const sb = layout.scrollbar;
    const btn = layout.footerButtons.resume;
    if ((mx >= sb.trackX - 6 * layout.sc && mx <= sb.trackX + sb.trackW + 6 * layout.sc && my >= sb.trackY && my <= sb.trackY + sb.trackH) ||
        (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h)) {
      canvas.style.cursor = 'pointer';
      return;
    }
    canvas.style.cursor = 'default';
    return;
  }

  if (gameState === 'gameOver') {
    const btns = getGameOverBtns();
    if ((mx >= btns.rematch.x && mx <= btns.rematch.x + btns.rematch.w && my >= btns.rematch.y && my <= btns.rematch.y + btns.rematch.h) ||
        (mx >= btns.menu.x && mx <= btns.menu.x + btns.menu.w && my >= btns.menu.y && my <= btns.menu.y + btns.menu.h)) {
      canvas.style.cursor = 'pointer';
      return;
    }
    canvas.style.cursor = 'default';
    return;
  }

  if (gameState === 'menu') {
    if (menuView === 'moves') {
      const layout = getMoveListModalLayout('menu');
      const sb = layout.scrollbar;
      const backBtn = layout.footerButtons.back;
      const startBtn = layout.footerButtons.start;
      if ((mx >= sb.trackX - 6 * layout.sc && mx <= sb.trackX + sb.trackW + 6 * layout.sc && my >= sb.trackY && my <= sb.trackY + sb.trackH) ||
          (mx >= backBtn.x && mx <= backBtn.x + backBtn.w && my >= backBtn.y && my <= backBtn.y + backBtn.h) ||
          (mx >= startBtn.x && mx <= startBtn.x + startBtn.w && my >= startBtn.y && my <= startBtn.y + startBtn.h)) {
        canvas.style.cursor = 'pointer';
        return;
      }
      canvas.style.cursor = 'default';
      return;
    }

    const layout = getMenuLayout();
    for (const card of layout.cards) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    if ((mx >= layout.movesBtn.x && mx <= layout.movesBtn.x + layout.movesBtn.w && my >= layout.movesBtn.y && my <= layout.movesBtn.y + layout.movesBtn.h) ||
        (mx >= layout.startBtn.x && mx <= layout.startBtn.x + layout.startBtn.w && my >= layout.startBtn.y && my <= layout.startBtn.y + layout.startBtn.h)) {
      canvas.style.cursor = 'pointer';
      return;
    }
    canvas.style.cursor = 'default';
    return;
  }

  canvas.style.cursor = 'crosshair';
});

window.addEventListener('mouseup', () => {
  isDraggingScroll = false;
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('blur', () => {
  keys = {};
  if (player) {
    player.crouching = false;
    player.blocking = false;
    if (player.state === 'crouch' || player.state === 'block') player.state = 'idle';
  }
});

// ── Ground Stomp Attack ("Q") (Received 3 Spartan Kicks in 5s -> Screen-Wide Knockdown) ──
function triggerGroundStomp(user, target) {
  if (!user || (!user.groundStompReady && !user.reversalReady)) return;
  user.groundStompReady = false;
  user.reversalReady = false;
  user.spartanHitTimestamps = [];
  user.kdTimestamps = [];

  // If user is knocked down or in hurt state, snap them instantly awake onto their feet!
  user.state = 'idle';
  user.stunTimer = 0;
  user.y = user.floor;
  user.vy = 0;
  user.onGround = true;
  user.crouching = false;
  user.blocking = false;

  // Execute the epic Ground Stomp attack!
  user.attack('groundStomp');
}
function triggerReversal(user, target) {
  triggerGroundStomp(user, target);
}

// ── AI (Tactical & Realistic: Always Smart, Hyper-Aggressive under 50% HP) ──
function updateAI(dt) {
  if (!enemy || gameState !== 'fight') return;
  // Trigger [Q] Ground Stomp if CPU received 3 Spartan Kicks (or 3 knockdowns) in 5s!
  if (enemy.groundStompReady || enemy.reversalReady) {
    triggerGroundStomp(enemy, player);
    return;
  }
  if (enemy.state === 'knockdown') { enemy.aiMoveX = 0; return; }

  // Execute continuous movement
  if (enemy.aiMoveX !== 0 && enemy.state !== 'dash') {
    enemy.move(enemy.aiMoveX * dt);
  } else if (enemy.state === 'walk') {
    enemy.state = 'idle';
  }

  enemy.aiTimer -= dt;
  if (enemy.aiTimer > 0) return;

  const isEasy = (difficulty === 'easy');
  const isHard = (difficulty === 'hard');
  // Easy mode: CPU NEVER enters berserk aggression below 50% HP!
  const lowHp = !isEasy && (enemy.hp < enemy.maxHp * 0.5);

  // Decision cycles tuned per difficulty:
  // Easy: relaxed, forgiving (0.24 - 0.42s)
  // Medium: smart tactical (0.16 - 0.32s), aggressive frenzy (0.07 - 0.15s)
  // Hard: twitch evasion reflexes & dash movement (0.06 - 0.12s normal, 0.04 - 0.08s aggressive frenzy)
  if (isEasy) {
    enemy.aiTimer = rnd(0.24, 0.42);
  } else if (isHard) {
    enemy.aiTimer = lowHp ? rnd(0.04, 0.08) : rnd(0.06, 0.12);
  } else {
    enemy.aiTimer = lowHp ? rnd(0.07, 0.15) : rnd(0.16, 0.32);
  }

  if (player.state === 'dead') { enemy.aiMoveX = 0; return; }

  const dist = Math.abs(player.x - enemy.x);
  const dir = player.x > enemy.x ? 1 : -1;
  const pAttacking = ['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick'].includes(player.state);

  // 1. HARD MODE DASH-CENTRIC LOCOMOTION:
  // "in hard mode the enemy should mostly move arround by dashing"
  if (isHard && enemy.onGround && enemy.state !== 'dash') {
    // If player is stunned from headbutt, rush in with forward dash!
    if (player.stunTimer > 0 && dist > 115) {
      enemy.dash(dir);
      return;
    }
    // High-frequency dashing instead of walking:
    if (dist > 150 && Math.random() < 0.85) {
      enemy.dash(dir); // Forward burst dash!
      return;
    }
    if (dist < 85 && Math.random() < 0.78) {
      enemy.dash(-dir); // Evasive backdash!
      return;
    }
  }

  // 2. WAKE-UP / KNOCKDOWN BEHAVIOR:
  if (player.state === 'knockdown') {
    if (lowHp) {
      // Aggressive AI (Medium & Hard below 50% HP): Okizeme wake-up pressure!
      if (dist > 95) {
        if (isHard && enemy.onGround && Math.random() < 0.70) enemy.dash(dir);
        else enemy.aiMoveX = dir * 260;
      } else if (dist < 65) {
        enemy.aiMoveX = -dir * 140;
      } else {
        enemy.aiMoveX = 0;
        if (player.stateProgress > 0.70 && Math.random() < 0.60) {
          enemy.attack(Math.random() < 0.50 ? 'sweepKick' : 'spartanKick');
        }
      }
    } else {
      // Tactical spacing: respect wake-up invulnerability
      if (dist > 140) enemy.aiMoveX = dir * 160;
      else if (dist < 110) enemy.aiMoveX = -dir * 120;
      else enemy.aiMoveX = 0;
    }
    return;
  }

  // 3. REACTIVE COUNTER TO INCOMING ATTACKS (EXPERT DUCK HEADBUTT COUNTER IN HARD MODE):
  // "in hard mode enemy should be really good at using this headbutt attack"
  if (pAttacking && dist < (isHard ? 200 : 185)) {
    // If player throws high punches or Spartan Kick:
    if (player.state === 'punch' || player.state === 'spartanKick') {
      // Hard mode: 85% chance to duck under strike with Duck Headbutt and counter-stun for 1.5s!
      if (isHard && enemy.onGround && Math.random() < 0.85) {
        enemy.attack('duckHeadbutt');
        return;
      }
      // Medium mode: 35% chance to counter with Duck Headbutt
      if (!isEasy && enemy.onGround && Math.random() < 0.35) {
        enemy.attack('duckHeadbutt');
        return;
      }
      // Duck punch into crouch
      if (Math.random() < (isHard ? 0.90 : (isEasy ? 0.25 : 0.50)) && enemy.onGround) {
        enemy.crouch(true);
        setTimeout(() => enemy && enemy.crouch(false), rnd(240, 420));
        return;
      }
    }

    // Hard mode: lightning quick evasive backdash out of harm's way!
    if (isHard && enemy.onGround && Math.random() < 0.80 && enemy.state !== 'dash') {
      enemy.dash(-dir);
      return;
    }

    // High Guard block rate: Hard = 95%, Medium = 78%, Easy = 50%
    const blockChance = isHard ? 0.95 : (isEasy ? 0.50 : 0.78);
    if (Math.random() < blockChance) {
      enemy.block(true);
      setTimeout(() => enemy && enemy.block(false), rnd(300, 500));
      return;
    } else if (enemy.onGround && Math.random() < (isEasy ? 0.20 : 0.45) && enemy.state !== 'dash') {
      enemy.dash(-dir);
      return;
    }
  }

  // 4. DEFENSIVE BACKDASH & EVASION:
  const backdashDist = isHard ? 140 : 125;
  const backdashChance = isHard ? 0.75 : (isEasy ? 0.20 : 0.40);
  if (!lowHp && enemy.onGround && dist < backdashDist && Math.random() < backdashChance && enemy.state !== 'dash') {
    enemy.dash(-dir); // Evasive backdash!
    enemy.aiMoveX = 0;
    return;
  }

  // 5. ANTI-AIR DEFENSE: Reacts to airborne player
  if (!player.onGround && dist < 195) {
    const roll = Math.random();
    if (lowHp) {
      if (roll < 0.60 && enemy.onGround) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 130);
      } else {
        enemy.attack('spartanKick');
      }
    } else {
      const antiAirRate = isHard ? 0.92 : (isEasy ? 0.50 : 0.75);
      if (roll < antiAirRate) {
        enemy.block(true);
        setTimeout(() => enemy && enemy.block(false), rnd(350, 500));
      } else if (enemy.onGround && roll < 0.90) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
      } else {
        enemy.attack('spartanKick');
      }
    }
    return;
  }

  // 6. COUNTER CROUCH:
  if (player.state === 'crouch' || player.state === 'crouchPunch') {
    if (dist < 140) {
      if (lowHp) {
        enemy.attack(Math.random() < 0.60 ? 'sweepKick' : 'crouchPunch');
      } else {
        const crouchBackdashChance = isHard ? 0.70 : (isEasy ? 0.20 : 0.40);
        if (Math.random() < crouchBackdashChance && enemy.onGround && enemy.state !== 'dash') {
          enemy.dash(-dir);
        } else {
          enemy.attack(Math.random() < 0.50 ? 'sweepKick' : 'crouchPunch');
        }
      }
    } else {
      if (isHard && enemy.onGround && Math.random() < 0.75) enemy.dash(dir);
      else enemy.aiMoveX = dir * (lowHp ? 260 : 180);
    }
    return;
  }

  // 7. OFFENSIVE DASH (Predominant in Hard mode, tactical in Medium/Easy)
  const dashChance = isHard ? (lowHp ? 0.88 : 0.75) : (lowHp ? 0.70 : (isEasy ? 0.20 : 0.38));
  if (enemy.onGround && dist > 130 && dist < 260 && Math.random() < dashChance && enemy.state !== 'dash') {
    enemy.dash(dir);
    setTimeout(() => {
      if (enemy && enemy.state !== 'dead' && enemy.state !== 'knockdown' && enemy.state !== 'hurt') {
        const atkRoll = Math.random();
        if (isHard && atkRoll < 0.45) {
          enemy.attack('duckHeadbutt'); // Hard CPU follows up dash with 45° Duck Headbutt stun!
        } else if (atkRoll < 0.70) {
          enemy.attack('spartanKick');
        } else if (atkRoll < 0.88) {
          enemy.attack('sweepKick');
        } else {
          enemy.attack('punch');
        }
      }
    }, 110);
    return;
  }

  // 8. ATTACK & MOVEMENT STRATEGY
  const roll = Math.random();

  // If player is currently stunned from Duck Headbutt: capitalize relentlessly!
  if (player.stunTimer > 0) {
    if (dist > 120 && enemy.onGround) {
      enemy.dash(dir);
    } else {
      const punishRoll = Math.random();
      if (punishRoll < 0.45) enemy.attack('spartanKick');
      else if (punishRoll < 0.75 && enemy.onGround) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 120);
      } else {
        enemy.attack('punch');
      }
    }
    return;
  }

  if (lowHp) {
    // ═══════════════════════════════════════════════════════
    //  AGGRESSIVE MODE (< 50% HP on Medium & Hard): Relentless Forward Pressure
    // ═══════════════════════════════════════════════════════
    if (dist > 200) {
      if (isHard && enemy.onGround) enemy.dash(dir);
      else enemy.aiMoveX = dir * (isHard ? 280 : 270);
    } else if (dist > 120) {
      if (isHard && roll < 0.45) {
        enemy.attack('duckHeadbutt');
      } else if (roll < 0.70) {
        enemy.aiMoveX = dir * 220;
        setTimeout(() => { if (enemy) enemy.attack('spartanKick'); }, 80);
      } else if (roll < 0.88 && enemy.onGround) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 120);
      } else {
        enemy.dash(dir);
      }
    } else {
      // In Hard mode, mix Duck Headbutt stuns, relentless strikes, and evasive dashes
      if (isHard && roll < 0.42) {
        enemy.attack('duckHeadbutt');
      } else if (roll < 0.60) {
        enemy.attack('punch');
      } else if (roll < 0.75) {
        enemy.attack('crouchPunch');
      } else if (roll < 0.90) {
        enemy.attack('sweepKick');
      } else {
        enemy.attack('spartanKick');
      }
    }
  } else {
    // ═══════════════════════════════════════════════════════
    //  STANDARD SMART TACTICAL MODE: Methodical spacing & counters
    // ═══════════════════════════════════════════════════════
    if (dist > 220) {
      if (isHard && enemy.onGround && Math.random() < 0.75) enemy.dash(dir);
      else enemy.aiMoveX = dir * (isHard ? 200 : (isEasy ? 160 : 190));
    } else if (dist > 135) {
      if (isHard && roll < 0.38) {
        enemy.dash(dir);
        setTimeout(() => { if (enemy) enemy.attack('duckHeadbutt'); }, 100);
      } else if (roll < (isEasy ? 0.25 : 0.45)) {
        enemy.aiMoveX = dir * 150;
        setTimeout(() => { if (enemy) enemy.attack('spartanKick'); }, 100);
      } else if (roll < (isEasy ? 0.45 : 0.65) && enemy.onGround) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
      } else {
        enemy.aiMoveX = dir * 130;
      }
    } else if (dist < 80) {
      // Hard mode: constantly dodgy when player gets within 80px!
      if (isHard && Math.random() < 0.70 && enemy.onGround && enemy.state !== 'dash') {
        enemy.dash(-dir); // Evasively dash away!
      } else if (isHard && roll < 0.40) {
        enemy.attack('duckHeadbutt'); // Stuns player for 1.5s!
      } else if (roll < 0.55) {
        enemy.attack('punch');
      } else if (roll < 0.72) {
        enemy.attack('crouchPunch');
      } else if (roll < 0.88) {
        enemy.attack('sweepKick');
      } else {
        enemy.block(true);
        setTimeout(() => enemy && enemy.block(false), rnd(300, 450));
      }
    } else {
      enemy.aiMoveX = 0;
      if (isHard && roll < 0.38) {
        enemy.attack('duckHeadbutt');
      } else if (roll < 0.55) {
        enemy.attack('punch');
      } else if (roll < 0.75) {
        enemy.attack(dist > 110 ? 'spartanKick' : 'kick');
      } else if (roll < 0.88 && enemy.onGround) {
        enemy.jump();
        setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
      } else {
        enemy.attack('sweepKick');
      }
    }
  }
}

// ── Hit detection ──────────────────────────────────────────
// Combo increments ONLY on confirmed hit
function checkHit(att, def) {
  if (!['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick'].includes(att.state)) return;
  if (att.hasHit) return; // Strict single-hit lock: guarantees attack only connects once per animation!
  if (att.hitCooldown > 0) return;
  if (def.state === 'knockdown' || def.state === 'dead') return; // Cannot hit grounded target
  const sp = att.stateProgress;
  const sc = canvas.width / DW;

  // Front Flip Axe Kick: damage specifically connects at 220° rotation!
  if (att.state === 'flipKick') {
    const rot = sp * 360;
    if (rot < 208 || rot > 236) return;
  } else if (att.state === 'duckHeadbutt') {
    // 45-degree lean forward headbutt strike phase
    if (sp < 0.38 || sp > 0.66) return;
  } else {
    if (sp < 0.15 || sp > 0.88) return;
  }

  // Reach ranges:
  // - Normal punch: 132 * sc
  // - Crouch punch: 138 * sc
  // - Duck headbutt: 145 * sc (45-degree forward lunge)
  // - Normal kick: 152 * sc
  // - Spartan kick: 192 * sc (massive reach & 4x colossal knockback: 368px!)
  // - Sweep kick: 160 * sc (low ground sweep)
  // - Front Flip Axe Kick: 175 * sc (overhead axe slam at 220°, knocks down opponent!)
  let range = 132 * sc;
  let dmg = 9;
  let kbk = 44 * sc;

  if (att.state === 'punch') {
    if (att.currentPunchNum && att.currentPunchNum > 1) {
      // Rapid punch combo: punches 2 to 5 deal punch damage divided by 4 (2.25 DMG)
      dmg = 2.25;
      kbk = 22 * sc;
    } else {
      dmg = 9;
      kbk = 44 * sc;
    }
  } else if (att.state === 'crouchPunch') {
    range = 138 * sc;
    dmg = 9;
    kbk = 44 * sc;
  } else if (att.state === 'duckHeadbutt') {
    range = 145 * sc;
    dmg = 14;
    kbk = 30 * sc;
  } else if (att.state === 'kick') {
    range = 152 * sc;
    dmg = 12;
    kbk = 62 * sc;
  } else if (att.state === 'spartanKick') {
    range = 192 * sc;
    dmg = 18;
    kbk = 368 * sc; // 4X MASSIVE KNOCKBACK (was 92 * sc, now 368 * sc)!
  } else if (att.state === 'sweepKick') {
    range = 160 * sc;
    dmg = 7; // Reduced health loss (-3 DMG, was 10)
    kbk = 35 * sc;
  } else if (att.state === 'flipKick') {
    range = 175 * sc;
    dmg = 21; // Increased health loss (+3 DMG, was 18)
    kbk = 55 * sc;
  }

  // Easy mode: CPU attacks deal 35% less damage
  if (!att.isPlayer && difficulty === 'easy') {
    dmg = Math.max(1, Math.round(dmg * 0.65 * 10) / 10);
  }

  if (Math.abs(att.x - def.x) > range) return;
  if (att.facing * (def.x - att.x) < 0) return;

  // Crouching (or Crouch Punching) ducks under standing punches!
  if (att.state === 'punch' && (def.state === 'crouch' || def.state === 'crouchPunch')) {
    att.hitCooldown = 0.25;
    return;
  }

  // Duck Headbutt evasion: While in ducking and striking frames (sp < 0.68), duck under punches AND Spartan kicks!
  if (def.state === 'duckHeadbutt' && def.stateProgress < 0.68) {
    if (att.state === 'punch' || att.state === 'spartanKick') {
      att.hitCooldown = (att.state === 'spartanKick') ? 0.45 : 0.25;
      spawnParticles(def.x, def.y - 75 * sc, 4); // Clean evasive whoosh dust
      return; // Cleanly dodges high punches and Spartan kicks!
    }
  }

  // Both "Q" Ground Stomp attacks are completely uninterruptible (hyper-armor)!
  if (def.state === 'groundStomp') {
    att.hasHit = true;
    def.takeHit(dmg, 0, att);
    att.hitCooldown = 0.5;
    return;
  }

  // Sweep kick special logic: trips unblocked opponents! (No blood effect)
  if (att.state === 'sweepKick') {
    att.hasHit = true;
    // A standing high guard CANNOT block a low ground sweep! Only a crouching block can stop it.
    const isLowBlocked = def.blocking && def.crouching;
    if (isLowBlocked) {
      def.takeHit(Math.floor(dmg * 0.15), 30 * sc, att);
      att.hitCooldown = 0.5;
    } else {
      // Swept off their feet -> KNOCKDOWN onto their ass!
      def.knockdown(att, dmg);
      att.hitCooldown = 0.6;
      spawnParticles(def.x, def.floor - 20, 14);
      if (att.isPlayer) { att.comboCount++; att.comboTimer = 1.8; }
    }
    return;
  }

  // Front Flip Axe Kick special logic: KNOCKS DOWN OPPONENT!
  if (att.state === 'flipKick') {
    att.hasHit = true;
    // Standing boxer block can mitigate overhead hit; crouching cannot block overhead axe kick!
    const isHighBlocked = def.blocking && !def.crouching;
    if (isHighBlocked) {
      def.takeHit(Math.floor(dmg * 0.20), 45 * sc, att);
      att.hitCooldown = 0.5;
    } else {
      // Overhead axe kick slams down from above at 220° -> KNOCKDOWN onto back in sleeping pose!
      def.knockdown(att, dmg);
      att.hitCooldown = 0.6;
      shake(14, 0.30);
      spawnBlood(def.x, def.y - 70 * sc, att.facing, 26);
      spawnParticles(def.x, def.y - 70 * sc, 8);
      if (att.isPlayer) { att.comboCount++; att.comboTimer = 1.8; }
    }
    return;
  }

  // Duck Headbutt special logic: STUNS ENEMY FOR 1.5 SECONDS!
  if (att.state === 'duckHeadbutt') {
    att.hasHit = true;
    const isBlocked = def.blocking;
    if (isBlocked) {
      def.takeHit(Math.floor(dmg * 0.20), 25 * sc, att);
      att.hitCooldown = 0.5;
    } else {
      // 45-degree lean forward headbutt strikes enemy skull: 1.5s STUN!
      def.hp = Math.max(0, def.hp - dmg);
      def.stunTimer = 1.5; // Stunned for 1.5 seconds!
      def.state = 'hurt';
      def.stateDur = 1.5;
      def.stateElapsed = 0;
      def.hitCooldown = 0.6;
      shake(15, 0.30);
      spawnBlood(def.x, def.y - 75 * sc, att.facing, 24);
      spawnParticles(def.x, def.y - 75 * sc, 12);
      att.hitCooldown = 0.6;
      if (att.isPlayer) { att.comboCount++; att.comboTimer = 2.2; }
      if (def.hp <= 0) { def.state = 'dead'; def.vy = -canvas.height * 0.5; }
    }
    return;
  }

  // Spartan Kick colossal impact screen shake (no blood effect)
  if (att.state === 'spartanKick') {
    shake(14, 0.32);
    spawnParticles(def.x, def.y - 75 * sc, 18);
  }

  if (def.takeHit(dmg, kbk, att)) {
    att.hasHit = true;
    att.hitCooldown = (att.state === 'punch') ? 0.20 : 0.5;
    // Combo: only increment on confirmed hit to enemy
    if (att.isPlayer) { att.comboCount++; att.comboTimer = 1.5; }
  }
}
function checkHits() {
  if (gameState !== 'fight') return;
  checkHit(player, enemy); checkHit(enemy, player);
}

// ── Background ─────────────────────────────────────────────
function drawBackground() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * FLOOR_FRAC); ctx.lineTo(W, H * FLOOR_FRAC); ctx.stroke();
  for (const f of [player, enemy].filter(Boolean)) {
    const isDown = (f.state === 'knockdown' && f.stateProgress > 0.20 && f.stateProgress < 0.80) || f.state === 'dead';
    const shadowX = isDown ? (f.x - f.facing * 20 * f.sc) : f.x;
    const shadowY = H * FLOOR_FRAC + 5;
    const heightOffGround = Math.max(0, f.floor - f.y);
    const jumpScale = clamp(1 - (heightOffGround / (canvas.height * 0.45)) * 0.35, 0.65, 1);

    if (f.isPlayer) {
      // Left player (Player 1): Dark orange horizontally elongated oval shadow under feet
      const baseRx = isDown ? (62 * f.sc) : (46 * f.sc);
      const baseRy = isDown ? (8.5 * f.sc) : (7.5 * f.sc);
      const rx = baseRx * jumpScale;
      const ry = baseRy * jumpScale;

      // Outer soft dark orange ambient halo
      ctx.fillStyle = 'rgba(234, 88, 12, 0.28)';
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner distinct dark orange oval core
      ctx.fillStyle = 'rgba(194, 65, 12, 0.65)';
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (difficulty === 'pvp') {
        // Right player (Player 2) in Multiplayer: Dark blue horizontally elongated oval shadow
        const baseRx = isDown ? (62 * f.sc) : (46 * f.sc);
        const baseRy = isDown ? (8.5 * f.sc) : (7.5 * f.sc);
        const rx = baseRx * jumpScale;
        const ry = baseRy * jumpScale;

        // Outer soft dark blue ambient halo
        ctx.fillStyle = 'rgba(37, 99, 235, 0.28)';
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner distinct dark blue oval core
        ctx.fillStyle = 'rgba(29, 78, 216, 0.65)';
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Enemy: Standard neutral dark shadow
        const baseRx = isDown ? (58 * f.sc) : (36 * f.sc);
        const baseRy = isDown ? (8 * f.sc) : (8 * f.sc);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.ellipse(shadowX, shadowY, baseRx * jumpScale, baseRy * jumpScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ── HUD ────────────────────────────────────────────────────
function drawHUD() {
  const W = canvas.width, H = canvas.height;
  const sc = W / DW, pad = 20, barW = W * 0.33, barH = Math.max(14, 18 * sc);

  // Player health
  ctx.fillStyle = '#eee'; ctx.fillRect(pad, pad, barW, barH);
  ctx.fillStyle = '#000'; ctx.fillRect(pad, pad, barW * (player.hp / player.maxHp), barH);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(pad, pad, barW, barH);

  // Enemy health (right→left)
  const ex = W - pad - barW;
  ctx.fillStyle = '#eee'; ctx.fillRect(ex, pad, barW, barH);
  const ef = barW * (enemy.hp / enemy.maxHp);
  ctx.fillStyle = enemy.mainColor || '#000'; ctx.fillRect(ex + barW - ef, pad, ef, barH);
  ctx.strokeStyle = '#000'; ctx.strokeRect(ex, pad, barW, barH);

  // Names
  ctx.font = `bold ${Math.floor(12 * sc)}px monospace`;
  ctx.textAlign = 'left';
  if (difficulty === 'pvp') {
    ctx.fillStyle = '#c2410c'; // Dark orange
    ctx.fillText('P1 [ORANGE]', pad, pad + barH + 16 * sc);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillText('PLAYER', pad, pad + barH + 16 * sc);
  }
  ctx.textAlign = 'right';
  if (difficulty === 'pvp') {
    ctx.fillStyle = '#1d4ed8'; // Dark blue
    ctx.fillText('P2 [BLUE]', W - pad, pad + barH + 16 * sc);
  } else {
    ctx.fillStyle = enemy.mainColor || '#000';
    ctx.fillText(enemy.displayName || 'CPU', W - pad, pad + barH + 16 * sc);
  }

  // Win gems
  const gr = 6 * sc, gy = pad + barH + 32 * sc;
  for (let i = 0; i < WIN_ROUNDS; i++) {
    ctx.fillStyle = i < playerWins ? (difficulty === 'pvp' ? '#c2410c' : '#000') : '#ccc';
    ctx.beginPath(); ctx.arc(pad + gr + i * 20 * sc, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = i < enemyWins ? (difficulty === 'pvp' ? '#1d4ed8' : '#000') : '#ccc';
    ctx.beginPath(); ctx.arc(W - pad - gr - i * 20 * sc, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
  }

  // [Q] Ground Stomp Prompt below Player Health Bar (unlocked by receiving 3 Spartan Kicks in 5s)
  if (player && (player.groundStompReady || player.reversalReady)) {
    const pulse = 0.70 + Math.sin(Date.now() * 0.009) * 0.30;
    ctx.save();
    ctx.globalAlpha = pulse;
    const badgeX = pad;
    const badgeY = pad + barH + 44 * sc;
    const badgeW = 172 * sc, badgeH = 20 * sc;
    ctx.fillStyle = '#000000';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(9.5 * sc)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('💥 PRESS [Q] GROUND STOMP! 💥', badgeX + badgeW / 2, badgeY + badgeH * 0.72);
    ctx.restore();
  }

  // Ground Stomp Prompt below CPU / P2 Health Bar
  if (enemy && (enemy.groundStompReady || enemy.reversalReady)) {
    const pulse = 0.70 + Math.sin(Date.now() * 0.009) * 0.30;
    ctx.save();
    ctx.globalAlpha = pulse;
    const badgeW = difficulty === 'pvp' ? 172 * sc : 160 * sc;
    const badgeH = 20 * sc;
    const badgeX = W - pad - badgeW;
    const badgeY = pad + barH + 44 * sc;
    ctx.fillStyle = difficulty === 'pvp' ? '#1d4ed8' : '#000000';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(9.5 * sc)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(difficulty === 'pvp' ? '💥 PRESS [7] STOMP! 💥' : '💥 STOMP READY 💥', badgeX + badgeW / 2, badgeY + badgeH * 0.72);
    ctx.restore();
  }

  // Timer
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(28 * sc)}px monospace`;
  ctx.fillText(Math.ceil(roundTimer), W / 2, pad + barH * 0.9);
  ctx.font = `${Math.floor(11 * sc)}px monospace`;
  ctx.fillText(`ROUND ${roundNum}`, W / 2, pad + barH + 16 * sc);

  // Dynamic Directional Hint (adjusts automatically based on player facing direction & mode)
  if (showTouchControls) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${Math.floor(9 * sc)}px monospace`;
    ctx.fillText('🕹️ JOYSTICK: 8-WAY MOVE  |  TAP SIDES: DASH  |  BLOCK & PUNCH  |  KICK  |  ⏸: PAUSE', W / 2, H - 10);
  } else if (difficulty === 'pvp') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${Math.floor(9 * sc)}px monospace`;
    ctx.fillText('P1 [ORANGE]: WASD · V Punch · B Kick · Shift Block · Q Stomp   |   P2 [BLUE]: 8456 · - Punch · + Kick · 0 Block · 7 Stomp   |   P: Pause', W / 2, H - 10);
  } else {
    const hbKey = player && player.facing < 0 ? 'D' : 'A';
    const spKey = player && player.facing < 0 ? 'A' : 'D';
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.font = `${Math.floor(10 * sc)}px monospace`;
    ctx.fillText(`V/L-CLICK: Punch  |  ${hbKey}+V: Duck Headbutt (1.5s Stun)  |  ${spKey}+B: Spartan Kick  |  DOUBLE-TAP: Dash  |  P: Pause & Move List`, W / 2, H - 10);
  }
}

// ── Screens ─────────────────────────────────────────────────
function drawMenu() {
  const W = canvas.width, H = canvas.height;

  if (menuView === 'moves') {
    drawBackground();
    drawScrollableMoveListModal('SHADOW FIGHT · COMBAT MOVE LIST', 'SPACIOUS MOVE GUIDE · DAMAGE VALUES & TACTICAL CONSEQUENCES', 'menu');
    return;
  }

  const layout = getMenuLayout();
  const sc = layout.sc;

  drawBackground();

  // Header Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${Math.floor(46 * sc)}px monospace`;
  ctx.fillText('SHADOW FIGHT', W / 2, H * 0.14);

  ctx.font = `bold ${Math.floor(12 * sc)}px monospace`;
  ctx.fillStyle = '#666666';
  ctx.fillText('SELECT DIFFICULTY  ·  CLICK TO CHOOSE  ·  PRESS ENTER TO FIGHT', W / 2, H * 0.22);

  // Subtle separator line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.12, H * 0.25);
  ctx.lineTo(W * 0.88, H * 0.25);
  ctx.stroke();

  // Render Difficulty Selection Cards
  for (const card of layout.cards) {
    const isSelected = (difficulty === card.id);

    // Card background
    ctx.fillStyle = isSelected ? card.accentBg : '#ffffff';
    ctx.fillRect(card.x, card.y, card.w, card.h);

    // Card border
    ctx.strokeStyle = isSelected ? card.color : '#d1d5db';
    ctx.lineWidth = isSelected ? Math.max(3, 3.5 * sc) : Math.max(1.5, 1.5 * sc);
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    // Card Header Banner
    const headerH = 34 * sc;
    ctx.fillStyle = isSelected ? card.color : '#f3f4f6';
    ctx.fillRect(card.x, card.y, card.w, headerH);
    ctx.strokeStyle = isSelected ? card.color : '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(card.x, card.y + headerH);
    ctx.lineTo(card.x + card.w, card.y + headerH);
    ctx.stroke();

    // Card Title
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelected ? '#ffffff' : card.color;
    ctx.font = `900 ${Math.floor(14 * sc)}px monospace`;
    ctx.fillText(card.title, card.x + card.w / 2, card.y + 22 * sc);

    // Default badge
    if (card.badge) {
      const badgeW = 60 * sc, badgeH = 14 * sc;
      const bx = card.x + card.w - badgeW - 6 * sc;
      const by = card.y + (headerH - badgeH) / 2;
      ctx.fillStyle = isSelected ? '#ffffff' : '#000000';
      ctx.fillRect(bx, by, badgeW, badgeH);
      ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
      ctx.font = `bold ${Math.floor(8.5 * sc)}px monospace`;
      ctx.fillText(card.badge, bx + badgeW / 2, by + badgeH * 0.75);
    }

    // Subtitle
    ctx.fillStyle = isSelected ? card.color : '#6b7280';
    ctx.font = `bold ${Math.floor(9.5 * sc)}px monospace`;
    ctx.fillText(card.sub, card.x + card.w / 2, card.y + headerH + 16 * sc);

    // Bullet points
    ctx.textAlign = 'left';
    ctx.fillStyle = '#374151';
    ctx.font = `${Math.floor(9.5 * sc)}px monospace`;
    const bulletStartY = card.y + headerH + 34 * sc;
    const bulletGap = 20 * sc;
    card.bullets.forEach((b, i) => {
      ctx.fillText(b, card.x + 10 * sc, bulletStartY + i * bulletGap);
    });

    // Active Selection Badge Pill
    if (isSelected) {
      const pillH = 18 * sc;
      const pillY = card.y + card.h - pillH - 7 * sc;
      const pillW = card.w - 20 * sc;
      const pillX = card.x + 10 * sc;
      ctx.fillStyle = card.color;
      ctx.fillRect(pillX, pillY, pillW, pillH);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.floor(9.5 * sc)}px monospace`;
      ctx.fillText('✓ SELECTED', pillX + pillW / 2, pillY + pillH * 0.72);
    }
  }

  // Left Button: View Move List & Guide [M]
  const movesBtn = layout.movesBtn;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(movesBtn.x, movesBtn.y, movesBtn.w, movesBtn.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(movesBtn.x, movesBtn.y, movesBtn.w, movesBtn.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${Math.floor(12.5 * sc)}px monospace`;
  ctx.fillText('📖  MOVE LIST & GUIDE  [ M ]', movesBtn.x + movesBtn.w / 2, movesBtn.y + movesBtn.h * 0.64);

  // Right Button: Start Fight [ENTER]
  const startBtn = layout.startBtn;
  const pulse = 0.88 + Math.sin(Date.now() * 0.005) * 0.12;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#000000';
  ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.floor(12.5 * sc)}px monospace`;
  ctx.fillText('▶  START FIGHT  [ ENTER ]', startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h * 0.64);
  ctx.restore();

  // Keyboard navigation hint & quick move bar
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888888';
  ctx.font = `${Math.floor(9.5 * sc)}px monospace`;
  if (showTouchControls) {
    ctx.fillText('TOUCH TO SELECT MODE  ·  TAP MOVE LIST OR START FIGHT', W / 2, startBtn.y + startBtn.h + 20 * sc);
  } else {
    ctx.fillText('KEYS: [1] Easy  ·  [2] Medium  ·  [3] Hard  ·  [4] 2P Versus  ·  [M] Moves  ·  [ENTER] Start Match', W / 2, startBtn.y + startBtn.h + 20 * sc);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = `${Math.floor(9 * sc)}px monospace`;
  if (showTouchControls) {
    ctx.fillText('🕹️ JOYSTICK (8-WAY)  |  DASH (TAP SIDES)  |  BLOCK & PUNCH  |  KICK  |  STOMP POPUP', W / 2, H - 12);
  } else {
    ctx.fillText('P1 [ORANGE]: WASD + V/B (Punch/Kick) · Shift (Block) · Q (Stomp)   |   P2 [BLUE]: 8456 + -/+ (Punch/Kick) · 0 (Block) · 7 (Stomp)   |   P: Pause', W / 2, H - 12);
  }
}

function drawPauseMenu() {
  drawScrollableMoveListModal('PAUSED · COMBAT MOVE LIST', 'SPACIOUS MOVE GUIDE · DAMAGE VALUES & TACTICAL CONSEQUENCES', 'pause');
}

function drawCountdown() {
  const W = canvas.width, H = canvas.height, sc = W / DW;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(22 * sc)}px monospace`;
  ctx.fillText(`ROUND ${roundNum}`, W / 2, H / 2 - 36 * sc);
  ctx.font = `bold ${Math.floor(70 * sc)}px monospace`;
  ctx.fillText(countdown > 0 ? countdown : 'FIGHT!', W / 2, H / 2 + 25 * sc);
}

function drawRoundBanner() {
  if (roundBannerTimer <= 0) return;
  const W = canvas.width, H = canvas.height, sc = W / DW;
  ctx.save();
  const alpha = Math.min(1, roundBannerTimer / 0.45);
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';

  const text = roundBannerText;
  ctx.font = `900 ${Math.floor(36 * sc)}px monospace`;
  const tw = ctx.measureText(text).width;
  const pillW = tw + 44 * sc;
  const pillH = 52 * sc;
  const pillX = (W - pillW) / 2;
  const pillY = H * 0.35 - pillH * 0.65;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(pillX, pillY, pillW, pillH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3 * sc;
  ctx.strokeRect(pillX, pillY, pillW, pillH);

  ctx.fillStyle = '#000000';
  ctx.fillText(text, W / 2, H * 0.35);
  ctx.restore();
}

function drawRoundTransition() {
  const W = canvas.width, H = canvas.height, sc = W / DW;
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(38 * sc)}px monospace`;
  ctx.fillText(resultText, W / 2, H * 0.38);
  ctx.fillStyle = '#555'; ctx.font = `bold ${Math.floor(16 * sc)}px monospace`;
  ctx.fillText(`STARTING ROUND ${roundNum + 1}...`, W / 2, H * 0.50);
}

function drawRoundEnd() {
  const W = canvas.width, H = canvas.height, sc = W / DW;
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(42 * sc)}px monospace`; ctx.fillText(resultText, W / 2, H * 0.4);
  ctx.fillStyle = '#555'; ctx.font = `${Math.floor(13 * sc)}px monospace`;
  ctx.fillText('MATCH COMPLETED', W / 2, H * 0.55);
}

function drawGameOver() {
  const W = canvas.width, H = canvas.height, sc = W / DW;
  ctx.textAlign = 'center';

  if (difficulty === 'pvp') {
    const p1Won = playerWins >= WIN_ROUNDS;
    ctx.fillStyle = p1Won ? '#c2410c' : '#1d4ed8';
    ctx.font = `bold ${Math.floor(52 * sc)}px monospace`;
    ctx.fillText(p1Won ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!', W / 2, H * 0.34);
    ctx.font = `bold ${Math.floor(18 * sc)}px monospace`;
    ctx.fillStyle = '#000000';
    ctx.fillText(`FINAL SCORE: ${playerWins} — ${enemyWins}`, W / 2, H * 0.45);

    ctx.fillStyle = '#2563eb';
    ctx.font = `bold ${Math.floor(13 * sc)}px monospace`;
    ctx.fillText('[ 2P MULTIPLAYER VERSUS ]', W / 2, H * 0.52);
  } else {
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.floor(52 * sc)}px monospace`;
    ctx.fillText(playerWins >= WIN_ROUNDS ? 'VICTORY!' : 'DEFEAT', W / 2, H * 0.34);
    ctx.font = `bold ${Math.floor(18 * sc)}px monospace`;
    ctx.fillText(`FINAL SCORE: ${playerWins} — ${enemyWins}`, W / 2, H * 0.45);

    const diffLabel = difficulty.toUpperCase();
    ctx.fillStyle = difficulty === 'easy' ? '#16a34a' : (difficulty === 'hard' ? '#dc2626' : '#555555');
    ctx.font = `bold ${Math.floor(13 * sc)}px monospace`;
    ctx.fillText(`[ DIFFICULTY: ${diffLabel} ]`, W / 2, H * 0.52);
  }

  // Clickable Rematch & Main Menu buttons
  const btns = getGameOverBtns();

  // Rematch Button
  ctx.fillStyle = '#000000';
  ctx.fillRect(btns.rematch.x, btns.rematch.y, btns.rematch.w, btns.rematch.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(btns.rematch.x, btns.rematch.y, btns.rematch.w, btns.rematch.h);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(13.5 * sc)}px monospace`;
  ctx.fillText('⚔  REMATCH  ⚔', btns.rematch.x + btns.rematch.w / 2, btns.rematch.y + btns.rematch.h * 0.64);

  // Main Menu / Difficulty Selection Button
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(btns.menu.x, btns.menu.y, btns.menu.w, btns.menu.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(btns.menu.x, btns.menu.y, btns.menu.w, btns.menu.h);

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.floor(13.5 * sc)}px monospace`;
  ctx.fillText('⚙  MENU / DIFFICULTY  ⚙', btns.menu.x + btns.menu.w / 2, btns.menu.y + btns.menu.h * 0.64);
}

// ── Round logic ─────────────────────────────────────────────
function checkRoundEnd() {
  if (gameState !== 'fight') return;
  const pDead = player.hp <= 0 || player.state === 'dead';
  const eDead = enemy.hp <= 0 || enemy.state === 'dead';
  const timeout = roundTimer <= 0;
  if (!pDead && !eDead && !timeout) return;

  if (timeout) {
    if (player.hp > enemy.hp) {
      playerWins++;
      resultText = difficulty === 'pvp' ? 'TIME OUT — PLAYER 1 WINS!' : 'TIME OUT — PLAYER WINS!';
    } else if (enemy.hp > player.hp) {
      enemyWins++;
      resultText = difficulty === 'pvp' ? 'TIME OUT — PLAYER 2 WINS!' : 'TIME OUT — CPU WINS!';
    } else {
      resultText = 'ROUND DRAW!';
    }
  } else if (pDead && !eDead) {
    enemyWins++;
    resultText = difficulty === 'pvp' ? 'PLAYER 2 WINS ROUND!' : 'CPU WINS ROUND!';
  } else if (eDead && !pDead) {
    playerWins++;
    resultText = difficulty === 'pvp' ? 'PLAYER 1 WINS ROUND!' : 'PLAYER WINS ROUND!';
  } else {
    resultText = 'DOUBLE KO!';
  }

  // Check if match is completely decided (First to 2 wins)
  if (playerWins >= WIN_ROUNDS || enemyWins >= WIN_ROUNDS) {
    gameState = 'roundEnd';
    setTimeout(() => { if (gameState === 'roundEnd') gameState = 'gameOver'; }, 1800);
  } else {
    // Match continues into next round! (Round 1 -> Round 2, or Round 2 -> Round 3)
    gameState = 'roundTransition';
    setTimeout(() => {
      startNextRoundContinuous();
    }, 1500); // 1.5s dramatic pause to witness KO hit
  }
}

function startNextRoundContinuous() {
  // ── ROUND 2 & CONTINUOUS ROUNDS (ARENA PERSISTS, NO RESET!) ────────
  roundNum++;
  roundTimer = 99;
  roundTimerAcc = 0;
  countdown = 0;
  countdownTimer = 0;
  gameState = 'fight'; // Instant combat start for Round 2 & 3! No countdown!
  roundBannerText = `ROUND ${roundNum} BEGINS`;
  roundBannerTimer = 1.8;
  isPaused = false;
  keys = {};
  groundShockwaves.length = 0;
  player.groundStompReady = false;
  player.reversalReady = false;
  player.spartanHitTimestamps = [];
  player.kdTimestamps = [];
  enemy.groundStompReady = false;
  enemy.reversalReady = false;
  enemy.spartanHitTimestamps = [];
  enemy.kdTimestamps = [];

  // 1. Both health bars become full!
  player.hp = player.maxHp;
  enemy.hp = enemy.maxHp;

  // 2. Identify loser (who was dead on ground) and winner
  const pWasDead = player.state === 'dead' || player.hp <= 0;
  const eWasDead = enemy.state === 'dead' || enemy.hp <= 0;

  let loser = null;
  let winner = null;
  if (pWasDead && !eWasDead) {
    loser = player;
    winner = enemy;
  } else if (eWasDead && !pWasDead) {
    loser = enemy;
    winner = player;
  }

  if (loser && winner) {
    // 3. The dead person wakes back up from knockdown!
    // Transitions into wake-up pushing off floor back onto feet
    loser.state = 'knockdown';
    loser.stateDur = 1.6;
    loser.stateElapsed = 0.50 * 1.6; // flat on back sleeping pose, then smoothly rises
    loser.stunTimer = 1.6 - loser.stateElapsed;
    loser.y = loser.floor;
    loser.vy = 0;
    loser.onGround = true;
    loser.crouching = false;
    loser.blocking = false;
    loser.landedShake = true;

    // Reset winner to grounded neutral
    winner.state = 'idle';
    winner.atkCooldown = 0;
    winner.stunTimer = 0;
    winner.y = winner.floor;
    winner.vy = 0;
    winner.onGround = true;
    winner.crouching = false;
    winner.blocking = false;

    // Face each other
    loser.facing = winner.x > loser.x ? 1 : -1;
    winner.facing = loser.x > winner.x ? 1 : -1;

    // 4. "if the winner is too close to loser while loser wakes up for round 2 the get huge knockback and knock down (no health loss)"
    const dist = Math.abs(winner.x - loser.x);
    const PROXIMITY_THRESHOLD = 160 * (canvas.width / DW);

    if (dist < PROXIMITY_THRESHOLD) {
      // Reversal wake-up shockwave explosion!
      shake(15, 0.35);
      spawnParticles(loser.x, loser.floor - 40, 28);

      // Huge knockback (380 * sc) + knock down onto back with NO HEALTH LOSS (0 DMG)!
      winner.knockdown(loser, 0, 380 * winner.sc);
    }
  } else {
    // Timeout or mutual reset
    player.state = 'idle';
    enemy.state = 'idle';
    player.y = player.floor; player.vy = 0; player.onGround = true;
    enemy.y = enemy.floor; enemy.vy = 0; enemy.onGround = true;
    player.crouching = false; player.blocking = false;
    enemy.crouching = false; enemy.blocking = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  let sx = 0, sy = 0;
  if (shakeDur > 0) { shakeDur -= dt; sx = (Math.random() - 0.5) * shakeAmt * 2; sy = (Math.random() - 0.5) * shakeAmt * 2; }
  ctx.save();
  ctx.translate(sx, sy);
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  if (gameState === 'menu') { drawMenu(); ctx.restore(); requestAnimationFrame(loop); return; }

  if (gameState === 'countdown') {
    player.update(dt, enemy); enemy.update(dt, player);
    updateParticles(dt);
    updateGroundShockwaves(dt);
    drawBackground(); player.draw(); enemy.draw(); drawParticles(); drawGroundShockwaves(); drawHUD();
    countdownTimer -= dt;
    if (countdownTimer <= 0) { countdown--; if (countdown < 0) gameState = 'fight'; else countdownTimer = 1; }
    drawCountdown();
    ctx.restore(); requestAnimationFrame(loop); return;
  }

  if (gameState === 'fight') {
    if (isPaused) {
      drawBackground();
      player.draw();
      enemy.draw();
      drawParticles();
      drawGroundShockwaves();
      drawHUD();
      drawPauseMenu();
      ctx.restore();
      requestAnimationFrame(loop);
      return;
    }

    if (!['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'block', 'groundStomp'].includes(player.state)) {
      const isTouchDown = (typeof showTouchControls !== 'undefined' && showTouchControls && typeof touchControls !== 'undefined' && touchControls.joystick && touchControls.joystick.down);
      const downHeld = !!(keys['KeyS'] || keys['ArrowDown'] || isTouchDown);
      if (downHeld) {
        if (player.onGround && player.state !== 'crouch') player.state = 'crouch';
      } else {
        if (player.state === 'crouch') player.state = 'idle';
        let mv = false;
        if (keys['KeyA'] || keys['ArrowLeft'] || (touchControls.joystick && touchControls.joystick.left)) { player.move(-220 * dt); mv = true; }
        if (keys['KeyD'] || keys['ArrowRight'] || (touchControls.joystick && touchControls.joystick.right)) { player.move(220 * dt); mv = true; }
        if (!mv && player.state === 'walk') player.state = 'idle';
      }
    }

    if (difficulty === 'pvp') {
      // Player 2 keyboard movement in 2-Player Versus Mode
      if (!['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'block', 'groundStomp'].includes(enemy.state)) {
        if (enemy.state === 'crouch' && (keys['Numpad5'] || keys['Digit5'] || keys['5'])) {
          // P2 is intentionally holding crouch
        } else {
          if (enemy.state === 'crouch') enemy.state = 'idle';
          let mv2 = false;
          if (keys['Numpad4'] || keys['Digit4'] || keys['4']) { enemy.move(-220 * dt); mv2 = true; }
          if (keys['Numpad6'] || keys['Digit6'] || keys['6']) { enemy.move(220 * dt); mv2 = true; }
          if (!mv2 && enemy.state === 'walk') enemy.state = 'idle';
        }
      }
    } else {
      updateAI(dt);
    }

    const dist = Math.abs(player.x - enemy.x);
    const neitherDown = player.state !== 'knockdown' && player.state !== 'dead' &&
                        enemy.state !== 'knockdown' && enemy.state !== 'dead';
    if (neitherDown && player.onGround && enemy.onGround && dist < PUSH_DIST) {
      const push = (PUSH_DIST - dist) * 0.5 + 1;
      if (player.x < enemy.x) { player.x -= push; enemy.x += push; }
      else { player.x += push; enemy.x -= push; }
      player.x = clamp(player.x, 55, canvas.width - 55);
      enemy.x = clamp(enemy.x, 55, canvas.width - 55);
    }

    player.update(dt, enemy); enemy.update(dt, player);
    checkHits();
    if (roundBannerTimer > 0) roundBannerTimer -= dt;
    roundTimerAcc += dt;
    if (roundTimerAcc >= 1) { roundTimerAcc = 0; roundTimer--; }
    checkRoundEnd();
  }

  if (gameState === 'roundTransition' || gameState === 'roundEnd') {
    player.update(dt, enemy);
    enemy.update(dt, player);
  }

  drawBackground(); player.draw(); enemy.draw();
  updateParticles(dt); updateGroundShockwaves(dt); drawParticles(); drawGroundShockwaves();
  drawHUD();
  if (showTouchControls && (gameState === 'fight' || gameState === 'countdown') && !isPaused) {
    drawTouchControls();
  }
  if (roundBannerTimer > 0) drawRoundBanner();
  if (gameState === 'roundTransition') drawRoundTransition();
  if (gameState === 'roundEnd') drawRoundEnd();
  if (gameState === 'gameOver') drawGameOver();

  ctx.restore();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
