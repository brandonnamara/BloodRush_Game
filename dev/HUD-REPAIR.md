# Bloodrush HUD repair (development build only)

## What broke, and where it came from

The 07:09 build (glowing characters and pixel sun) rebuilt the voxel code block and dropped five hook calls that had been added to it by hand earlier. The functions themselves were never removed. They just stopped being called.

I compared three files:

| File | SHA-256 | The five calls |
|---|---|---|
| `backups/index-pre-glowsun-20261023-0706.html` (last good build) | `2de300d7b435c998f3b9331af9a0eb115d9ecfa9acc1f7f9c6ed489ef3d41cb4` | present |
| Stage 0 `dev/index.html` (live dev) | `96a1182df0f630cdc3d3e271c8d393c921f2afc027133e9cb9d623b487f03dda` | missing |
| Stage 1a `dev/index.html` (proposed, not uploaded) | `2bee6b3769bba14a4415c39e690f73d88f09239df1b0669970dd4ec2aed55881` | missing |
| Production `index.html` (my copy) | `44007dff80f6926ce096f9a314fd94767967f706b3bb4e65f1140786581fdad7` | missing |

The HUD module (`UI2`) and the menu module (`UI3`) are **byte-identical** in the 0706 backup and in Stage 1a. Restoring the calls therefore brings back exactly the behaviour that 0706 had.

## The five restored calls (copied from the 0706 backup, not recreated)

**In `vxTick()`, which runs every frame.** Original ending: `…setHex(vxCur.glow||act?0xff3a48:0x8a1a28);ui2Tick();ui3Tick()}`

1. **`ui2Tick()`**: updates the in-run HUD. It sets the distance text, shows, fills and empties the power-up timer rings (with the "2s!" warning), and shows or hides the ×2 multiplier badge. It only writes to the page when a value changes.
2. **`ui3Tick()`**: updates the main menu while it's open. It sets the subtitle (hero name and title), the ability-ready line under Rise, the tab-bar highlight, and the "new" dots on the side buttons, and it hides the side buttons on the Collection and Progress pages. It returns immediately when you're not on the menu, and refreshes once per second.

**In `vxApply(i)`, which runs whenever a character is applied.** Original: `P.add(VXP.root);ui2Face(i);ui3Face();if(state==='select')ui4Scroll();vxTick()}`

3. **`ui2Face(i)`**: draws the character's voxel face onto the ability button.
4. **`ui3Face()`**: copies that face onto the profile button in the menu.
5. **`if(state==='select')ui4Scroll()`**: in character select, scrolls the chosen portrait card into view.

**Placement.** In the current file, the 07:09 build put the aura set-up code between `P.add(VXP.root)` and `vxTick()`. The three face calls go back immediately before `vxTick()`, so they keep their original order: after the model is added, before the first frame update. The aura code doesn't touch the faces.

## The patch

`hud-repair.patch` (Stage 1a → repaired) contains only these insertions (73 bytes in total). Nothing is removed or changed:

```
+ ;ui2Tick();ui3Tick()                                        (end of vxTick)
+ ui2Face(i);ui3Face();if(state==='select')ui4Scroll();       (end of vxApply, before vxTick())
```

- The build label stays `0.1.0-dev.2 · Stage 1a`, so the patch stays minimal. You can tell the builds apart by file size (232,835 vs 232,762 bytes) or by the self-test line "HUD shows the distance" (PASS on the repaired build, FAIL before).
- Checked on temporary copies only: the same patch also applies cleanly to Stage 0 `dev/index.html` and to production `index.html`. A later production fix can therefore be byte-for-byte the same change.

## SHA-256

| Build | Bytes | SHA-256 |
|---|---|---|
| Stage 0 dev (live, rollback 1) | 212,311 | `96a1182df0f630cdc3d3e271c8d393c921f2afc027133e9cb9d623b487f03dda` |
| Stage 1a dev (rollback 2) | 232,762 | `2bee6b3769bba14a4415c39e690f73d88f09239df1b0669970dd4ec2aed55881` |
| **Stage 1a + HUD repair** | 232,835 | `46f8b85eca5d03b9f9ec3c6c4838d344d257c3d0e8ce23f6eefaf1d65fef5fa3` |

The Stage 0 dev, the 0706 backup and production are unchanged (re-hashed after the work). Candidate copies of both new builds were added to `backups/` as new files.

## Test results (Claude's sandbox, MOCKED ENGINE: Three.js replaced by a stand-in)

