# 🗺️ Shadow Fight Web — Code Map & Architecture Dictionary

This dictionary serves as the master navigation index for [`game.js`](file:///c:/Users/KEN/.gemini/antigravity-ide/scratch/Fight-html%20prototype/game.js). Use this guide to quickly locate any system, function, class, or mechanic without needing to search through the entire codebase.

---

## 📌 Master File Index (`game.js`)

| Section # | Line Range | System Name | Key Functions / Variables |
|---|---|---|---|
| **01** | `L1 - L150` | **Canvas Setup, Touch State & Mobile Scaling** | `canvas`, `ctx`, `isTouchDevice`, `touchControls`, `updateTouchLayout()`, `checkOrientation()`, `resize()`, `DW (900)`, `FLOOR_FRAC (0.82)` |
| **02** | `L151 - L208` | **Particle & Blood VFX Engine** | `spawnParticles()`, `spawnBlood()`, `updateParticles()`, `drawParticles()` |
| **03** | `L209 - L267` | **Seismic Shockwaves & Screen Shake** | `triggerGroundStompEffect()`, `updateGroundShockwaves()`, `drawGroundShockwaves()`, `shake()` |
| **04** | `L268 - L320` | **Angle Convention & Fighter Constructor** | `class Fighter`, constructor properties (`hp`, `state`, `facing`, `stunTimer`, `dashGhosts`) |
| **05** | `L321 - L385` | **Fighter Core Locomotion & State Triggers** | `move()`, `dash()`, `jump()`, `block()`, `crouch()`, `knockdown()`, `takeHit()` |
| **06** | `L386 - L595` | **Combat State Machine & Attack Updates** | `attack()`, `update()`, combo cooldowns, stun decay, afterimages, knockdown wake-up |
| **07** | `L596 - L850` | **Skeletal Kinematics & Rendering Pipeline** | `drawLimb()`, `drawTorso()`, `drawHead()`, `drawDizzyStars()`, `drawDashGhosts()` |
| **08** | `L851 - L1525` | **Per-State Skeletal Joint Angle Curves** | Angle curves for `idle`, `walk`, `punch`, `duckHeadbutt`, `kick`, `spartanKick`, `sweepKick`, `flipKick`, `groundStomp`, `hurt`, `knockdown`, `dead` |
| **09** | `L1526 - L1545` | **Global Game State Variables** | `gameState`, `difficulty`, `isPaused`, `menuView`, `roundNum`, `playerWins`, `enemyWins` |
| **10** | `L1546 - L1700` | **Master Combat Moves Database** | `ALL_MOVES` (11 moves with categories, P1/P2/Touch input tags, badges, damage, and tactical consequences) |
| **11** | `L1701 - L1762` | **Match Lifecycle & Fighter Initialization** | `initRound()` (instantiates fighters, resets touch inputs, applies difficulty and PvP color themes) |
| **12** | `L1763 - L2030` | **Combat Attack Dispatchers & Keyboard Input** | `triggerPlayer1Punch/Kick` (integrated with touch joystick), `triggerPlayer2Punch/Kick`, `keydown`, `keyup` |
| **13** | `L2031 - L2188` | **Menu & Move List Modal Layout Generators** | `getMenuLayout()` (4 cards: Easy, Medium, Hard, 2P Versus), `getMoveListModalLayout()`, `getGameOverBtns()` |
| **14** | `L2189 - L2420` | **Scrollable Move List Modal Renderer** | `drawScrollableMoveListModal()` (canvas clipping `ctx.clip()`, scrollbar track/thumb, overflow fade gradients) |
| **15** | `L2421 - L3265` | **Mobile Touch Controls & Virtual Joystick Engine** | `drawJoyArrow()`, `drawTouchControls()`, `updateJoystick()`, multi-touch handlers (`touchstart`, `touchmove`, `touchend`, `touchcancel`) |
| **16** | `L3266 - L3290` | **Ground Stomp ("Q" / "7") Attack System** | `triggerGroundStomp()` (hyper-armor, screen-wide floor slam, knockdown trigger) |
| **17** | `L3291 - L3765` | **CPU Tactical AI Engine** | `updateAI()` (decision timer, Easy/Medium/Hard archetypes, reflex duck headbutt counters, dash movement) |
| **18** | `L3766 - L3850` | **Combat Hitbox Detection & Damage Pipeline** | `checkHits()` (duck headbutt dodge frames, Spartan kick knockback, sweep kick trips, blood spray spawn, knockdown counters) |
| **19** | `L3851 - L3915` | **Arena Background & Ground Shadows** | `drawBackground()` (minimalist floor line, P1 dark orange oval ground shadow, P2 royal blue oval ground shadow in PvP) |
| **20** | `L3916 - L4025` | **Heads-Up Display (HUD)** | `drawHUD()` (health bars, round victory gems, dynamic mobile touch hints, [Q]/[7] Stomp prompts, round timer) |
| **21** | `L4026 - L4290` | **Menu, Pause & Overlay Screens** | `drawMenu()` (4 mode cards + [M] Move List button), `drawPauseMenu()`, `drawCountdown()`, `drawRoundBanner()`, `drawGameOver()` |
| **22** | `L4291 - L4345` | **Round Progression & Arena Persistence** | `checkRoundEnd()`, `startNextRoundContinuous()` (continuous arena reset, wake-up reversal shockwave on close proximity) |
| **23** | `L4346 - L4353` | **Main Game Loop & Frame Engine** | `loop()`, touch controls overlay renderer, joystick locomotion, delta time clamping, screen shake transform |

---

## 🔍 How to Find & Edit Key Features

### 1. Adding or Modifying a Combat Move
To edit or add a martial arts move, you only need to touch 4 specific regions:
1. **Move Database & Documentation**: In `ALL_MOVES` (`L1426 - L1563`), add the move name, input key badge, damage rating, summary, and tactical consequences.
2. **Animation Keyframes & Poses**: In the `Fighter.draw()` state switch (`L731 - L1406`), add the joint angles for head, torso, upper arm, forearm, thigh, and calf across animation progress `sp`.
3. **Hit Detection & Damage**: In `checkHits()` (`L2696 - L2864`), add the hitbox distance, damage value, blood effect trigger, knockback impulse, or stun duration.
4. **Input Trigger**: In `canvas.addEventListener('mousedown')` (`L2111 - L2362`) or `keydown` (`L1597 - L1729`), map the user key/button combination.

### 2. Modifying CPU Difficulty & AI
- **Difficulty Selection Cards & Colors**: `getMenuLayout()` (`L1730 - L1800`) and `initRound()` (`L1564 - L1596`).
- **Tactical Decisions & Reaction Rates**: `updateAI()` (`L2387 - L2695`):
  - *Easy*: Slower decision tick, 50% block, 25% duck, no enrage frenzy.
  - *Medium*: Balanced 78% block, enrages below 50% HP.
  - *Hard*: 95% High Guard, 88% punch ducks, 85% reflex Duck Headbutt counters to standing punches/Spartan kicks, dash-centric locomotion.

### 3. Modifying Round Transitions & Reversal Mechanics
- `startNextRoundContinuous()` (`L3220 - L3338`):
  - Dead player wakes up with full health on floor without arena reload.
  - Close proximity threshold (`160px`) triggers 380px knockback + floor knockdown (0 DMG).

### 4. Bidirectional Arena Combat & Screen-Side Swapping
- **Downed Body Phasing**: `neitherDown` in `loop()` (`L3395 - L3410`) disables `PUSH_DIST` body collision when a fighter is down, allowing walking/jumping over.
- **Facing Updates**: In `Fighter.update()` (`L560 - L575`), updates `facing` to face opponent, holding position during knockdown sleep (`sp < 0.80`) and attacking states.
- **Direction-Adaptive Controls**: In `mousedown` (`L2155 - L2185`), computes `isFwd` and `isBack` relative to `player.facing`, adapting Spartan Kick (forward) and Duck Headbutt (backward) regardless of which side the player is on.

### 5. Modifying the Scrollable Move List Modal
- **Layout & Metrics**: `getMoveListModalLayout()` (`L1801 - L1888`).
- **Rendering & Clipping**: `drawScrollableMoveListModal()` (`L1889 - L2110`).
- **Scrolling & Dragging**: Mouse `wheel`, `mousedown`, `mousemove` (`L2111 - L2362`) and `keydown` arrow navigation (`L1597 - L1729`).

