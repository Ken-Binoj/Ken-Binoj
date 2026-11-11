# 🥷 Shadow Fight Web

A browser-based, high-performance 2D martial arts fighting game inspired by *Shadow Fight 2*. Built using pure vanilla web technologies (HTML5 Canvas + JavaScript + CSS) with zero external libraries or asset dependencies.

---

## 🕹️ Controls

| Move | Key / Input | Description |
|---|---|---|
| **Rapid Punch Combo** | `Rapid Left Click (x1-5)` | Flurry punches alternating lead and rear hands (Hikite chamber). 1st punch 9 DMG; rest 2.25 DMG (`9 / 4`). Max 5 punches followed by 0.5s lockout. |
| **Low Crouch Punch** | `S (Crouch) + Left Click` | Straight low jab executed **while staying fully crouched**; ducks under standing punches! |
| **Normal Kick** | `Right Click` (Stationary) | Quick upward snap kick (`152px` reach). |
| **Front Flip Axe Kick** | `Airborne + Right Click` | 360° forward somersault gliding toward enemy with downward axe slam (**21 DMG**). Connects at 220° & knocks down opponent with red blood spray! |
| **Spartan Kick** | `Forward + Right Click` | Ferocious chest thrust kick (**18 DMG**), **fighter bends backward** (`-40°`), **4x massive animated knockback (`368px`) with dust skidding! (No blood)** |
| **Low Sweep Kick** | `S (Crouch) + Right Click` | Low ground sweep (**7 DMG**) — **trips unblocked enemies onto their rear into a 1-second knockdown! (No blood)** |
| **Crouch** | `S` or `Down Arrow` | Low martial arts crouch. **Passively ducks under standing punches!** |
| **Boxer High Guard Block** | `Left Shift` | Peek-a-boo guard in front of face (absorbs 90% dmg & prevents sweep trips). |
| **Movement** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with walking animation. |
| **Dash Move** | `Double-Tap A` / `D` or `←` / `→` | Explosive burst propelling character `184px` (half of Spartan knockback!) with shadow afterimages. |
| **Jump** | `W` or `Up Arrow` | Leap into the air with gravity physics. |
| **Ground Stomp Attack** | `Q` (After 3 Spartan Kicks in 5s) | Unlocked after taking 3 Spartan Kicks in 5s. Stomps the arena floor: **KNOCKS DOWN FOE ANYWHERE ON SCREEN!** |
| **Pause & Move List** | `P` or `Escape` | Pauses match and opens the Move List modal with combat consequences. Click anywhere or press P/ESC to resume. |

---

## 🏆 Difficulty Levels

Selectable on the interactive startup Menu Screen or via hotkeys `1`, `2`, `3`:

| Level | Silhouette | Damage | Aggression (<50% HP) | Defense & Tactics |
|---|---|---|---|---|
| **Easy** | 🟢 **Green** (`#16a34a`) | **-35% Damage** | **No Frenzy** (Stays calm) | Slower decision timer, 50% block, 25% duck. Great for beginners! |
| **Medium (Default)** | ⚫ **Black** (`#000000`) | **100% Normal** | **Aggressive Frenzy** | Smart tactical blocking (78%), 50% duck, 40% backdashes, and okizeme. |
| **Hard** | 🔴 **Red** (`#dc2626`) | **100% Normal** | **Aggressive Frenzy** | **Extremely dodgy & defensive!** 95% High Guard, 88% punch ducks, 72% evasive backdashes, twitch reflexes. |

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

