// ═══════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB  ·  game.js
//  LEFT CLICK: Punch  |  RIGHT CLICK: Kick
//  A/D: Move  |  W: Jump  |  S: Crouch  |  SHIFT: Block
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = Math.min(window.innerWidth - 20, 1000);
  canvas.height = Math.min(window.innerHeight - 40, 562);
}
resize();
window.addEventListener('resize', () => {
  resize();
  if (player) player.y = canvas.height * FLOOR_FRAC;
  if (enemy) enemy.y = canvas.height * FLOOR_FRAC;
});

const GRAVITY = 1600;
const FLOOR_FRAC = 0.82;
const PUSH_DIST = 55;
const DW = 900;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

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
    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'dash', 'groundStomp'].includes(this.state)) return;
    if (this.state === 'crouch') {
      if (this.isPlayer && !(keys['KeyS'] || keys['ArrowDown'])) {
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
    if (['punch', 'crouchPunch', 'duckHeadbutt', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'dash'].includes(this.state)) return;
    if (this.state === 'crouch') {
      if (this.isPlayer && !(keys['KeyS'] || keys['ArrowDown'])) {
        this.state = 'idle';
      } else {
        return;
      }
    }
    this.vy = -canvas.height * 0.9;
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

    // Player direct key synchronization (guarantees player NEVER gets stuck in crouch or block)
    if (this.isPlayer) {
      const downHeld = !!(keys['KeyS'] || keys['ArrowDown']);
      this.crouching = downHeld;
      if (this.state === 'crouch' && !downHeld) {
        this.state = 'idle';
      }
      const blockHeld = !!(keys['ShiftLeft'] || keys['ShiftRight']);
      this.blocking = blockHeld;
      if (this.state === 'block' && !blockHeld) {
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
        if (!this.onGround) {
          this.state = 'jump';
        } else if (this.crouching && (this.isPlayer ? (keys['KeyS'] || keys['ArrowDown']) : true)) {
          this.state = 'crouch';
        } else if (this.blocking && (this.isPlayer ? (keys['ShiftLeft'] || keys['ShiftRight']) : true)) {
          this.state = 'block';
        } else {
          this.state = 'idle';
        }
      }
    }

    if (!this.onGround) { this.vy += GRAVITY * dt; this.y += this.vy * dt; }
    if (this.y >= this.floor) {
      this.y = this.floor; this.vy = 0;
      if (!this.onGround) { this.onGround = true; if (this.state === 'jump') this.state = 'idle'; }
    } else { this.onGround = false; }

    this.walkCycle += dt * (this.state === 'walk' ? 8 : 1.5);

    if (this.state !== 'dead' && this.state !== 'flipKick' && this.state !== 'dash') {
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
let difficulty = 'medium'; // 'easy' | 'medium' (default) | 'hard'
let isPaused = false;
let playerWins = 0, enemyWins = 0;
const WIN_ROUNDS = 2;
let roundTimer = 99, roundTimerAcc = 0;
let countdown = 3, countdownTimer = 0;
let roundNum = 1, resultText = '';
let roundBannerText = '', roundBannerTimer = 0;
let player, enemy;

function initRound() {
  player = new Fighter(canvas.width * 0.25, true, 'PLAYER');
  enemy = new Fighter(canvas.width * 0.75, false, 'CPU');

  // Configure enemy appearance & traits by difficulty
  if (difficulty === 'easy') {
    enemy.mainColor = '#16a34a'; // Vibrant emerald green
    enemy.backColor = '#15803d'; // Deep green for back limbs
    enemy.displayName = 'CPU [EASY]';
  } else if (difficulty === 'hard') {
    enemy.mainColor = '#dc2626'; // Vibrant crimson red
    enemy.backColor = '#991b1b'; // Deep dark red for back limbs
    enemy.displayName = 'CPU [HARD]';
  } else {
    enemy.mainColor = '#000000'; // Classic black shadow (medium default)
    enemy.backColor = '#333333';
    enemy.displayName = 'CPU [MEDIUM]';
  }

  roundTimer = 99; roundTimerAcc = 0;
  countdown = 3; countdownTimer = 1;
  gameState = 'countdown';
  isPaused = false;
  particles.length = 0;
  groundShockwaves.length = 0;
  keys = {};
  roundBannerText = '';
  roundBannerTimer = 0;
}

// ── Input ────────────────────────────────────────────────────
let keys = {};
let lastTap = { left: 0, right: 0 };
const DOUBLE_TAP_WINDOW = 280; // ms

document.addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;

  // Toggle Pause Menu with P or Escape during fight
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameState === 'fight') {
      isPaused = !isPaused;
      if (!isPaused) lastTime = performance.now();
      return;
    }
  }

  if (gameState === 'fight' && !isPaused) {
    const now = Date.now();
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
  }
  if (gameState === 'menu') {
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
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      if (difficulty === 'hard') difficulty = 'medium';
      else if (difficulty === 'medium') difficulty = 'easy';
      return;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      if (difficulty === 'easy') difficulty = 'medium';
      else if (difficulty === 'medium') difficulty = 'hard';
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
  if (!player) return;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') player.crouch(false);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.block(false);
});

