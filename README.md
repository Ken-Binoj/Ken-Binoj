# 🥷 Shadow Fight Web

A browser-based, high-performance 2D martial arts fighting game inspired by *Shadow Fight 2*. Built using pure vanilla web technologies (HTML5 Canvas + JavaScript + CSS) with zero external libraries or asset dependencies.

---

## 🕹️ Controls

### 🟠 Player 1 (Left Fighter — Dark Orange Shadow)
| Move | Key / Input | Description |
|---|---|---|
| **Rapid Punch Combo** | `V` (or Left-Click) | Flurry punches alternating lead and rear hands (Hikite chamber). 1st punch 9 DMG; rest 2.25 DMG (`9 / 4`). Max 5 punches followed by 0.5s lockout. |
| **Duck Headbutt** | `Backward + V` (`A+V` on left, `D+V` on right) | Ducks low to **evade Spartan kicks & high punches**, then explodes forward with a **45° lean headbutt** (**14 DMG**). Confirmed hit **STUNS enemy for 1.5 seconds** with golden dizzy stars! Directionally adapts when crossing sides! |
| **Low Crouch Punch** | `S (Crouch) + V` | Straight low jab executed **while staying fully crouched**; ducks under standing punches! |
| **Normal Kick** | `B` (or Right-Click) | Quick upward snap kick (`152px` reach). |
| **Front Flip Axe Kick** | `Airborne (W) + B` | 360° forward somersault gliding toward enemy with downward axe slam (**21 DMG**). Connects at 220° & knocks down opponent with red blood spray! |
| **Spartan Kick** | `Forward + B` (`D+B` on left, `A+B` on right) | Ferocious chest thrust kick (**18 DMG**), **fighter bends backward** (`-40°`), **4x massive animated knockback (`368px`) with dust skidding! (No blood)**. Directionally adapts when crossing sides! |
| **Low Sweep Kick** | `S (Crouch) + B` | Low ground sweep (**7 DMG**) — **trips unblocked enemies onto their rear into a 1-second knockdown! (No blood)** |
| **Crouch** | `S` or `Down Arrow` | Low martial arts crouch. **Passively ducks under standing punches!** |
| **Boxer High Guard Block** | `Left Shift` / `Shift` | Peek-a-boo guard in front of face (absorbs 90% dmg & prevents sweep trips). |
| **Movement** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with walking animation. |
| **Dash Move** | `Double-Tap A` / `D` or `←` / `→` | Explosive burst propelling character `184px` (half of Spartan knockback!) with shadow afterimages. Adapts to forward or backward dash! |
| **Jump** | `W` or `Up Arrow` | Leap into the air with gravity physics. Can leap over opponents for cross-ups! |
| **Ground Stomp Attack** | `Q` (After 3 Spartan Kicks in 5s) | Unlocked after taking 3 Spartan Kicks in 5s. **100% UNINTERRUPTIBLE hyper-armor!** Stomps the arena floor: **KNOCKS DOWN FOE ANYWHERE ON SCREEN!** |

