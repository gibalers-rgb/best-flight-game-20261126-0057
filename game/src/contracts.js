// contracts.js — tiga kontrak kurir yang dimainkan berurutan.
// 1 "Cincin Angin": terbang menembus 5 cincin di atas laguna.
// 2 "Antar Paket": jatuhkan paket ke 3 bantalan di pulau-pulau.
// 3 "Mendarat Pulang": mendarat mulus di landasan Pulau Besar.
// Skor: poin misi + bonus waktu. Bintang 1-3 dari total skor.
import { project, screenLen } from "./projection.js";
import { RUNWAY, PADS, groundHeight } from "./archipelago.js";

// Cincin: posisi, ketinggian, radius — jalur melengkung di atas laguna.
export const RINGS = [
  { x: -160, z: 420, y: 90, r: 22 },
  { x: -420, z: 60, y: 110, r: 22 },
  { x: -640, z: -260, y: 130, r: 21 },
  { x: -560, z: -640, y: 120, r: 21 },
  { x: -240, z: -900, y: 100, r: 20 },
];

export function newRun() {
  return {
    contract: 0,            // 0 menu, 1 cincin, 2 paket, 3 mendarat, 4 selesai
    ringIdx: 0,
    ringsHit: 0,
    dropsDone: new Set(),
    parcels: [],            // paket yang sedang jatuh {x,y,z,vy}
    parcelsLeft: 3,
    score: 0,
    time: 0,
    startedAt: 0,
    message: null,
    messageAt: 0,
    crashCount: 0,
    landingScore: 0,
    checkpoint: null,       // titik respawn setelah jatuh
  };
}

export const CONTRACT_INFO = [
  null,
  {
    title: "Kontrak 1 — Cincin Angin",
    body: "Lima cincin emas melayang di atas laguna. Terbang menembusnya satu per satu — makin cepat, makin besar bonusnya. Gas dengan W, belok dengan panah kiri/kanan, naik-turun dengan panah atas/bawah.",
    keys: "W/S gas · ←/→ belok · ↑/↓ pitch",
  },
  {
    title: "Kontrak 2 — Antar Paket",
    body: "Tiga desa menunggu paketnya: Desa Kelapa, Mercusuar Karang, dan Pondok Kabut. Terbang rendah di atas bantalan jerami berbendera, lalu tekan SPASI untuk menjatuhkan paket. Kamu bawa 3 paket — jangan sampai meleset.",
    keys: "SPASI lepas paket · terbang rendah di atas bantalan",
  },
  {
    title: "Kontrak 3 — Mendarat Pulang",
    body: "Terakhir: pulang ke landasan Pulau Besar. Turunkan gas, jaga sayap tetap datar, dan sentuh aspal pelan-pelan di bawah 34 m/s. Mendarat mulus = bonus besar. Menukik atau miring = kecelakaan.",
    keys: "S kurangi gas · jaga roll & pitch kecil saat menyentuh tanah",
  },
];

export function startContract(run, n, plane) {
  run.contract = n;
  run.message = null;
  if (n === 1) {
    run.ringIdx = 0; run.ringsHit = 0;
    // Ambang landasan Pulau Besar (140 m sebelum tengah landasan).
    run.checkpoint = {
      x: RUNWAY.x - Math.sin(RUNWAY.heading) * 140,
      y: 12,
      z: RUNWAY.z - Math.cos(RUNWAY.heading) * 140,
      heading: RUNWAY.heading, speed: 0, throttle: 0, ground: true,
    };
  } else if (n === 2) {
    run.dropsDone = new Set();
    run.parcels = [];
    run.parcelsLeft = 3;
    run.checkpoint = { x: -420, y: 130, z: 60, heading: Math.PI * 0.9, speed: 42, throttle: 0.55, ground: false };
  } else if (n === 3) {
    // Final lurus: 600 m sebelum landasan, searah haluan landasan.
    run.checkpoint = {
      x: RUNWAY.x - Math.sin(RUNWAY.heading) * 600,
      y: 150,
      z: RUNWAY.z - Math.cos(RUNWAY.heading) * 600,
      heading: RUNWAY.heading, speed: 46, throttle: 0.5, ground: false,
    };
  }
  if (run.checkpoint) {
    plane.x = run.checkpoint.x; plane.y = run.checkpoint.y; plane.z = run.checkpoint.z;
    plane.heading = run.checkpoint.heading;
    plane.speed = run.checkpoint.speed; plane.throttle = run.checkpoint.throttle;
    plane.onGround = run.checkpoint.ground; plane.pitch = 0; plane.roll = 0;
    plane.damage = 0; plane.crash = null; plane.landing = null;
  }
}

