// controls.js — keyboard + mouse. Satu objek input yang dibaca model terbang.
// W/S: gas. Panah kiri/kanan atau A/D: roll. Panah atas/bawah: pitch.
// Mouse: gerakkan untuk membelok (opsional, tombol M mengaktifkan).
// Spasi: lepas paket. P: jeda. R: ulang kontrak. M: alih mouse.
export function makeInput() {
  const input = {
    keys: {},
    roll: 0, pitch: 0, throttleDelta: 0,
    mouseSteer: false, mouseX: 0,
    pressed: {},      // tombol yang baru ditekan frame ini (sekali pakai)
    onAction: null,   // callback untuk aksi sekali tekan (spasi, P, R, M)
    attach() {
      window.addEventListener("keydown", (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
        if (!e.repeat) {
          this.pressed[e.key.toLowerCase()] = true;
          if (this.onAction) this.onAction(e.key.toLowerCase());
        }
        this.keys[e.key.toLowerCase()] = true;
      });
      window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
      window.addEventListener("mousemove", (e) => {
        this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      });
      window.addEventListener("blur", () => { this.keys = {}; });
    },
    // Hitung sumbu dari tombol yang sedang ditahan.
    poll(dt) {
      const k = this.keys;
      let roll = 0, pitch = 0, thr = 0;
      if (k["arrowleft"] || k["a"]) roll -= 1;
      if (k["arrowright"] || k["d"]) roll += 1;
      if (k["arrowup"]) pitch += 1;
      if (k["arrowdown"]) pitch -= 1;
      if (k["w"]) thr += 1;
      if (k["s"]) thr -= 1;
      if (this.mouseSteer) roll += this.mouseX * 0.85;
      this.roll = Math.max(-1, Math.min(1, roll));
      this.pitch = Math.max(-1, Math.min(1, pitch));
      this.throttleDelta = thr;
      this.pressed = {};
    },
    consume(key) {
      if (this.pressed[key]) { this.pressed[key] = false; return true; }
      return false;
    },
  };
  return input;
}
