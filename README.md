# 🥷 Shadow Fight Web

A browser-based, high-performance 2D martial arts fighting game inspired by *Shadow Fight 2*. Built using pure vanilla web technologies (HTML5 Canvas + JavaScript + CSS) with zero external libraries or asset dependencies.

---

## 🕹️ Controls

| Move | Key / Input | Description |
|---|---|---|
| **Karate Punch** | `Left Click` | Piston-straight horizontal jab with Hikite (hand pulled back to hip). |
| **Normal Kick** | `Right Click` (Stationary) | Quick upward snap kick (`152px` reach). |
| **Backflip Kick** | `Airborne + Right Click` | 360° reverse somersault flip with overhead whip. **Extra heavy knockback (`110px`)!** |
| **Spartan Kick** | `Forward + Right Click` | Heavy chest thrust kick, **fighter bends backward** (`-40°`), long reach (`192px`). |
| **Low Sweep Kick** | `S (Crouch) + Right Click` | Low ground sweep — **trips unblocked enemies onto their rear into a 1-second knockdown!** |
| **Crouch** | `S` or `Down Arrow` | Low martial arts crouch. **Passively ducks under standing punches!** |
| **Boxer High Guard Block** | `Left Shift` | Peek-a-boo guard in front of face (absorbs 90% dmg & prevents sweep trips). |
| **Movement** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with walking animation. |
| **Jump** | `W` or `Up Arrow` | Leap into the air with gravity physics. |

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
