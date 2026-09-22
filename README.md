# JEV Tank Battle

**English** | [简体中文](README.zh-CN.md)

A browser tank game built with vanilla JavaScript and HTML Canvas. Fight an AI opponent around destructible walls, using keyboard or touch controls. Both tanks start each round with three hit points, and scores carry across rounds.

The opponent combines **Jev strategic decisions** with a **local real-time combat controller**. Jev selects a broad strategy; browser-side logic handles movement, aiming, shooting, and dodging. The game remains playable when the remote service is unavailable.

## Getting Started

The frontend has no package dependencies or build step. From the project directory, serve the files with Python 3:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). This serves the frontend only: `/api/jev` is unavailable, so the game automatically uses local AI.

You can also open `index.html` directly in a JavaScript-enabled browser. Keep the adjacent `css/` and `js/` directories with it. Some mobile file previewers do not execute JavaScript; use a hosted page in a browser in that case.

### Enable Jev

Deploy the static frontend together with `api/jev.js` in a server environment that supports its Vercel-style request/response handler. Configure these environment variables on the server:

| Variable | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account used for the model request |
| `CLOUDFLARE_API_TOKEN` | API token authorized to call the model |

The browser sends game state to `POST /api/jev`. The handler calls Cloudflare's AI endpoint with the `typesafe/jev` model and returns the result. Credentials stay on the server.

The handler also provides two diagnostic routes:

- `GET /api/jev`: reports whether the required environment variables are configured, without exposing their values.
- `GET /api/jev?test=1`: makes an actual model request to check connectivity and access.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Direction buttons |
| Fire | Space | FIRE button |
| Start another round | R or NEW ROUND | Restart button after a round |

## AI Strategy

The active implementation is defined by `js/ai.js` together with the overrides in `js/ai-killer.js`. The latter replaces the base shooting, aiming, tactical candidate generation, position scoring, suppressive fire, and combat controller functions before the game starts.

### 1. Strategic decisions with Jev

The browser summarizes the arena, tank positions and health, player velocity, relative geometry, line of sight, incoming bullet danger, current strategy, and up to 14 walls. Jev receives that snapshot and chooses a strategy:

| Strategy | Intended role |
| --- | --- |
| `ATTACK` | Exploit a firing opportunity and maintain pressure |
| `CHASE` | Close distance and improve the attack position |
| `FLANK` | Find a firing lane or cut off the player's route |
| `EVADE` | Respond to an imminent projectile threat |
| `RETREAT` | Create space when survival is threatened |

The model instructions favor attack and pursuit when a credible kill opportunity exists. The frontend checks whether to request a decision every 2.4 seconds of game time. It skips requests while one is in flight, during retry backoff, or while the current strategy is held. Successful decisions have a 2.8-second hold that high danger can bypass at the next check; actual requests can therefore be less frequent than the check interval.

Although the server asks Jev about movement, fire, and danger as well, **the current frontend consumes only its strategy choice, confidence, and model name**. Local code determines the immediate actions and can override the selected strategy.

### 2. Local combat priorities

The tactical controller runs approximately every 100 ms of game time. Each update estimates player velocity, adjusts difficulty, evaluates attack opportunities, and applies these priorities:

1. **Take a strong shot before dodging.** If intercept quality exceeds 0.78 and the weapon is ready, fire immediately.
2. **Evade imminent bullets.** When a threat is less than 0.48 seconds from its closest approach and a viable dodge exists, move sideways out of its path.
3. **Fire at an intercept point.** Shoot when a valid solution exists, then follow the current path or create space if the player is within 95 pixels.
4. **Apply suppressive fire.** While attacking, chasing, or in kill mode, fire toward a roughly aligned predicted player position, allowing shots to destroy intervening walls.
5. **Reposition.** Plan and follow a route toward a tactical position. If movement is `STOP` and the player is more than 90 pixels away, attempt a clear direction toward the player.

This keeps immediate combat responsive while remote decisions are pending.

### 3. Prediction, positioning, and pathfinding

Player velocity is smoothed across observations. Intercept aiming evaluates all four firing directions and performs two flight-time refinement passes to estimate where the player will be when a bullet arrives. It rejects shots behind the barrel, outside the lateral tolerance, or blocked by walls.

Tactical candidates include horizontal and vertical firing positions around the predicted player location, positions ahead of the player's movement, side positions for cutting off escape routes, and nearby escape points for the AI. The candidate list is capped at 26 positions.

