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
| **Normal Kick** | `Right Click` (Stationary) | Upward sweeping round/snap kick targeting mid/high zones. |
| **Backflip Kick** | `Airborne + Right Click` | Aerial somersault kick; completes a **360° backward rotational flip** with overhead leg whip. **Extra knockback (`110px`)!** |
| **Spartan Kick** | `Moving Forward + Right Click` | Ferocious linear chest thrust kick; fighter **bends backward** dramatically (`-40°`); extended reach (`192px`) & heavy knockback (`92px`). |
| **Low Sweep Kick** | `Crouch (S) + Right Click` | Ground-level sweep with hand planted on floor. **Trips unblocked opponents onto their ass with screen shake!** |
| **Crouch** | `S` or `Down Arrow` | Drops into a low martial arts crouch. **Passively ducks under all standing punches!** |
| **Boxer High Guard Block** | `Left Shift` / `Shift` | Raises both fists and forearms tightly in front of the chin, nose, and eyes (peek-a-boo guard). Absorbs 90% of incoming damage and prevents sweep knockdowns. |
| **Move Left / Right** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with automatic walk cycle animation. |
| **Jump** | `W` or `Up Arrow` | Aerial leap with parabolic gravity physics. |

---

## 📝 Detailed Chronological Changelog

### Version 1.5.2 — Knockdown Sleeping Position Overhaul (Current)
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