### 🔵 Player 2 (Right Fighter — Dark Blue Shadow, 2P Multiplayer Mode)
| Move | Key / Input | Description |
|---|---|---|
| **Punch Combo** | `-` (Minus / Numpad Subtract) | Rapid flurry punches alternating lead and rear arms. 1st punch 9 DMG; rest 2.25 DMG (`9 / 4`). Max 5 punches. |
| **Duck Headbutt** | `Backward + -` (`4+-` on right, `6+-` on left) | Ducks under Spartan kicks & standing punches, then surges into 45° headbutt (**14 DMG**). **STUNS opponent for 1.5s**! |
| **Low Crouch Punch** | `5 (Crouch) + -` | Straight low body strike executed while crouched (**9 DMG**); ducks under high punches! |
| **Normal Kick** | `+` (Plus / Equal / Numpad Add) | Swift linear round thrust kick extending 152px outward (**12 DMG**). |
| **Front Flip Axe Kick** | `Airborne (8) + +` | Aerial 360° somersault axe slam (**21 DMG**)! Flattens opponent onto back for 1.0s knockdown! |
| **Spartan Kick** | `Forward + +` (`6++` on right, `4++` on left) | Ferocious chest thrust kick (**18 DMG**); **4x colossal knockback (`368px`) with dust skidding!** |
| **Low Sweep Kick** | `5 (Crouch) + +` | Ground-level foot sweep (**7 DMG**). **Trips unblocked opponents onto their ass!** |
| **Crouch** | `5` (Numpad 5 or Digit 5) | Low martial arts crouch. **Passively ducks under all standing punches!** |
| **Boxer High Guard Block** | `0` (Numpad 0 or Digit 0) | Peek-a-boo guard in front of face. Absorbs 90% incoming damage & blocks sweeps. |
| **Movement** | `4` / `6` (Numpad or Digit) | Smooth lateral movement with walking animation. |
| **Dash Move** | `Double-Tap 4` / `6` | Explosive directional burst propelling character **`184px`** with shadow afterimages. |
| **Jump** | `8` (Numpad 8 or Digit 8) | Aerial leap with parabolic gravity physics. Can leap over opponents for cross-ups! |
| **Ground Stomp Attack** | `7` (Numpad 7 or Digit 7) | **100% UNINTERRUPTIBLE hyper-armor!** Smashes floor: **KNOCKS DOWN OPPONENT WHEREVER THEY ARE ON SCREEN!** |

### ⚙️ Navigation & Menus
| Action | Key / Input | Description |
|---|---|---|
| **Pause & Move List** | `P` or `Escape` | Pauses match and opens spacious scrollable Move List modal with damage values and tactical consequences. Press P/ESC or click Resume. |
| **Menu Move Guide** | `M` (On Menu Screen) | Opens the full scrollable Move List modal directly from the Main Menu. Press ESC, M, or click Back to return. |
| **Select Mode / Difficulty** | `1`, `2`, `3`, `4` or Click | `1`: Easy, `2`: Medium (Default), `3`: Hard, `4`: 2P Versus (Local Multiplayer). |

---

## 🏆 Game Modes & Difficulty Levels

Selectable on the interactive startup Menu Screen or via hotkeys `1`, `2`, `3`, `4`:

| Level / Mode | Silhouette & Shadow | Damage | Aggression (<50% HP) | Defense & Mechanics |
|---|---|---|---|---|
| **Easy** | 🟢 **Green** (`#16a34a`) | **-35% Damage** | **No Frenzy** (Stays calm) | Slower decision timer, 50% block, 25% duck. Great for beginners! |
| **Medium (Default)** | ⚫ **Black** (`#000000`) | **100% Normal** | **Aggressive Frenzy** | Smart tactical blocking (78%), 50% duck, 40% backdashes, and okizeme. |
| **Hard** | 🔴 **Red** (`#dc2626`) | **100% Normal** | **Aggressive Frenzy** | **Extremely dodgy, moves by dashing & expert headbutt counters!** 95% High Guard, 88% punch ducks, 85% Duck Headbutt counters, frequent dashes. |
| **2P Versus** | 🔵 **Blue P2** (`#1d4ed8` + Blue Shadow) vs 🟠 **Orange P1** (Orange Shadow) | **100% Player Controlled** | **N/A (Human vs Human)** | **Same-Keyboard 1v1 Local Multiplayer!** Both fighters 100% keyboard-controlled in real-time. |

---

## 🚀 How to Play

No build step or server required! Simply clone the repo and open `index.html` in any modern web browser:

```bash
# Clone the repository
git clone <repository-url>

# Open in browser
open index.html   # macOS
start index.html  # Windows
```

---

## 📁 Project Structure

- `index.html` — Canvas viewport container.
- `style.css` — Minimalist high-contrast aesthetic and styling.
- `game.js` — Core game engine (kinematics, combat state machines, AI, physics, rendering).
- `CHANGELOG.md` — Complete development history, version notes, and feature specs.

