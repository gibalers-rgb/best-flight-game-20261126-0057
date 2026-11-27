// kestrel.js — pesawat amfibi "Kestrel" dan model terbangnya.
// Model arcade yang jinak: throttle mengatur kecepatan, pitch mengatur
// naik/turun, roll mengatur belok. Stall di bawah 14 m/s, overspeed di
// atas 92 m/s memberi guncangan.
import { groundHeight } from "./archipelago.js";

export function newPlane() {
  return {
    x: 86, y: 12, z: 1010,          // mulai di ujung landasan Pulau Besar
    heading: (38 * Math.PI) / 180,
    pitch: 0, roll: 0,
    speed: 0, throttle: 0,       // throttle 0..1
    vspeed: 0,                    // kecepatan vertikal (m/s), untuk penilaian mendarat
    onGround: true,
    damage: 0,                    // 0..100; 100 = hancur
    prop: 0,                      // sudut baling-baling (animasi)
    wobble: 0,                    // guncangan (overspeed / turbulensi)
  };
}

const STALL = 14, VMAX = 92, LIFT = 0.055;

export function updatePlane(p, input, dt, wind) {
  // Throttle: W/S atau roda mouse.
  p.throttle = Math.max(0, Math.min(1, p.throttle + input.throttleDelta * dt * 0.9));
  // Target kecepatan dari throttle; pesawat melaju menuju target itu.
  const targetSpeed = 8 + p.throttle * 84;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 0.55);

  // Roll dari A/D atau panah kiri/kanan (dan mouse), pitch dari panah atas/bawah.
  const rollTarget = input.roll * 0.62;
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 3.2);
  // Belok: heading berubah sebanding tan(roll) * kecepatan.
  p.heading += Math.tan(p.roll) * (p.speed / 46) * dt * 0.9;
  const pitchTarget = input.pitch * 0.42;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 2.6);

  // Gaya angkat: di atas stall, pitch mengangkat pesawat.
  const liftFactor = Math.max(0, Math.min(1, (p.speed - STALL) / 26));
  const climb = Math.sin(p.pitch) * p.speed * liftFactor * 2.6;
  // Gravitasi menarik turun bila lambat; di darat pesawat menempel tanah.
  const ground = groundHeight(p.x, p.z);
  if (p.onGround) {
    p.y = ground + 1.6;
    if (p.speed > STALL + 3 && p.pitch > 0.05) p.onGround = false;
  } else {
    const sink = (1 - liftFactor) * 9.5;
    p.vspeed = climb - sink;
    p.y += p.vspeed * dt;
    if (p.y <= ground + 1.6) {
      p.y = ground + 1.6;
      landOrCrash(p, ground);
    }
  }
  if (p.y > 620) { p.y = 620; p.vspeed = Math.min(0, p.vspeed); }

  // Gerak maju + angin silang ringan.
  p.x += Math.sin(p.heading) * p.speed * dt + wind.x * dt;
  p.z += Math.cos(p.heading) * p.speed * dt + wind.z * dt;
  // Batas dunia: belokkan halus kembali ke tengah.
  const r = Math.hypot(p.x, p.z);
  if (r > 1750) {
    const back = Math.atan2(-p.x, -p.z);
    let dh = back - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += dh * dt * 0.5;
  }
  p.prop += dt * (6 + p.throttle * 42);
  p.wobble = p.speed > 84 ? (p.speed - 84) / 8 : 0;
  return p;
}

// Menyentuh tanah: mendarat mulus bila pelan, datar, dan di landasan;
// kalau tidak, pesawat rusak.
function landOrCrash(p, ground) {
  const flat = Math.abs(p.roll) < 0.28 && Math.abs(p.pitch) < 0.22;
  const gentle = p.vspeed > -6.5;
  const slow = p.speed < 34;
  if (flat && gentle && slow) {
    p.onGround = true;
    p.vspeed = 0;
    p.landing = { vspeed: p.vspeed, speed: p.speed, quality: "smooth" };
  } else {
    p.damage = 100;
    p.crash = {
      reason: !slow ? "terlalu cepat" : !gentle ? "menukik terlalu keras" : "sayap miring",
      speed: p.speed,
    };
  }
}

