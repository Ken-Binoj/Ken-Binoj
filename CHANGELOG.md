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
| **Rapid Punch Combo** | `Rapid Left Click (x1-5)` | Fast flurry punching with **alternating hands** (lead & back arms). 1st punch deals **9 DMG**; remaining 4 punches deal **2.25 DMG** (`9 / 4`). Max 5 punches followed by a **0.5s lockout**. Spawns **red blood spray**. |
| **Duck Headbutt** | `Backward + Left Click` (`A` on left, `D` on right) | Ducks low to **evade Spartan kicks & high punches**, then explodes forward with a **45° lean headbutt** (**14 DMG**). Confirmed hit **STUNS enemy for 1.5 seconds** with golden dizzy stars! Directionally adapts when crossing sides! |
| **Low Crouch Punch** | `S (Crouch) + Left Click` | Straight low jab executed **while staying fully crouched** (**9 DMG**); ducks under high standing punches! Spawns **red blood**. |
| **Normal Kick** | `Right Click` (Stationary) | Upward sweeping round/snap kick targeting mid/high zones (**12 DMG**). Spawns **red blood**. |
| **Front Flip Axe Kick** | `Airborne + Right Click` | Aerial somersault axe slam (**21 DMG**)! Knocks down opponent at 220° rotation with **explosive red blood spray**! Automatically propels forward toward foe. |
| **Spartan Kick** | `Forward + Right Click` (`D` on left, `A` on right) | Ferocious chest thrust kick (**18 DMG**); **4x colossal knockback (`368px`) with dust skidding! (No blood effect)**. Directionally adapts when crossing sides! |
| **Low Sweep Kick** | `Crouch (S) + Right Click` | Ground-level sweep (**7 DMG**). **Trips unblocked opponents onto their ass! (No blood effect)**. |
| **Crouch** | `S` or `Down Arrow` | Drops into a low martial arts crouch. **Passively ducks under all standing punches!** |
| **Boxer High Guard Block** | `Left Shift` / `Shift` | Raises both fists and forearms tightly in front of the chin, nose, and eyes (peek-a-boo guard). Absorbs 90% of incoming damage and prevents sweep knockdowns. |
| **Move Left / Right** | `A` / `D` or `Arrow Keys` | Smooth lateral movement with automatic walk cycle animation. |
| **Dash Move** | `Double-Tap A` / `D` or `←` / `→` | Explosive directional burst propelling character **`184px` (exactly half of Spartan kick knockback!)** with shadow afterimages. Adapts to forward burst or backdash based on facing! |
| **Jump** | `W` or `Up Arrow` | Aerial leap with parabolic gravity physics. Can leap over opponents for cross-ups! |
| **Ground Stomp Attack** | `Q` (After 3 Spartan Kicks in 5s) | Unlocked after receiving 3 Spartan Kicks in 5s. **100% UNINTERRUPTIBLE hyper-armor!** Smashes floor: **KNOCKS DOWN OPPONENT WHEREVER THEY ARE ON SCREEN!** |
| **Pause & Move List** | `P` or `Escape` | Pauses match and opens spacious scrollable Move List modal with damage values and tactical consequences. Press P/ESC or click Resume to resume. |
| **Menu Move List & Guide** | `M` (On Menu Screen) | Opens the full scrollable Move List modal directly from the Main Menu. Press ESC, M, or click Back to return. |

---

## 📝 Detailed Chronological Changelog

### Version 1.8.2 — Player Dark Orange Oval Ground Shadow & Visual Distinguisher (Current)
- **Player Dark Orange Oval Ground Shadow**:
  - **Instant Visual Player Identification**: The player now casts a distinctive horizontally elongated dark orange oval shadow directly beneath their feet on the arena floor.
  - **Two-Tone Ambient Depth**:
    - **Inner Core**: Rich dark burnt orange ellipse (`rgba(194, 65, 12, 0.65)`) with an elongated horizontal aspect ratio (`46px` radius horizontally by `7.5px` vertically).
    - **Outer Halo**: Soft warm ambient dark orange glow (`rgba(234, 88, 12, 0.28)`) that smoothly frames the shadow.
  - **Dynamic Jump & Knockdown Perspective**:
    - The shadow dynamically scales down in size as the player leaps higher into the air, preserving vertical grounding and height perspective.
    - When knocked down on the floor, the shadow smoothly elongates to `62px` along the mat.
  - **Enemy Silhouette Contrast**: The CPU enemy maintains the subtle neutral dark shadow (`rgba(0, 0, 0, 0.12)`), making it effortless to identify and track your fighter at all times during rapid dashes, side swaps, and aerial cross-ups.

