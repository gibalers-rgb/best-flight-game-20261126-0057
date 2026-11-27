// Missions for Skycourier: three sorties with different goals, so flying well
// is a decision, not just a straight line. Fuel and damage turn every sortie
// into a trade-off: push the throttle and you get there faster on less fuel
// margin; fly low and fast and a mistake is a crash.
//
//   1. Ring Run — fly through all 8 rings in order, as fast as you can.
//   2. Island Hop — land cleanly on the runways of Palm Cay, Turtle Rock and
//      Coral Bay, in that order, then come home.
//   3. Courier Dash — pick up the parcel on Home runway, deliver it to Far
//      Point before the 4-minute timer runs out, then land there.

import { ISLANDS, RINGS } from "./world.js";

export const MISSIONS = [
  {
    id: 1,
    name: "Ring Run",
    brief: "Fly through all 8 gold rings in order. Fast and smooth wins.",
  },
  {
    id: 2,
    name: "Island Hop",
    brief: "Land on Palm Cay, Turtle Rock, then Coral Bay. Gentle touchdowns only.",
  },
  {
    id: 3,
    name: "Courier Dash",
    brief: "Parcel waiting on Home runway. Deliver to Far Point in under 4:00.",
  },
];

export function createMissionState(id) {
  const mission = MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
  return {
    mission,
    ringIndex: 0,
    // Island Hop legs, in order: the island to land on next.
    hopLegs: [ISLANDS[1], ISLANDS[2], ISLANDS[3]],
    hopIndex: 0,
    // Courier Dash: parcel picked up, then delivered.
    parcel: false,
    delivered: false,
    timeLeft: 240,
    elapsed: 0,
    score: 0,
    done: false,
    message: mission.brief,
    messageTimer: 4,
  };
}

// The current objective, as one short line for the HUD.
export function objectiveLine(s) {
  if (s.done) return "Mission complete — press R to fly again";
  const m = s.mission;
  if (m.id === 1) {
    return s.ringIndex >= RINGS.length
      ? "All rings flown!"
      : `Ring ${s.ringIndex + 1} of ${RINGS.length} — follow the gold ring`;
  }
  if (m.id === 2) {
    if (s.hopIndex >= s.hopLegs.length) return "All islands visited — land at Home!";
    return `Land on ${s.hopLegs[s.hopIndex].name} runway (${s.hopIndex + 1}/3)`;
  }
  if (!s.parcel) return "Parcel on Home runway — land or taxi over it to pick up";
  if (!s.delivered) return "Parcel aboard — deliver to Far Point runway!";
  return "Parcel delivered — land on Far Point runway to finish";
}

// The target the HUD arrow and the next-ring beacon should point at:
// a ring, a runway, or the parcel / delivery runway.
export function currentTarget(s, plane) {
  const m = s.mission;
  if (m.id === 1 && s.ringIndex < RINGS.length) {
    const r = RINGS[s.ringIndex];
    return { x: r.x, y: r.y, z: r.z, kind: "ring", radius: r.r };
  }
  if (m.id === 2) {
    const leg = s.hopIndex < s.hopLegs.length ? s.hopLegs[s.hopIndex] : ISLANDS[0];
    const rw = leg.runway;
    return { x: rw.x, y: 95, z: rw.z, kind: "runway", name: leg.name };
  }
  if (m.id === 3) {
    if (!s.parcel) {
      const rw = ISLANDS[0].runway;
      return { x: rw.x, y: 95, z: rw.z + 200, kind: "parcel", name: "Parcel" };
    }
    const rw = ISLANDS[4].runway;
    return { x: rw.x, y: 95, z: rw.z, kind: "runway", name: "Far Point" };
  }
  return null;
}

