// Skycourier: Island Hopper — entry point.
//
// Boot: read the ?shot= preset (used for the entry's screenshots), build the
// world, and run the loop. Game phases: title, flying, paused, crashed,
// complete. The loop steps physics, checks the ground, runs the mission
// logic and renders every frame. Everything is deterministic for a
// screenshot preset: the sim is frozen at a chosen moment, so the same URL
// always renders the same frame.

import { newAircraft, stepAircraft, gradeTouchdown, FLIGHT } from "./physics.js";
import { groundHeightAt, islandUnder, ISLANDS } from "./world.js";
import { makeControls } from "./input.js";
import { makeSound } from "./audio.js";
import { makeRenderer } from "./render.js";
import { newSortie, advanceSortie, touchdownOutcome, sortieTarget } from "./missions.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");

const controls = makeControls(canvas);
const sound = makeSound();
const renderer = makeRenderer(canvas);

let plane = newAircraft();
let sortie = newSortie(1);
let phase = "title";
let time = 0;
let last = performance.now();
let statusText = "";

function setStatus(text) {
  if (text !== statusText) {
    statusText = text;
    statusEl.textContent = text;
  }
}

// Screenshot presets: frozen moments that show the game at its best.
//   takeoff — on Home runway, runway and threshold ahead, instruments lit.
//   ring    — mid-flight, the next gold ring dead ahead over the islands.
//   islands — high over the archipelago, three islands and two rings in view.
//   landing — final approach to Palm Cay runway, low and lined up.
function applyShot(name) {
  if (!name) return;
  const known = ["takeoff", "ring", "islands", "landing"];
  if (!known.includes(name)) {
    console.warn(`Skycourier: unknown shot preset "${name}", showing the title screen.`);
    return;
  }
  phase = "flying";
  if (name === "takeoff") {
    // On Home runway near its south end, rolling for takeoff: the strip,
    // its dashes and the threshold ahead, instruments lit.
    plane = newAircraft();
    plane.x = 0; plane.y = 76; plane.z = 100;
    plane.heading = 0; plane.throttle = 0.75; plane.speed = 34;
    plane.onGround = true;
    sortie = newSortie(1);
  } else if (name === "ring") {
    plane = newAircraft();
    plane.x = 450; plane.y = 340; plane.z = -1150;
    plane.heading = 12; plane.pitch = 2; plane.roll = -8;
    plane.speed = 68; plane.throttle = 0.8; plane.onGround = false;
    sortie = newSortie(1);
    sortie.message = "Ring 1 of 8 — follow the gold ring";
    sortie.messageTimer = 99;
  } else if (name === "islands") {
    plane = newAircraft();
    plane.x = 1400; plane.y = 620; plane.z = -800;
    plane.heading = 335; plane.pitch = -4; plane.roll = 14;
    plane.speed = 74; plane.throttle = 0.7; plane.onGround = false;
    sortie = newSortie(2);
    sortie.message = "Land on Palm Cay (1/3)";
    sortie.messageTimer = 99;
  } else if (name === "landing") {
    plane = newAircraft();
    const rw = ISLANDS[1].runway;
    // Final approach, offset left of the centre line so the runway strip
    // shows ahead of the plane instead of hiding behind it.
    const h = (rw.heading * Math.PI) / 180;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    plane.x = rw.x - fx * 1100 - rx * 170;
    plane.z = rw.z - fz * 1100 - rz * 170;
    plane.y = 250; plane.heading = rw.heading; plane.pitch = -4;
    plane.speed = 48; plane.throttle = 0.45; plane.flaps = true;
    plane.onGround = false;
    sortie = newSortie(2);
    sortie.message = "Final approach — Palm Cay runway ahead";
    sortie.messageTimer = 99;
  }
}

function beginSortie(id) {
  sortie = newSortie(id);
  plane = newAircraft();
  // Courier Dash starts parked on the parcel: taxi over it to pick it up.
  if (id === 3) {
    plane.z = 950;
  }
  phase = "flying";
  sound.unlock();
}

function endFlight(reason) {
  phase = "crashed";
  plane.damage = 100;
  plane.speed = 0;
  sound.crash();
  setStatus(`Crashed: ${reason}. Press R to fly again.`);
}

