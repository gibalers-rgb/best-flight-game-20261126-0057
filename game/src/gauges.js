// gauges.js — HUD: kecepatan, ketinggian, kompas, horizon buatan,
// panel instrumen bawah, panah sasaran, dan bar throttle.
import { headingDeg, compass16 } from "./projection.js";

function fmt(n, d = 0) { return n.toFixed(d); }

export function drawHUD(ctx, plane, run, w, h, time) {
  // ---- Bar atas: misi, skor, waktu ----
  ctx.save();
  ctx.fillStyle = "rgba(4, 20, 36, 0.62)";
  ctx.fillRect(0, 0, w, 56);
  ctx.fillStyle = "#ffd75e";
  ctx.font = "bold 19px sans-serif";
  ctx.textAlign = "left";
  const names = ["", "Cincin Angin", "Antar Paket", "Mendarat Pulang", ""];
  ctx.fillText(run.contract >= 1 && run.contract <= 3 ? `✈ ${names[run.contract]}` : "Kurir Langit", 18, 36);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "center";
  const mins = Math.floor(run.time / 60), secs = Math.floor(run.time % 60);
  ctx.font = "bold 19px sans-serif";
  ctx.fillText(`Skor ${run.score}   ·   ${mins}:${String(secs).padStart(2, "0")}`, w / 2, 36);
  ctx.textAlign = "right";
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#9fd4f2";
  const prog = run.contract === 1 ? `Cincin ${run.ringsHit}/5`
    : run.contract === 2 ? `Paket terkirim ${run.dropsDone.size}/3 · sisa ${run.parcelsLeft}`
    : run.contract === 3 ? "Mendarat di landasan" : "";
  ctx.fillText(prog, w - 18, 36);
  ctx.restore();

  drawCompass(ctx, plane, w);
  drawAltSpeed(ctx, plane, w, h);
  drawHorizonGauge(ctx, plane, w, h);
  drawThrottle(ctx, plane, w, h);
}

function drawCompass(ctx, plane, w) {
  const cx = w / 2, cy = 30;
  const deg = headingDeg(plane.heading);
  ctx.save();
  ctx.fillStyle = "rgba(4, 20, 36, 0.55)";
  ctx.beginPath(); ctx.roundRect(cx - 170, cy - 20, 340, 34, 8); ctx.fill();
  ctx.strokeStyle = "rgba(140, 200, 240, 0.5)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = "13px sans-serif"; ctx.textAlign = "center";
  for (let off = -60; off <= 60; off += 10) {
    let d = deg + off;
    d = ((d % 360) + 360) % 360;
    const x = cx + off * 2.6;
    const major = d % 30 === 0;
    ctx.fillStyle = major ? "#ffd75e" : "#bfeaff";
    ctx.font = major ? "bold 13px sans-serif" : "12px sans-serif";
    if (major) {
      const label = d % 90 === 0 ? ["U", "T", "S", "B"][Math.round(d / 90) % 4] : String(Math.round(d));
      ctx.fillText(label, x, cy + 5);
    }
    ctx.fillRect(x, cy + 10, 1, major ? 5 : 3);
  }
  // Penanda haluan.
  ctx.fillStyle = "#ff5a4e";
  ctx.beginPath(); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx - 6, cy - 12); ctx.lineTo(cx + 6, cy - 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`${Math.round(deg)}° ${compass16(deg)}`, cx, cy + 30);
  ctx.restore();
}

function drawAltSpeed(ctx, plane, w, h) {
  const kmh = Math.round(plane.speed * 3.6);
  const alt = Math.max(0, Math.round(plane.y));
  ctx.save();
  ctx.textAlign = "left";
  // Kecepatan (kiri).
  ctx.fillStyle = "rgba(4, 20, 36, 0.62)";
  ctx.beginPath(); ctx.roundRect(16, 72, 168, 64, 10); ctx.fill();
  ctx.fillStyle = "#57c8ff"; ctx.font = "12px sans-serif";
  ctx.fillText("KECEPATAN", 28, 92);
  ctx.fillStyle = "#fff"; ctx.font = "bold 30px sans-serif";
  ctx.fillText(`${kmh}`, 28, 124);
  ctx.font = "14px sans-serif"; ctx.fillStyle = "#9fd4f2";
  ctx.fillText("km/jam", 108, 124);
  // Ketinggian (kanan).
  ctx.fillStyle = "rgba(4, 20, 36, 0.62)";
  ctx.beginPath(); ctx.roundRect(w - 184, 72, 168, 64, 10); ctx.fill();
  ctx.fillStyle = "#57c8ff"; ctx.font = "12px sans-serif";
  ctx.fillText("KETINGGIAN", w - 172, 92);
  ctx.fillStyle = "#fff"; ctx.font = "bold 30px sans-serif";
  ctx.fillText(`${alt}`, w - 172, 124);
  ctx.font = "14px sans-serif"; ctx.fillStyle = "#9fd4f2";
  ctx.fillText("meter", w - 92, 124);
  ctx.restore();
}