// ── Menu and Button Layouts ──────────────────────────────────
function getMenuLayout() {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 560);

  const gap = 16 * sc;
  const cardW = Math.min(270 * sc, (W - 44 * sc - gap * 2) / 3);
  const cardH = Math.min(205 * sc, H * 0.40);
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const cardY = H * 0.31;

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
    }
  ];

  const btnW = Math.min(320 * sc, W * 0.65);
  const btnH = Math.max(38, 44 * sc);
  const btnX = (W - btnW) / 2;
  const btnY = cardY + cardH + 18 * sc;
  const startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

  return { sc, cards, startBtn };
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

// Mouse: left = punch (or crouch punch if crouched), right = kick
canvas.addEventListener('mousedown', e => {
  if (isPaused) {
    isPaused = false;
    lastTime = performance.now();
    return;
  }
  if (gameState === 'fight') {
    if (e.button === 0) {
      if (keys['KeyA'] || keys['ArrowLeft']) {
        // While pressing "A" (or Left Arrow) + Punch: Duck Headbutt!
        player.attack('duckHeadbutt');
      } else if (player.crouching || player.state === 'crouch') {
        player.attack('crouchPunch');
      } else {
        player.attack('punch');
      }
    }
    if (e.button === 2) {
      if (!player.onGround) {
        // Kick performed in the air -> Front Flip Axe Kick!
        player.attack('flipKick');
      } else if (player.crouching || player.state === 'crouch') {
        // Crouch + Right Click: Low Sweep Kick (trips unblocked enemies!)
        player.attack('sweepKick');
      } else {
        // Moving towards enemy + Right Click: Spartan Kick!
        const movingForward = (player.facing > 0 && (keys['KeyD'] || keys['ArrowRight'])) ||
          (player.facing < 0 && (keys['KeyA'] || keys['ArrowLeft']));
        player.attack(movingForward ? 'spartanKick' : 'kick');
      }
    }
    return;
  }
  if (gameState === 'gameOver') {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const btns = getGameOverBtns();

    if (mx >= btns.rematch.x && mx <= btns.rematch.x + btns.rematch.w &&
        my >= btns.rematch.y && my <= btns.rematch.y + btns.rematch.h) {
      playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
      return;
    }
    if (mx >= btns.menu.x && mx <= btns.menu.x + btns.menu.w &&
        my >= btns.menu.y && my <= btns.menu.y + btns.menu.h) {
      playerWins = 0; enemyWins = 0; roundNum = 1; gameState = 'menu';
      return;
    }
    return;
  }
  if (gameState === 'menu') {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const layout = getMenuLayout();

    // Check click on difficulty cards
    for (const card of layout.cards) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        difficulty = card.id;
        return;
      }
    }

    // Check click on Start Button
    const btn = layout.startBtn;
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
      return;
    }
  }
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

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
    const layout = getMenuLayout();
    for (const card of layout.cards) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    const btn = layout.startBtn;
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      canvas.style.cursor = 'pointer';
      return;
    }
    canvas.style.cursor = 'default';
    return;
  }
  canvas.style.cursor = 'crosshair';
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
  if (att.state === 'punch' && (def.state === 'crouch' || def.state === 'crouchPunch')) return;

  // Duck Headbutt evasion: While in ducking frames (sp < 0.38), duck under punches AND Spartan kicks!
  if (def.state === 'duckHeadbutt' && def.stateProgress < 0.38) {
    if (att.state === 'punch' || att.state === 'spartanKick') {
      return; // Cleanly dodges!
    }
  }

  // Both "Q" Ground Stomp attacks are completely uninterruptible (hyper-armor)!
  if (def.state === 'groundStomp') {
    def.takeHit(dmg, 0, att);
    att.hitCooldown = 0.5;
    return;
  }

  // Sweep kick special logic: trips unblocked opponents! (No blood effect)
  if (att.state === 'sweepKick') {
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
    att.hitCooldown = (att.state === 'punch') ? 0.10 : 0.5;
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
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    if ((f.state === 'knockdown' && f.stateProgress > 0.20 && f.stateProgress < 0.80) || f.state === 'dead') {
      // Elongated shadow along the ground while lying on back in sleeping position
      const shadowX = f.x - f.facing * 20 * f.sc;
      ctx.ellipse(shadowX, H * FLOOR_FRAC + 5, 58 * f.sc, 8 * f.sc, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(f.x, H * FLOOR_FRAC + 5, 36 * f.sc, 8 * f.sc, 0, 0, Math.PI * 2);
    }
    ctx.fill();
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
  ctx.fillStyle = '#000'; ctx.font = `bold ${Math.floor(12 * sc)}px monospace`;
  ctx.textAlign = 'left'; ctx.fillText('PLAYER', pad, pad + barH + 16 * sc);
  ctx.textAlign = 'right';
  ctx.fillStyle = enemy.mainColor || '#000';
  ctx.fillText(enemy.displayName || 'CPU', W - pad, pad + barH + 16 * sc);

  // Win gems
  const gr = 6 * sc, gy = pad + barH + 32 * sc;
  for (let i = 0; i < WIN_ROUNDS; i++) {
    ctx.fillStyle = i < playerWins ? '#000' : '#ccc';
    ctx.beginPath(); ctx.arc(pad + gr + i * 20 * sc, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = i < enemyWins ? '#000' : '#ccc';
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

  // Ground Stomp Prompt below CPU Health Bar
  if (enemy && (enemy.groundStompReady || enemy.reversalReady)) {
    const pulse = 0.70 + Math.sin(Date.now() * 0.009) * 0.30;
    ctx.save();
    ctx.globalAlpha = pulse;
    const badgeW = 160 * sc, badgeH = 20 * sc;
    const badgeX = W - pad - badgeW;
    const badgeY = pad + barH + 44 * sc;
    ctx.fillStyle = '#000000';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(9.5 * sc)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('💥 STOMP READY 💥', badgeX + badgeW / 2, badgeY + badgeH * 0.72);
    ctx.restore();
  }

  // Timer
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(28 * sc)}px monospace`;
  ctx.fillText(Math.ceil(roundTimer), W / 2, pad + barH * 0.9);
  ctx.font = `${Math.floor(11 * sc)}px monospace`;
  ctx.fillText(`ROUND ${roundNum}`, W / 2, pad + barH + 16 * sc);

  // Hint
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.font = `${Math.floor(10 * sc)}px monospace`;
  ctx.fillText('L-CLICK: Punch  |  A+L-CLICK: Duck Headbutt (1.5s Stun)  |  R-CLICK: Kick  |  DOUBLE-TAP A/D: Dash  |  P: Pause & Move List', W / 2, H - 10);
}

// ── Screens ─────────────────────────────────────────────────
function drawMenu() {
  const W = canvas.width, H = canvas.height;
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

  // Large Start Fight Button
  const btn = layout.startBtn;
  const pulse = 0.85 + Math.sin(Date.now() * 0.005) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#000000';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.floor(13.5 * sc)}px monospace`;
  ctx.fillText('▶  START FIGHT  [ CLICK / ENTER ]', btn.x + btn.w / 2, btn.y + btn.h * 0.64);
  ctx.restore();

  // Keyboard navigation hint & quick move bar
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888888';
  ctx.font = `${Math.floor(9.5 * sc)}px monospace`;
  ctx.fillText('KEYS: [1] Easy  ·  [2] Medium (Default)  ·  [3] Hard  ·  [ENTER / SPACE] Start Match', W / 2, btn.y + btn.h + 20 * sc);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = `${Math.floor(9 * sc)}px monospace`;
  ctx.fillText('L-CLICK: Punch  |  A+L-CLICK: Duck Headbutt (1.5s Stun)  |  R-CLICK: Kick  |  DOUBLE-TAP A/D: Dash  |  P: Pause & Move List', W / 2, H - 12);
}

function drawPauseMenu() {
  const W = canvas.width, H = canvas.height;
  const sc = Math.min(W / DW, H / 560);

  // Translucent dark veil over frozen fight scene
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, W, H);

  const modalW = Math.min(W * 0.94, 880 * sc);
  const modalH = Math.min(H * 0.93, 510 * sc);
  const modalX = (W - modalW) / 2;
  const modalY = (H - modalH) / 2;

  // Outer Box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(modalX, modalY, modalW, modalH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2.5, 3 * sc);
  ctx.strokeRect(modalX, modalY, modalW, modalH);

  // Inner border accent
  ctx.lineWidth = 1;
  ctx.strokeRect(modalX + 5 * sc, modalY + 5 * sc, modalW - 10 * sc, modalH - 10 * sc);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `900 ${Math.floor(22 * sc)}px monospace`;
  ctx.fillText('PAUSED', W / 2, modalY + 28 * sc);

  ctx.fillStyle = '#666666';
  ctx.font = `bold ${Math.floor(10 * sc)}px monospace`;
  ctx.fillText('MOVE LIST  &  COMBAT CONSEQUENCES', W / 2, modalY + 43 * sc);

  // Header horizontal divider
  ctx.strokeStyle = '#cccccc';
  ctx.beginPath();
  ctx.moveTo(modalX + 16 * sc, modalY + 50 * sc);
  ctx.lineTo(modalX + modalW - 16 * sc, modalY + 50 * sc);
  ctx.stroke();

  // Vertical column divider
  ctx.strokeStyle = '#e0e0e0';
  ctx.beginPath();
  ctx.moveTo(modalX + modalW / 2, modalY + 56 * sc);
  ctx.lineTo(modalX + modalW / 2, modalY + modalH - 46 * sc);
  ctx.stroke();

  const colW = (modalW - 56 * sc) / 2;
  const col1X = modalX + 18 * sc;
  const col2X = modalX + modalW / 2 + 12 * sc;
  const startY = modalY + 58 * sc;
  const itemGap = 65 * sc;

  const col1Moves = [
    {
      name: 'Rapid Punch Combo',
      input: 'L-CLICK (x1-5)',
      badge: '9 / 2.25 DMG',
      line1: 'Rapid alternating hands! First punch 9 DMG; rest 2.25 DMG.',
      line2: 'Max 5 punches, then 0.5s lockout. Whiffs if foe crouches!'
    },
    {
      name: 'Duck Headbutt',
      input: 'A + L-CLICK',
      badge: '14 DMG / 1.5s STUN',
      line1: 'Ducks under punches & Spartan kicks! Explodes into 45° ram.',
      line2: 'Headbutt connects: STUNS enemy for 1.5 seconds with dizzy stars!'
    },
    {
      name: 'Low Crouch Punch',
      input: 'S + L-CLICK',
      badge: '9 DMG',
      line1: 'Low Gedan Tsuki punch executed while staying crouched.',
      line2: 'Ducks under high punches while striking midsection.'
    },
    {
      name: 'Snap Kick',
      input: 'R-CLICK (Neutral)',
      badge: '12 DMG',
      line1: 'High snap thrust kick with 152px reach.',
      line2: 'Excellent mid-range spacing and poke tool against advances.'
    },
    {
      name: 'Spartan Kick',
      input: 'FORWARD + R-CLICK',
      badge: '18 DMG',
      line1: 'Torso leans back -40° and unleashes linear foot thrust.',
      line2: '4X COLOSSAL KNOCKBACK (368px) into arena walls!'
    },
    {
      name: 'Front Flip Axe Kick',
      input: 'AIRBORNE + R-CLICK',
      badge: '21 DMG',
      line1: '360° forward aerial flip; chops down at 220° rotation.',
      line2: 'Glides forward & KNOCKS FOE FLAT ON BACK for 1s! (+3 DMG)'
    }
  ];

  const col2Moves = [
    {
      name: 'Low Sweep Kick',
      input: 'S + R-CLICK',
      badge: '7 DMG',
      line1: 'Low ground sweep with grounded hand plant (-3 DMG).',
      line2: 'Ignores high guard! TRIPS enemy onto back for 1s.'
    },
    {
      name: 'Tactical Dash Move',
      input: 'DOUBLE-TAP A / D',
      badge: 'MOBILITY',
      line1: 'Rapid burst propulsion (184px, half Spartan knockback).',
      line2: 'Shadow afterimages. Can be cancelled into any attack!'
    },
    {
      name: 'Boxer High Guard',
      input: 'HOLD SHIFT',
      badge: 'DEFENSE',
      line1: 'Peek-a-boo face guard absorbs 90% incoming damage.',
      line2: 'Mitigates knockback slide. Vulnerable to low sweep kicks!'
    },
    {
      name: 'Martial Arts Crouch',
      input: 'HOLD S / DOWN',
      badge: 'DEFENSE',
      line1: 'Low ducking stance lower than punch height.',
      line2: 'Passively evades all standing punches and high kicks.'
    },
    {
      name: 'Ground Stomp ("Q")',
      input: 'RECEIVE 3 SPARTAN KICKS',
      badge: 'UNINTERRUPTIBLE',
      line1: 'Taking 3 Spartan Kicks (or 3 KDs) in 5s unlocks Ground Stomp.',
      line2: 'UNINTERRUPTIBLE hyper-armor! Knocks down foe anywhere on screen!'
    }
  ];

  function drawMoveItem(m, x, y) {
    ctx.textAlign = 'left';
    // Move Name
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.floor(11.5 * sc)}px monospace`;
    ctx.fillText(m.name, x, y);

    // Input tag
    const nameWidth = ctx.measureText(m.name).width;
    const tagX = x + nameWidth + 8 * sc;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(tagX, y - 10 * sc, ctx.measureText(m.input).width + 8 * sc, 13 * sc);
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, y - 10 * sc, ctx.measureText(m.input).width + 8 * sc, 13 * sc);
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${Math.floor(9 * sc)}px monospace`;
    ctx.fillText(m.input, tagX + 4 * sc, y - 1 * sc);

    // Badge (Damage / Type) on right edge of column
    ctx.textAlign = 'right';
    const badgeX = x + colW - 6 * sc;
    ctx.fillStyle = '#000000';
    ctx.fillRect(badgeX - ctx.measureText(m.badge).width - 8 * sc, y - 10 * sc, ctx.measureText(m.badge).width + 8 * sc, 13 * sc);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(9 * sc)}px monospace`;
    ctx.fillText(m.badge, badgeX - 4 * sc, y - 1 * sc);

    // Description lines
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333333';
    ctx.font = `${Math.floor(10 * sc)}px monospace`;
    ctx.fillText(m.line1, x, y + 14 * sc);
    ctx.fillStyle = '#666666';
    ctx.fillText(m.line2, x, y + 27 * sc);
  }

  col1Moves.forEach((m, i) => drawMoveItem(m, col1X, startY + i * itemGap));
  col2Moves.forEach((m, i) => drawMoveItem(m, col2X, startY + i * itemGap));

  // Footer Resume Button / Banner
  const btnH = 26 * sc;
  const btnY = modalY + modalH - btnH - 10 * sc;
  ctx.fillStyle = '#000000';
  ctx.fillRect(modalX + 14 * sc, btnY, modalW - 28 * sc, btnH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.floor(11.5 * sc)}px monospace`;
  ctx.fillText('▶  PRESS "P", "ESC", OR CLICK ANYWHERE TO RESUME FIGHT', W / 2, btnY + btnH * 0.68);
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
  ctx.fillStyle = '#000'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.floor(52 * sc)}px monospace`;
  ctx.fillText(playerWins >= WIN_ROUNDS ? 'VICTORY!' : 'DEFEAT', W / 2, H * 0.34);
  ctx.font = `bold ${Math.floor(18 * sc)}px monospace`;
  ctx.fillText(`FINAL SCORE: ${playerWins} — ${enemyWins}`, W / 2, H * 0.45);

  const diffLabel = difficulty.toUpperCase();
  ctx.fillStyle = difficulty === 'easy' ? '#16a34a' : (difficulty === 'hard' ? '#dc2626' : '#555555');
  ctx.font = `bold ${Math.floor(13 * sc)}px monospace`;
  ctx.fillText(`[ DIFFICULTY: ${diffLabel} ]`, W / 2, H * 0.52);

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
    if (player.hp > enemy.hp) { playerWins++; resultText = 'TIME OUT — PLAYER WINS!'; }
    else if (enemy.hp > player.hp) { enemyWins++; resultText = 'TIME OUT — CPU WINS!'; }
    else { resultText = 'ROUND DRAW!'; }
  } else if (pDead && !eDead) {
    enemyWins++;
    resultText = 'CPU WINS ROUND!';
  } else if (eDead && !pDead) {
    playerWins++;
    resultText = 'PLAYER WINS ROUND!';
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
      if (player.state === 'crouch' && (keys['KeyS'] || keys['ArrowDown'])) {
        // Player is intentionally holding crouch
      } else {
        if (player.state === 'crouch') player.state = 'idle';
        let mv = false;
        if (keys['KeyA'] || keys['ArrowLeft']) { player.move(-220 * dt); mv = true; }
        if (keys['KeyD'] || keys['ArrowRight']) { player.move(220 * dt); mv = true; }
        if (!mv && player.state === 'walk') player.state = 'idle';
      }
    }

    updateAI(dt);

    const dist = Math.abs(player.x - enemy.x);
    if (dist < PUSH_DIST) {
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
  if (roundBannerTimer > 0) drawRoundBanner();
  if (gameState === 'roundTransition') drawRoundTransition();
  if (gameState === 'roundEnd') drawRoundEnd();
  if (gameState === 'gameOver') drawGameOver();

  ctx.restore();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