---

### Version 1.8.1 — Duck Headbutt Evasion Fix & Extended Invulnerability Window
- **Resolved Attack Linger Whiff Bug**:
  - **The Root Cause**: Previously, when Duck Headbutt dodged a high punch or Spartan kick, the collision engine returned early without consuming the attacker's `hitCooldown`. Because Spartan kicks (0.62s duration) and flurry punch combos have long active frames, the lingering attack would immediately hit the defender the split-second the duck frames passed.
  - **Whiff Neutralization**: Dodged attacks now immediately trigger the attacker's `hitCooldown` (`0.45s` for Spartan kicks, `0.25s` for standing punches), fully neutralizing the swing so it whiffs harmlessly over the ducking fighter.
  - Same whiff cooldown applied to standing punches ducked by normal crouch / crouch punch.
- **Widened Invulnerability Window (+79% Duration)**:
  - **Expanded Evasion Window**: Increased the invulnerability window against standing punches and Spartan kicks from `sp < 0.38` (210ms) to **`sp < 0.68` (380ms)**.
  - **Full Attack Sequence Coverage**: Invulnerability now covers both the initial downward ducking coil AND the entire 45-degree forward strike surge, ensuring incoming high attacks cannot interrupt the headbutt before it connects.
  - **Evasive Dust Feedback**: Clean whoosh particle effects spawn whenever a high punch or Spartan kick misses over the headbutting fighter.

---

### Version 1.8.0 — Bidirectional Arena Combat, Downed Body Crossing & Direction-Adaptive Controls
- **Downed Fighter Crossing & Body Phasing**:
  - **No More Invisible Body Walls**: When a fighter is knocked down (`knockdown`) or defeated (`dead`), the standing fighter is no longer repelled or pushed back by `PUSH_DIST` body collision.
  - **Full Cross-Over Mobility**: Players and CPUs can freely walk, dash, or leap across the body lying on the mat to fight from either side of the arena.
  - **Mid-Air Jump Cross-Ups**: Aerial jumping fighters can leap over opponents without horizontal repulsion, enabling tactical cross-up leaps.
- **Dynamic Mutual Facing & Natural Wake-Up**:
  - **Automatic Facing Tracking**: Standing fighters immediately flip (`facing = 1` or `-1`) to face the opponent as soon as they step or dash across them.
  - **Grounded Knockdown Protection**: Downed fighters stay resting naturally on the floor without glitchy 180° mid-sleep flips. Upon waking up (`sp >= 0.80` or returning to standing `idle`), they dynamically turn to face the opponent and rise to their guard.
  - **Continuous Arena Persistence**: Round 2 and Round 3 wake-ups smoothly face each other regardless of which side each combatant ended up on.
- **Direction-Adaptive Controls**:
  - **Relative Directional Mapping**:
    - **Forward** is always toward the opponent (`D` from left side, `A` from right side).
    - **Backward** is always away from the opponent (`A` from left side, `D` from right side).
  - **Spartan Kick**: Executed via `Forward + R-CLICK` (`D + R-CLICK` on left, `A + R-CLICK` on right).
  - **Duck Headbutt**: Executed via `Backward + L-CLICK` (`A + L-CLICK` on left, `D + L-CLICK` on right).
  - **Tactical Dash Burst**: Double-tapping toward opponent executes forward burst; double-tapping away executes evasive backdash.
  - **Real-Time Dynamic HUD Hint**: In-game bottom HUD hint automatically updates key prompts based on current facing direction (`A+L-CLICK / D+R-CLICK` on left side vs `D+L-CLICK / A+R-CLICK` on right side).

---