// Lateral distance from the plane to a runway's centre line.
function centrelineDistance(p, runway) {
  const h = (runway.heading * Math.PI) / 180;
  const dx = p.x - runway.x;
  const dz = p.z - runway.z;
  return Math.abs(dx * Math.cos(h) + dz * Math.sin(h));
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  const ctl = controls.poll();

  if (ctl.mute) sound.toggleMute();
  if (ctl.restart && phase !== "title") {
    beginSortie(sortie.sortie.id);
  }

  // Title screen: pick a mission with 1/2/3, or any key to free-fly.
  if (phase === "title") {
    if (ctl.mission) beginSortie(ctl.mission);
    else if (ctl.anyKey) {
      phase = "flying";
      sound.unlock();
    }
    renderer.render({ plane, missionState: sortie, target: sortieTarget(sortie), phase }, time);
    requestAnimationFrame(tick);
    return;
  }

  if (ctl.pause && (phase === "flying" || phase === "paused")) {
    phase = phase === "flying" ? "paused" : "flying";
  }

  if (phase === "flying") {
    sound.unlock();
    const { stalled } = stepAircraft(plane, ctl, dt);
    plane.flaps = ctl.flaps;
    sound.engine(plane.throttle, plane.speed, !plane.onGround);

    // Ground contact: compare the wheels with the terrain under them.
    const groundY = groundHeightAt(plane.x, plane.z);
    const overSea = groundY <= 0;
    // Liftoff: rolling fast with the nose up, the wing lifts the plane off
    // instead of the ground clamp pinning it down. Give it a small initial
    // climb so it separates cleanly from the rising ground.
    const liftingOff =
      plane.y <= groundY + 2 && plane.onGround &&
      plane.speed > FLIGHT.rotationSpeed && plane.pitch > 4;
    if (liftingOff) {
      plane.onGround = false;
      plane.verticalSpeed = Math.max(plane.verticalSpeed, 3);
    } else if (plane.y <= groundY + 2) {
      plane.y = groundY + 2;
      plane.verticalSpeed = 0;
      if (!plane.onGround) {
        // Just touched down: judge the landing.
        const island = islandUnder(plane.x, plane.z);
        const runway = island ? island.runway : null;
        const onRunway = runway && centrelineDistance(plane, runway) < runway.width / 2 + 6;
        const quality = onRunway ? gradeTouchdown(plane, runway) : "crash";
        if (quality === "crash") {
          endFlight(overSea ? "ditched in the sea" : "hit the ground too hard");
        } else {
          const result = touchdownOutcome(sortie, plane, onRunway ? runway : null, quality);
          if (quality === "hard") {
            plane.damage += 18;
            sound.thud();
            sortie.message = "Hard landing! The courier winces.";
            sortie.messageTimer = 3;
          } else {
            sound.thud();
          }
          if (result === "complete") {
            phase = "complete";
            sound.deliver();
          }
          plane.onGround = true;
          plane.pitch = 0;
          if (plane.damage >= 100) endFlight("the airframe gave out");
        }
      } else {
        plane.onGround = true;
      }
      // Rolling on the ground bleeds speed; brakes help.
      plane.speed = Math.max(0, plane.speed - (ctl.brake ? 26 : 4) * dt);
      if (plane.speed < 2 && plane.throttle < 0.1) plane.speed = 0;
    } else {
      plane.onGround = false;
    }
    if (stalled && !plane.onGround) {
      setStatus("Stall! Add power and lower the nose.");
    }

    // Mission logic: rings, pickup, timers, fuel warnings.
    const events = [];
    advanceSortie(sortie, plane, dt, events);
    for (const e of events) {
      if (e === "ring") sound.ring();
      if (e === "pickup" || e === "delivered") sound.deliver();
      if (e === "complete") {
        phase = "complete";
        sound.deliver();
      }
    }

    // Fuel empty while airborne with no speed left is a forced ditching.
    if (plane.fuel <= 0 && plane.speed < 8 && !plane.onGround && plane.y < 30) {
      endFlight("ran out of fuel over the sea");
    }

    setStatus(
      `Skycourier ${sortie.sortie.name}: altitude ${Math.round(plane.y * 3.28)} ft, ` +
      `speed ${Math.round(plane.speed * 1.94)} kt, heading ${Math.round(plane.heading)} degrees, ` +
      `fuel ${Math.round(plane.fuel)} percent, score ${sortie.score}.`,
    );
  }

  renderer.render(
    { plane, missionState: sortie, target: sortieTarget(sortie), phase },
    time,
  );
  requestAnimationFrame(tick);
}

applyShot(shot);
if (shot) {
  // Frozen frame for a screenshot: render once, never advance the sim.
  renderer.render(
    { plane, missionState: sortie, target: sortieTarget(sortie), phase },
    1.2,
  );
} else {
  requestAnimationFrame(tick);
}
