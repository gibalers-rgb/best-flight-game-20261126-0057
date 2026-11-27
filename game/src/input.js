// Input for Skycourier: keyboard and mouse, both steering the same plane.
//
// Keyboard: Up/Down pitch, Left/Right roll, W/S throttle, Shift full throttle,
// Ctrl idle, Space brake, F flaps, M sound, P pause, R restart, 1/2/3 missions.
// Mouse: hold the left button and drag — the pointer's offset from the centre
// of the screen steers pitch and roll, like a stick. Releasing the button
// recentres the stick. Mouse and keyboard blend: whichever is active wins.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { active: false, dx: 0, dy: 0 };
  const pressed = new Set(); // keys hit since last poll (for one-shot actions)

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  canvas.addEventListener("pointerdown", (e) => {
    mouse.active = true;
    mouse.dx = 0;
    mouse.dy = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!mouse.active) return;
    const rect = canvas.getBoundingClientRect();
    mouse.dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    mouse.dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
  });
  const releaseMouse = () => {
    mouse.active = false;
    mouse.dx = 0;
    mouse.dy = 0;
  };
  canvas.addEventListener("pointerup", releaseMouse);
  canvas.addEventListener("pointercancel", releaseMouse);

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Read the current control frame. `consume` clears one-shot presses.
  return {
    read(dt) {
      let pitch = 0;
      let roll = 0;
      let throttleDelta = 0;

      if (keys.has("ArrowUp")) pitch += 1;
      if (keys.has("ArrowDown")) pitch -= 1;
      if (keys.has("ArrowLeft")) roll -= 1;
      if (keys.has("ArrowRight")) roll += 1;
      if (keys.has("KeyW")) throttleDelta += 0.55;
      if (keys.has("KeyS")) throttleDelta -= 0.55;
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) throttleDelta += 1.6;
      if (keys.has("ControlLeft") || keys.has("ControlRight")) throttleDelta -= 1.6;

      // Mouse stick overrides the keyboard axes while held: dragging up
      // pulls the nose up, dragging right banks right.
      if (mouse.active) {
        pitch = clamp(-mouse.dy * 1.4, -1, 1);
        roll = clamp(mouse.dx * 1.4, -1, 1);
      }

      const out = {
        pitch: clamp(pitch, -1, 1),
        roll: clamp(roll, -1, 1),
        throttleDelta,
        brake: keys.has("Space"),
        flaps: keys.has("KeyF"),
        pause: pressed.has("KeyP"),
        restart: pressed.has("KeyR"),
        mute: pressed.has("KeyM"),
        mission: pressed.has("Digit1") ? 1 : pressed.has("Digit2") ? 2 : pressed.has("Digit3") ? 3 : 0,
        anyKey: pressed.size > 0,
      };
      pressed.clear();
      return out;
    },
  };
}
