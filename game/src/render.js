// Rendering for Skycourier: a chase-view pseudo-3D scene on a 2D canvas.
//
// The camera sits behind and just above the plane and looks ahead along its
// nose. World points are projected with a real camera basis (forward / right /
// up vectors), so the horizon, the sea, the islands, the runways and the rings
// all move together as the plane banks and climbs. The plane itself is drawn
// in the frame, banking with its roll, and the bottom of the screen is a lit
// instrument panel: airspeed, altimeter, compass and fuel, with altitude,
// speed and heading repeated on the HUD. No images, no libraries — every pixel
// is drawn from the world data each frame.

import { ISLANDS, RINGS } from "./world.js";
import { clamp } from "./physics.js";
import { bearingTo } from "./missions.js";

// Fixed clouds: white puffs floating over the sea, for depth and scale.
const CLOUDS = [
  { x: 1200, y: 750, z: -3200, s: 260 },
  { x: -1800, y: 820, z: -1800, s: 320 },
  { x: 3200, y: 700, z: -5200, s: 280 },
  { x: -800, y: 780, z: -5600, s: 300 },
  { x: -4200, y: 720, z: 1200, s: 340 },
  { x: 2400, y: 860, z: 1800, s: 260 },
  { x: 600, y: 800, z: 2600, s: 300 },
  { x: -2600, y: 740, z: -4800, s: 240 },
];