export function resetTo(p, spot) {
  p.x = spot.x; p.z = spot.z; p.y = spot.y;
  p.heading = spot.heading; p.pitch = 0; p.roll = 0;
  p.speed = spot.speed || 0; p.throttle = spot.throttle || 0;
  p.onGround = !!spot.ground; p.damage = 0; p.crash = null; p.landing = null;
  p.vspeed = 0;
}

// ---- Menggambar Kestrel dari belakang-bawah (chase view) ----
export function drawPlane(ctx, p, w, h, time) {
  const cx = w / 2, baseY = h * 0.82;
  const bank = p.roll;
  const wob = p.wobble * Math.sin(time * 31) * 2.2;
  const lift = Math.max(0, (p.speed - 14) / 60) * 14;
  ctx.save();
  ctx.translate(cx + wob, baseY - lift + Math.sin(time * 2.2) * 1.5);
  ctx.rotate(-bank * 0.9);
  const S = Math.min(w, h) / 820; // skala pesawat
  ctx.scale(S, S);

  // Bayangan di bawah pesawat (memberi rasa ketinggian).
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#06283f";
  ctx.beginPath(); ctx.ellipse(0, 128, 150, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Sayap bawah + atas (biplane amfibi) dengan ujung kuning.
  ctx.fillStyle = "#e8b64c";
  roundRect(ctx, -168, -8, 336, 26, 10); ctx.fill();
  ctx.fillStyle = "#c0392b";
  roundRect(ctx, -168, -8, 22, 26, 8); ctx.fill();
  roundRect(ctx, 146, -8, 22, 26, 8); ctx.fill();
  ctx.fillStyle = "#e8b64c";
  roundRect(ctx, -138, -58, 276, 22, 9); ctx.fill();
  // Penyangga sayap.
  ctx.strokeStyle = "#7a4a21"; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-120, -8); ctx.lineTo(-104, -58);
  ctx.moveTo(120, -8); ctx.lineTo(104, -58);
  ctx.moveTo(-120, -8); ctx.lineTo(-120, -58);
  ctx.moveTo(120, -8); ctx.lineTo(120, -58);
  ctx.stroke();

  // Badan pesawat: kuning cerah dengan garis merah.
  ctx.fillStyle = "#f7c948";
  ctx.beginPath();
  ctx.moveTo(0, -96);
  ctx.quadraticCurveTo(34, -72, 30, -20);
  ctx.quadraticCurveTo(28, 34, 12, 62);
  ctx.lineTo(-12, 62);
  ctx.quadraticCurveTo(-28, 34, -30, -20);
  ctx.quadraticCurveTo(-34, -72, 0, -96);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(-30, -34, 60, 9);
  ctx.fillRect(-24, 30, 48, 7);
  // Kokpit: kaca biru mengilap.
  ctx.fillStyle = "#9fd8ef";
  ctx.beginPath(); ctx.ellipse(0, -58, 19, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath(); ctx.ellipse(-6, -66, 6, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  // Ekor: sirip vertikal + stabilizer.
  ctx.fillStyle = "#c0392b";
  ctx.beginPath(); ctx.moveTo(0, 58); ctx.lineTo(-26, 108); ctx.lineTo(26, 108); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e8b64c";
  roundRect(ctx, -64, 78, 128, 16, 7); ctx.fill();
  // Pelampung (floats) kiri-kanan.
  ctx.fillStyle = "#2e6f8e";
  roundRect(ctx, -78, 66, 30, 62, 12); ctx.fill();
  roundRect(ctx, 48, 66, 30, 62, 12); ctx.fill();
  ctx.fillStyle = "#57c8ff";
  roundRect(ctx, -78, 66, 30, 12, 6); ctx.fill();
  roundRect(ctx, 48, 66, 30, 12, 6); ctx.fill();
  // Baling-baling di hidung: putaran buram + hub.
  ctx.save();
  ctx.translate(0, -96);
  ctx.rotate(p.prop);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#3c4148";
  ctx.beginPath(); ctx.ellipse(0, -34, 7, 36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 34, 7, 36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#c0392b";
  ctx.beginPath(); ctx.arc(0, -96, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd75e";
  ctx.beginPath(); ctx.arc(0, -96, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