### Version 1.7.9 — Spacious Scrollable Move List & Main Menu Guide Integration
- **Spacious Scrollable Move List in Pause Menu**:
  - **No More Cramped Layout**: Completely redesigned the Pause Menu move guide from a cramped, tiny 2-column fixed grid into a spacious, beautifully formatted single-column card stream.
  - **Interactive Canvas Scroll Bar**:
    - High-contrast scrollbar track (`#f1f5f9` with `#cbd5e1` outline) and rounded scroll thumb (`#94a3b8` idle, `#000000` while dragging).
    - Fully draggable thumb with click-to-jump track navigation.
    - Smooth mouse wheel scrolling (`wheel` event) bounded within canvas clipping limits.
    - Full keyboard scrolling support: `ArrowDown` / `ArrowUp` (line step), `PageDown` / `PageUp` (page step), and `Home` / `End` (instant top / bottom jump).
  - **Canvas Viewport Clipping & Visual Polishing**:
    - Strict hardware clipping prevents cards from spilling into modal headers or footers.
    - Dynamic top and bottom gradient fades smoothly indicate overflow content when scrolled.
  - **Spacious Card Information Architecture (All 11 Combat Techniques)**:
    - **Header Row**: Move sequence number pill (`01` - `11`), bold move name (13px monospace), input key pill (e.g. `L-CLICK (x1-5)`, `A + L-CLICK`, `S + R-CLICK`), and high-visibility combat consequence badge (e.g. `14 DMG · 1.5s STUN`, `18 DMG · 4X KNOCKBACK`, `ULTIMATE · UNINTERRUPTIBLE`).
    - **Summary Description**: Crisp bold sentence detailing the animation and martial arts mechanics.
    - **Tactical Consequences & Frame Data**: Two distinct bullet points specifying exact damage values, frame advantages, hitstun durations, evasion phases, and counter-play.
- **Move List Visible & Accessible in Main Menu**:
  - **Main Menu Integration**: Added a prominent **`[ 📖 MOVE LIST & GUIDE [M] ]`** button side-by-side with **`[ ▶ START FIGHT [ENTER] ]`** on the startup title screen.
  - **Direct Access Hotkey (`M`)**: Pressing `M` from the startup menu opens the scrollable move list guide instantly.
  - **Modal Footer Actions in Menu View**:
    - `[ ← BACK TO MAIN MENU [ ESC / M ] ]`: Instantly returns to the difficulty selection screen.
    - `[ ▶ START FIGHT [ ENTER ] ]`: Starts the match immediately without needing to return to the previous screen first.
- **Accidental Unpause Protection**:
  - Clicking on the scrollbar track, dragging the thumb, or selecting card items during pause mode no longer accidentally unpauses the match.
  - The fight resumes only when pressing `P`, `Escape`, clicking the explicit **"CLICK TO RESUME FIGHT"** footer banner, or clicking outside the modal veil.

---

### Version 1.7.8 — Uninterruptible "Q" Attacks, Duck Headbutt (1.5s Stun) & Hard Mode Dashing/Counters
- **Uninterruptible "Q" Ground Stomp Attacks**:
  - **Full Hyper-Armor**: Both Player and CPU Ground Stomp ("Q") attacks are now completely uninterruptible.
  - **Damage Immunity to Flinch & Interruption**: Incoming strikes and sweep/flip kicks during the ground stomp will still apply damage, but will **never** interrupt the animation, trigger hitstun, cause knockback slide, or cause knockdowns.
  - **Mutual Ground Stomp Safety**: A fighter performing a ground stomp cannot be knocked down by the opponent's ground stomp shockwave.
- **New Move: Duck Headbutt (`A + Left Click`)**:
  - **Input Trigger**: Pressing `A` (or `←`) while Left Clicking performs the Duck Headbutt.
  - **Ducking Evasion Phase (`sp < 0.38`)**:
    - The fighter dips deeply (`bodyDip = 28px`), hips dropping close to the mat with arms tucked in.
    - **Spartan Kick & High Punch Dodge**: While the ducking frames are active, incoming standing punches and Spartan kicks miss/whiff completely over the fighter's head!
  - **45° Lean Forward Headbutt Strike (`sp >= 0.38` to `0.65`)**:
    - The fighter explodes forward with a dramatic **45-degree forward torso lean** (`bodyLean = 45°`).
    - Kinetic forward surge: advances `190px/s` forward into the opponent's guard.
    - **1.5-Second Stun Effect**: A confirmed unblocked hit deals **14 DMG**, triggers screen shake, arterial red blood spray, and **stuns the victim for a full 1.5 seconds** (`stunTimer = 1.5s`, `stateDur = 1.5s`).
  - **Visual Stun Feedback**:
    - Stunned fighters display three revolving golden yellow stars (`#facc15`) orbiting their head while incapacitated.