Position scoring strongly rewards a clear, aligned firing lane. It favors a distance of roughly 165 pixels, reduced to 125 pixels when the player has one hit point left. Strategy-specific adjustments reward cover, flanking alignment, or separation.

Movement uses breadth-first search on a 40-pixel grid with at most 500 node expansions. Normal replanning has a 0.75-second cooldown; kill mode shortens the remaining timer to at most 0.18 seconds. A watchdog checks movement about every 550 ms and clears stale paths when the tank remains stuck, then selects a direction with more clearance.

### 4. Kill mode and adaptive difficulty

Kill mode activates when any of these conditions holds:

- The player has one hit point or less.
- The AI has more health than the player and is within 260 pixels.
- Estimated player speed stays below 18 pixels per second for more than 1.1 seconds of tactical updates.

When the stored danger score is below 0.78, kill mode forces `ATTACK`. It also accelerates replanning and enables sustained suppressive fire.

Difficulty increases with the player's score lead, capped at four points:

| Parameter | Player | AI: no player lead → four-point player lead |
| --- | --- | --- |
| Movement speed | 145 px/s | 198 → 230 px/s |
| Shot cooldown | 0.42 s | 0.18 → 0.132 s |
| Bullet speed | 330 px/s | 420 → 480 px/s |
| Bullet radius | 4 px | 6 → 7.4 px |

The AI is intentionally stronger in these mechanical parameters. Its difficulty adjustment is a fixed score-based rule; the local controller does not train or learn between rounds.

### 5. Fallback and recovery

On a failed Jev request, the browser selects `EVADE` when the local danger score exceeds 0.55, otherwise `CHASE`, and sets a 1.5-second strategy hold. The local combat controller continues running and can still activate kill mode. A 503 error triggers a 30-second retry backoff. The server aborts upstream model requests after six seconds.

The frame loop catches logic and rendering exceptions separately and continues scheduling frames. After a logic exception, it clears the AI path and stops its movement so subsequent updates can recover.

### Reading the decision panel

The panel combines remote and local information:

- **Strategy confidence** comes from the last successful Jev response, or its initial default. It is not recalculated when local logic overrides the strategy.
- **Movement bars** illustrate the selected direction using fixed weights: 84% for that direction and 4% for each alternative.
- **Fire** is a local heuristic indicator, not a calibrated hit probability or a random firing threshold.
- **Danger** is computed from local incoming-bullet analysis.
- **Decision count and log** track successful Jev decisions; initialization also adds log entries.

## Project Structure

| File | Responsibility |
| --- | --- |
| `index.html` | Page markup and ordered resource loading |
| `css/style.css` | Desktop and mobile styling |
| `js/state.js` | Shared state, constants, helpers, and canvas sizing |
| `js/game.js` | Tanks, walls, collisions, movement, projectiles, rounds, and health HUD |
| `js/ai.js` | Base perception, prediction, dodging, pathfinding, tactics, and stuck recovery |
| `js/jev.js` | State serialization, Jev requests, response mapping, and fallback |
| `js/ui.js` | Decision panel, logs, keyboard input, and touch controls |
| `js/render.js` | Canvas drawing and particle updates |
| `js/loop.js` | Game updates, render orchestration, and frame recovery |
| `js/ai-killer.js` | Active combat overrides and adaptive difficulty |
| `js/main.js` | Initial round setup and loop startup |
| `api/jev.js` | Server-side Jev proxy and diagnostic routes |
| `tests/smoke.cjs` | Deterministic simulation and optional original-version comparison |

Scripts use classic `defer` tags and share a top-level scope. Keep the order in `index.html`: shared state first, base functions before AI overrides, and `main.js` last. Changing these scripts to `async`, ES modules, or separate IIFEs requires an explicit dependency and state refactor.

## Verification

Run the smoke check with Node.js; no test dependencies are required:

```sh
node tests/smoke.cjs
```

It simulates 900 frames for each of three API scenarios: success, HTTP 503, and network failure. It exercises movement, shooting, input release, round restart, and local fallback, and checks for logic or rendering exceptions.

To compare against a saved copy of the original single-file version:

```sh
node tests/smoke.cjs /path/to/original-index.html
```

This additionally compares game state, UI updates, and request contents frame by frame. The test uses a simulated DOM and canvas; visual layout and real browser input still need browser verification.
