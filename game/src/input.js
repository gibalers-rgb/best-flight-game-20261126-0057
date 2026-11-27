// Input for Skycourier: Island Hopper — keyboard and mouse, both steering
// the same aircraft.
//
// Keyboard: Up/Down pitch, Left/Right roll, W/S throttle, Shift full
// throttle, Ctrl idle, Space brake, F flaps, M sound, P pause, R restart,
// 1/2/3 missions. Mouse: hold the left button and drag — the pointer's
// offset from the centre of the screen steers pitch and roll, like a stick.
// Releasing the button recentres the stick. Mouse and keyboard blend:
// whichever is active wins.

export function makeControls(canvas) {
  const held = new Set();
  const tapped = new Set(); // keys hit since the last poll (one-shot actions)
  const stick = { active: false, dx: 0, dy: 0 };

  function limit(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) tapped.add(e.code);
    held.add(e.code);
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());

  canvas.addEventListener("pointerdown", (e) => {
    stick.active = true;
    stick.dx = 0;
    stick.dy = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!stick.active) return;
    const rect = canvas.getBoundingClientRect();
    stick.dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    stick.dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
  });
  function releaseStick() {
    stick.active = false;
    stick.dx = 0;
    stick.dy = 0;
  }
  canvas.addEventListener("pointerup", releaseStick);
  canvas.addEventListener("pointercancel", releaseStick);
  canvas.addEventListener("pointerleave", releaseStick);

  // Read the current control frame. `poll` clears the one-shot presses.
  return {
    poll() {
      let pitch = 0;
      let roll = 0;
      let throttleDelta = 0;

      if (held.has("ArrowUp")) pitch += 1;
      if (held.has("ArrowDown")) pitch -= 1;
      if (held.has("ArrowLeft")) roll -= 1;
      if (held.has("ArrowRight")) roll += 1;
      if (held.has("KeyW")) throttleDelta += 0.55;
      if (held.has("KeyS")) throttleDelta -= 0.55;
      if (held.has("ShiftLeft") || held.has("ShiftRight")) throttleDelta += 1.6;
      if (held.has("ControlLeft") || held.has("ControlRight")) throttleDelta -= 1.6;

      // The mouse stick overrides the keyboard axes while held: dragging up
      // pulls the nose up, dragging right banks right.
      if (stick.active) {
        pitch = limit(-stick.dy * 1.4, -1, 1);
        roll = limit(stick.dx * 1.4, -1, 1);
      }

      const frame = {
        pitch: limit(pitch, -1, 1),
        roll: limit(roll, -1, 1),
        throttleDelta,
        brake: held.has("Space"),
        flaps: held.has("KeyF"),
        pause: tapped.has("KeyP"),
        restart: tapped.has("KeyR"),
        mute: tapped.has("KeyM"),
        mission: tapped.has("Digit1") ? 1 : tapped.has("Digit2") ? 2 : tapped.has("Digit3") ? 3 : 0,
        anyKey: tapped.size > 0,
      };
      tapped.clear();
      return frame;
    },
  };
}
