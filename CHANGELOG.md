# 📜 Shadow Fight Web — Development & Changelog

This document tracks all features, mechanics, visual systems, and updates implemented in the game. Every subsequent modification is documented here.

---

## 🎮 Current Game Overview

**Shadow Fight Web** is a browser-based, high-performance 2D martial arts fighting game prototype inspired by *Shadow Fight 2*. Built using pure vanilla web technologies (HTML5 Canvas + JavaScript + CSS) with zero external libraries or asset dependencies.

### 📁 File Structure
- [`index.html`](file:///c:/Users/KEN/.gemini/antigravity-ide/scratch/Fight-html%20prototype/index.html) — Lightweight container shell hosting the Canvas viewport.
- [`style.css`](file:///c:/Users/KEN/.gemini/antigravity-ide/scratch/Fight-html%20prototype/style.css) — Clean minimalist white canvas styling, crisp black border, crosshair cursor.
- [`game.js`](file:///c:/Users/KEN/.gemini/antigravity-ide/scratch/Fight-html%20prototype/game.js) — Complete game loop, skeletal inverse kinematics, physics, animation state machines, collision detection, and AI systems.
- [`CHANGELOG.md`](file:///c:/Users/KEN/.gemini/antigravity-ide/scratch/Fight-html%20prototype/CHANGELOG.md) — Comprehensive development log and feature documentation.

---

## 🕹️ Controls Reference

| Action | Control | Description |
|---|---|---|
| **Karate Punch** | `Left Click` | Piston-straight horizontal jab/cross; opposite hand pulled back tight to the hip (**Hikite**). |
| **Low Crouch Punch** | `S (Crouch) + Left Click` | Straight low jab executed **while staying fully crouched**; ducks under high standing punches! |
| **Normal Kick** | `Right Click` (Stationary) | Upward sweeping round/snap kick targeting mid/high zones. |
| **Front Flip Axe Kick** | `Airborne + Right Click` | Aerial somersault kick; completes a **360° forward rotational flip** gliding toward enemy with downward axe kick. **Connects at 220° rotation & knocks down opponent!** |
| **Spartan Kick** | `Moving Forward + Right Click` | Ferocious linear chest thrust kick; fighter **bends backward** dramatically (`-40°`); extended reach (`192px`) & **4x colossal knockback (`368px`) with smooth sliding physics!** |
| **Low Sweep Kick** | `Crouch (S) + Right Click` | Ground-level sweep with hand planted on floor. **Trips unblocked opponents onto their ass with screen shake!** |
| **Crouch** | `S` or `Down Arrow` | Drops into a low martial arts crouch. **Passively ducks under all standing punches!** |
| **Boxer High Guard Block** | `Left Shift` / `Shift` | Raises both fists and forearms tightly in front of the chin, nose, and eyes (peek-a-boo guard). Absorbs 90% of incoming damage and prevents sweep knockdowns. |
| **Move Left / Right** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with automatic walk cycle animation. |
| **Dash Move** | `Double-Tap A` / `D` or `←` / `→` | Explosive directional burst propelling character **`184px` (exactly half of Spartan kick knockback!)** with shadow afterimages. |
| **Jump** | `W` or `Up Arrow` | Aerial leap with parabolic gravity physics. |
| **Pause & Move Consequences** | `P` or `Escape` | Pauses match and opens full Move List modal with damage values and tactical consequences. Press P/ESC or click to resume. |

---

## 📝 Detailed Chronological Changelog

### Version 1.7.1 — In-Game Pause Menu & Enhanced AI Aggression Overhaul (Current)
- **Interactive In-Game Pause Menu (`P` or `Escape`)**:
  - Pressing `P` or `Escape` during combat immediately halts the game, freezing character physics, movement, particle decay, and the round timer.
  - Renders a clean, high-contrast modal dialog over the frozen arena with zero external libraries.
  - **Comprehensive Move List & Combat Consequences**:
    - **Karate Straight Punch** (`L-Click`): 9 DMG · Direct linear piston strike with Hikite waist chambering. Fast recovery & combo starter. Whiffs completely if target crouches!
    - **Low Crouch Punch** (`S + L-Click`): 9 DMG · Low Gedan Tsuki jab executed while staying crouched. Ducks under high punches while striking midsection.
    - **Snap Kick** (`R-Click Neutral`): 12 DMG · High snap thrust kick with 152px reach. Excellent mid-range spacing and poke tool to halt advances.
    - **Spartan Kick** (`Forward + R-Click`): 18 DMG · Torso leans back -40° and unleashes linear foot thrust. 4X COLOSSAL KNOCKBACK (368px) into arena walls!
    - **Front Flip Axe Kick** (`Airborne + R-Click`): 18 DMG · 360° forward aerial flip; chops down at 220° rotation. Glides forward & KNOCKS FOE FLAT ON BACK for 1s!
    - **Low Sweep Kick** (`S + R-Click`): 10 DMG · Low ground sweep with grounded hand plant. Ignores high guard! TRIPS enemy onto back for 1s.
    - **Tactical Dash Move** (`Double-Tap A / D`): MOBILITY · Rapid burst propulsion (184px, half Spartan knockback). Shadow afterimages. Cancelable directly into any attack!
    - **Boxer High Guard** (`Hold Shift`): DEFENSE · Peek-a-boo face guard absorbs 90% incoming damage. Mitigates knockback slide. Vulnerable to low sweep kicks!
    - **Martial Arts Crouch** (`Hold S / Down`): DEFENSE · Low ducking stance lower than punch height. Passively evades all standing punches and high snap kicks.
    - **Combat Tactics & Okizeme**: Explains how standing guards block high attacks, crouch blocks defend against low sweeps, and enraged CPU behaviors.
  - **Seamless Resume**: Pressing `P`, `Escape`, or clicking anywhere on screen smoothly unpauses with delta-time synchronization (`lastTime = performance.now()`), avoiding any physics jump.

- **Baseline Smart Tactical AI (Always Active at All Health Levels)**:
  - The CPU no longer waits until below 50% HP to employ smart martial arts tactics; high-level fighting sense is now **always active by default**:
    - **Reactive High Block**: Consistently guards incoming attacks with a 78% block rate.
    - **Anti-Punch Ducking**: Automatically crouches to duck underneath standing high punches with 50% probability.
    - **Evasive Backdash**: Proactively utilizes backdashes (`dash(-dir)`) when pressurized at close range or facing strikes.
    - **Counter-Crouching**: Readies low sweep kicks and low crouch punches whenever the opponent ducks.
    - **Anti-Air Counters**: High-guards or counters jump-ins with aerial Front Flip Axe Kicks or Spartan Kicks.

- **Aggressive Enraged AI Mode (Active Below 50% HP)**:
  - When CPU health falls below 50% (`enemy.hp < enemy.maxHp * 0.5`), the AI enters a relentless **Aggressive Mode**:
    - **High APM & Fast Reactions**: Decision timer drops from `0.16-0.32s` to `0.07-0.15s`, chaining actions rapidly.
    - **Elevated Chase Speed**: Sprint velocity increases to `270px/s`, maintaining constant forward pursuit.
    - **Offensive Forward Dashes**: 70% chance at mid-range to dash forward (`dash(dir)`) directly into strike range and immediately chain into Spartan Kick, Front Flip Axe Kick, or jab combinations.
    - **Relentless Close-Range Pressure**: Instead of retreating, constantly bombards the player with rapid punches, crouch jabs, sweep kicks, and Spartan kicks.
    - **Wake-up Pressure (Okizeme)**: Instead of respecting knockdown distance, the aggressive AI rushes directly into point-blank range (`75-95px`) and buffers attacks to strike the instant the player stands up.

---

### Version 1.7.0 — Tactical Dash Move & Low-Health Enemy AI Behavior
- **New Move — Directional Dash (`Double-Tap A / D` or `← / →`)**:
  - Tapping left or right twice within `280ms` triggers an explosive tactical dash burst in that direction (`dur = 0.20s`).
  - **Propulsion Distance**: Propels character **`184 * sc` pixels** — exactly **half the distance of the Spartan Kick knockback** (`368 * sc`)!
  - **Sleek Aerodynamic Posing**:
    - **Forward Dash**: Low ninja sprint lean (`bodyLean = -26°`, `bodyDip = 16`, lead knee driving forward).
    - **Backdash**: Evasive martial arts back-hop (`bodyLean = 16°`, `bodyDip = 10`).
  - **Shadow Afterimages & Dust**: Renders fading shadow afterimages trailing behind the character along with footstep dust bursts.
  - **Attack-Cancelable**: Can immediately cancel the dash into attacks (dash punch, dash Spartan kick, dash sweep).
- **New Enemy AI Behavior (Low-Health Rage & Defense Mode)**:
  - When CPU health drops **below 50% (`enemy.hp < enemy.maxHp * 0.5`)**:
    - **Heavy Guarding / Turtle Mode**: Blocks incoming high attacks with **82% probability** (up from 35%) and holds the guard longer (`400-650ms`).
    - **Proactive Close-Range Block**: Blocks 45% of the time at close quarters, absorbing player pressure.
    - **Frequent Tactical Dashing**:
      - **Evasive Backdash**: When player approaches or attacks at close range, CPU frequently backdashes (`dash(-dir)`) to reset to neutral.
      - **Sudden Dash-In Punish**: Mid-range gap-closer dash (`dash(dir)`) followed by a rapid Spartan kick or punch.

---

### Version 1.6.1 — Animated Knockback Physics, Aerial Flip Glide & Crouch Punch
- **Smooth Animated Knockback Physics (Zero Teleportation)**:
  - Replaced all instant `x` position snaps with a smooth physics-based deceleration slide (`kbVx` and `kbDecel`).
  - Knockback slide duration dynamically scales with hit severity (`0.28s` up to `0.52s` for the 4x Spartan kick).
  - **Skid Dust Clouds**: As the opponent slides across the floor, their dragging heels kick up realistic dust particle clouds.
  - **Perimeter Wall Collision**: If knockback reaches the arena boundary (`55px` or `W - 55px`), the opponent impacts the wall with a firm thud sound/shake (`shake(6, 0.14)`) and wall impact dust.
- **Front Flip Axe Kick Forward Aerial Propulsion**:
  - The attacker now automatically propels smoothly forward through the air toward the opponent (`forwardSpeed = 200 * sc`) during the first 70% of the somersault.
  - Ensures the descending 220° axe kick lands squarely upon the opponent from mid-range.
- **Crouch Punch (`S + Left Click`)**:
  - Punching while crouching now executes a dedicated low straight punch (`crouchPunch`) **without standing up**.
  - Fighter maintains a deep, grounded martial arts crouch (`bodyDip = 28`, `fThigh = -68°`, `fCalf = 68°`).
  - **Duck Under Standing Punches**: Because the fighter stays low throughout the strike, opponent standing punches whiff harmlessly overhead.
  - Includes IK straight-line arm extension and opposite-hand Hikite at the hip.
  - Seamlessly returns to crouch stance if `S` is held.

---

### Version 1.6.0 — Front Flip Axe Kick & 4x Spartan Knockback
- **Front Flip Axe Kick Overhaul (`flipKick`)**:
  - Replaced the backward somersault with a **forward somersault (Front Flip)** rotating clockwise 360° (`charRot = sp * 360°`).
  - **Devastating Axe Kick Mechanics**:
    - **0° -> 108° (`sp < 0.30`)**: Fighter tucks knees and curls into forward roll launch with forward rotational momentum.
    - **108° -> 198° (`0.30 <= sp < 0.55`)**: Fighter inverts upside-down; kicking leg chambers high above hips.
    - **198° -> 245° (`0.55 <= sp < 0.68`)**: Kicking leg locks completely straight into a razor-sharp axe blade (`fThigh = -105°`, `fCalf = 0°`), chopping downward with immense torque.
    - **Exact 220° Rotation Hit Window**: Damage and knockdown connect precisely when the attacker reaches **220° rotation** (`rot >= 208° && rot <= 236°`), right at peak downward axe extension!
    - **245° -> 360° (`sp >= 0.68`)**: Downward follow-through and clean 2-point landing reset onto both feet.
  - **Downwards Axe Slam Causes Hard Knockdown**:
    - When unblocked, Front Flip Kick now triggers `def.knockdown(att, 18)`!
    - The opponent is slammed onto their rear and rolls into the peaceful flat-on-back sleeping position for 1 second.
    - Heavy impact screen shake (`shake(12, 0.28)`) and high-impact particle burst.
- **Spartan Kick 4x Massive Knockback**:
  - Increased knockback force from `92 * sc` to **`368 * sc` (4x increase)**!
  - Unblocked Spartan Kicks now rocket opponents across the entire width of the arena into the perimeter boundary.
  - Enhanced camera screen shake (`shake(14, 0.32)`) and chest impact dust burst (`spawnParticles`).
  - Heavy strike pushback through block: even when guarded with Boxer Block, the 4x Spartan kick pushes opponents backward by `~128px`.

---

### Version 1.5.2 — Knockdown Sleeping Position Overhaul
- **Natural Sleeping Position Flat on Back**:
  - **Backward Fall Alignment**: Corrected torso lean from positive (which bent forward face-down) to negative (`bodyLean = -90°`), ensuring the fallen fighter lies completely flat on their back.
  - **Ground Height Alignment (`bodyDip = 58`)**: Recalculated hip and head offsets so the back of the head, neck, torso, and buttocks rest naturally on top of the mat line with zero clipping below the floor.
  - **Legs Flat Along Ground (Subterranean Clipping Fix)**:
    - Fixed thighs pointing straight down underground (`0°`).
    - Legs now extend forward along the floor (`fThigh = -76°`, `fCalf = -10°`, `bThigh = -70°`, `bCalf = -8°`) with heels resting directly on the floor line.
  - **Sleeping Arms & Breathing Motion**:
    - Front arm folds comfortably across the chest/abdomen (`fUpper = 28°`, `fFore = 80°`) with subtle chest rise-and-fall breathing (`breathe = sin(...) * 2`).
    - Rear arm rests relaxed along the floor beside the body (`bUpper = 8°`, `bFore = 10°`).
  - **Horizontal Sleeping Eye Slit**:
    - Recalculated eye coordinate mapping in rotated torso space (`(11, headCY - 4)` to `(11, headCY + 3)`) so closed eyes render as a crisp, peaceful horizontal white line parallel to the ground.
  - **Butt Slam Screen Shake & Impact Dust**:
    - Butt slam triggers at `sp = 0.20` with enhanced camera impact shake (`shake(10, 0.24)`) and landing dust burst right where the rear impacts the floor (`x - facing * 20`).
  - **Elongated Ground Shadow**:
    - Ground shadow dynamically expands to an elongated ellipse (`58px`) while lying flat to cradle the full silhouette.
  - **True 1-Second Grounded Duration**:
    - Knockdown state duration tuned to `1.65s` (~0.33s sweep & flight, ~1.0s grounded in sleeping pose, ~0.32s wake-up push).

---

### Version 1.5.1 — Fixes & Combat Tuning
- **Fixed Canvas Upside-Down Inversion**:
  - The aerial backflip somersault rotation (`charRot = -sp * 360°`) is now strictly contained within isolated character space (`ctx.save()` / `ctx.restore()`).
  - Completely resolved the canvas bug where the entire screen would flip upside down during mid-air kicks.
- **Fixed Low Sweep Knockdown & Fall Triggers**:
  - Standing Boxer Block (`Left Shift`) no longer blocks low Sweep Kicks (`isLowBlocked = def.blocking && def.crouching`).
  - Sweep kicks now reliably trip standing opponents into the dramatic 4-phase knockdown animation (legs fly up -> butt slam with screen shake -> 1-second sleeping position on floor -> wake up).
- **Tuned AI Reaction Fairness**:
  - Removed frame-0 psychic auto-blocking from AI logic. AI now makes realistic, human-timed combat decisions instead of instantly blocking sweeps.

---

### Version 1.5 — Aerial Backflip, Smarter AI & Improved Fall Dynamics
- **Aerial Backflip Kick (`flipKick`)**:
  - Activated by pressing `Right Click` while airborne (in mid-air jump).
  - Character executes a full **360° reverse rotational somersault** in mid-air (`flipAngle = -sp * 360°`).
  - At peak rotation, the kicking leg snaps straight overhead with vertical whipping torque (`fThigh = -115°`, `fCalf = 0°`).
  - **Extra Heavy Knockback**: Implemented the highest knockback in the game (`110 * sc`), sending airborne or standing opponents flying across the canvas.
  - High impact screen shake (`shake(10, 0.25)`) and extra damage (`18`).
- **Tactical & Reactive Enemy AI Overhaul**:
  - **Reactive Defense**: AI reads incoming attacks in real time:
    - If player uses a low Sweep Kick, AI reactively blocks high guard or jumps to evade.
    - If player uses a standing Punch, AI reactively crouches to duck underneath or raises block.
    - If player uses Spartan Kick or high kicks, AI blocks.
  - **Anti-Air Countering**: If player leaps towards AI, AI jumps to meet player in mid-air with a Backflip Kick or times a Spartan Kick as player lands.
  - **Whiff Punish**: If player whiffs an attack just out of range, AI recognizes the recovery window and immediately punishes with a Spartan Kick or punch.
  - **Knockdown Respect**: AI ceases attacking grounded opponents and spaces to optimal range (`~120px`) to prepare wake-up mixups.
  - **Low-High Mixups**: AI alternates between low sweeps and Spartan kicks against guarding players.
- **Improved Knockdown Fall & Sleeping Position**:
  - **Phase 1 (The Sweep & Flight)**: Legs fly straight **UP into the air** (`-118°` and `-102°`) as feet are swept out.
  - **Phase 2 (The Butt Slam & Screen Shake)**: Enemy slams **hard on their ass** on the floor (`bodyDip = 74`), triggering a dedicated **camera screen shake (`9px, 0.22s`)** and ground dust burst.
  - **Phase 3 (Sleeping Position)**: Enemy rolls backward flat onto the floor into a relaxed sleeping position for 1 full second; eye rendering shifts to a sleeping closed slit (`-`).
  - **Phase 4 (Recovery)**: Character pushes off the floor with hands, brings knees under, and stands smoothly back onto their feet.

---

### Version 1.4 — The Spartan & Sweep Update
- **Spartan Kick Implemented**:
  - Activated by holding the forward movement key (`D` if facing right, `A` if facing left) and pressing `Right Click`.
  - Fighter drives their knee high to the chest and fires an explosive linear thrust directly into the opponent's solar plexus.
  - Features the iconic **dramatic backward torso bend** (`bodyLean = -40°`), supporting leg drive, and wide counter-balancing arms.
  - Spartan Kick stats: extended reach (`192px`), maximum knockback (`92px`), heavy screen shake (`8px, 0.22s`).
- **Low Sweep Kick Implemented**:
  - Activated by pressing `Right Click` while holding `S` (crouch).
  - Fighter drops flat to the floor (`bodyDip = 44px`), plants their lead hand on the ground for balance, and sweeps their fully extended leg flat along the floor at ankle level.
- **Knockdown & 1-Second Recovery System**:
  - When an unblocked Sweep Kick connects, the opponent is swept off their feet into the `knockdown` state.
  - Grounded targets are completely immune to high punches while lying down.
  - Blocking with `Left Shift` successfully guards against the sweep kick and prevents falling.
- **Karate Punch Hikite Integration**:
  - During the straight punch, the opposite (rear) arm is pulled back firmly against the ribs/hip above the belt with the elbow angled backward (**Hikite / 引き手**).
  - Front fist pistons straight forward via 2-bone Inverse Kinematics (no circular windmill swinging).
- **Reach Rebalancing**:
  - Normal Punch reach tuned to `132px`.
  - Normal Kick reach tuned to `152px`.
  - Spartan Kick reach set to `192px`.
  - Sweep Kick reach set to `160px`.
- **Project Logging System Initialized**:
  - Created `CHANGELOG.md` with full architectural and mechanical history.

---

### Version 1.3 — Boxer High Guard & Dual-Jointed Arms
- **Double-Jointed Arms Architecture**:
  - Upgraded character skeletal rig to include upper arms, elbow joints, forearms, and fists for both front and back arms.
- **Boxer High Guard Block**:
  - Pressing `Left Shift` causes the fighter to raise both forearms and fists vertically in front of the chin, nose, and eyes in a classic boxing peek-a-boo guard.
  - Tucks the chin and lowers head height slightly (`bodyLean: -6°`, `bodyDip: 4px`).
- **Linear Piston Punch**:
  - Removed circular shoulder swing in favor of a straight horizontal piston jab/cross.
- **Crouch Ducking Mechanics**:
  - Bound `S` to a low martial arts crouch.
  - Standing punches automatically whiff over crouching targets.
- **Hit-Confirmed Combos**:
  - Combo counter only increments when an attack physically lands on the opponent.
- **UI Cleanup**:
  - Removed floating overhead health bars; retained only top-screen HUD health bars.

---

### Version 1.2 — Architecture Decoupling & Minimalist Aesthetic
- **Code Separation**:
  - Decoupled single-file prototype into clean, modular files: `index.html`, `style.css`, and `game.js`.
- **Pure Black-and-White Art Direction**:
  - Replaced temporary colored background with a stark white arena, black floor line, and solid black silhouette fighters.
- **Mouse Combat Mapping**:
  - Left Click mapped to Punch; Right Click mapped to Kick.
- **Upgraded Multi-Phase Kick Animation**:
  - 4-phase kick: chamber, explosive extension, hold impact frame, and snappy retraction.

---

### Version 1.1 — Core Mechanics & AI Opponent
- **Best-of-3 Round System**:
  - Round countdown (`3, 2, 1, FIGHT!`), 99-second round timer, win gems, KO/Victory/Defeat screens.
- **AI Combat Logic**:
  - Distance evaluation, jumping, blocking, and attack actions.
- **Combat Physics**:
  - Gravity system (`1600 px/s²`), ground floor clamping, player push-separation to prevent overlapping.
- **Screen Shake & Particle System**:
  - Directional particle bursts on hit impacts; dynamic screen shake on heavy blows.

---

### Version 1.0 — Initial Prototype
- Canvas 16:9 responsive viewport initialization.
- Base silhouette character rendering.
- Keyboard-only movement and basic attack actions.
