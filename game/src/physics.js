// Flight model for Skycourier: Island Hopper — a forgiving arcade model
// with real trade-offs.
//
// The aircraft carries speed (m/s), heading (degrees), pitch and roll.
// Throttle sets thrust; drag grows with speed; pitch trades speed for
// altitude; roll banks the aircraft and turns it; below stall speed the
// nose drops and the aircraft sinks. Fuel drains with throttle. A landing
// is a gentle touchdown on a runway with low vertical speed and a heading
// close to the runway's; anything else is a crash, with damage that scales
// with how hard the impact was.

export const FLIGHT = {
  maxSpeed: 85,        // m/s at full throttle, level flight (~165 kt)
  cruiseSpeed: 62,     // comfortable cruise
  stallSpeed: 26,      // below this the wing stops flying
  rotationSpeed: 38,   // rolling this fast with the nose up, the wing lifts off
  maxThrottle: 1,
  fuelCapacity: 100,
  fuelBurn: 0.55,      // fuel units per second at full throttle
  gravity: 9.8,
};

export const KNOTS_PER_MS = 1.94384; // m/s to knots
export const FEET_PER_M = 3.28084;  // m to ft

export function newAircraft() {
  return {
    x: 0, y: 75, z: 700, // parked at the south end of Home runway, on the ground
    heading: 0,          // north, down the runway
    pitch: 0,            // degrees, + is nose up
    roll: 0,             // degrees, + is right wing down
    speed: 0,            // m/s along the nose
    throttle: 0,
    verticalSpeed: 0,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,           // 0-100; 100 is a wreck
    onGround: true,
    flaps: false,
  };
}

export function clampValue(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Signed difference between two headings, wrapped to -180..180.
export function wrapDegrees(a, b) {
  return ((a - b + 540) % 360) - 180;
}

// One physics step. `ctl` carries the pilot's inputs for this frame:
// pitch (-1..1, + is pull up), roll (-1..1, + is right), throttleDelta,
// brake (bool), flaps (bool). `dt` is seconds.
export function stepAircraft(a, ctl, dt) {
  // Throttle: W/S nudge it, Shift/Ctrl slam it; an empty tank gives no thrust.
  a.throttle = clampValue(a.throttle + ctl.throttleDelta * dt, 0, FLIGHT.maxThrottle);
  const thrust = a.fuel > 0 ? a.throttle : 0;
  a.fuel = Math.max(0, a.fuel - thrust * FLIGHT.fuelBurn * dt);

  // Pitch and roll ease towards the pilot's command; the aircraft never snaps.
  const pitchTarget = clampValue(ctl.pitch * 22, -18, 24);
  const rollTarget = clampValue(ctl.roll * 55, -60, 60);
  a.pitch += (pitchTarget - a.pitch) * Math.min(1, dt * 2.2);
  a.roll += (rollTarget - a.roll) * Math.min(1, dt * 2.6);

  // Speed: thrust pushes forward, drag holds it back, climbing costs speed
  // and descending gives it back. Brakes and flaps bleed speed on the ground.
  const drag = 0.004 * a.speed * Math.abs(a.speed);
  const climbCost = Math.sin((a.pitch * Math.PI) / 180) * FLIGHT.gravity * 0.9;
  let accel = thrust * 26 - drag - climbCost;
  if (ctl.brake) accel -= 22;
  if (a.flaps) accel -= 6;
  a.speed = Math.max(0, a.speed + accel * dt);
  if (a.speed > FLIGHT.maxSpeed) a.speed = FLIGHT.maxSpeed;

  // Stall: below stall speed the wing quits, the nose drops and we sink.
  const stalled = a.speed < FLIGHT.stallSpeed && !a.onGround;
  if (stalled) {
    a.pitch -= 14 * dt;
    a.verticalSpeed -= 22 * dt;
  }

  // Turn: banked flight turns the heading; steeper bank, faster turn.
  const turnRate = (FLIGHT.gravity * Math.tan((a.roll * Math.PI) / 180)) / Math.max(a.speed, 12);
  a.heading = (a.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

  // Vertical speed follows pitch and speed; a stalled aircraft just falls.
  const targetVs = stalled ? -14 : Math.sin((a.pitch * Math.PI) / 180) * a.speed;
  a.verticalSpeed += (targetVs - a.verticalSpeed) * Math.min(1, dt * 2.0);
  a.y += a.verticalSpeed * dt;

  // Move along the nose.
  const hRad = (a.heading * Math.PI) / 180;
  const forward = Math.cos((a.pitch * Math.PI) / 180) * a.speed * dt;
  a.x += Math.sin(hRad) * forward;
  a.z -= Math.cos(hRad) * forward;

  return { stalled };
}

// Landing quality when the wheels touch. Returns "landed", "hard" or
// "crash". A good landing needs low vertical speed, low speed, a runway
// under the wheels and a heading roughly along it.
export function gradeTouchdown(a, runway) {
  const vs = Math.abs(a.verticalSpeed);
  const align = Math.abs(wrapDegrees(a.heading, runway.heading));
  const aligned = Math.min(align, 360 - align);
  if (vs > 9 || a.speed > 75 || aligned > 28) return "crash";
  if (vs > 5 || a.speed > 55 || aligned > 15) return "hard";
  return "landed";
}
