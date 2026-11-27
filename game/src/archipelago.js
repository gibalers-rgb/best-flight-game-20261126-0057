// archipelago.js — kepulauan, laut, langit, awan dan landasan.
// Dunia 3600 x 3600 m. Pulau-pulau adalah gundukan Gauss; landasan pacu
// duduk di dataran yang diratakan di Pulau Besar.
import { project, screenLen } from "./projection.js";

// ---- Pulau-pulau: [x, z, radius, tinggi puncak, warna dasar] ----
export const ISLANDS = [
  { x: 0, z: 900, r: 520, peak: 96, hue: 122 },     // Pulau Besar (landasan)
  { x: -780, z: -420, r: 300, peak: 64, hue: 108 }, // Pulau Kelapa
  { x: 760, z: -560, r: 260, peak: 58, hue: 96 },   // Pulau Karang
  { x: -260, z: -1180, r: 210, peak: 44, hue: 130 },// Pulau Kabut
  { x: 980, z: 640, r: 170, peak: 36, hue: 112 },   // Pulau Pasir
  { x: -1180, z: 780, r: 190, peak: 40, hue: 100 }, // Pulau Ombak
  { x: 420, z: 1380, r: 150, peak: 30, hue: 118 },  // Pulau Terumbu
];

// Landasan pacu di Pulau Besar: strip 320 m x 26 m, haluan 218 derajat
// (lepas landas menuju laguna tempat cincin berada).
export const RUNWAY = {
  x: 0, z: 900, heading: (218 * Math.PI) / 180,
  length: 320, width: 26, alt: 9,
};

// Titik-titik pendaratan paket (bantalan jerami) di tiga pulau.
export const PADS = [
  { x: -780, z: -420, label: "Desa Kelapa" },
  { x: 760, z: -560, label: "Mercusuar Karang" },
  { x: -260, z: -1180, label: "Pondok Kabut" },
];

// Awan: posisi tetap, digambar sebagai gumpalan elips.
export const CLOUDS = [];
{
  let seed = 1234567;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 16; i++) {
    CLOUDS.push({
      x: (rnd() - 0.5) * 3400, z: (rnd() - 0.5) * 3400,
      y: 320 + rnd() * 260, w: 120 + rnd() * 190, puffs: 3 + Math.floor(rnd() * 3),
      seed: rnd() * 10,
    });
  }
}

// Ketinggian tanah (m). Di laut -3, di pulau naik mengikuti Gauss, dan
// diratakan di sekitar landasan supaya pesawat bisa mendarat.
export function groundHeight(x, z) {
  let h = -3;
  for (const isl of ISLANDS) {
    const dx = x - isl.x, dz = z - isl.z;
    const d2 = dx * dx + dz * dz;
    const rr = isl.r * isl.r;
    if (d2 < rr * 4.5) {
      const g = Math.exp(-d2 / (rr * 0.9));
      h = Math.max(h, -3 + isl.peak * g + 6 * g * g);
    }
  }
  // Ratakan dataran landasan.
  const rx = x - RUNWAY.x, rz = z - RUNWAY.z;
  const along = rx * Math.sin(RUNWAY.heading) + rz * Math.cos(RUNWAY.heading);
  const across = rx * Math.cos(RUNWAY.heading) - rz * Math.sin(RUNWAY.heading);
  const flat = Math.exp(-(along * along) / (2 * 260 * 260) - (across * across) / (2 * 90 * 90));
  h = h * (1 - flat) + RUNWAY.alt * flat;
  return h;
}

// ---- Langit: gradien + matahari + kabut cakrawala ----
export function drawSky(ctx, cam, w, h, time) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const sunH = Math.max(0, Math.min(1, (cam.horizonY - 40) / h));
  g.addColorStop(0, "#2f7fc9");
  g.addColorStop(Math.max(0.15, sunH * 0.55), "#7ec2ee");
  g.addColorStop(0.62, "#cfeefb");
  g.addColorStop(0.72, "#e8f7ff");
  g.addColorStop(1, "#0d3a5c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Matahari: cakram hangat di kanan atas, posisi tetap di langit.
  const sunX = w * 0.78, sunY = h * 0.16;
  const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  sg.addColorStop(0, "rgba(255,246,200,0.95)");
  sg.addColorStop(0.25, "rgba(255,226,120,0.75)");
  sg.addColorStop(1, "rgba(255,226,120,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = "#fff7cf";
  ctx.beginPath(); ctx.arc(sunX, sunY, 26, 0, Math.PI * 2); ctx.fill();
  // Kabut tipis di cakrawala.
  const fg = ctx.createLinearGradient(0, cam.horizonY - 60, 0, cam.horizonY + 30);
  fg.addColorStop(0, "rgba(220,240,252,0)");
  fg.addColorStop(0.6, "rgba(220,240,252,0.35)");
  fg.addColorStop(1, "rgba(220,240,252,0)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, cam.horizonY - 60, w, 90);
}

// ---- Laut + daratan: mesh segitiga yang diwarnai menurut ketinggian ----
const GRID = 32;            // sel per sisi
const SPAN = 3800;          // lebar dunia yang di-mesh
const HALF = SPAN / 2;
let meshCache = null;

function buildMesh() {
  const pts = [];
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const x = -HALF + (i / GRID) * SPAN;
      const z = -HALF + (j / GRID) * SPAN;
      pts.push({ x, z, y: groundHeight(x, z) });
    }
  }
  meshCache = pts;
  return pts;
}

