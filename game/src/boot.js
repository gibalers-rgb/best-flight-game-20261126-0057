// boot.js — titik masuk game: loop, state machine, kartu kontrak,
// penanganan jatuh, debrief, dan mode demo (?demo=...) untuk screenshot.
import { makeCamera, chaseCamera } from "./projection.js";
import { drawSky, drawTerrain, drawRunway, drawPads, drawClouds, RUNWAY, groundHeight as groundHeightAt } from "./archipelago.js";
import { newPlane, updatePlane, drawPlane, resetTo } from "./kestrel.js";
import { drawHUD, drawTargetArrow, drawInstrumentPanel } from "./gauges.js";
import {
  newRun, startContract, updateContracts, dropParcel, currentTarget,
  drawRings, drawParcels, CONTRACT_INFO, starsFor,
} from "./contracts.js";
import { makeSfx } from "./sounds.js";
import { makeInput } from "./controls.js";

const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
const toastEl = document.getElementById("toast");
const cardEl = document.getElementById("card");
const debriefEl = document.getElementById("debrief");

const plane = newPlane();
const run = newRun();
const cam = makeCamera();
const sfx = makeSfx();
const input = makeInput();
input.attach();

let mode = "menu";       // menu | card | fly | paused | crashed | debrief
let paused = false;
let toastTimer = 0;
let crashTimer = 0;
let autopilot = null;    // mode demo: {target:{x,y,z}} — terbang otomatis ke sasaran
const wind = { x: 1.6, z: -0.9 };

function showToast(text, kind) {
  toastEl.textContent = text;
  toastEl.className = kind || "";
  toastTimer = 2.6;
}
function hideToast() { toastEl.classList.add("hidden"); toastTimer = 0; }

function showCard(n) {
  const info = CONTRACT_INFO[n];
  document.getElementById("card-title").textContent = info.title;
  document.getElementById("card-body").textContent = info.body;
  document.getElementById("card-keys").textContent = info.keys;
  cardEl.classList.remove("hidden");
  mode = "card";
}