// Horizon buatan: cakram kecil yang miring mengikuti roll & pitch.
function drawHorizonGauge(ctx, plane, w, h) {
  const cx = w - 96, cy = h - 150, r = 52;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const py = Math.max(-r, Math.min(r, plane.pitch * r * 1.6));
  ctx.fillStyle = "#3f8fd2"; ctx.fillRect(-r, -r + py, r * 2, r);
  ctx.fillStyle = "#8a6a42"; ctx.fillRect(-r, py, r * 2, r);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(-r, py - 1, r * 2, 2);
  ctx.rotate(plane.roll);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#eef6ff"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // Sayap tetap (simbol pesawat).
  ctx.fillStyle = "#ffd75e";
  ctx.beginPath(); ctx.moveTo(cx - 26, cy); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 6, cy + 5); ctx.lineTo(cx - 26, cy + 5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 26, cy); ctx.lineTo(cx + 26, cy + 5); ctx.lineTo(cx + 6, cy + 5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9fd4f2"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("HORIZON", cx, cy + r + 16);
  ctx.restore();
}

// Bar throttle vertikal di kiri bawah + peringatan stall/overspeed.
function drawThrottle(ctx, plane, w, h) {
  const x = 30, y0 = h - 190, bh = 130;
  ctx.save();
  ctx.fillStyle = "rgba(4, 20, 36, 0.62)";
  ctx.beginPath(); ctx.roundRect(x - 8, y0 - 24, 56, bh + 44, 10); ctx.fill();
  ctx.fillStyle = "#12324a"; ctx.fillRect(x, y0, 20, bh);
  const th = plane.throttle * bh;
  const grad = ctx.createLinearGradient(0, y0 + bh, 0, y0);
  grad.addColorStop(0, "#57c8ff"); grad.addColorStop(1, "#ffd75e");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y0 + bh - th, 20, th);
  ctx.fillStyle = "#9fd4f2"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("GAS", x + 10, y0 - 8);
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, x + 10, y0 + bh + 16);
  if (plane.speed < 14 && !plane.onGround) {
    ctx.fillStyle = "#ff7a6e"; ctx.font = "bold 15px sans-serif";
    ctx.fillText("⚠ STALL!", x + 10, y0 - 30);
  } else if (plane.speed > 84) {
    ctx.fillStyle = "#ffb400"; ctx.font = "bold 15px sans-serif";
    ctx.fillText("⚠ TERLALU CEPAT", x + 10, y0 - 30);
  }
  ctx.restore();
}

// Panah tepi layar menuju sasaran aktif.
export function drawTargetArrow(ctx, target, plane, cam, w, h) {
  if (!target) return;
  const dx = target.x - plane.x, dz = target.z - plane.z;
  const dist = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) - plane.heading;
  const ax = w / 2 + Math.sin(ang) * 150;
  const ay = h * 0.42 + -Math.cos(ang) * 110;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(255, 215, 94, 0.9)";
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, 10); ctx.lineTo(0, 4); ctx.lineTo(-11, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "#ffd75e"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`${target.label} · ${Math.round(dist)} m`, ax, ay + 34);
  ctx.restore();
}

// Panel instrumen bawah: tiga dial (RPM, bahan bakar fiktif, suhu mesin).
export function drawInstrumentPanel(ctx, plane, w, h, time) {
  const y = h - 84;
  ctx.save();
  ctx.fillStyle = "rgba(5, 24, 42, 0.78)";
  ctx.beginPath(); ctx.roundRect(w / 2 - 210, y, 420, 74, 14); ctx.fill();
  ctx.strokeStyle = "rgba(140, 200, 240, 0.45)"; ctx.lineWidth = 1; ctx.stroke();
  dial(ctx, w / 2 - 140, y + 37, 27, plane.throttle, "RPM", "#57c8ff");
  dial(ctx, w / 2, y + 37, 27, Math.max(0, 1 - plane.damage / 100), "KONDISI", plane.damage > 60 ? "#ff7a6e" : "#57c86a");
  dial(ctx, w / 2 + 140, y + 37, 27, Math.min(1, plane.speed / 92), "DAYA", "#ffd75e");
  ctx.restore();
}

function dial(ctx, cx, cy, r, frac, label, color) {
  ctx.save();
  ctx.fillStyle = "#0a2438";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(180, 220, 245, 0.6)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, -Math.PI * 0.75, -Math.PI * 0.75 + frac * Math.PI * 1.5);
  ctx.stroke();
  // Jarum.
  const a = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9)); ctx.stroke();
  ctx.fillStyle = "#9fd4f2"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(label, cx, cy + r + 12);
  ctx.restore();
}
