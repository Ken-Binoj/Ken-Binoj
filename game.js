// ═══════════════════════════════════════════════════════════
//  SHADOW FIGHT WEB  ·  game.js
//  LEFT CLICK: Punch  |  RIGHT CLICK: Kick
//  A/D: Move  |  W: Jump  |  S: Crouch  |  SHIFT: Block
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function resize() {
  canvas.width  = Math.min(window.innerWidth  - 20, 1000);
  canvas.height = Math.min(window.innerHeight - 40, 562);
}
resize();
window.addEventListener('resize', () => {
  resize();
  if (player) player.y = canvas.height * FLOOR_FRAC;
  if (enemy)  enemy.y  = canvas.height * FLOOR_FRAC;
});

const GRAVITY    = 1600;
const FLOOR_FRAC = 0.82;
const PUSH_DIST  = 55;
const DW         = 900;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd   = (a, b)    => a + Math.random() * (b - a);
const lerp  = (a, b, t) => a + (b - a) * t;

// ── Particles ───────────────────────────────────────────────
const particles = [];
function spawnParticles(x, y, n = 9) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(60, 230);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 100,
                     life: 1, decay: rnd(2.5, 4.5), r: rnd(2, 5) });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 500*dt; p.life -= p.decay*dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  ctx.fillStyle = '#000';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life) * 0.65;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
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
    this.isPlayer    = isPlayer;
    this.name        = name;
    this.x           = x;
    this.y           = canvas.height * FLOOR_FRAC;
    this.vy          = 0;
    this.facing      = isPlayer ? 1 : -1;
    this.onGround    = true;
    this.maxHp       = 100;
    this.hp          = 100;
    this.state       = 'idle';
    this.stateDur    = 0;
    this.stateElapsed = 0;
    this.atkCooldown  = 0;
    this.hitCooldown  = 0;
    this.stunTimer    = 0;
    this.blocking     = false;
    this.crouching    = false;
    this.walkCycle    = 0;
    this.comboCount   = 0;
    this.comboTimer   = 0;
    this.aiTimer      = 0;
    this.aiMoveX      = 0;
    this.landedShake  = false;
  }

  get sc()            { return canvas.width / DW; }
  get floor()         { return canvas.height * FLOOR_FRAC; }
  get stateProgress() { return this.stateDur > 0 ? this.stateElapsed / this.stateDur : 1; }

  move(dx) {
    if (this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt'].includes(this.state)) return;
    if (this.state === 'crouch') return;
    this.x = clamp(this.x + dx, 55, canvas.width - 55);
    if (Math.abs(dx) > 0.5 && this.onGround) this.state = 'walk';
  }

  jump() {
    if (!this.onGround || this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'crouch'].includes(this.state)) return;
    this.vy = -canvas.height * 0.9;
    this.onGround = false;
    this.state    = 'jump';
  }

  block(on) {
    if (this.state === 'dead' || this.state === 'knockdown') return;
    this.blocking = on;
    if (on && this.onGround && !['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'crouch'].includes(this.state)) this.state = 'block';
    if (!on && this.state === 'block') this.state = 'idle';
  }

  crouch(on) {
    if (this.state === 'dead' || this.state === 'knockdown') return;
    this.crouching = on;
    if (on && this.onGround && !['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'block'].includes(this.state)) this.state = 'crouch';
    if (!on && this.state === 'crouch') this.state = 'idle';
  }

  attack(type) {
    if (this.atkCooldown > 0 || this.stunTimer > 0 || this.state === 'dead' || this.state === 'knockdown') return;
    if (this.state === 'crouch' && type !== 'sweepKick') this.state = 'idle';
    let dur = 0.42;
    if (type === 'kick') dur = 0.54;
    else if (type === 'spartanKick') dur = 0.62;
    else if (type === 'sweepKick') dur = 0.52;
    else if (type === 'flipKick') {
      dur = 0.68;
      // Athletic acrobatic aerial lift & forward drive for Front Flip Axe Kick
      if (!this.onGround && this.vy > -240) this.vy = -canvas.height * 0.42;
      this.x = clamp(this.x + 30 * this.facing * this.sc, 55, canvas.width - 55);
    }
    this.state       = type;
    this.stateDur    = dur;
    this.stateElapsed = 0;
    this.atkCooldown = dur * 0.78;
  }

  takeHit(dmg, kbk, attacker) {
    if (this.state === 'dead' || this.state === 'knockdown') return false;
    if (this.blocking) {
      this.hp = Math.max(0, this.hp - Math.floor(dmg * 0.1));
      if (kbk > 150 * this.sc) {
        // Massive hits (like 4x Spartan kick) push through guard
        this.x = clamp(this.x + (kbk * 0.35) * attacker.facing, 55, canvas.width - 55);
      }
      shake(3, 0.10);
      return true;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.x  = clamp(this.x + kbk * attacker.facing, 55, canvas.width - 55);
    this.stunTimer    = 0.28;
    this.state        = 'hurt';
    this.stateDur     = 0.28;
    this.stateElapsed = 0;
    this.hitCooldown  = 0.55;
    spawnParticles(this.x, this.y - 90 * this.sc);
    shake(5, 0.15);
    if (this.hp <= 0) { this.state = 'dead'; this.vy = -canvas.height * 0.5; }
    return true;
  }

  knockdown(attacker, customDmg = 10) {
    if (this.state === 'dead' || this.state === 'knockdown') return;
    this.hp = Math.max(0, this.hp - customDmg);
    this.x  = clamp(this.x + 55 * attacker.facing, 55, canvas.width - 55);
    this.state        = 'knockdown';
    this.stateDur     = 1.65; // ~0.33s fall + ~1.0s grounded in sleeping position + ~0.32s get up
    this.stateElapsed = 0;
    this.hitCooldown  = 0.6;
    this.stunTimer    = 1.65;
    this.landedShake  = false;
    spawnParticles(this.x, this.floor - 40, 10);
    if (this.hp <= 0) { this.state = 'dead'; this.vy = -canvas.height * 0.5; }
  }

  update(dt, opp) {
    if (this.atkCooldown  > 0) this.atkCooldown  -= dt;
    if (this.hitCooldown  > 0) this.hitCooldown  -= dt;
    if (this.stunTimer    > 0) this.stunTimer     -= dt;
    if (this.comboTimer   > 0) this.comboTimer    -= dt; else this.comboCount = 0;

    // Ass slam shake trigger for knockdown fall
    if (this.state === 'knockdown') {
      const sp = this.stateProgress;
      if (sp >= 0.20 && !this.landedShake) {
        this.landedShake = true;
        shake(10, 0.24); // Screen shake on ass impact!
        spawnParticles(this.x - this.facing * 20, this.floor, 22); // Landing dust burst right where butt hits mat
      }
    }

    if (['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown'].includes(this.state)) {
      this.stateElapsed += dt;
      if (this.stateElapsed >= this.stateDur) {
        if (!this.onGround) {
          this.state = 'jump';
        } else if (this.crouching) {
          this.state = 'crouch';
        } else if (this.blocking) {
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

    if (this.state !== 'dead') {
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
    const LEG_H      = 80;
    const THIGH_L    = 44;
    const CALF_L     = 42;
    const TORSO_H    = 70;
    const U_ARM_L    = 32;   // upper arm
    const FORE_L     = 30;   // forearm
    const HEAD_R     = 22;
    const LIMB_W     = 13;
    const FOOT_W     = 20;
    const FOOT_H     = 9;
    const hipY       = -LEG_H;
    const shoulderY  = hipY - TORSO_H;   // = -150

    // Pose variables — all degrees, negative=forward
    let bodyDip  = 0;
    let bodyLean = 0;
    let charRot  = 0;
    let fThigh = -5, fCalf = 5;
    let bThigh =  8, bCalf = 5;
    // Double-jointed arms: upper arm (abs) + forearm (relative to upper arm)
    let fUpper = -35, fFore = 65;
    let bUpper = -15, bFore = 50;
    let fArmX = 0, fArmY = -TORSO_H + 6;
    let bArmX = 0, bArmY = -TORSO_H + 6;

    const idleBob = Math.sin(Date.now() * 0.0022) * 3;

    switch (this.state) {

      case 'idle':
        fThigh = -5;  fCalf = 5;   bThigh = 8;   bCalf = 5;
        // Fighter ready guard: hands held up near chest
        fUpper = -35; fFore = 65;
        bUpper = -15; bFore = 50;
        bodyDip = idleBob;
        break;

      case 'walk': {
        const wc = this.walkCycle;
        const sw = Math.sin(wc) * 32;
        fThigh = sw; fCalf = Math.max(0, sw) * 0.55 + 3;
        bThigh = -sw; bCalf = Math.max(0,-sw) * 0.55 + 3;
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
        const cosShoulder = (u*u + clampedD*clampedD - f*f) / (2 * u * clampedD);
        const sAngle = Math.acos(clamp(cosShoulder, -1, 1));
        const cosElbow = (u*u + f*f - clampedD*clampedD) / (2 * u * f);
        const eAngle = Math.acos(clamp(cosElbow, -1, 1));

        fUpper = -(90 - sAngle * 180 / Math.PI);
        fFore  = -(180 - eAngle * 180 / Math.PI);
        fArmX  = sShift;

        // Opposite arm pulled back to the waist/hip (Hikite):
        bUpper = bUp;
        bFore  = bFo;
        bArmX  = bShift;
        bArmY  = -TORSO_H + 10;

        bodyLean = pLean;
        bodyDip  = pDip;
        fThigh = -8; fCalf = 10;
        bThigh =  8; bCalf = 6;
        break;
      }

      case 'kick': {
        // Normal swing-up kick (Roundhouse / High Snap Kick)
        if (sp < 0.22) {
          const t = sp / 0.22;
          fThigh = lerp(-5,  22, t);  fCalf = lerp(5,  28, t);
          bodyLean = lerp(0, 6, t);
        } else if (sp < 0.62) {
          const t = (sp - 0.22) / 0.40;
          fThigh = lerp(22, -74, t);  fCalf = lerp(28, 0, t);
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
          fThigh   = lerp(-5, -92, t);    // high knee lift
          fCalf    = lerp( 5, 120, t);    // leg folded tight
          bThigh   = lerp( 8,   0, t);
          bCalf    = lerp( 5,  12, t);
          bodyLean = lerp( 0,  -8, t);
          bodyDip  = lerp( 0,  -4, t);
          fUpper   = lerp(-35, -45, t); fFore = lerp(65, 45, t);
          bUpper   = lerp(-15,  30, t); bFore = lerp(50, 20, t);
        } else if (sp < 0.52) {
          // 0.22 -> 0.52: Ferocious linear forward thrust + bend backwards!
          const t = (sp - 0.22) / 0.30;
          const ease = 1 - (1 - t) * (1 - t);
          fThigh   = lerp(-92, -88, ease); // straight horizontal kick
          fCalf    = lerp(120,   0, ease); // snaps completely straight!
          bThigh   = lerp(  0,  20, ease); // supporting leg drives forward
          bCalf    = lerp( 12,  12, ease);
          bodyLean = lerp( -8, -40, ease); // BENDS BACKWARDS DRAMATICALLY!
          bodyDip  = lerp( -4,   0, ease);
          fUpper   = lerp(-45,  50, ease); fFore = lerp(45, 20, ease);
          bUpper   = lerp( 30, -65, ease); bFore = lerp(20, 50, ease);
        } else if (sp < 0.70) {
          // 0.52 -> 0.70: Full Spartan extension hold
          fThigh   = -88;
          fCalf    = 0;
          bThigh   = 20;
          bCalf    = 12;
          bodyLean = -40; // BENT BACKWARDS
          bodyDip  = 0;
          fUpper   = 50;  fFore = 20;
          bUpper   = -65; bFore = 50;
        } else {
          // 0.70 -> 1.0: Powerful snap-back to stance
          const t = (sp - 0.70) / 0.30;
          const ease = t * t;
          fThigh   = lerp(-88, -5, ease);
          fCalf    = lerp(  0,  5, ease);
          bThigh   = lerp( 20,  8, ease);
          bCalf    = lerp( 12,  5, ease);
          bodyLean = lerp(-40,  0, ease);
          bodyDip  = 0;
          fUpper   = lerp( 50, -35, ease); fFore = lerp(20, 65, ease);
          bUpper   = lerp(-65, -15, ease); bFore = lerp(50, 50, ease);
        }
        break;
      }

      case 'sweepKick': {
        // Low Ground Sweep Kick (performed from crouch)
        // Stays low to the floor, braces hand on ground, sweeps leg flat at ankle level
        if (sp < 0.20) {
          // 0 -> 0.20: Drop low and coil sweep leg
          const t = sp / 0.20;
          bodyDip  = lerp(28, 42, t);
          bodyLean = lerp(-15, 12, t);
          fThigh   = lerp(-68, -45, t);
          fCalf    = lerp( 68,  55, t);
          bThigh   = lerp( 58,  72, t);
          bCalf    = lerp(-58, -72, t);
          fUpper   = lerp(-18, -45, t);
          fFore    = lerp( 32,  30, t);
          fArmY    = -TORSO_H + 16;
        } else if (sp < 0.58) {
          // 0.20 -> 0.58: Sweeping leg shoots straight across the floor!
          const t = (sp - 0.20) / 0.38;
          const ease = 1 - (1 - t) * (1 - t);
          bodyDip  = 44;
          bodyLean = lerp(12, 18, ease);
          fThigh   = lerp(-45, -88, ease);
          fCalf    = lerp( 55,   0, ease);
          bThigh   = 74;
          bCalf    = -74;
          fUpper   = -50;
          fFore    = 35;
          fArmY    = -TORSO_H + 20; // hand braced on ground
          bUpper   = 20;
          bFore    = 30;
        } else if (sp < 0.74) {
          // 0.58 -> 0.74: Full sweep follow-through along the ground
          bodyDip  = 44;
          bodyLean = 18;
          fThigh   = -88;
          fCalf    = 0;
          bThigh   = 74;
          bCalf    = -74;
          fUpper   = -50;
          fFore    = 35;
          fArmY    = -TORSO_H + 20;
          bUpper   = 20;
          bFore    = 30;
        } else {
          // 0.74 -> 1.0: Recover back up to crouch stance
          const t = (sp - 0.74) / 0.26;
          const ease = t * t;
          bodyDip  = lerp(44, 28, ease);
          bodyLean = lerp(18, -15, ease);
          fThigh   = lerp(-88, -68, ease);
          fCalf    = lerp(  0,  68, ease);
          bThigh   = lerp( 74,  58, ease);
          bCalf    = lerp(-74, -58, ease);
          fUpper   = lerp(-50, -18, ease);
          fFore    = lerp( 35,  32, ease);
          fArmY    = -TORSO_H + 6;
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
          fThigh   = lerp(-10, -80, t);       // chambering knees high
          fCalf    = lerp(10, 85, t);
          bThigh   = lerp(10, -50, t);
          bCalf    = lerp(10, 80, t);
          fUpper   = lerp(-35, -80, t);       // arms driving forward flip rotation
          fFore    = lerp(65, 30, t);
          bUpper   = lerp(-15, -70, t);
          bFore    = lerp(50, 30, t);
        } else if (sp < 0.55) {
          // 108° -> 198°: Inversion & high chamber of the axe blade
          const t = (sp - 0.30) / 0.25;
          bodyLean = lerp(25, -5, t);
          fThigh   = lerp(-80, -100, t);      // kicking leg raises and uncoils
          fCalf    = lerp(85, 10, t);
          bThigh   = lerp(-50, 35, t);        // supporting leg tucked
          bCalf    = lerp(80, 75, t);
          fUpper   = lerp(-80, 35, t);
          fFore    = lerp(30, 20, t);
          bUpper   = lerp(-70, -50, t);
          bFore    = lerp(30, 40, t);
        } else if (sp < 0.68) {
          // 198° -> 245° (PEAK AT 220°): DEVASTATING DOWNWARD AXE KICK!
          // Leg snaps completely straight like a guillotine axe blade!
          fThigh   = -105;                    // locked straight, slicing downward
          fCalf    = 0;                       // fully extended axe blade
          bThigh   = 45;                      // supporting leg tucked
          bCalf    = 85;
          bodyLean = -10;
          fUpper   = 40;  fFore = 20;         // arms spread for balance
          bUpper   = -60; bFore = 35;
        } else {
          // 245° -> 360°: Follow-through and landing tuck onto feet
          const t = (sp - 0.68) / 0.32;
          bodyLean = lerp(-10, 0, t);
          fThigh   = lerp(-105, -15, t);
          fCalf    = lerp(0, 30, t);
          bThigh   = lerp(45, 5, t);
          bCalf    = lerp(85, 20, t);
          fUpper   = lerp(40, -35, t);
          fFore    = lerp(20, 65, t);
          bUpper   = lerp(-60, -15, t);
          bFore    = lerp(35, 50, t);
        }
        break;
      }

      case 'crouch':
        bodyDip  = 28;
        bodyLean = -15;
        fThigh = -68; fCalf = 68;
        bThigh =  58; bCalf = -58;
        fUpper = -18; fFore = 32;
        bUpper =  14; bFore = 20;
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
          bodyDip  = lerp(0, 42, ease);        // dropping toward floor
          fThigh   = lerp(-5, -125, ease);     // lead leg flies straight UP!
          fCalf    = lerp(5, 20, ease);
          bThigh   = lerp(8, -105, ease);      // back leg also swept high!
          bCalf    = lerp(5, 25, ease);
          // Arms flail backward to break fall
          fUpper   = lerp(-35, -75, ease);
          fFore    = lerp(65, 25, ease);
          bUpper   = lerp(-15, -60, ease);
          bFore    = lerp(50, 20, ease);
        } else if (sp < 0.34) {
          // Phase 2: SLAMS HARD ON ASS! Impact rebounds legs high into air
          const t = (sp - 0.20) / 0.14;
          bodyLean = lerp(-52, -80, t);        // torso rocking back from ass impact
          bodyDip  = lerp(42, 58, t);          // ass firmly on the mat!
          // Legs kick up to max vertical height at impact
          fThigh   = lerp(-125, -135, Math.sin(t * Math.PI)); // peaks up in the air!
          fCalf    = lerp(20, 28, t);
          bThigh   = lerp(-105, -118, Math.sin(t * Math.PI));
          bCalf    = lerp(25, 30, t);
          // Hands slapping the mat / floor
          fUpper   = lerp(-75, 12, t);
          fFore    = lerp(25, 15, t);
          bUpper   = lerp(-60, 10, t);
          bFore    = lerp(20, 15, t);
        } else if (sp < 0.80) {
          // Phase 3: RELAXED SLEEPING POSITION FLAT ON BACK (~1 full sec grounded)
          const t = Math.min(1, (sp - 0.34) / 0.10); // smooth settle into sleeping pose
          bodyLean = lerp(-80, -90, t);        // torso flat on back (horizontal along floor)
          bodyDip  = 58;                       // head, torso & hips resting on floor

          // Legs settle down from air and lie relaxed along the floor
          fThigh   = lerp(-135, -76, t);       // lead leg extended along floor
          fCalf    = lerp(20, -10, t);         // knee slightly relaxed, heel on floor
          bThigh   = lerp(-118, -70, t);       // back leg resting beside it
          bCalf    = lerp(25, -8, t);

          // Subtle sleeping breathing rhythm
          const breathe = Math.sin((sp - 0.34) * 14) * 2;

          // Arms resting in natural sleeping pose
          // Front arm resting folded comfortably across the abdomen / chest
          fUpper   = 28 + breathe;
          fFore    = 80 - breathe;
          // Back arm resting relaxed along the side on the floor
          bUpper   = 8;
          bFore    = 10;
        } else {
          // Phase 4: WAKING UP & STANDING BACK UP onto feet
          const t = (sp - 0.80) / 0.20;
          const ease = t * (2 - t);            // smooth ease out
          bodyLean = lerp(-90, 0, ease);       // rising from back to upright
          bodyDip  = lerp(58, 0, ease);        // hips rising from floor
          // Legs tucking in and planting feet firmly on ground
          fThigh   = lerp(-76, -5, ease);
          fCalf    = lerp(-10, 5, ease);
          bThigh   = lerp(-70, 8, ease);
          bCalf    = lerp(-8, 5, ease);
          // Pushing up with hands and returning to guard stance
          fUpper   = lerp(28, -35, ease);
          fFore    = lerp(80, 65, ease);
          bUpper   = lerp(8, -15, ease);
          bFore    = lerp(10, 50, ease);
        }
        break;
      }

      case 'block':
        // Boxer high guard: both hands raised tight right in front of the face
        fThigh = -12; fCalf = 16;
        bThigh =  10; bCalf =  8;
        bodyLean = -6;     // tucked chin, head down
        bodyDip  =  4;     // solid boxer stance

        // Front arm (guards face & nose):
        fUpper = -98;      // upper arm points forward & slightly up
        fFore  = -116;     // forearm angles up-back: fist directly in front of face/eyes!
        fArmX  =  8;
        fArmY  = -TORSO_H + 2;

        // Back arm (guards cheek & jaw):
        bUpper = -92;
        bFore  = -118;
        bArmX  = -4;
        bArmY  = -TORSO_H + 4;
        break;

      case 'hurt': {
        const t = 1 - sp;
        bodyLean = 18 * t; bodyDip = 8 * t;
        fThigh = lerp(-5,  18, t); fCalf = lerp(5, 5, t);
        bThigh = lerp( 8, -15, t); bCalf = lerp(5, 5, t);
        fUpper = lerp(-35, 35, t); fFore = lerp(65, 25, t);
        bUpper = lerp(-15, 28, t); bFore = lerp(50, 18, t);
        break;
      }

      case 'dead':
        ctx.globalAlpha = 0.35;
        bodyLean = -90;
        bodyDip  = 58;
        fThigh = -76; fCalf = -10;
        bThigh = -70; bCalf = -8;
        fUpper = 28;  fFore = 80;
        bUpper = 8;   bFore = 10;
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

    // 1) Back leg
    this._leg(-4, hipY, bThigh, bCalf, THIGH_L, CALF_L, LIMB_W, FOOT_W, FOOT_H, '#333');

    // 2) Torso block (torso + head + both double-jointed arms, all lean together)
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(bodyLean * Math.PI / 180);

    // back arm (behind torso)
    this._arm(bArmX, bArmY, bUpper, bFore, U_ARM_L, FORE_L, LIMB_W, '#333');

    // torso
    ctx.fillStyle = '#000';
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
    this._arm(fArmX, fArmY, fUpper, fFore, U_ARM_L, FORE_L, LIMB_W, '#000');

    ctx.restore(); // end torso+lean

    // 3) Front leg
    this._leg(4, hipY, fThigh, fCalf, THIGH_L, CALF_L, LIMB_W, FOOT_W, FOOT_H, '#000');

    ctx.restore(); // end character space
    ctx.globalAlpha = 1;

    // 4) Combo badge (screen space, no health bar)
    if (this.comboCount >= 2) this._comboBadge(sc);
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
    ctx.beginPath(); ctx.roundRect(-w/2, 0, w, uLen, w/2); ctx.fill();
    // elbow joint
    ctx.beginPath(); ctx.arc(0, uLen, w * 0.6, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, uLen);
    ctx.rotate(foreA * Math.PI / 180); // relative to upper arm
    // forearm
    ctx.beginPath(); ctx.roundRect(-w/2, 0, w, fLen, w/2); ctx.fill();
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
    ctx.beginPath(); ctx.roundRect(-w/2, 0, w, tLen, w/2); ctx.fill();
    // knee joint
    ctx.beginPath(); ctx.arc(0, tLen, w * 0.6, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, tLen);
    ctx.rotate(calfA * Math.PI / 180);
    ctx.beginPath(); ctx.roundRect(-w/2, 0, w, cLen, w/2); ctx.fill();
    ctx.translate(0, cLen);
    ctx.beginPath(); ctx.roundRect(-w/2, -fh/2, fw, fh, fh/2); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ── Combo badge (above fighter, no health bar) ──────────
  _comboBadge(sc) {
    const sx = this.x, sy = this.y;
    ctx.textAlign = 'center';
    ctx.font = `bold ${13*sc}px monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText(`COMBO ×${this.comboCount}`, sx, sy - 220*sc);
  }
}

// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════
let gameState = 'menu';
let playerWins = 0, enemyWins = 0;
const WIN_ROUNDS = 2;
let roundTimer = 99, roundTimerAcc = 0;
let countdown = 3, countdownTimer = 0;
let roundNum = 1, resultText = '';
let player, enemy;

function initRound() {
  player = new Fighter(canvas.width * 0.25, true,  'PLAYER');
  enemy  = new Fighter(canvas.width * 0.75, false, 'CPU');
  roundTimer = 99; roundTimerAcc = 0;
  countdown = 3; countdownTimer = 1;
  gameState = 'countdown';
  particles.length = 0;
  keys = {};
}

// ── Input ────────────────────────────────────────────────────
let keys = {};
document.addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (gameState === 'fight') {
    if (e.code === 'KeyW' || e.code === 'ArrowUp')       player.jump();
    if (e.code === 'KeyS' || e.code === 'ArrowDown')     player.crouch(true);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.block(true);
  }
  if (gameState === 'menu') { playerWins = 0; enemyWins = 0; roundNum = 1; initRound(); }
  if ((gameState === 'roundEnd' || gameState === 'gameOver') && e.code === 'Space') nextRound();
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (!player) return;
  if (e.code === 'KeyS' || e.code === 'ArrowDown')       player.crouch(false);
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.block(false);
});

// Mouse: left = punch, right = kick (or Spartan kick if moving towards enemy, or sweep kick if crouched, or flip kick in air)
canvas.addEventListener('mousedown', e => {
  if (gameState === 'fight') {
    if (e.button === 0) player.attack('punch');
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
  playerWins = 0; enemyWins = 0; roundNum = 1; initRound();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── AI (Tactical & Realistic) ──────────────────────────────
function updateAI(dt) {
  if (!enemy || gameState !== 'fight') return;
  if (enemy.state === 'knockdown') { enemy.aiMoveX = 0; return; }

  // Execute continuous movement
  if (enemy.aiMoveX !== 0) {
    enemy.move(enemy.aiMoveX * dt);
  } else if (enemy.state === 'walk') {
    enemy.state = 'idle';
  }

  enemy.aiTimer -= dt;
  if (enemy.aiTimer > 0) return;
  enemy.aiTimer = rnd(0.20, 0.45);
  if (player.state === 'dead') { enemy.aiMoveX = 0; return; }

  const dist = Math.abs(player.x - enemy.x);
  const dir  = player.x > enemy.x ? 1 : -1;

  // 1. RESPECT KNOCKDOWN: Don't attack invulnerable grounded player; space for wake-up
  if (player.state === 'knockdown') {
    if (dist > 135) enemy.aiMoveX = dir * 160;
    else if (dist < 105) enemy.aiMoveX = -dir * 120;
    else enemy.aiMoveX = 0;
    return;
  }

  // 2. ANTI-AIR: If player is jumping at AI, counter with air Front Flip Axe Kick or Spartan Kick!
  if (!player.onGround && dist < 190) {
    if (Math.random() < 0.50 && enemy.onGround) {
      enemy.jump();
      setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
    } else if (Math.random() < 0.45) {
      enemy.attack('spartanKick');
    }
    return;
  }

  // 3. REACTIVE DEFENSE (Occasional block when player attacks)
  const pAttacking = ['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick'].includes(player.state);
  if (pAttacking && dist < 180) {
    if (player.state === 'punch' && Math.random() < 0.40 && enemy.onGround) {
      // Duck under punches!
      enemy.crouch(true);
      setTimeout(() => enemy && enemy.crouch(false), rnd(250, 450));
      return;
    } else if (Math.random() < 0.35) {
      // Block incoming high attack
      enemy.block(true);
      setTimeout(() => enemy && enemy.block(false), rnd(250, 450));
      return;
    }
  }

  // 4. COUNTER CROUCH: If player is crouching, high punch will whiff! Use low sweep or Spartan kick
  if (player.state === 'crouch') {
    if (dist < 165) {
      enemy.attack(Math.random() < 0.60 ? 'sweepKick' : 'spartanKick');
    } else {
      enemy.aiMoveX = dir * 180;
    }
    return;
  }

  // 5. TACTICAL SPACING & ATTACK STRATEGY
  const roll = Math.random();

  if (dist > 220) {
    // Approach player
    enemy.aiMoveX = dir * 200;
  } else if (dist > 135 && dist <= 220) {
    // Spartan kick zone or jump-in front flip axe kick!
    if (roll < 0.40) {
      enemy.aiMoveX = dir * 150;
      setTimeout(() => { if (enemy) enemy.attack('spartanKick'); }, 100);
    } else if (roll < 0.65 && enemy.onGround) {
      enemy.jump();
      setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
    } else {
      enemy.aiMoveX = dir * 130;
    }
  } else if (dist < 80) {
    // Close range: mix up low sweep, quick punch, or back-step
    if (roll < 0.35) {
      enemy.attack('punch');
    } else if (roll < 0.65) {
      enemy.attack('sweepKick');
    } else {
      enemy.aiMoveX = -dir * 160;
    }
  } else {
    // Mid range mix-up
    enemy.aiMoveX = 0;
    if (roll < 0.12) {
      enemy.block(true);
      setTimeout(() => enemy && enemy.block(false), rnd(250, 400));
    } else if (roll < 0.45) {
      enemy.attack('punch');
    } else if (roll < 0.70) {
      enemy.attack(dist > 115 ? 'spartanKick' : 'kick');
    } else if (roll < 0.85 && enemy.onGround) {
      enemy.jump();
      setTimeout(() => { if (enemy && !enemy.onGround) enemy.attack('flipKick'); }, 140);
    } else {
      enemy.aiMoveX = (Math.random() < 0.5 ? 1 : -1) * 120;
    }
  }
}

// ── Hit detection ──────────────────────────────────────────
// Combo increments ONLY on confirmed hit
function checkHit(att, def) {
  if (!['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick'].includes(att.state)) return;
  if (att.hitCooldown > 0) return;
  if (def.state === 'knockdown' || def.state === 'dead') return; // Cannot hit grounded target
  const sp = att.stateProgress;
  const sc = canvas.width / DW;

  // Front Flip Axe Kick: damage specifically connects at 220° rotation!
  if (att.state === 'flipKick') {
    const rot = sp * 360;
    if (rot < 208 || rot > 236) return;
  } else {
    if (sp < 0.20 || sp > 0.85) return;
  }

  // Reach ranges:
  // - Normal punch: 132 * sc
  // - Normal kick: 152 * sc
  // - Spartan kick: 192 * sc (massive reach & 4x colossal knockback: 368px!)
  // - Sweep kick: 160 * sc (low ground sweep)
  // - Front Flip Axe Kick: 175 * sc (overhead axe slam at 220°, knocks down opponent!)
  let range = 132 * sc;
  let dmg   = 9;
  let kbk   = 44 * sc;

  if (att.state === 'kick') {
    range = 152 * sc;
    dmg   = 12;
    kbk   = 62 * sc;
  } else if (att.state === 'spartanKick') {
    range = 192 * sc;
    dmg   = 18;
    kbk   = 368 * sc; // 4X MASSIVE KNOCKBACK (was 92 * sc, now 368 * sc)!
  } else if (att.state === 'sweepKick') {
    range = 160 * sc;
    dmg   = 10;
    kbk   = 35 * sc;
  } else if (att.state === 'flipKick') {
    range = 175 * sc;
    dmg   = 18;
    kbk   = 55 * sc;
  }

  if (Math.abs(att.x - def.x) > range) return;
  if (att.facing * (def.x - att.x) < 0) return;

  // Crouching ducks under standing punches
  if (att.state === 'punch' && def.state === 'crouch') return;

  // Sweep kick special logic: trips unblocked opponents!
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
      shake(12, 0.28);
      spawnParticles(def.x, def.y - 70 * sc, 20);
      if (att.isPlayer) { att.comboCount++; att.comboTimer = 1.8; }
    }
    return;
  }

  // Spartan Kick colossal impact screen shake
  if (att.state === 'spartanKick') {
    shake(14, 0.32);
    spawnParticles(def.x, def.y - 75 * sc, 18);
  }

  if (def.takeHit(dmg, kbk, att)) {
    att.hitCooldown = 0.5;
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
  ctx.beginPath(); ctx.moveTo(0, H*FLOOR_FRAC); ctx.lineTo(W, H*FLOOR_FRAC); ctx.stroke();
  for (const f of [player, enemy].filter(Boolean)) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    if (f.state === 'knockdown' && f.stateProgress > 0.20 && f.stateProgress < 0.80) {
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
  const sc = W/DW, pad = 20, barW = W*0.33, barH = Math.max(14, 18*sc);

  // Player health
  ctx.fillStyle='#eee'; ctx.fillRect(pad,pad,barW,barH);
  ctx.fillStyle='#000'; ctx.fillRect(pad,pad,barW*(player.hp/player.maxHp),barH);
  ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.strokeRect(pad,pad,barW,barH);

  // Enemy health (right→left)
  const ex=W-pad-barW;
  ctx.fillStyle='#eee'; ctx.fillRect(ex,pad,barW,barH);
  const ef=barW*(enemy.hp/enemy.maxHp);
  ctx.fillStyle='#000'; ctx.fillRect(ex+barW-ef,pad,ef,barH);
  ctx.strokeStyle='#000'; ctx.strokeRect(ex,pad,barW,barH);

  // Names
  ctx.fillStyle='#000'; ctx.font=`bold ${Math.floor(12*sc)}px monospace`;
  ctx.textAlign='left';  ctx.fillText('PLAYER',pad,pad+barH+16*sc);
  ctx.textAlign='right'; ctx.fillText('CPU',W-pad,pad+barH+16*sc);

  // Win gems
  const gr=6*sc, gy=pad+barH+32*sc;
  for (let i=0;i<WIN_ROUNDS;i++) {
    ctx.fillStyle=i<playerWins?'#000':'#ccc';
    ctx.beginPath(); ctx.arc(pad+gr+i*20*sc,gy,gr,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=i<enemyWins?'#000':'#ccc';
    ctx.beginPath(); ctx.arc(W-pad-gr-i*20*sc,gy,gr,0,Math.PI*2); ctx.fill();
    ctx.stroke();
  }

  // Timer
  ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.font=`bold ${Math.floor(28*sc)}px monospace`;
  ctx.fillText(Math.ceil(roundTimer), W/2, pad+barH*0.9);
  ctx.font=`${Math.floor(11*sc)}px monospace`;
  ctx.fillText(`ROUND ${roundNum}`, W/2, pad+barH+16*sc);

  // Hint
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.font=`${Math.floor(10*sc)}px monospace`;
  ctx.fillText('L-CLICK: Punch  |  R-CLICK: Kick  |  AIR+R-CLICK: Front Flip Axe Kick  |  FWD+R-CLICK: Spartan Kick (4x KB)  |  S+R-CLICK: Sweep',W/2,H-10);
}

// ── Screens ─────────────────────────────────────────────────
function drawMenu() {
  const W=canvas.width, H=canvas.height, sc=W/DW;
  drawBackground();
  ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.font=`bold ${Math.floor(52*sc)}px monospace`; ctx.fillText('SHADOW FIGHT',W/2,H*0.26);
  ctx.font=`${Math.floor(14*sc)}px monospace`; ctx.fillText('WEB PROTOTYPE',W/2,H*0.35);
  ctx.fillStyle='#333'; ctx.font=`${Math.floor(12*sc)}px monospace`;
  ctx.fillText('L-CLICK: Karate Punch  |  R-CLICK: Kick  |  AIR + R-CLICK: Front Flip Axe Kick (Knocks Down at 220°!)',W/2,H*0.48);
  ctx.fillText('FORWARD + R-CLICK: Spartan Kick (Leans back, 4x colossal knockback!)',W/2,H*0.54);
  ctx.fillText('S (Crouch) + R-CLICK: Low Sweep Kick (Knocks enemy onto ass for 1s!)',W/2,H*0.60);
  ctx.fillText('A/D: Move  ·  W: Jump  ·  S: Crouch (Dodge punches)  ·  SHIFT: Boxer Block',W/2,H*0.66);
  ctx.globalAlpha=0.55+Math.sin(Date.now()*0.004)*0.45;
  ctx.fillStyle='#000'; ctx.font=`bold ${Math.floor(14*sc)}px monospace`;
  ctx.fillText('CLICK ANYWHERE OR PRESS ANY KEY TO START',W/2,H*0.82);
  ctx.globalAlpha=1;
}

function drawCountdown() {
  const W=canvas.width, H=canvas.height, sc=W/DW;
  ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.font=`bold ${Math.floor(70*sc)}px monospace`;
  ctx.fillText(countdown>0?countdown:'FIGHT!',W/2,H/2+20*sc);
}

function drawRoundEnd() {
  const W=canvas.width, H=canvas.height, sc=W/DW;
  ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.font=`bold ${Math.floor(42*sc)}px monospace`; ctx.fillText(resultText,W/2,H*0.4);
  ctx.fillStyle='#555'; ctx.font=`${Math.floor(13*sc)}px monospace`;
  ctx.fillText('SPACE or Click to continue',W/2,H*0.55);
}

function drawGameOver() {
  const W=canvas.width, H=canvas.height, sc=W/DW;
  ctx.fillStyle='#000'; ctx.textAlign='center';
  ctx.font=`bold ${Math.floor(52*sc)}px monospace`;
  ctx.fillText(playerWins>=WIN_ROUNDS?'YOU WIN!':'YOU LOSE',W/2,H*0.35);
  ctx.font=`${Math.floor(16*sc)}px monospace`;
  ctx.fillText(`${playerWins} — ${enemyWins}`,W/2,H*0.5);
  ctx.fillStyle='#555'; ctx.font=`${Math.floor(12*sc)}px monospace`;
  ctx.fillText('SPACE or Click to play again',W/2,H*0.65);
}

// ── Round logic ─────────────────────────────────────────────
function checkRoundEnd() {
  const pDead=player.hp<=0||player.state==='dead';
  const eDead=enemy.hp<=0||enemy.state==='dead';
  const timeout=roundTimer<=0;
  if (!pDead&&!eDead&&!timeout) return;
  gameState='roundEnd';
  if (timeout) {
    if (player.hp>enemy.hp) { playerWins++; resultText='TIME OUT — YOU WIN!'; }
    else if (enemy.hp>player.hp) { enemyWins++; resultText='TIME OUT — CPU WINS!'; }
    else resultText='DRAW!';
  } else if (pDead&&!eDead) { enemyWins++; resultText='CPU WINS!'; }
  else if (eDead&&!pDead)   { playerWins++; resultText='YOU WIN!'; }
  else                       { resultText='DOUBLE KO!'; }
  if (playerWins>=WIN_ROUNDS||enemyWins>=WIN_ROUNDS)
    setTimeout(()=>{ gameState='gameOver'; }, 2200);
}

function nextRound() {
  if (gameState==='gameOver') { playerWins=0; enemyWins=0; roundNum=1; }
  else roundNum++;
  initRound();
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  let sx=0, sy=0;
  if (shakeDur>0) { shakeDur-=dt; sx=(Math.random()-0.5)*shakeAmt*2; sy=(Math.random()-0.5)*shakeAmt*2; }
  ctx.save();
  ctx.translate(sx, sy);
  ctx.clearRect(-20,-20,canvas.width+40,canvas.height+40);

  if (gameState==='menu') { drawMenu(); ctx.restore(); requestAnimationFrame(loop); return; }

  if (gameState==='countdown') {
    drawBackground(); player.draw(); enemy.draw(); drawHUD();
    countdownTimer-=dt;
    if (countdownTimer<=0) { countdown--; if (countdown<0) gameState='fight'; else countdownTimer=1; }
    drawCountdown();
    ctx.restore(); requestAnimationFrame(loop); return;
  }

  if (gameState==='fight') {
    if (!['punch', 'kick', 'spartanKick', 'sweepKick', 'flipKick', 'hurt', 'knockdown', 'block', 'crouch'].includes(player.state)) {
      let mv=false;
      if (keys['KeyA']||keys['ArrowLeft'])  { player.move(-220*dt); mv=true; }
      if (keys['KeyD']||keys['ArrowRight']) { player.move( 220*dt); mv=true; }
      if (!mv&&player.state==='walk') player.state='idle';
    }

    updateAI(dt);

    const dist=Math.abs(player.x-enemy.x);
    if (dist<PUSH_DIST) {
      const push=(PUSH_DIST-dist)*0.5+1;
      if (player.x<enemy.x) { player.x-=push; enemy.x+=push; }
      else { player.x+=push; enemy.x-=push; }
      player.x=clamp(player.x,55,canvas.width-55);
      enemy.x=clamp(enemy.x,55,canvas.width-55);
    }

    player.update(dt,enemy); enemy.update(dt,player);
    checkHits();
    roundTimerAcc+=dt;
    if (roundTimerAcc>=1) { roundTimerAcc=0; roundTimer--; }
    checkRoundEnd();
  }

  drawBackground(); player.draw(); enemy.draw();
  updateParticles(dt); drawParticles();
  drawHUD();
  if (gameState==='roundEnd') drawRoundEnd();
  if (gameState==='gameOver') drawGameOver();

  ctx.restore();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
