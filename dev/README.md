# Bloodrush dev tests

All suites run in headless Chromium with **`three-stub.js` in place of Three.js**. They test page logic, controls and save safety. They do **not** render anything, and the FPS or renderer numbers they produce are **not** performance evidence. Real numbers come from the in-page Self-test and Benchmark tools (debug overlay) on real devices.

| File | Checks | Status |
|---|---|---|
| `stage0.test.js` | 33 | Stage 0 safety: save-key isolation, guard, paths from `/dev/`, label, overlay toggles, error capture, production page unaffected. Unchanged from Stage 0 except that the build-label pattern accepts any `0.1.0-dev.N` and the server address can be set with `BASE`. |
| `exploratory-controls.test.js` | 19 | **Exploratory.** Startup, menu, start run, distance, lane changes (keys and swipe), jump, slide, pause, resume, death, results, restart, save isolation. The runner is kept invincible because stand-in obstacles do not collide realistically. These stay exploratory until the in-page Self-test confirms them against the real game on real devices. |
| `hud-repair.test.js` | 24 | HUD repair regression: distance HUD, power-up rings and ×2 badge, ability/profile faces, menu subtitle, tab highlight, side buttons per page, character-select scroll, plus lane/pause/resume/restart and save isolation. Power-ups are triggered with the game's own pickup handler `grab()`, not real collisions. Against the unrepaired build, 15 of these fail. |
| `stage1a.test.js` | 34 | (Updated for the HUD repair: the in-page self-test must now report no FAIL.) Safety of the Stage 1a tools: dev progress byte-identical after Self-test and benchmarks (completed, stopped and failing), production untouched, the original collision function restored, normal play and saving afterwards, failures reported (not swallowed). |
| `layout.test.js` | 77 | Main-menu layout (C1) at 11 phone sizes, portrait and landscape: Rise on screen and in the lower thumb zone (centre at ≥60% of the height in portrait), Rise and its best-score line clear of the side buttons and the tab bar, side buttons on screen, not overlapping each other or the title, and a tap on Rise starts a run. It measures layout boxes in headless Chromium, which has **no notch or home-indicator insets**, so safe areas still need a real-device check. Against the old menu (dev.2) 13 of these fail. |
| `characters.test.js` | 20 | Stage B characters: all 23 build in the game with a face, faces follow game state (idle and blinking in the menu, focused while running, scared after a werewolf strike, grin on a power-up, KO on death), blended run/jump/slide poses, landing squash recovers, the player group follows the gameplay position exactly while changing lanes, the collision function is unchanged, the aura stays within 16 fragments while running, portraits include the face, and saves stay isolated. The stand-in engine has no real vectors, so the test gives the visual root and player group plain x/y/z holders to read values back. It proves wiring, **not appearance**. Against dev.3 it fails at the first face check, as it should. |

## Running (optional, needs Node.js and Playwright)

From the repository root:

```
python3 -m http.server 8765        # serves the repo like GitHub Pages
node dev/tests/stage0.test.js
node dev/tests/exploratory-controls.test.js 3
node dev/tests/stage1a.test.js
node dev/tests/hud-repair.test.js
node dev/tests/layout.test.js
node dev/tests/characters.test.js
```

Set `BASE=http://host:port` to use another address. Each script exits with code 1 if any check fails.