- **Hard Mode CPU Enhancements**:
  - **Mastery of Duck Headbutt Counters**:
    - When the player initiates standing punches or a Spartan kick within range (`dist < 190px`), Hard CPU recognizes the high attack and counters with Duck Headbutt (**85% reaction rate**), ducking underneath the strike and punishing with a 1.5-second stun!
    - Hard CPU also integrates the 45° headbutt as a primary offensive strike in close-to-mid quarters (40% close-range roll, 45% out-of-dash follow-up).
    - Ruthless punish follow-up: When the player is stunned, Hard CPU dashes in to capitalize with Spartan Kicks, Jump Axe Kicks, or rapid flurries.
  - **Dash-Centric Locomotion**:
    - In Hard mode, the CPU predominantly moves and repositions across the arena by **dashing** (`dash(dir)` forward burst, `dash(-dir)` evasive backdash) rather than slowly walking.
- **UI & Controls Display**:
  - Updated in-game HUD bottom hint, startup Menu Screen footer, and Pause Menu Move List with the new `Duck Headbutt` move and `UNINTERRUPTIBLE` Ground Stomp badge.

---

### Version 1.7.7 — Interactive Menu Screen & Difficulty Levels (Easy, Medium, Hard)
- **Interactive Menu Screen & Difficulty Selection**:
  - **Menu UI & Architecture**: Redesigned the startup flow with an interactive Menu Screen featuring title typography, responsive layout scaling, quick move hints, and three clickable difficulty cards.
  - **Input Controls**:
    - Click any difficulty card to select.
    - Keyboard hotkeys: press `[1]` for Easy, `[2]` for Medium, `[3]` for Hard, or use `[←]` / `[→]` to cycle.
    - Start match: click the pulsing **"START FIGHT"** button or press **`[Enter]` / `[Space]`**.
- **Difficulty Systems & AI Archetypes**:
  - **Medium (Default Difficulty)**:
    - **Visual Identity**: Classic Black shadow silhouette (`#000000` body, `#333333` rear limbs).
    - **Damage & Aggression**: 100% standard damage. Triggers ruthless aggressive frenzy below 50% HP (`lowHp = true`).
    - **AI Tactics**: Balanced tactical blocking (78% guard), 50% punch ducks, 40% backdashes, and methodical spacing.
  - **Easy Difficulty**:
    - **Visual Identity**: Emerald Green silhouette (`#16a34a` body, `#15803d` rear limbs).
    - **Damage Scaling**: Enemy attacks deal **35% less damage** (`Math.max(1, Math.round(dmg * 0.65 * 10) / 10)`).
    - **No Berserk Aggression**: Enemy **never** enters aggressive frenzy when health is below 50% HP (`lowHp = false`).
    - **Forgiving AI Behavior**: Relaxed decision cycle (`0.24 - 0.42s`), lower block rate (50%), lower duck rate (25%), and fewer offensive dashes.
  - **Hard Difficulty**:
    - **Visual Identity**: Crimson Red silhouette (`#dc2626` body, `#991b1b` rear limbs).
    - **Damage & Aggression**: 100% standard damage. Aggressively enrages below 50% HP just like Medium difficulty.
    - **Extremely Dodgy & Defensive**:
      - **High Guard Defense**: 95% block rate against incoming strikes (`Math.random() < 0.95`).
      - **Reflex Punch Ducks**: 88% chance to duck under standing punches into low crouch.
      - **Twitch Evasive Backdashes**: 72% backdash chance when pressured in close range (`dist < 140px`) and 75% evasive dash counter against incoming attacks.
      - **Twitch Reflex Timer**: Ultra-fast decision cycles (`0.07 - 0.14s` normal, `0.05 - 0.09s` below 50% HP).
      - **Anti-Air Dominance**: 92% anti-air reaction rate against aerial jump attacks.
