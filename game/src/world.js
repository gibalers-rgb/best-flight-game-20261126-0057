// World data for Skycourier: the archipelago, its runways and its rings.
//
// Coordinates: x runs east, z runs south, y is altitude in metres. Heading 0
// is north (towards -z), 90 is east (+x). Distances are metres; the whole
// playable sea is about 12 km across, so a hop between islands takes under a
// minute at cruise speed and the player always has somewhere to aim for.

export const WORLD = {
  seaLevel: 0,
  // Fog distance for depth cueing: things further than this fade into haze.
  fogFar: 9000,
};

// Each island is a low, flat-topped hill rising out of the sea. The runway
// sits on the flat top; `peak` is the hill height so the terrain function can
// tell the plane when it has hit ground.
export const ISLANDS = [
  {
    name: "Home Island",
    x: 0, z: 0, radius: 1500, peak: 90,
    color: "#3f8f4f", sand: "#e8d9a0",
    runway: { x: 0, z: -150, heading: 0, length: 620, width: 46 },
  },
  {
    name: "Palm Cay",
    x: 2600, z: -2400, radius: 1100, peak: 70,
    color: "#4a9a55", sand: "#ecdca8",
    runway: { x: 2600, z: -2400, heading: 45, length: 520, width: 42 },
  },
  {
    name: "Turtle Rock",
    x: -2900, z: -2600, radius: 950, peak: 120,
    color: "#3a8547", sand: "#e2d198",
    runway: { x: -2900, z: -2600, heading: 315, length: 480, width: 40 },
  },
  {
    name: "Coral Bay",
    x: 900, z: -5200, radius: 1300, peak: 60,
    color: "#4da35c", sand: "#efe0aa",
    runway: { x: 900, z: -5200, heading: 90, length: 560, width: 44 },
  },
  {
    name: "Far Point",
    x: -3400, z: 2900, radius: 1000, peak: 80,
    color: "#458f50", sand: "#e6d69c",
    runway: { x: -3400, z: 2900, heading: 135, length: 500, width: 42 },
  },
];

// Rings float in the air along a tour of the archipelago. Flying through the
// centre of the next ring (within its radius) scores it; rings are ordered.
export const RINGS = [
  { x: 0,    y: 320, z: -1400, r: 55 },
  { x: 900,  y: 380, z: -2600, r: 55 },
  { x: 2200, y: 340, z: -2600, r: 55 },
  { x: 2600, y: 300, z: -1600, r: 55 },
  { x: 1800, y: 420, z: -4200, r: 55 },
  { x: 900,  y: 360, z: -5200, r: 55 },
  { x: -800, y: 400, z: -4200, r: 55 },
  { x: -2900, y: 320, z: -2600, r: 55 },
];

// Ground height at (x, z): the top of the island hill, or sea level.
// A hill is a smooth dome: full peak height at the centre, falling to the sea
// at the rim, flat enough near the top for a runway. The drawn island is a
// flat-topped disc (its green top sits at peak * 0.82 out to 62% of the
// radius), so the collision ground is a flat plateau at that same height
// inside the disc and the dome slope outside it: the runway the player sees
// is the runway the wheels roll on.
export function groundHeight(x, z) {
  let h = WORLD.seaLevel;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.hypot(dx, dz);
    if (d < island.radius) {
      const t = d / island.radius; // 0 at centre, 1 at rim
      const dome = island.peak * (1 - t * t);
      const flat = t < 0.62 ? island.peak * 0.82 : dome;
      h = Math.max(h, flat);
    }
  }
  return h;
}

// Which island, if any, is under (x, z) — used for landing checks and names.
export function islandAt(x, z) {
  for (const island of ISLANDS) {
    if (Math.hypot(x - island.x, z - island.z) < island.radius * 0.72) return island;
  }
  return null;
}
