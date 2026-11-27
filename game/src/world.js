// World data for Skycourier: Island Hopper — the archipelago the courier flies.
//
// Axes: x runs east, z runs south, y is altitude in metres. Heading 0 points
// north (towards -z) and 90 points east (+x). The playable sea is about
// 12 km across: a hop between islands takes under a minute at cruise speed,
// and from anywhere in the sky there is always an island or a ring to aim for.

export const SEA_LEVEL = 0;
export const HAZE_DISTANCE = 9000;

// The flat top of an island: out to this fraction of its radius the ground
// sits at this fraction of its peak height, flat enough for a runway.
export const PLATEAU_FRACTION = 0.62;
export const PLATEAU_HEIGHT = 0.82;

function makeIsland(name, x, z, radius, peak, color, sand, runway) {
  return { name, x, z, radius, peak, color, sand, runway };
}

export const ISLANDS = [
  makeIsland("Home Island", 0, 0, 1500, 90, "#3f8f4f", "#e8d9a0",
    { x: 0, z: -150, heading: 0, length: 620, width: 46 }),
  makeIsland("Palm Cay", 2600, -2400, 1100, 70, "#4a9a55", "#ecdca8",
    { x: 2600, z: -2400, heading: 45, length: 520, width: 42 }),
  makeIsland("Turtle Rock", -2900, -2600, 950, 120, "#3a8547", "#e2d198",
    { x: -2900, z: -2600, heading: 315, length: 480, width: 40 }),
  makeIsland("Coral Bay", 900, -5200, 1300, 60, "#4da35c", "#efe0aa",
    { x: 900, z: -5200, heading: 90, length: 560, width: 44 }),
  makeIsland("Far Point", -3400, 2900, 1000, 80, "#458f50", "#e6d69c",
    { x: -3400, z: 2900, heading: 135, length: 500, width: 42 }),
];

// Gold rings floating in the air along a tour of the archipelago. Flying
// through the centre of the next ring (within its radius) scores it; the
// rings are flown in order.
export const RINGS = [
  { x: 0,     y: 320, z: -1400, r: 55 },
  { x: 900,   y: 380, z: -2600, r: 55 },
  { x: 2200,  y: 340, z: -2600, r: 55 },
  { x: 2600,  y: 300, z: -1600, r: 55 },
  { x: 1800,  y: 420, z: -4200, r: 55 },
  { x: 900,   y: 360, z: -5200, r: 55 },
  { x: -800,  y: 400, z: -4200, r: 55 },
  { x: -2900, y: 320, z: -2600, r: 55 },
];

// Height of an island's flat top: the plateau the runway sits on.
export function plateauTop(island) {
  return island.peak * PLATEAU_HEIGHT;
}

// Ground height at (x, z): the top of the island hill, or sea level. A hill
// is a smooth dome — full peak height at the centre, falling to the sea at
// the rim — with a flat plateau near the top where the runway sits. The
// island the renderer draws is a flat-topped disc whose green top sits at
// peak * 0.82 out to 62% of the radius, so the collision ground is the same
// plateau inside the disc and the dome slope outside it: the runway the
// player sees is the runway the wheels roll on.
export function groundHeightAt(x, z) {
  let height = SEA_LEVEL;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= island.radius) continue;
    const t = dist / island.radius; // 0 at the centre, 1 at the rim
    const dome = island.peak * (1 - t * t);
    const flat = t < PLATEAU_FRACTION ? island.peak * PLATEAU_HEIGHT : dome;
    if (flat > height) height = flat;
  }
  return height;
}

// Which island, if any, is under (x, z) — used for landing checks and for
// naming the place the plane is over.
export function islandUnder(x, z) {
  for (const island of ISLANDS) {
    if (Math.hypot(x - island.x, z - island.z) < island.radius * 0.72) {
      return island;
    }
  }
  return null;
}