// Per-frame mission logic. `events` collects what happened this frame:
// "ring", "landed", "hard", "crash", "pickup", "delivered", "complete",
// "timeout", "fuel". The caller turns events into sound and messages.
export function stepMission(s, plane, dt, groundY, events) {
  s.elapsed += dt;
  const m = s.mission;

  if (m.id === 3 && !s.done) {
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      events.push("timeout");
      s.message = "Out of time — the parcel missed its window. Press R to retry.";
      s.messageTimer = 6;
      s.done = true;
    }
  }

  if (plane.fuel <= 0 && !s.done) {
    events.push("fuel");
    s.message = "Fuel empty! Glide to the nearest runway — any landing counts.";
    s.messageTimer = 5;
  }

  // Ring Run: score a ring when the plane passes within its radius.
  if (m.id === 1 && s.ringIndex < RINGS.length) {
    const r = RINGS[s.ringIndex];
    const d = Math.hypot(plane.x - r.x, plane.y - r.y, plane.z - r.z);
    if (d < r.r) {
      s.ringIndex += 1;
      s.score += 100 + Math.max(0, Math.round(50 - plane.speed * 0.2));
      events.push("ring");
      if (s.ringIndex >= RINGS.length) {
        s.done = true;
        s.score += 500;
        events.push("complete");
        s.message = `Ring Run complete in ${fmtTime(s.elapsed)}! Score ${s.score}. Press R to fly again.`;
        s.messageTimer = 8;
      } else {
        s.message = `Ring ${s.ringIndex} of ${RINGS.length} — nice flying!`;
        s.messageTimer = 2.5;
      }
    }
  }

  // Courier Dash pickup: taxi or fly low over the parcel on Home runway.
  if (m.id === 3 && !s.parcel) {
    const rw = ISLANDS[0].runway;
    const d = Math.hypot(plane.x - rw.x, plane.z - (rw.z + 200));
    if (d < 70 && plane.y < 130) {
      s.parcel = true;
      s.score += 50;
      events.push("pickup");
      s.message = "Parcel aboard! Far Point, 4 minutes on the clock — go!";
      s.messageTimer = 4;
    }
  }

  if (s.messageTimer > 0) s.messageTimer -= dt;
  return events;
}

// Called when the wheels touch ground. Returns what the touchdown means for
// the active mission: "landed" advances a leg, "hard" damages the plane,
// "crash" ends the flight. `runway` is the runway landed on, or null.
export function onTouchdown(s, plane, runway, quality) {
  const m = s.mission;
  if (quality === "crash") return "crash";

  if (m.id === 2 && runway) {
    const leg = s.hopIndex < s.hopLegs.length ? s.hopLegs[s.hopIndex] : null;
    if (leg && runway === leg.runway) {
      s.hopIndex += 1;
      s.score += 200;
      if (s.hopIndex >= s.hopLegs.length) {
        s.message = "All three islands visited — land at Home to finish!";
        s.messageTimer = 5;
      } else {
        s.message = `Landed on ${leg.name}! Next: ${s.hopLegs[s.hopIndex].name}.`;
        s.messageTimer = 4;
      }
      return quality;
    }
    if (runway === ISLANDS[0].runway && s.hopIndex >= s.hopLegs.length) {
      s.done = true;
      s.score += 500;
      s.message = `Island Hop complete in ${fmtTime(s.elapsed)}! Score ${s.score}. Press R to fly again.`;
      s.messageTimer = 8;
      return "complete";
    }
  }

  if (m.id === 3 && s.delivered && runway === ISLANDS[4].runway) {
    s.done = true;
    s.score += 500 + Math.max(0, Math.round(s.timeLeft)) * 2;
    s.message = `Delivered with ${fmtTime(s.timeLeft)} to spare! Score ${s.score}. Press R to fly again.`;
    s.messageTimer = 8;
    return "complete";
  }

  if (m.id === 3 && s.parcel && !s.delivered && runway === ISLANDS[4].runway) {
    s.delivered = true;
    s.score += 200;
    s.message = "Parcel delivered! Land on this runway to finish the job.";
    s.messageTimer = 5;
    return "landed";
  }

  return quality;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Distance and bearing from the plane to a target, for the HUD arrow.
export function bearingTo(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const dist = Math.hypot(dx, dz);
  const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const rel = ((bearing - plane.heading + 540) % 360) - 180;
  return { dist, rel };
}