function shadeFor(y, dist) {
  // Laut dalam -> dangkal -> pasir -> rumput -> batu, digelapkan oleh jarak.
  const fade = Math.max(0.42, 1 - dist / 5200);
  let r, g, b;
  if (y < -0.5) {
    const t = Math.min(1, (-y) / 3);
    r = 16 + 22 * (1 - t); g = 96 + 60 * (1 - t); b = 158 + 40 * (1 - t);
  } else if (y < 2.5) { r = 232; g = 214; b = 150; }
  else if (y < 26) { const t = y / 26; r = 96 - 20 * t; g = 168 - 30 * t; b = 92 - 12 * t; }
  else if (y < 60) { const t = (y - 26) / 34; r = 76 - 14 * t; g = 138 - 30 * t; b = 80 - 10 * t; }
  else { const t = Math.min(1, (y - 60) / 40); r = 122 - 30 * t; g = 112 - 24 * t; b = 98 - 18 * t; }
  return `rgb(${Math.round(r * fade)},${Math.round(g * fade)},${Math.round(b * fade)})`;
}

export function drawTerrain(ctx, cam) {
  const pts = meshCache || buildMesh();
  const tris = [];
  const row = GRID + 1;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = pts[j * row + i], b = pts[j * row + i + 1];
      const c = pts[(j + 1) * row + i], d = pts[(j + 1) * row + i + 1];
      tris.push([a, b, d]); tris.push([a, d, c]);
    }
  }
  // Proyeksi + urutkan jauh -> dekat (painter's algorithm).
  const drawn = [];
  for (const t of tris) {
    const p0 = project(cam, t[0].x, t[0].y, t[0].z);
    const p1 = project(cam, t[1].x, t[1].y, t[1].z);
    const p2 = project(cam, t[2].x, t[2].y, t[2].z);
    if (!p0 || !p1 || !p2) continue;
    const depth = (p0.d + p1.d + p2.d) / 3;
    drawn.push({ p0, p1, p2, depth, y: (t[0].y + t[1].y + t[2].y) / 3 });
  }
  drawn.sort((a, b) => b.depth - a.depth);
  for (const t of drawn) {
    ctx.fillStyle = shadeFor(t.y, t.depth);
    ctx.beginPath();
    ctx.moveTo(t.p0.x, t.p0.y); ctx.lineTo(t.p1.x, t.p1.y); ctx.lineTo(t.p2.x, t.p2.y);
    ctx.closePath(); ctx.fill();
  }
}

// ---- Landasan pacu: strip aspal + garis tengah + angka haluan ----
export function drawRunway(ctx, cam) {
  const h = RUNWAY.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  const px = Math.cos(h), pz = -Math.sin(h); // tegak lurus haluan
  const L = RUNWAY.length / 2, W = RUNWAY.width / 2, y = RUNWAY.alt + 0.4;
  const corner = (a, b) => project(cam, RUNWAY.x + fx * a + px * b, y, RUNWAY.z + fz * a + pz * b);
  const c1 = corner(-L, -W), c2 = corner(L, -W), c3 = corner(L, W), c4 = corner(-L, W);
  if (!c1 || !c2 || !c3 || !c4) return;
  ctx.fillStyle = "#3c4148";
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2;
  ctx.stroke();
  // Garis tengah putus-putus.
  ctx.strokeStyle = "#f4f6f0"; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
  const m1 = corner(-L + 12, 0), m2 = corner(L - 12, 0);
  if (m1 && m2) { ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); }
  ctx.setLineDash([]);
  // Ambang landasan (chevron) di kedua ujung.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const a of [-L + 8, L - 8]) {
    const q = corner(a, 0);
    if (q) { ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, screenLen(cam, 3, q.d) * 0.5), 0, Math.PI * 2); ctx.fill(); }
  }
}

// ---- Bantalan paket: lingkaran jerami + tiang bendera ----
export function drawPads(ctx, cam, padsDone) {
  for (let i = 0; i < PADS.length; i++) {
    const pad = PADS[i];
    const y = groundHeight(pad.x, pad.z) + 0.6;
    const p = project(cam, pad.x, y, pad.z);
    if (!p) continue;
    const r = screenLen(cam, 13, p.d);
    if (r < 1.5) continue;
    ctx.save();
    ctx.globalAlpha = padsDone.has(i) ? 0.45 : 0.95;
    ctx.fillStyle = padsDone.has(i) ? "#7fbf6a" : "#e8b64c";
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.62, r * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
    // Tiang bendera.
    const top = project(cam, pad.x, y + 22, pad.z);
    if (top) {
      ctx.strokeStyle = "#5a4632"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = padsDone.has(i) ? "#57c86a" : "#ff5a4e";
      ctx.beginPath();
      ctx.moveTo(top.x, top.y); ctx.lineTo(top.x + r * 0.7, top.y + r * 0.16); ctx.lineTo(top.x, top.y + r * 0.32);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- Awan: gumpalan elips putih yang melayang ----
export function drawClouds(ctx, cam, time) {
  const items = [];
  for (const c of CLOUDS) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p) continue;
    items.push({ c, p });
  }
  items.sort((a, b) => b.p.d - a.p.d);
  for (const { c, p } of items) {
    const s = screenLen(cam, c.w, p.d);
    if (s < 3) continue;
    const alpha = Math.max(0.12, Math.min(0.9, 340 / p.d));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < c.puffs; k++) {
      const off = Math.sin(c.seed + k * 2.1) * s * 0.42;
      const oy = Math.cos(c.seed + k * 1.7) * s * 0.08;
      const r = s * (0.22 + 0.1 * Math.sin(c.seed + k));
      ctx.beginPath(); ctx.ellipse(p.x + off, p.y + oy, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