- **Dynamic HUD & Character Color-Matching**:
  - Enemy display name updates dynamically: `CPU [EASY]`, `CPU [MEDIUM]`, or `CPU [HARD]`.
  - Enemy health bar fill color dynamically matches the difficulty palette (Green on Easy, Black on Medium, Red on Hard).
  - Limb rendering, torso, head, and dash afterimages all dynamically reflect the chosen difficulty theme.
- **Game Over Screen Improvements**:
  - Added dual interactive buttons: **"⚔ REMATCH ⚔"** (instantly starts rematch on current difficulty) and **"⚙ MENU / DIFFICULTY ⚙"** (returns to Main Menu to select a new difficulty).
  - Displays current difficulty tag (`[ DIFFICULTY: EASY / MEDIUM / HARD ]`).

---

### Version 1.7.6 — Red Blood Hit Effects & Combat Damage Tuning
- **Red Blood Splatter & Arterial Spray**:
  - **Dynamic Blood Particle Engine**: Implemented `spawnBlood(x, y, dir, count)` with rich multi-tonal crimson red palette (`#ff0d38`, `#d60029`, `#ff2449`, `#a8001d`, `#e6002b`).
  - **Physics & Dispersion**: Blood droplets spray in the forward impact direction with natural gravitational arc (`gravity: 700`), realistic decay velocities, and varying droplet radii.
  - **Impact Triggers**: Confirmed unblocked hits from punches, rapid punch combos, crouch punches, standing snap kicks, and jump axe kicks generate vivid blood splatters.
- **Excluded Strikes (No Blood Effects)**:
  - **Spartan Kick**: Generates blunt force kinetic dust and debris shockwaves only (`spawnParticles`), maintaining pure blunt impact aesthetic without blood.
  - **Low Sweep Kick**: Generates ground sweep dust clouds when tripping the opponent, with zero blood.
  - **Guard Blocks**: Striking a blocking opponent spawns defensive guard sparks rather than blood.
- **Damage Rebalancing**:
  - **Low Sweep Kick**: Health loss reduced from `10 DMG` to **`7 DMG`** (**-3 DMG reduction**), balancing its unblockable low knockdown advantage.
  - **Front Flip Axe Kick (Jump Kick)**: Health loss increased from `18 DMG` to **`21 DMG`** (**+3 DMG increase**), making high-risk aerial axe kicks devastatingly rewarding.
- **Pause Menu & UI Synchronization**:
  - Updated the in-game Pause Menu move badges to clearly display `7 DMG` for Low Sweep Kick and `21 DMG` for Front Flip Axe Kick.

---

### Version 1.7.5 — [Q] Ground Stomp Screen-Wide Knockdown Attack
- **Receive 3 Spartan Kicks in 5 Seconds**:
  - **Dynamic Rolling Tracker**: Both fighters now track the exact timestamps of every Spartan Kick received (`spartanHitTimestamps`) within a rolling 5-second window (`filter(t => now - t <= 5000)`).
  - **Unlock Condition**: When a character absorbs or is hit by 3 Spartan Kicks in the span of 5 seconds, the devastating **Ground Stomp Attack ("Q")** is immediately unlocked (`groundStompReady = true`).
  - **HUD Callout**: An animated high-contrast pulsing indicator appears directly below the fighter's health bar:
    - Player: `💥 PRESS [Q] GROUND STOMP! 💥`
    - CPU: `💥 STOMP READY 💥`
