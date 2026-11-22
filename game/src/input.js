// Keyboard and mouse, read as edges and levels: held keys steer the thief, a press
// fires one action, and a click gives a field point for the noise coin. The input
// knows nothing about screens; the caller decides what a click means.

import { FIELD, TOOLS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_DASH = 8;

const KEY_DIRS = {
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let click = null;

  function fieldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (KEY_DIRS[event.code]) held.add(event.code);
    else if (event.code === 'Space' || event.code === 'Enter') queued |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    else if (event.code === 'KeyQ') queued |= ACTION_SMOKE;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') queued |= ACTION_DASH;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  canvas.addEventListener('pointerdown', (event) => {
    click = fieldPoint(event.clientX, event.clientY);
  });

  /** The held movement direction, normalised (0,0 when still). */
  function direction() {
    let dx = 0;
    let dy = 0;
    for (const code of held) {
      const dir = KEY_DIRS[code];
      if (dir) { dx += dir[0]; dy += dir[1]; }
    }
    if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };
    const len = Math.hypot(dx, dy);
    return { dx: dx / len, dy: dy / len };
  }

  /** The actions pressed since the last call, then cleared. */
  function takeActions() {
    const actions = queued;
    queued = 0;
    return actions;
  }

  /** The queued actions, without clearing them. */
  function peekActions() {
    return queued;
  }

  /**
   * The last click as a noise-coin target, clamped to the coin's throw range
   * from the thief; null when there was no click.
   */
  function takeCoin(thiefX, thiefY) {
    if (!click) return null;
    const point = click;
    click = null;
    const dx = point.x - thiefX;
    const dy = point.y - thiefY;
    const d = Math.hypot(dx, dy);
    if (d > TOOLS.coinRange) {
      return { x: thiefX + (dx / d) * TOOLS.coinRange, y: thiefY + (dy / d) * TOOLS.coinRange };
    }
    return { x: point.x, y: point.y };
  }

  /** A click waiting, whatever it means; clears it. */
  function takeClick() {
    const point = click;
    click = null;
    return point;
  }

  return { direction, takeActions, peekActions, takeCoin, takeClick };
}