const KNOTS = 1.94384; // m/s to knots
const FEET = 3.28084;  // m to ft

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  // Camera basis from the plane: forward along the nose, right and up.
  function camera(plane) {
    const h = (plane.heading * Math.PI) / 180;
    const p = (plane.pitch * Math.PI) / 180;
    const fwd = {
      x: Math.sin(h) * Math.cos(p),
      y: Math.sin(p),
      z: -Math.cos(h) * Math.cos(p),
    };
    const pos = {
      x: plane.x - fwd.x * 26,
      y: plane.y - fwd.y * 26 + 6,
      z: plane.z - fwd.z * 26,
    };
    const look = {
      x: plane.x + fwd.x * 60,
      y: plane.y + fwd.y * 60 + 2,
      z: plane.z + fwd.z * 60,
    };
    const f = norm({
      x: look.x - pos.x,
      y: look.y - pos.y,
      z: look.z - pos.z,
    });
    const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
    const u = cross(r, f);
    return { pos, f, r, u, focal: H * 0.95 };
  }

  function norm(v) {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  // Project a world point to screen space; null when behind the camera.
  function project(cam, p) {
    const c = camSpace(cam, p);
    if (c.z < 2) return null;
    return toScreen(cam, c);
  }

  // Camera-space point (x right, y up, z forward along the view).
  function camSpace(cam, p) {
    const v = { x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z };
    return { x: dot(v, cam.r), y: dot(v, cam.u), z: dot(v, cam.f) };
  }

  function toScreen(cam, c) {
    return {
      x: W / 2 + (c.x / c.z) * cam.focal,
      y: H / 2 - (c.y / c.z) * cam.focal,
      z: c.z,
      scale: cam.focal / c.z,
    };
  }

  // Sutherland–Hodgman clip of a polygon against the near plane z >= near:
  // a quad whose near corner passes behind the camera still draws the part
  // that is in front of it, instead of vanishing whole.
  function clipNear(points, near) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const aIn = a.z >= near;
      const bIn = b.z >= near;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (near - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near });
      }
    }
    return out;
  }

  function haze(z) {
    // Distance haze: 1 up close, fading to 0 at the fog distance.
    return clamp(1 - z / 9000, 0.15, 1);
  }

  function drawSkySea(cam, plane) {
    // The horizon sits where the camera's pitch puts it.
    const horizonY = H / 2 - Math.tan((plane.pitch * Math.PI) / 180) * cam.focal
      - (cam.pos.y / 9000) * H * 0.35;
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    sky.addColorStop(0, "#2f6fd0");
    sky.addColorStop(0.7, "#7fb2e8");
    sky.addColorStop(1, "#cfe6f7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.max(horizonY, 0));
    // Sun: fixed in the sky, upper right of the view.
    const sunX = W * 0.78;
    const sunY = Math.max(horizonY - H * 0.22, H * 0.08);
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
    glow.addColorStop(0, "rgba(255,244,190,0.95)");
    glow.addColorStop(0.35, "rgba(255,220,120,0.55)");
    glow.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Sea below the horizon, deep blue-green with a lighter band at the horizon.
    const sea = ctx.createLinearGradient(0, horizonY, 0, H);
    sea.addColorStop(0, "#3f8fb5");
    sea.addColorStop(0.25, "#2a6d94");
    sea.addColorStop(1, "#123f5e");
    ctx.fillStyle = sea;
    ctx.fillRect(0, Math.max(horizonY, 0), W, H - Math.max(horizonY, 0));
    return horizonY;
  }

  function drawClouds(cam) {
    ctx.save();
    for (const c of CLOUDS) {
      const p = project(cam, c);
      if (!p) continue;
      const a = 0.75 * haze(p.z);
      const s = c.s * p.scale * 0.9;
      if (s < 4) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      for (const [ox, oy, r] of [[-0.5, 0.1, 0.42], [0, -0.12, 0.55], [0.55, 0.08, 0.45], [0.1, 0.18, 0.5]]) {
        ctx.beginPath();
        ctx.ellipse(p.x + ox * s, p.y + oy * s, r * s, r * s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawIsland(cam, island) {
    // Project a ring of points around the island at sea level (sand rim),
    // then a smaller, higher ring (green top), then the peak.
    const rim = [];
    const top = [];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = island.x + Math.cos(a) * island.radius;
      const pz = island.z + Math.sin(a) * island.radius;
      const pr = project(cam, { x: px, y: 2, z: pz });
      if (pr) rim.push(pr);
      const tx = island.x + Math.cos(a) * island.radius * 0.62;
      const tz = island.z + Math.sin(a) * island.radius * 0.62;
      const pt = project(cam, { x: tx, y: island.peak * 0.82, z: tz });
      if (pt) top.push(pt);
    }
    if (rim.length < 3) return;
    const depth = project(cam, { x: island.x, y: 0, z: island.z });
    const fade = depth ? haze(depth.z) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    // Sand rim.
    ctx.fillStyle = island.sand;
    poly(rim);
    ctx.fill();
    // Green top.
    if (top.length >= 3) {
      ctx.fillStyle = island.color;
      poly(top);
      ctx.fill();
    }
    ctx.restore();
    drawRunway(cam, island, fade);
  }

  function poly(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function drawRunway(cam, island, fade) {
    const rw = island.runway;
    const topY = island.peak * 0.82 + 2;
    const h = (rw.heading * Math.PI) / 180;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    // Strip corners in world space. The strip is clipped against the
    // camera's near plane before projecting: its near end passes behind the
    // camera while the plane taxis on it, and the strip must stay visible
    // then instead of vanishing whole.
    const world = [
      { x: rw.x - fx * rw.length / 2 - rx * rw.width / 2, z: rw.z - fz * rw.length / 2 - rz * rw.width / 2 },
      { x: rw.x + fx * rw.length / 2 - rx * rw.width / 2, z: rw.z + fz * rw.length / 2 - rz * rw.width / 2 },
      { x: rw.x + fx * rw.length / 2 + rx * rw.width / 2, z: rw.z + fz * rw.length / 2 + rz * rw.width / 2 },
      { x: rw.x - fx * rw.length / 2 + rx * rw.width / 2, z: rw.z - fz * rw.length / 2 + rz * rw.width / 2 },
    ];
    const clipped = clipNear(world.map((c) => camSpace(cam, { x: c.x, y: topY, z: c.z })), 2);
    if (clipped.length < 3) return;
    const corners = clipped.map((c) => toScreen(cam, c));
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#4b4f55";
    poly(corners);
    ctx.fill();
    // Centre dashes: each dash is a short segment on the centre line, drawn
    // only when both of its ends project in front of the camera, stroked at
    // a width that fits the dash's own distance (a near corner's scale would
    // make a far dash absurdly thick).
    ctx.strokeStyle = "#f5f5f0";
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const a = centrePoint(i / steps + 0.12);
      const b = centrePoint((i + 1) / steps - 0.12);
      if (!a || !b) continue;
      ctx.lineWidth = Math.max(1, 3 * ((a.scale + b.scale) / 2) * 0.02);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Threshold bars at both ends, when both ends project, at the bar's own
    // distance scale.
    ctx.strokeStyle = "#ffffff";
    const e0a = project(cam, { x: world[0].x, y: topY, z: world[0].z });
    const e0b = project(cam, { x: world[3].x, y: topY, z: world[3].z });
    const e1a = project(cam, { x: world[1].x, y: topY, z: world[1].z });
    const e1b = project(cam, { x: world[2].x, y: topY, z: world[2].z });
    if (e0a && e0b) {
      ctx.lineWidth = Math.max(2, 6 * ((e0a.scale + e0b.scale) / 2) * 0.02);
      ctx.beginPath();
      ctx.moveTo(e0a.x, e0a.y);
      ctx.lineTo(e0b.x, e0b.y);
      ctx.stroke();
    }
    if (e1a && e1b) {
      ctx.lineWidth = Math.max(2, 6 * ((e1a.scale + e1b.scale) / 2) * 0.02);
      ctx.beginPath();
      ctx.moveTo(e1a.x, e1a.y);
      ctx.lineTo(e1b.x, e1b.y);
      ctx.stroke();
    }
    ctx.restore();

    function centrePoint(t) {
      const x = rw.x - fx * rw.length / 2 + fx * rw.length * t;
      const z = rw.z - fz * rw.length / 2 + fz * rw.length * t;
      return project(cam, { x, y: topY, z });
    }
  }

  function drawRings(cam, ringIndex, time) {
    RINGS.forEach((ring, i) => {
      const p = project(cam, ring);
      if (!p) return;
      const isNext = i === ringIndex;
      const r = ring.r * p.scale;
      if (r < 2) return;
      const pulse = isNext ? 1 + Math.sin(time * 4) * 0.08 : 1;
      ctx.save();
      ctx.globalAlpha = 0.95 * haze(p.z);
      // Facing squash: a ring seen edge-on is a thin ellipse.
      const squash = 0.9;
      ctx.strokeStyle = isNext ? "#ffd23f" : "#c8b06a";
      ctx.lineWidth = Math.max(2, r * 0.09 * pulse);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * pulse, r * squash * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (isNext) {
        ctx.strokeStyle = "rgba(255,210,63,0.35)";
        ctx.lineWidth = Math.max(4, r * 0.2);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * pulse, r * squash * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(12, r * 0.28)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, p.x, p.y - r * 1.25);
      }
      ctx.restore();
    });
  }

  function drawParcel(cam, show) {
    if (!show) return;
    const rw = ISLANDS[0].runway;
    const p = project(cam, { x: rw.x, y: 100, z: rw.z + 200 });
    if (!p) return;
    const s = Math.max(6, 26 * p.scale * 0.06);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#c98a2e";
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = "#7a4d12";
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.beginPath();
    ctx.moveTo(-s / 2, 0);
    ctx.lineTo(s / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  // The courier plane, seen from behind and slightly above, banking with roll.
  function drawPlane(plane, time) {
    const cx = W / 2;
    const cy = H * 0.62;
    const s = Math.min(W, H) / 9; // plane size in px
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-plane.roll * Math.PI) / 180);
    // Prop blur: a faint disc ahead of the nose (top of the drawing).
    ctx.fillStyle = "rgba(200,220,240,0.25)";
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.15, s * 0.42, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings: broad, slightly swept, with red/green nav lights at the tips.
    ctx.fillStyle = "#e8b23a";
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, s * 0.1);
    ctx.quadraticCurveTo(-s * 1.1, -s * 0.28, -s * 0.28, -s * 0.18);
    ctx.lineTo(s * 0.28, -s * 0.18);
    ctx.quadraticCurveTo(s * 1.1, -s * 0.28, s * 1.5, s * 0.1);
    ctx.quadraticCurveTo(s * 0.9, s * 0.32, 0, s * 0.28);
    ctx.quadraticCurveTo(-s * 0.9, s * 0.32, -s * 1.5, s * 0.1);
    ctx.fill();
    ctx.strokeStyle = "#8a6414";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Fuselage: tapering towards the nose, tail at the bottom.
    const grad = ctx.createLinearGradient(0, -s * 1.2, 0, s * 0.8);
    grad.addColorStop(0, "#f4f6f8");
    grad.addColorStop(0.6, "#dfe6ec");
    grad.addColorStop(1, "#b9c4cd");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.25);
    ctx.quadraticCurveTo(s * 0.34, -s * 0.7, s * 0.3, s * 0.1);
    ctx.quadraticCurveTo(s * 0.26, s * 0.55, s * 0.16, s * 0.78);
    ctx.lineTo(-s * 0.16, s * 0.78);
    ctx.quadraticCurveTo(-s * 0.26, s * 0.55, -s * 0.3, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.34, -s * 0.7, 0, -s * 1.25);
    ctx.fill();
    ctx.strokeStyle = "#7c8894";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Cockpit glint.
    ctx.fillStyle = "rgba(90,160,220,0.85)";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.72, s * 0.16, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin and tailplane.
    ctx.fillStyle = "#d23b2e";
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.lineTo(-s * 0.3, s * 0.95);
    ctx.lineTo(s * 0.3, s * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8b23a";
    ctx.fillRect(-s * 0.55, s * 0.62, s * 1.1, s * 0.09);
    // Nav lights, blinking on the left.
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = blink ? "#ff3b30" : "#7a1512";
    ctx.beginPath();
    ctx.arc(-s * 1.48, s * 0.08, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2ecc40";
    ctx.beginPath();
    ctx.arc(s * 1.48, s * 0.08, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // A lit instrument dial: dark face, glowing ticks, a needle.
  function dial(x, y, r, label, valueText, frac, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#10161d";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3d4a55";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Green backlight ring: the instruments are lit.
    ctx.strokeStyle = "rgba(110,255,170,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const inner = i % 5 === 0 ? r - 12 : r - 8;
      ctx.strokeStyle = "#cfe3ef";
      ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
      ctx.stroke();
    }
    const needleA = Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(needleA) * (r - 8), Math.sin(needleA) * (r - 8));
    ctx.stroke();
    ctx.fillStyle = "#e8f2f8";
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9fd8ff";
    ctx.font = `bold ${Math.max(10, r * 0.32)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(valueText, 0, r * 0.42);
    ctx.fillStyle = "#7e93a3";
    ctx.font = `${Math.max(9, r * 0.24)}px sans-serif`;
    ctx.fillText(label, 0, r + 14);
    ctx.restore();
  }

  function drawPanel(plane, missionState, time) {
    const panelH = Math.max(86, H * 0.13);
    const y0 = H - panelH;
    ctx.save();
    // The panel is fully opaque: bright terrain behind it must never bleed
    // through the instruments.
    const bg = ctx.createLinearGradient(0, y0, 0, H);
    bg.addColorStop(0, "#0c121a");
    bg.addColorStop(1, "#080c12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, y0, W, panelH);
    ctx.strokeStyle = "#2c3a48";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y0);
    ctx.stroke();
    const r = Math.min(34, (panelH - 30) / 2);
    const cy = y0 + panelH / 2 - 4;
    const speedKt = plane.speed * KNOTS;
    const altFt = plane.y * FEET;
    dial(W * 0.1, cy, r, "AIRSPEED kt", String(Math.round(speedKt)), speedKt / 230, "#6effaa");
    dial(W * 0.24, cy, r, "ALTITUDE ft", String(Math.round(altFt)), clamp(altFt / 3000, 0, 1), "#6ec8ff");
    // Compass dial: a rotating rose with the heading at the top.
    ctx.save();
    ctx.translate(W * 0.38, cy);
    ctx.fillStyle = "#10161d";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3d4a55";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(110,255,170,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate((-plane.heading * Math.PI) / 180);
    ctx.fillStyle = "#e8f2f8";
    ctx.font = `bold ${Math.max(10, r * 0.3)}px sans-serif`;
    ctx.textAlign = "center";
    const marks = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
    for (const [label, deg] of marks) {
      const a = (deg * Math.PI) / 180 - Math.PI / 2;
      ctx.fillText(label, Math.cos(a) * (r - 12), Math.sin(a) * (r - 12) + 4);
    }
    ctx.strokeStyle = "#6effaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r + 5);
    ctx.lineTo(0, -r + 14);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#9fd8ff";
    ctx.font = `bold ${Math.max(10, r * 0.32)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${String(Math.round(plane.heading)).padStart(3, "0")}°`, W * 0.38, cy + r * 0.42);
    ctx.fillStyle = "#7e93a3";
    ctx.font = `${Math.max(9, r * 0.24)}px sans-serif`;
    ctx.fillText("HEADING", W * 0.38, cy + r + 14);
    dial(W * 0.52, cy, r, "FUEL", `${Math.round(plane.fuel)}%`, plane.fuel / 100, plane.fuel < 25 ? "#ff6b5e" : "#6effaa");
    // Throttle bar, right of the dials.
    const tx = W * 0.62;
    const tw = W * 0.16;
    const th = 14;
    const ty = cy - th / 2;
    ctx.fillStyle = "#0c1218";
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = plane.throttle > 0.85 ? "#ffb03a" : "#3fae6a";
    ctx.fillRect(tx, ty, tw * plane.throttle, th);
    ctx.strokeStyle = "#3d4a55";
    ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = "#9fd8ff";
    ctx.font = `bold ${Math.max(11, r * 0.3)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, tx, ty - 8);
    ctx.fillStyle = plane.damage > 60 ? "#ff6b5e" : "#9fd8ff";
    ctx.fillText(`DMG ${Math.round(plane.damage)}%`, tx, ty + th + 18);
    if (plane.flaps) {
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("FLAPS", tx + tw + 12, ty + 11);
    }
    // Mission + score, far right.
    ctx.textAlign = "right";
    ctx.fillStyle = "#e8f2f8";
    ctx.font = `bold ${Math.max(12, r * 0.34)}px sans-serif`;
    ctx.fillText(missionState.mission.name.toUpperCase(), W - 18, cy - 8);
    ctx.fillStyle = "#9fd8ff";
    ctx.font = `${Math.max(11, r * 0.3)}px monospace`;
    ctx.fillText(`SCORE ${missionState.score}`, W - 18, cy + 12);
    if (missionState.mission.id === 3) {
      ctx.fillStyle = missionState.timeLeft < 60 ? "#ff6b5e" : "#ffd23f";
      ctx.fillText(`TIME ${fmtClock(missionState.timeLeft)}`, W - 18, cy + 30);
    }
    ctx.restore();
  }

  function fmtClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function drawHUD(plane, missionState, target) {
    const speedKt = Math.round(plane.speed * KNOTS);
    const altFt = Math.round(plane.y * FEET);
    const hdg = Math.round(plane.heading);
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(8,14,22,0.55)";
    roundRect(12, 12, 300, 74, 10);
    ctx.fill();
    ctx.fillStyle = "#e8f2f8";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`ALT ${altFt.toLocaleString()} ft`, 24, 40);
    ctx.fillText(`SPD ${speedKt} kt`, 24, 68);
    ctx.fillStyle = "#9fd8ff";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`HDG ${String(hdg).padStart(3, "0")}°`, 196, 40);
    ctx.fillText(plane.onGround ? "ON GROUND" : plane.speed < 26 ? "STALL!" : "AIRBORNE", 196, 68);
    if (plane.speed < 26 && !plane.onGround) {
      ctx.fillStyle = "#ff6b5e";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("STALL — NOSE DOWN, ADD POWER", W / 2, 110);
    }
    // Compass strip across the top centre: ticks and cardinal letters all
    // inside the strip, with a gold marker at the current heading.
    const stripY = 12;
    const stripH = 40;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(8,14,22,0.55)";
    roundRect(W / 2 - 190, stripY, 380, stripH, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(W / 2 - 190, stripY, 380, stripH);
    ctx.clip();
    for (let d = -60; d <= 60; d += 15) {
      const deg = Math.round((plane.heading + d + 360) % 360);
      const x = W / 2 + d * 3.1;
      const major = deg % 90 === 0;
      ctx.strokeStyle = major ? "#e8f2f8" : "#7e93a3";
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, stripY + 24);
      ctx.lineTo(x, stripY + (major ? 14 : 19));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = "#e8f2f8";
        ctx.font = "bold 12px sans-serif";
        const label = { 0: "N", 90: "E", 180: "S", 270: "W" }[deg] ?? String(deg);
        ctx.fillText(label, x, stripY + 38);
      }
    }
    ctx.restore();
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(W / 2, stripY + 2);
    ctx.lineTo(W / 2 - 6, stripY + 11);
    ctx.lineTo(W / 2 + 6, stripY + 11);
    ctx.closePath();
    ctx.fill();
    // Objective line, top right.
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(8,14,22,0.55)";
    const obj = missionState.done ? "MISSION COMPLETE" : objectiveText(missionState);
    roundRect(W - 330, 12, 318, 74, 10);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(missionState.mission.name.toUpperCase(), W - 24, 34);
    ctx.fillStyle = "#e8f2f8";
    ctx.font = "13px sans-serif";
    wrapText(obj, W - 24, 56, 300, 17);
    // Target arrow: a chevron at the screen edge pointing at the objective.
    if (target && !missionState.done) {
      const b = bearingTo(plane, target);
      const distM = Math.round(b.dist);
      const ang = (b.rel * Math.PI) / 180;
      const ax = W / 2 + Math.sin(ang) * 150;
      const ay = H * 0.42 - Math.cos(ang) * 120;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = target.kind === "ring" ? "#ffd23f" : "#6ec8ff";
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 6);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // The label sits clear below the chevron on its own dark plate, so the
      // chevron never strikes through the text.
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      const targetText =
        `${target.name ?? (target.kind === "ring" ? "RING" : target.kind.toUpperCase())} ${distM >= 1000 ? (distM / 1000).toFixed(1) + " km" : distM + " m"}`;
      const tw = ctx.measureText(targetText).width;
      ctx.fillStyle = "rgba(8,14,22,0.75)";
      roundRect(ax - tw / 2 - 8, ay + 22, tw + 16, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#e8f2f8";
      ctx.fillText(targetText, ax, ay + 38);
    }
    // Centre message, when one is live.
    if (missionState.messageTimer > 0) {
      ctx.fillStyle = "rgba(8,14,22,0.65)";
      const msg = missionState.message;
      ctx.font = "bold 16px sans-serif";
      const mw = ctx.measureText(msg).width + 32;
      roundRect(W / 2 - mw / 2, H * 0.2, mw, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(msg, W / 2, H * 0.2 + 22);
    }
    ctx.restore();
  }

  function objectiveText(s) {
    // Short version of the mission objective for the HUD box.
    const m = s.mission;
    if (m.id === 1) return s.ringIndex >= 8 ? "All rings flown!" : `Ring ${s.ringIndex + 1} of 8 — follow the gold ring`;
    if (m.id === 2) {
      if (s.hopIndex >= s.hopLegs.length) return "All islands visited — land at Home!";
      return `Land on ${s.hopLegs[s.hopIndex].name} (${s.hopIndex + 1}/3)`;
    }
    if (!s.parcel) return "Parcel on Home runway — pick it up";
    if (!s.delivered) return "Parcel aboard — deliver to Far Point!";
    return "Delivered — land on Far Point runway";
  }

  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = w;
        yy += lh;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawOverlay(title, lines, accent) {
    ctx.save();
    ctx.fillStyle = "rgba(6,12,20,0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "bold 52px sans-serif";
    ctx.fillText(title, W / 2, H * 0.34);
    ctx.fillStyle = "#e8f2f8";
    ctx.font = "18px sans-serif";
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.34 + 44 + i * 30));
    ctx.restore();
  }

  return {
    render(state, time) {
      const { plane, missionState, target, phase } = state;
      const cam = camera(plane);
      drawSkySea(cam, plane);
      drawClouds(cam);
      // Islands far to near so near ones overlap far ones.
      const sorted = [...ISLANDS].sort((a, b) => {
        const da = Math.hypot(a.x - plane.x, a.z - plane.z);
        const db = Math.hypot(b.x - plane.x, b.z - plane.z);
        return db - da;
      });
      for (const island of sorted) drawIsland(cam, island);
      drawRings(cam, missionState.ringIndex, time);
      drawParcel(cam, missionState.mission.id === 3 && !missionState.parcel);
      drawPlane(plane, time);
      drawHUD(plane, missionState, target);
      drawPanel(plane, missionState, time);
      if (phase === "title") {
        drawOverlay("SKYCOURIER", [
          "Island Hopper — fly the courier plane across the archipelago.",
          "1 Ring Run   •   2 Island Hop   •   3 Courier Dash",
          "Arrows / mouse steer  •  W/S throttle  •  Space brake  •  F flaps  •  P pause",
          "Press 1, 2 or 3 to start a mission — or just fly.",
        ], "#ffd23f");
      } else if (phase === "crashed") {
        drawOverlay("CRASHED", [
          "The courier is a wreck. The parcel service sends its regards.",
          `Score ${missionState.score} — press R to fly again.`,
        ], "#ff6b5e");
      } else if (phase === "complete") {
        drawOverlay("MISSION COMPLETE", [
          missionState.message,
          `Score ${missionState.score} — press R to fly again.`,
        ], "#6effaa");
      } else if (phase === "paused") {
        drawOverlay("PAUSED", ["Press P to keep flying.", ""], "#9fd8ff");
      }
    },
    resize,
  };
}
