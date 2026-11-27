// projection.js — kamera kejar dan proyeksi perspektif dunia -> layar.
// Dunia: x timur, z selatan, y ketinggian (meter). Kamera duduk di belakang
// pesawat, menengok ke arah haluan, lalu miring mengikuti roll pesawat.
export function makeCamera() {
  return {
    x: 0, y: 0, z: 0,        // posisi mata kamera
    yaw: 0, pitch: 0, roll: 0,
    focal: 900,              // panjang fokus (px) pada kanvas 1280 lebar
    cx: 640, cy: 360,        // titik tengah layar
    horizonY: 360,           // garis horizon hasil proyeksi, dihitung tiap frame
  };
}

// Posisikan kamera di belakang pesawat: 17 m ke belakang, 5,5 m di atas,
// menengok 34 m ke depan. Roll kamera mengikuti 55% roll pesawat supaya
// horizon ikut miring tapi tidak membuat pusing.
export function chaseCamera(cam, plane, w, h) {
  const fx = Math.sin(plane.heading), fz = Math.cos(plane.heading);
  cam.x = plane.x - fx * 17;
  cam.y = plane.y + 5.5;
  cam.z = plane.z - fz * 17;
  cam.yaw = plane.heading;
  cam.pitch = plane.pitch * 0.45;
  cam.roll = plane.roll * 0.55;
  cam.focal = h * 1.18;
  cam.cx = w / 2;
  cam.cy = h * 0.52;
  // Horizon: titik jauh di depan pada ketinggian kamera.
  const far = project(cam, cam.x + fx * 4000, cam.y, cam.z + fz * 4000);
  cam.horizonY = far ? far.y : h * 0.42;
}

// Proyeksikan satu titik dunia ke layar. Kembalikan null bila di belakang kamera.
export function project(cam, px, py, pz) {
  let dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z;
  // Putar mengelilingi sumbu Y (yaw), lalu sumbu X (pitch), lalu sumbu Z (roll).
  const sy = Math.sin(-cam.yaw), cy = Math.cos(-cam.yaw);
  let x1 = dx * cy + dz * sy;
  let z1 = -dx * sy + dz * cy;
  let y1 = dy;
  const sp = Math.sin(-cam.pitch), cp = Math.cos(-cam.pitch);
  let y2 = y1 * cp - z1 * sp;
  let z2 = y1 * sp + z1 * cp;
  const sr = Math.sin(-cam.roll), cr = Math.cos(-cam.roll);
  let x3 = x1 * cr - y2 * sr;
  let y3 = x1 * sr + y2 * cr;
  if (z2 < 2.5) return null; // terlalu dekat / di belakang
  const s = cam.focal / z2;
  return { x: cam.cx + x3 * s, y: cam.cy - y3 * s, d: z2, s };
}

// Jarak layar (px) untuk sebuah panjang dunia pada kedalaman z2.
export function screenLen(cam, meters, z2) {
  return (meters * cam.focal) / Math.max(z2, 2.5);
}

// Arah kompas 0..360 dari heading (0 = utara, 90 = timur).
export function headingDeg(h) {
  let d = (h * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return d;
}

export function compass16(deg) {
  const names = ["U", "UTL", "TL", "TTL", "T", "TBD", "BD", "BBD", "S", "SBD", "BD", "BBD", "B", "BBL", "BL", "UBL"];
  return names[Math.round(deg / 22.5) % 16];
}