- **Ground Stomp Attack Execution & Animation**:
  - **Instant Recovery**: If the user is currently knocked down or in hitstun when pressing `Q`, they immediately surge upright onto their feet.
  - **Chambering Pose**: The fighter rears back, arms flaring wide with clenched fists, while their lead knee chambers up high toward the chest (`bodyLean = 14°`, `fThigh = -108°`, `fCalf = 102°`).
  - **Sledgehammer Impact**: At `sp >= 0.38`, the foot slams downward into the earth with massive kinetic force (`fThigh = -6°`, `fCalf = 6°`, `bodyDip = 20px`), triggering heavy screen shake (`shake(22, 0.45)`) and upward dust explosions.
  - **Seismic Ground Wave Effect**: Dynamic horizontal seismic shockwaves ripple outward along the arena floor line in both directions with rising vertical kinetic spikes (`groundShockwaves`).
  - **Screen-Wide Knockdown**: The seismic shock knocks down the opponent **wherever they are on screen**, sweeping their feet out and putting them flat on their back in the sleeping position (0 DMG, guaranteed knockdown).
- **CPU AI Integration**:
  - If the CPU absorbs 3 Spartan Kicks within 5 seconds, it recognizes its unlocked Ground Stomp and activates it strategically.
- **In-Game Pause Menu Updates**:
  - Updated the Pause Menu (`P` / `ESC`) move list with full documentation for the Ground Stomp attack and its screen-wide knockdown effect.

---

### Version 1.7.4 — Instant Round 2 & 3 Start (No Countdown) & Alternating Rapid Punch Combo
- **Instant Round 2 & Round 3 Start**:
  - **No Countdown**: Completely removed the 3... 2... 1... countdown timer for Round 2 and Round 3.
  - **Instant Action Banner**: As soon as the next continuous round begins, a sleek high-contrast banner displays `"ROUND 2 BEGINS"` (or `"ROUND 3 BEGINS"`), and fighters are immediately in active combat mode (`gameState = 'fight'`).
  - **Fluid Combat Flow**: Loser recovers up from knockdown with wake-up shockwave if the winner is too close, and both fighters can immediately engage with attacks, dashes, blocks, and counters.
- **Rapid Punch Combo Move**:
  - **Alternating Hands Animation**: Clicking normal punch (`Left Click`) in rapid succession cycles punches between the lead hand (front arm) and rear hand (back arm) using full 2D double-jointed skeletal inverse kinematics. The non-striking arm pulls back to the hip in Karate *Hikite* chamber.
  - **Maximum 5-Punch String**: The flurry chains up to a maximum of 5 rapid punches.
  - **0.5-Second Punch Lockout**: After executing the 5th punch in the string, a strict `0.5s` punch lockout timer engages (`punchLockoutTimer = 0.50s`), during which further punches are disabled while all other moves (kicks, dashes, jump, block) remain accessible.
  - **Combo Damage Scaling**:
    - **1st Punch**: Deals full normal punch damage (**9 DMG**).
    - **Punches 2 through 5**: Deal punch damage divided by 4 (**2.25 DMG** per punch) with calibrated knockback (`22px`) ensuring the full combination string stays in range and lands smoothly.
    - **Hit Registration & Cooldown**: Resetting hit cooldown allows each rapid punch in the combination to confirm hits and increment the combo meter.
- **In-Game Pause Menu Updates**:
  - Updated the Pause Menu (`P` / `ESC`) move list entry with full documentation for the Rapid Punch Combo, including damage scaling (9 DMG / 2.25 DMG) and the 0.5s lockout consequence.

---

### Version 1.7.3 — Faster Strikes, [Q] Reversal Burst, Guaranteed Round 2 Flow & Clickable Rematch
- **Faster Normal Punch & Kick**:
  - **Karate Straight Punch**: Duration decreased from `0.42s` to **`0.28s`** (33% faster snap jab, quicker recovery).
  - **Low Crouch Punch**: Duration decreased from `0.40s` to **`0.28s`** (30% faster low jab from crouch).
  - **Normal Snap Kick**: Duration decreased from `0.54s` to **`0.38s`** (30% faster high snap poke).
  - **Snappier Hit Detection**: Active hit window widened to `sp >= 0.15` to match the rapid strikes.