// Perbarui logika misi tiap frame. Kembalikan event string bila ada.
export function updateContracts(run, plane, dt, sfx) {
  run.time += dt;
  if (run.contract === 1) {
    const ring = RINGS[run.ringIdx];
    if (!ring) return null;
    const dx = plane.x - ring.x, dy = plane.y - ring.y, dz = plane.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < ring.r) {
      run.ringsHit++;
      run.ringIdx++;
      const bonus = Math.max(60, 220 - Math.round(run.time) * 2);
      run.score += 200 + bonus;
      sfx.ring();
      if (run.ringIdx >= RINGS.length) {
        run.score += 300;
        return "rings-done";
      }
      return "ring";
    }
  } else if (run.contract === 2) {
    // Paket jatuh: gravitasi 9,8 m/s^2, lalu cek bantalan.
    for (const pk of run.parcels) {
      if (pk.done) continue;
      pk.vy -= 9.8 * dt;
      pk.y += pk.vy * dt;
      pk.z += Math.cos(pk.heading) * pk.speed * dt;
      pk.x += Math.sin(pk.heading) * pk.speed * dt;
      const g = groundHeight(pk.x, pk.z);
      if (pk.y <= g + 1) {
        pk.done = true;
        let hit = -1;
        for (let i = 0; i < PADS.length; i++) {
          if (run.dropsDone.has(i)) continue;
          const d = Math.hypot(pk.x - PADS[i].x, pk.z - PADS[i].z);
          if (d < 16) { hit = i; break; }
        }
        if (hit >= 0) {
          run.dropsDone.add(hit);
          run.score += 300;
          sfx.dropGood();
          if (run.dropsDone.size >= PADS.length) return "drops-done";
          return "drop-good";
        }
        sfx.dropBad();
        return "drop-miss";
      }
    }
  } else if (run.contract === 3) {
    if (plane.landing) {
      const land = plane.landing;
      plane.landing = null;
      // Hanya dihitung bila mendarat di landasan.
      const rx = plane.x - RUNWAY.x, rz = plane.z - RUNWAY.z;
      const along = Math.abs(rx * Math.sin(RUNWAY.heading) + rz * Math.cos(RUNWAY.heading));
      const across = Math.abs(rx * Math.cos(RUNWAY.heading) - rz * Math.sin(RUNWAY.heading));
      if (along < RUNWAY.length / 2 + 20 && across < RUNWAY.width / 2 + 14) {
        const soft = Math.max(0, 1 - Math.abs(land.vspeed || -3) / 6.5);
        const pts = 400 + Math.round(soft * 300);
        run.score += pts;
        run.landingScore = pts;
        return "landed";
      }
      // Mendarat di luar landasan: lepas landas lagi, tanpa poin.
      return "landed-off";
    }
  }
  return null;
}

export function dropParcel(run, plane, sfx) {
  if (run.contract !== 2 || run.parcelsLeft <= 0) return false;
  if (plane.onGround) return false;
  run.parcelsLeft--;
  run.parcels.push({
    x: plane.x, y: plane.y - 2, z: plane.z,
    vy: -1, speed: plane.speed, heading: plane.heading, done: false,
  });
  sfx.drop();
  return true;
}

// Panah penunjuk ke sasaran aktif (cincin / bantalan / landasan).
export function currentTarget(run) {
  if (run.contract === 1 && run.ringIdx < RINGS.length) {
    const r = RINGS[run.ringIdx];
    return { x: r.x, y: r.y, z: r.z, label: `Cincin ${run.ringIdx + 1}/5` };
  }
  if (run.contract === 2) {
    for (let i = 0; i < PADS.length; i++) {
      if (!run.dropsDone.has(i)) {
        return { x: PADS[i].x, y: groundHeight(PADS[i].x, PADS[i].z) + 4, z: PADS[i].z, label: PADS[i].label };
      }
    }
    return null;
  }
  if (run.contract === 3) {
    return { x: RUNWAY.x, y: RUNWAY.alt + 6, z: RUNWAY.z, label: "Landasan" };
  }
  return null;
}

// ---- Menggambar cincin + paket jatuh ----
export function drawRings(ctx, cam, run, time) {
  for (let i = run.ringIdx; i < RINGS.length; i++) {
    const ring = RINGS[i];
    const p = project(cam, ring.x, ring.y, ring.z);
    if (!p) continue;
    const r = screenLen(cam, ring.r, p.d);
    if (r < 2) continue;
    const active = i === run.ringIdx;
    const pulse = active ? 0.75 + 0.25 * Math.sin(time * 5) : 0.45;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = active ? "#ffd75e" : "#8fd8ff";
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.shadowColor = active ? "#ffb400" : "#57c8ff";
    ctx.shadowBlur = active ? 22 : 8;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, r * 0.08), 0, Math.PI * 2); ctx.fill();
    if (active) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffd75e";
      ctx.font = `bold ${Math.max(12, Math.round(r * 0.5))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, p.x, p.y - r - 10);
    }
    ctx.restore();
  }
}

export function drawParcels(ctx, cam, run) {
  for (const pk of run.parcels) {
    if (pk.done) continue;
    const p = project(cam, pk.x, pk.y, pk.z);
    if (!p) continue;
    const s = Math.max(3, screenLen(cam, 1.6, p.d));
    ctx.save();
    ctx.fillStyle = "#b5772e";
    ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    ctx.strokeStyle = "#5a3a14"; ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2);
    ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
    ctx.restore();
  }
}

export function starsFor(score) {
  if (score >= 2600) return 3;
  if (score >= 1900) return 2;
  if (score >= 1200) return 1;
  return 0;
}