function showDebrief() {
  mode = "debrief";
  const stars = starsFor(run.score);
  document.getElementById("debrief-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  const mins = Math.floor(run.time / 60), secs = Math.floor(run.time % 60);
  const rows = [
    ["Cincin ditembus", `${run.ringsHit} / 5`],
    ["Paket terkirim", `${run.dropsDone.size} / 3`],
    ["Bonus mendarat", `${run.landingScore} poin`],
    ["Kecelakaan", `${run.crashCount} kali`],
    ["Waktu terbang", `${mins}:${String(secs).padStart(2, "0")}`],
    ["SKOR AKHIR", `${run.score}`],
  ];
  document.getElementById("debrief-table").innerHTML =
    rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  document.getElementById("debrief-note").textContent =
    stars === 3 ? "Penerbangan sempurna — langit kepulauan ini milikmu, Kurir!"
    : stars === 2 ? "Penerbangan yang solid. Satu putaran lagi dan bintang tiga menantimu."
    : stars === 1 ? "Kontrak selesai. Latih belokanmu dan coba raih skor lebih tinggi."
    : "Semua kontrak selesai, tapi skor masih rendah — terbang lebih cepat dan lebih rapi.";
  debriefEl.classList.remove("hidden");
  sfx.fanfare();
}

function beginContract(n) {
  cardEl.classList.add("hidden");
  debriefEl.classList.add("hidden");
  startContract(run, n, plane);
  mode = "fly";
  showToast(CONTRACT_INFO[n].title, "gold");
  sfx.ensure();
}

function handleCrash() {
  run.crashCount++;
  mode = "crashed";
  crashTimer = 2.4;
  sfx.crash();
  showToast(`💥 Kecelakaan — ${plane.crash ? plane.crash.reason : "jatuh"}! Kembali ke titik aman…`, "bad");
}

function respawn() {
  const cp = run.checkpoint || { x: 86, y: 12, z: 1010, heading: RUNWAY.heading, speed: 0, throttle: 0, ground: true };
  resetTo(plane, cp);
  mode = "fly";
  showToast("Siap terbang lagi — hati-hati!");
}

// Aksi tombol sekali tekan.
input.onAction = (key) => {
  sfx.ensure();
  if (key === " ") {
    if (mode === "fly") dropParcel(run, plane, sfx);
  } else if (key === "p") {
    if (mode === "fly") { mode = "paused"; paused = true; showToast("Jeda — tekan P untuk lanjut"); }
    else if (mode === "paused") { mode = "fly"; paused = false; hideToast(); }
  } else if (key === "r") {
    if (mode === "fly" || mode === "paused" || mode === "crashed") {
      run.crashCount = run.crashCount; // R hanya mengulang kontrak aktif
      startContract(run, run.contract || 1, plane);
      mode = "fly"; paused = false; hideToast();
      showToast("Kontrak diulang dari awal");
    }
  } else if (key === "m") {
    input.mouseSteer = !input.mouseSteer;
    showToast(input.mouseSteer ? "Kendal mouse: AKTIF" : "Kendal mouse: MATI");
  }
};
document.getElementById("card-go").addEventListener("click", () => {
  sfx.ensure(); sfx.click();
  beginContract(run.contract === 0 ? 1 : run.contract);
});
document.getElementById("debrief-again").addEventListener("click", () => {
  sfx.ensure(); sfx.click();
  Object.assign(run, newRun());
  plane.x = 86; plane.y = 12; plane.z = 1010;
  plane.heading = RUNWAY.heading; plane.speed = 0; plane.throttle = 0;
  plane.onGround = true; plane.damage = 0; plane.crash = null;
  showCard(1);
});

// ---- Mode demo (?demo=takeoff|rings|drop|landing): lompat ke satu fase
// dan terbang otomatis ke sasaran, supaya screenshot menangkap aksi. ----
function setupDemo() {
  const demo = new URLSearchParams(location.search).get("demo");
  if (!demo) return false;
  debriefEl.classList.add("hidden");
  cardEl.classList.add("hidden");
  if (demo === "takeoff") {
    run.contract = 1; run.time = 0;
    startContract(run, 1, plane);
    plane.throttle = 1.0; plane.speed = 26;
    mode = "fly";
  } else if (demo === "rings") {
    run.contract = 1; run.time = 42;
    startContract(run, 1, plane);
    plane.x = -300; plane.y = 105; plane.z = 260;
    plane.heading = Math.atan2(140, 160);
    plane.speed = 46; plane.throttle = 0.6; plane.onGround = false;
    mode = "fly";
  } else if (demo === "drop") {
    run.contract = 2; run.time = 128;
    startContract(run, 2, plane);
    plane.x = -780; plane.y = 96; plane.z = -200;
    plane.heading = Math.PI;
    plane.speed = 40; plane.throttle = 0.5; plane.onGround = false;
    // Paket sudah dilepas sedetik lalu: terlihat jatuh di bawah pesawat.
    run.parcels.push({ x: -780, y: 86, z: -240, vy: -6, speed: 40, heading: Math.PI, done: false });
    run.parcelsLeft = 2;
    mode = "fly";
  } else if (demo === "landing") {
    run.contract = 3; run.time = 214;
    startContract(run, 3, plane);
    // 350 m sebelum landasan, di final lurus, landasan tepat di depan.
    plane.x = RUNWAY.x - Math.sin(RUNWAY.heading) * 350;
    plane.y = 108;
    plane.z = RUNWAY.z - Math.cos(RUNWAY.heading) * 350;
    plane.heading = RUNWAY.heading;
    plane.speed = 34; plane.throttle = 0.32; plane.onGround = false;
    mode = "fly";
  } else {
    return false;
  }
  // Autopilot demo: kemudikan pesawat menuju sasaran aktif.
  autopilot = true;
  return true;
}

// ---- Loop utama ----
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
let time = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const w = canvas.width, h = canvas.height;

  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hideToast(); }

  if (mode === "fly" && !paused) {
    input.poll(dt);
    if (autopilot) steerAutopilot(dt);
    updatePlane(plane, input, dt, wind);
    sfx.update(plane.throttle, plane.speed, plane.onGround);
    const ev = updateContracts(run, plane, dt, sfx);
    if (ev === "ring") showToast(`⭕ Cincin ${run.ringIdx}/5! +poin`);
    else if (ev === "rings-done") { showToast("Semua cincin ditembus! Kontrak 2: Antar Paket", "gold"); setTimeout(() => showCard(2), 1400); mode = "card"; }
    else if (ev === "drop-good") showToast(`📦 Paket sampai! ${run.dropsDone.size}/3 desa terlayani`);
    else if (ev === "drop-miss") showToast("📦 Paket meleset dari bantalan…", "bad");
    else if (ev === "drops-done") { showToast("Semua paket terkirim! Kontrak 3: Mendarat Pulang", "gold"); setTimeout(() => showCard(3), 1400); mode = "card"; }
    else if (ev === "landed") { showToast(`🛬 Mendarat mulus! +${run.landingScore} poin`, "gold"); setTimeout(showDebrief, 1500); mode = "card"; }
    else if (ev === "landed-off") showToast("Mendarat di luar landasan — lepas landas lagi!", "bad");
    if (plane.damage >= 100 && plane.crash) handleCrash();
  } else if (mode === "crashed") {
    crashTimer -= dt;
    if (crashTimer <= 0) respawn();
  } else if (mode === "menu") {
    // Latar menu: kamera mengorbit pelan di atas laguna.
    plane.x = -300 + Math.sin(time * 0.05) * 120;
    plane.z = 100 + Math.cos(time * 0.05) * 120;
    plane.y = 150;
    plane.heading = time * 0.05 + Math.PI;
    plane.speed = 40;
  }

  // ---- Gambar ----
  chaseCamera(cam, plane, w, h);
  drawSky(ctx, cam, w, h, time);
  drawTerrain(ctx, cam);
  drawRunway(ctx, cam);
  drawPads(ctx, cam, run.dropsDone);
  drawClouds(ctx, cam, time);
  if (run.contract === 1) drawRings(ctx, cam, run, time);
  drawParcels(ctx, cam, run);
  drawPlane(ctx, plane, w, h, time);
  if (mode === "fly" || mode === "paused" || mode === "crashed") {
    drawHUD(ctx, plane, run, w, h, time);
    drawTargetArrow(ctx, currentTarget(run), plane, cam, w, h);
    drawInstrumentPanel(ctx, plane, w, h, time);
  }
  if (mode === "menu") drawMenuOverlay(ctx, w, h, time);
  if (mode === "paused") {
    ctx.save();
    ctx.fillStyle = "rgba(4, 18, 32, 0.55)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff"; ctx.font = "bold 44px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("⏸ JEDA", w / 2, h / 2);
    ctx.font = "18px sans-serif"; ctx.fillStyle = "#bfeaff";
    ctx.fillText("Tekan P untuk melanjutkan · R untuk mengulang kontrak", w / 2, h / 2 + 36);
    ctx.restore();
  }
  if (mode === "crashed") {
    ctx.save();
    ctx.fillStyle = "rgba(60, 8, 8, 0.45)"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffc4be"; ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("💥 KECELAKAAN", w / 2, h / 2 - 10);
    ctx.font = "18px sans-serif";
    ctx.fillText("Pesawat kembali ke titik aman…", w / 2, h / 2 + 28);
    ctx.restore();
  }
}