- **[Q] Comeback Reversal Burst Mechanic**:
  - **5-Second Knockdown Tracker**: Both fighters now track knockdown timestamps within a rolling 5-second window (`kdTimestamps.filter(t => now - t <= 5000)`).
  - **HUD Indicator**: When a player is knocked down 3 times in 5 seconds, an animated pulsing **`[Q] BURST!`** badge appears directly below their health bar.
  - **Trigger with [Q]**:
    - Pressing `Q` immediately unleashes a violent kinetic shockwave (`shake(15, 0.35)` + particle explosion).
    - Instantly breaks the user out of knockdown/hitstun into standing neutral `idle`.
    - If the opponent is within close proximity (`< 160px`), they suffer **colossal knockback** (`380 * sc`, Spartan Kick force) and are **knocked down flat on their back with zero health loss (0 DMG)**!
  - **CPU AI Integration**: CPU also recognizes when it has been knocked down 3 times in 5 seconds and strategically unleashes its Reversal Burst.
- **Guaranteed Seamless Round 2 Automatic Flow**:
  - Fixed round completion logic so Round 2 reliably starts automatically after Round 1 without locking or dropping.
  - When Round 1 finishes, `roundTransition` displays round results for 1.5 seconds, then immediately initiates continuous Round 2:
    - Arena positions are preserved (no reset).
    - Both health bars refill to 100% full HP.
    - Fallen fighter pushes up and wakes back up from knockdown.
    - Hovering winner is blasted with the wake-up shockwave if too close (`160px`).
    - Cinematic `ROUND 2` countdown plays in real-time.
- **Dedicated Clickable Rematch Button**:
  - When the entire match is finished (best of 3 rounds completed), the game enters `gameOver`.
  - The next fight **ONLY begins when the player explicitly clicks the centered `[ ⚔ REMATCH ⚔ ]` button**.
  - Accidental keyboard presses (Space, Enter) and clicks outside the button no longer restart the match.

---

### Version 1.7.2 — Continuous Arena Round 2, Wake-up Shockwave & Crouch Fix
- **Permanent Crouch Fix (Never Stuck in Crouch Mode)**:
  - **Frame-by-Frame Key State Synchronization**: Every frame in `Fighter.update()`, player crouching is synchronized directly with physical key states (`keys['KeyS'] || keys['ArrowDown']`). If the key is released at any point (even mid-attack, during hitstun, or during knockdown), crouching immediately clears to `idle`.
  - **Attack-Recovery Guard**: When exiting an attack or knockdown state, the character only transitions back to `crouch` if the down key is actively being held at that exact moment.
  - **Walk / Jump Override**: Pressing horizontal movement (`A` / `D`) or jumping (`W`) automatically breaks out of crouch if `S` is not held.
  - **Window Blur Protection**: Added `window.blur` listener that instantly releases stuck keys and resets crouch/block states to neutral `idle`.
  - **Unconditional Flag Assignment**: Fixed `crouch(on)` to set `this.crouching = on` immediately, avoiding dropped keyup releases while in knockdown/dead states.

- **Seamless Continuous Arena for Round 2 (No Position Resets)**:
  - When Round 1 finishes, the arena is **not reset**: neither fighter is destroyed or re-spawned at default side coordinates. Both fighters remain standing or lying exactly where their clash concluded.
  - **Health Bars Refill to Full**: Both player and CPU health bars instantly refill to 100% max HP.
  - **Dead Fighter Wakes Back Up from Knockdown**:
    - The defeated fighter (who was lying flat on the mat in natural sleeping posture) automatically begins their wake-up animation, pushing up off the floor and rising to their feet.
  - **Proximity Shockwave Reversal Knockback**:
    - If the winner is standing too close to the fallen loser (`dist < 155px`) while the loser wakes up for Round 2, the loser's wake-up surge emits a massive kinetic shockwave.
    - **Huge Knockback & Knockdown (Zero Health Loss)**: The hovering winner is blasted backwards with colossal knockback (`380 * sc`, identical to a Spartan Kick), skids across the floor, impacts the arena boundary or slams onto their rear/back in sleeping position, and then stands back up with **0 damage taken**.
  - **Real-Time Countdown Execution**: During the `ROUND 2` countdown (`3 ... 2 ... 1 ... FIGHT!`), physics, character animation, and particle effects continuously run, creating a cinematic and fluid transition directly into the next round.
  - **Smooth Round End Flow**: Automatically flows into Round 2 after 2.2 seconds, or advances immediately if the player presses Space or clicks.

---

### Version 1.7.1 — In-Game Pause Menu & Enhanced AI Aggression Overhaul
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