| Suite | Repaired build | Unrepaired Stage 1a |
|---|---|---|
| `hud-repair.test.js` (new, 24) | **24 passed** | 9 passed, **15 failed** (proves the checks detect the bug) |
| `stage0.test.js` (33) | 33 passed | 33 passed (earlier run) |
| `exploratory-controls.test.js` (19 × 3 runs) | 19/19 every run | 19/19 every run (earlier run) |
| `stage1a.test.js` (34, updated: self-test must report no FAIL) | 34 passed | the old version expected exactly 1 FAIL |
| In-page Self-test (inside the Stage 1a suite) | **22 passed, 0 failed** | 21 passed, 1 failed (HUD) |

Coverage of the regression areas you listed:
- **Distance:** updates during a run, tracks the game's distance, freezes on pause, moves after resume, and resets on restart.
- **Rings and ×2:** the Grimoire shows a ring and the ×2 badge; the ring empties over time; the Chalice adds a second ring; when the Grimoire ends, its ring and the badge disappear; no leftovers after restart.
- **Faces:** the ability face is set at startup, the profile face matches it, and both change when you pick another character.
- **Menu:** the subtitle shows the hero; the tab highlight follows Collection, Progress and Home; side buttons show only on Home; character select scrolls the chosen card into view.
- **Gameplay and saves:** lane change, pause, resume, restart, save isolation (production keys untouched, no new non-dev keys, guard redirects 0), and no page errors.

In the Stage 1a suite's results file, the one line `FAIL  resume … error: Cannot read properties of null` is **expected**. It comes from that suite's deliberately broken self-test, which checks that failures are reported rather than swallowed.

## Limitations: what these tests cannot prove

The stand-in draws nothing. These checks prove the game loop updates the HUD and menu correctly. They do **not** prove what you see. The following need a real browser:
1. The HUD distance, rings and ×2 badge are visible and correctly placed over the 3D scene, including iPhone safe areas.
2. The voxel faces (SVG images) actually render on the ability and profile buttons in Safari and Chrome.
3. A real power-up **pickup by running into it** shows the ring and badge. The tests called the pickup handler directly.
4. Swiping between menu pages (touch) moves the tab highlight and hides or shows the side buttons. The tests used tab taps.
5. Performance cost. `ui2Tick` runs every frame and creates a few small temporary objects. It ran every frame in the 06:51–07:06 builds you played before, so I expect it to be small, but only the real-device benchmark can confirm it.

## Upload options (you choose; nothing has been uploaded)

**Option A (one step): Stage 1a and the HUD repair together.** In GitHub, go into the `dev` folder, choose **Add file → Upload files**, and drag in `dev/index.html` and the `dev/tests` folder from this package. Commit: `Stage 1a tools + HUD repair (dev only)`. Check that `dev/index.html` shows 232,835 bytes.

**Option B (two steps):** upload the Stage 1a package first and test it. Then upload this package's `dev/index.html` and `dev/tests`. This lets you benchmark before and after the repair on your devices.

Root `index.html` and every other root file are **not** in this package. Don't upload them.

## Rollback

| To return to | Upload into `dev/` as `index.html` | SHA-256 |
|---|---|---|
| Stage 1a (undo only the HUD repair) | `rollback/dev-index-stage1a.html` | `2bee6b37…5881` |
| Stage 0 (current live dev, untouched) | `rollback/dev-index-stage0.html` | `96a1182d…3dda` |

## Testing the repaired dev build (before deciding about production)

On the Chromebook (Chrome) and the iPhone (Safari), open `…/BloodRush_Game/dev/?debug=1`:
1. **Main menu:**
   - The subtitle shows your hero, for example "BRAN · THE NEWBORN".
   - The profile button (top-left) shows the voxel face.
   - Tap **Collection**, then **Progress**: the highlight moves and the side buttons disappear. Tap **Home**: they come back.
   - Repeat by swiping the menu pages.
2. **Heroes:** pick another vampire. The card scrolls into view, and after you go back, the faces and subtitle match.
3. **Run:**
   - The ability button (bottom-left) shows the face, and the top-right distance counts up.
   - Collect a power-up. A ring appears on the right and empties. A Grimoire shows the ×2 badge, and the "2s!" warning appears near the end.
   - Pause: distance stops. Resume: it moves again. Die, then Run again: distance restarts from 0.
4. **Overlay:** run **Self-test**. Expect "22 passed, 0 failed" with "Engine: Three.js r128". Then run **Benchmark: run 30s** three times. Copy the results each time and paste them to Claude.
5. **Production:** open it and confirm it's unchanged. Its HUD still shows "0 m" until the same fix is applied there.

If all of that looks right on both devices, the production fix is the same 73-byte patch, applied to root `index.html` as a separate, approved step.
