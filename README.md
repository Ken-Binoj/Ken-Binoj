# 🥷 Shadow Fight Web

A browser-based, high-performance 2D martial arts fighting game inspired by *Shadow Fight 2*. Built using pure vanilla web technologies (HTML5 Canvas + JavaScript + CSS) with zero external libraries or asset dependencies.

---

## 🕹️ Controls

| Move | Key / Input | Description |
|---|---|---|
| **Karate Punch** | `Left Click` | Piston-straight horizontal jab with Hikite (hand pulled back to hip). |
| **Low Crouch Punch** | `S (Crouch) + Left Click` | Straight low jab executed **while staying fully crouched**; ducks under standing punches! |
| **Normal Kick** | `Right Click` (Stationary) | Quick upward snap kick (`152px` reach). |
| **Front Flip Axe Kick** | `Airborne + Right Click` | 360° forward somersault gliding toward enemy with downward axe slam. **Connects at 220° rotation & knocks down opponent!** |
| **Spartan Kick** | `Forward + Right Click` | Ferocious chest thrust kick, **fighter bends backward** (`-40°`), **4x massive animated knockback (`368px`) with dust skidding!** |
| **Low Sweep Kick** | `S (Crouch) + Right Click` | Low ground sweep — **trips unblocked enemies onto their rear into a 1-second knockdown!** |
| **Crouch** | `S` or `Down Arrow` | Low martial arts crouch. **Passively ducks under standing punches!** |
| **Boxer High Guard Block** | `Left Shift` | Peek-a-boo guard in front of face (absorbs 90% dmg & prevents sweep trips). |
| **Movement** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with walking animation. |
| **Dash Move** | `Double-Tap A` / `D` or `←` / `→` | Explosive burst propelling character `184px` (half of Spartan knockback!) with shadow afterimages. |
| **Jump** | `W` or `Up Arrow` | Leap into the air with gravity physics. |
| **Pause & Move List** | `P` or `Escape` | Pauses match and opens the Move List modal with combat consequences. Click anywhere or press P/ESC to resume. |

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

