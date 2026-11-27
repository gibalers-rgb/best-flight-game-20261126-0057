# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/gibalers-rgb/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/gibalers-rgb/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Skycourier: Island Hopper** — a complete flight game in a desktop browser,
from static files with no network request. Fly the courier plane across a
tropical archipelago in chase view: a cockpit-style HUD with altitude, speed
and heading, lit instruments (airspeed, altimeter, compass, fuel), runways and
gold target rings ahead, and recognisable island terrain below.

Three missions with different goals: **Ring Run** (fly through 8 gold rings),
**Island Hop** (land on three island runways), and **Courier Dash** (pick up a
parcel on Home runway and deliver it to Far Point in under 4 minutes). Fuel
drains with throttle and hard landings damage the airframe, so every sortie is
a decision about speed, altitude and fuel.

## Controls

- **Arrow keys** pitch and roll; **mouse drag** steers like a stick
- **W / S** throttle up / down, **Shift** full throttle, **Ctrl** idle
- **Space** brake, **F** flaps, **P** pause, **M** mute, **R** restart
- **1 / 2 / 3** start Ring Run, Island Hop, Courier Dash

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome and fly. Screenshot presets
(`?shot=takeoff|ring|islands|landing`) freeze a deterministic frame of the
game's own code — the entry's screenshots were taken from those URLs.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library.