// Autopilot demo: arahkan haluan & pitch ke sasaran, jaga throttle,
// dan jangan pernah menukik ke bawah bukit di depan.
function steerAutopilot(dt) {
  const t = currentTarget(run);
  if (!t) { input.throttleDelta = 0; input.roll = 0; input.pitch = 0; return; }
  const dx = t.x - plane.x, dz = t.z - plane.z;
  const want = Math.atan2(dx, dz);
  let dh = want - plane.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  input.roll = Math.max(-1, Math.min(1, dh * 1.4));
  // Jarak aman dari tanah 140 m di depan; naik bila bukit mendekat.
  const aheadX = plane.x + Math.sin(plane.heading) * 140;
  const aheadZ = plane.z + Math.cos(plane.heading) * 140;
  const clearAlt = groundHeightAt(aheadX, aheadZ) + 46;
  const dy = t.y - plane.y;
  const pitchTarget = Math.max(-0.7, Math.min(0.7, dy * 0.012));
  const pitchClear = Math.max(-0.2, Math.min(0.7, (clearAlt - plane.y) * 0.02));
  // Saat kontrak mendarat dan sudah dekat landasan, izin turun.
  const dist = Math.hypot(dx, dz);
  // Di bawah 90 m dan sudah mengudara: naik dulu, belok pelan.
  if (!plane.onGround && plane.y < 90 && run.contract !== 3) {
    input.pitch = Math.max(0.45, input.pitch);
    input.roll = Math.max(-0.45, Math.min(0.45, input.roll));
  }
  if (plane.onGround) input.pitch = 0;
  input.pitch = (run.contract === 3 && dist < 260)
    ? Math.max(-0.45, Math.min(0.3, dy * 0.012))
    : Math.max(pitchTarget, pitchClear);
  input.throttleDelta = dist > 120 ? 0.4 : (plane.speed > 40 ? -0.5 : 0.2);
  // Demo kontrak paket: jatuhkan paket otomatis saat sudah di atas bantalan.
  if (run.contract === 2 && run.parcelsLeft > 0 && dist < 130 && !plane.onGround) {
    dropParcel(run, plane, sfx);
  }
}

function drawMenuOverlay(ctx, w, h, time) {
  ctx.save();
  ctx.fillStyle = "rgba(4, 18, 32, 0.45)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd75e";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText("KURIR LANGIT", w / 2, h * 0.3);
  ctx.fillStyle = "#eef6ff";
  ctx.font = "26px sans-serif";
  ctx.fillText("Kepulauan Angin — tiga kontrak, satu pesawat amfibi", w / 2, h * 0.3 + 44);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#bfeaff";
  ctx.fillText("Terbang menembus cincin emas, antar paket ke tiga desa, lalu mendarat pulang.", w / 2, h * 0.3 + 76);
  ctx.fillText("Klik tombol di bawah untuk menerima kontrak pertamamu.", w / 2, h * 0.3 + 102);
  ctx.restore();
}

// ---- Mulai ----
if (!setupDemo()) {
  showCard(1);
  run.contract = 1;
  mode = "card";
}
requestAnimationFrame(frame);
