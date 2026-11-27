// Flight model for Skycourier: a forgiving arcade model with real trade-offs.
//
// The plane has speed (m/s), heading (degrees), pitch and roll. Throttle
// sets thrust; drag grows with speed; pitch trades speed for altitude; roll
// banks the plane and turns it; below stall speed the nose drops and the
// plane sinks. Fuel drains with throttle. Landing is a gentle touchdown on a
// runway with low vertical speed and a heading close to the runway's; anything
// else is a crash, with damage that scales with how hard the impact was.

export const FLIGHT = {
  maxSpeed: 85,         // m/s at full throttle, level flight (~165 kt)
  cruiseSpeed: 62,      // comfortable cruise
  stallSpeed: 26,       // below this the wing stops flying
  rotationSpeed: 38,    // rolling this fast with the nose up, the wing lifts off
  maxThrottle: 1,
  fuelCapacity: 100,
  fuelBurn: 0.55,       // fuel units per second at full throttle
  gravity: 9.8,
};

export function createPlane() {
  return {
    x: 0, y: 75, z: 700,     // parked at the south end of Home runway, on the ground
    heading: 0,              // north, down the runway
    pitch: 0,                // degrees, + is nose up
    roll: 0,                 // degrees, + is right wing down
    speed: 0,                // m/s along the nose
    throttle: 0,
    verticalSpeed: 0,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,               // 0-100; 100 is a wreck
    onGround: true,
    flaps: false,
  };
}

// One physics step. `ctl` carries the pilot's inputs for this frame:
// pitch (-1..1, + is pull up), roll (-1..1, + is right), throttleDelta,
// brake (bool), flaps (bool). `dt` is seconds.
export function stepPlane(p, ctl, dt) {
  // Throttle: W/S nudge it, Shift/Ctrl slam it; empty tank means no thrust.
  p.throttle = clamp(p.throttle + ctl.throttleDelta * dt, 0, FLIGHT.maxThrottle);
  const thrust = p.fuel > 0 ? p.throttle : 0;
  p.fuel = Math.max(0, p.fuel - thrust * FLIGHT.fuelBurn * dt);

  // Pitch and roll ease towards the pilot's command; the plane never snaps.
  const pitchTarget = clamp(ctl.pitch * 22, -18, 24);
  const rollTarget = clamp(ctl.roll * 55, -60, 60);
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 2.2);
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 2.6);

  // Speed: thrust pushes forward, drag holds it back, climbing costs speed,
  // descending gives it back. Brakes and flaps bleed speed on the ground.
  const drag = 0.004 * p.speed * Math.abs(p.speed);
  const climbCost = Math.sin((p.pitch * Math.PI) / 180) * FLIGHT.gravity * 0.9;
  let accel = thrust * 26 - drag - climbCost;
  if (ctl.brake) accel -= 22;
  if (p.flaps) accel -= 6;
  p.speed = Math.max(0, p.speed + accel * dt);
  if (p.speed > FLIGHT.maxSpeed) p.speed = FLIGHT.maxSpeed;

  // Stall: below stall speed the wing quits, the nose drops and we sink.
  const stalled = p.speed < FLIGHT.stallSpeed && !p.onGround;
  if (stalled) {
    p.pitch -= 14 * dt;
    p.verticalSpeed -= 22 * dt;
  }

  // Turn: banked flight turns the heading; steeper bank, faster turn.
  const turnRate = (FLIGHT.gravity * Math.tan((p.roll * Math.PI) / 180)) / Math.max(p.speed, 12);
  p.heading = (p.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

  // Vertical speed follows pitch and speed; a stalled plane just falls.
  const targetVs = stalled ? -14 : Math.sin((p.pitch * Math.PI) / 180) * p.speed;
  p.verticalSpeed += (targetVs - p.verticalSpeed) * Math.min(1, dt * 2.0);
  p.y += p.verticalSpeed * dt;

  // Move along the nose.
  const hRad = (p.heading * Math.PI) / 180;
  const forward = Math.cos((p.pitch * Math.PI) / 180) * p.speed * dt;
  p.x += Math.sin(hRad) * forward;
  p.z -= Math.cos(hRad) * forward;

  return { stalled };
}

// Heading difference in degrees, wrapped to -180..180.
export function headingDiff(a, b) {
  return ((a - b + 540) % 360) - 180;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Landing quality when the wheels touch. Returns "landed", "hard" or "crash".
// A good landing needs low vertical speed, low speed, a runway under the
// wheels and a heading roughly along it.
export function landingCheck(p, runway) {
  const vs = Math.abs(p.verticalSpeed);
  const align = Math.abs(headingDiff(p.heading, runway.heading));
  const aligned = Math.min(align, 360 - align);
  if (vs > 9 || p.speed > 75 || aligned > 28) return "crash";
  if (vs > 5 || p.speed > 55 || aligned > 15) return "hard";
  return "landed";
}
