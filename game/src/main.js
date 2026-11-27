// Skycourier: Island Hopper — entry point.
//
// Boot: read the ?shot= preset (used for the entry's screenshots), build the
// world, and run the loop. Game phases: title, flying, paused, crashed,
// complete. The loop steps physics, checks the ground, runs the mission logic
// and renders every frame. Everything is deterministic for a screenshot preset:
// the sim is frozen at a chosen moment, so the same URL always renders the
// same frame.

import { createPlane, stepPlane, landingCheck, FLIGHT } from "./physics.js";
import { groundHeight, islandAt, ISLANDS } from "./world.js";
import { createInput } from "./input.js";
import { createAudio } from "./audio.js";
import { createRenderer } from "./render.js";
import { createMissionState, stepMission, onTouchdown, currentTarget } from "./missions.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");

const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

let plane = createPlane();
let missionState = createMissionState(1);
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
  phase = "flying";
  if (name === "takeoff") {
    // On Home runway near its south end, rolling for takeoff: the strip,
    // its dashes and the threshold ahead, instruments lit.
    plane = createPlane();
    plane.x = 0; plane.y = 76; plane.z = 100;
    plane.heading = 0; plane.throttle = 0.75; plane.speed = 34;
    plane.onGround = true;
    missionState = createMissionState(1);
  } else if (name === "ring") {
    plane = createPlane();
    plane.x = 450; plane.y = 340; plane.z = -1150;
    plane.heading = 12; plane.pitch = 2; plane.roll = -8;
    plane.speed = 68; plane.throttle = 0.8; plane.onGround = false;
    missionState = createMissionState(1);
    missionState.message = "Ring 1 of 8 — follow the gold ring";
    missionState.messageTimer = 99;
  } else if (name === "islands") {
    plane = createPlane();
    plane.x = 1400; plane.y = 620; plane.z = -800;
    plane.heading = 335; plane.pitch = -4; plane.roll = 14;
    plane.speed = 74; plane.throttle = 0.7; plane.onGround = false;
    missionState = createMissionState(2);
    missionState.message = "Land on Palm Cay (1/3)";
    missionState.messageTimer = 99;
  } else if (name === "landing") {
    plane = createPlane();
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
    missionState = createMissionState(2);
    missionState.message = "Final approach — Palm Cay runway ahead";
    missionState.messageTimer = 99;
  }
}

function startMission(id) {
  missionState = createMissionState(id);
  plane = createPlane();
  // Courier Dash starts parked on the parcel: taxi over it to pick it up.
  if (id === 3) {
    plane.z = 950;
  }
  phase = "flying";
  audio.unlock();
}

function crash(reason) {
  phase = "crashed";
  plane.damage = 100;
  plane.speed = 0;
  audio.crash();
  setStatus(`Crashed: ${reason}. Press R to fly again.`);
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  const ctl = input.read(dt);

  if (ctl.mute) audio.toggleMute();
  if (ctl.restart && phase !== "title") {
    startMission(missionState.mission.id);
  }

  // Title screen: pick a mission with 1/2/3, or any key to free-fly.
  if (phase === "title") {
    if (ctl.mission) startMission(ctl.mission);
    else if (ctl.anyKey) {
      phase = "flying";
      audio.unlock();
    }
    renderer.render({ plane, missionState, target: currentTarget(missionState, plane), phase }, time);
    requestAnimationFrame(frame);
    return;
  }

  if (ctl.pause && (phase === "flying" || phase === "paused")) {
    phase = phase === "flying" ? "paused" : "flying";
  }

  if (phase === "flying") {
    audio.unlock();
    const { stalled } = stepPlane(plane, ctl, dt);
    plane.flaps = ctl.flaps;
    audio.engine(plane.throttle, plane.speed, !plane.onGround);

    // Ground contact: compare the wheels with the terrain under them.
    const groundY = groundHeight(plane.x, plane.z);
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
        const island = islandAt(plane.x, plane.z);
        const runway = island ? island.runway : null;
        const onRunway = runway && runwayDistance(plane, runway) < runway.width / 2 + 6;
        const quality = onRunway ? landingCheck(plane, runway) : "crash";
        if (quality === "crash") {
          crash(overSea ? "ditched in the sea" : "hit the ground too hard");
        } else {
          const result = onTouchdown(missionState, plane, onRunway ? runway : null, quality);
          if (quality === "hard") {
            plane.damage += 18;
            audio.thud();
            missionState.message = "Hard landing! The courier winces.";
            missionState.messageTimer = 3;
          } else {
            audio.thud();
          }
          if (result === "complete") {
            phase = "complete";
            audio.deliver();
          }
          plane.onGround = true;
          plane.pitch = 0;
          if (plane.damage >= 100) crash("the airframe gave out");
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
    stepMission(missionState, plane, dt, groundY, events);
    for (const e of events) {
      if (e === "ring") audio.ring();
      if (e === "pickup" || e === "delivered") audio.deliver();
      if (e === "complete") {
        phase = "complete";
        audio.deliver();
      }
    }

    // Fuel empty while airborne with no speed left is a forced ditching.
    if (plane.fuel <= 0 && plane.speed < 8 && !plane.onGround && plane.y < 30) {
      crash("ran out of fuel over the sea");
    }

    setStatus(
      `Skycourier ${missionState.mission.name}: altitude ${Math.round(plane.y * 3.28)} ft, ` +
      `speed ${Math.round(plane.speed * 1.94)} kt, heading ${Math.round(plane.heading)} degrees, ` +
      `fuel ${Math.round(plane.fuel)} percent, score ${missionState.score}.`,
    );
  }

  renderer.render(
    { plane, missionState, target: currentTarget(missionState, plane), phase },
    time,
  );
  requestAnimationFrame(frame);
}

// Lateral distance from the plane to a runway's centre line.
function runwayDistance(p, runway) {
  const h = (runway.heading * Math.PI) / 180;
  const dx = p.x - runway.x;
  const dz = p.z - runway.z;
  return Math.abs(dx * Math.cos(h) + dz * Math.sin(h));
}

applyShot(shot);
if (shot) {
  // Frozen frame for a screenshot: render once, never advance the sim.
  renderer.render(
    { plane, missionState, target: currentTarget(missionState, plane), phase },
    1.2,
  );
} else {
  requestAnimationFrame(frame);
}
