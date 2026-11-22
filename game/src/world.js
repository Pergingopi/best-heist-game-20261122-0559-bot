// The game's rules and state, with no drawing and no browser in it: the thief, the
// guards and their patrols, the sweeping cameras, vision cones with line of sight,
// the alarm meter, the loot, the lockpick and the tools. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the small smoke and ping lists.

import {
  ALARM_MAX, CAMERA, CAMERAS, EXIT, FIELD, GEMS, GUARD, GUARDS, STEP,
  THIEF, TOOLS, VAULT, WALLS,
} from './config.js';

export const EVENT_GEM = 1;
export const EVENT_VAULT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_SMOKE = 16;
export const EVENT_COIN = 32;
export const EVENT_SPOTTED = 64;

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function clampAngle(angle, base, span) {
  return base + Math.max(-span, Math.min(span, angleDiff(angle, base)));
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const px = [-dx, dx, -dy, dy];
  const qx = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i += 1) {
    if (px[i] === 0) {
      if (qx[i] < 0) return false;
    } else {
      const t = qx[i] / px[i];
      if (px[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

/** True when the segment touches the circle (used for smoke blocking sight). */
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx - cx;
  const py = y1 + t * dy - cy;
  return px * px + py * py <= r * r;
}

function circleHitsWalls(x, y, radius) {
  for (const w of WALLS) {
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

export function createWorld(random) {
  const thief = {
    x: EXIT.x, y: EXIT.y - 40, radius: THIEF.radius,
    dashTime: 0, dashCooldown: 0, moving: false,
  };
  const guards = GUARDS.map((g) => ({
    name: g.name,
    x: g.start.x, y: g.start.y, radius: GUARD.radius,
    waypoints: g.waypoints, waypointIndex: 0, pause: 0,
    facing: Math.PI / 2, state: 'patrol', target: null, lookTime: 0,
    pauseJitter: 0,
  }));
  const cameras = CAMERAS.map((c) => ({ ...c, angle: c.baseAngle }));
  const gems = GEMS.map((g) => ({ ...g, taken: false }));
  const smokes = [];
  const pings = [];
  const state = {
    thief, guards, cameras, gems, smokes, pings,
    alarm: 0, maxAlarm: 0, timesSpotted: 0,
    loot: false, vaultProgress: 0, score: 0,
    smokeLeft: TOOLS.smokeCount, coinsLeft: TOOLS.coinCount,
    elapsed: 0, over: false, escaped: false,
  };

  function reset() {
    thief.x = EXIT.x;
    thief.y = EXIT.y - 40;
    thief.dashTime = 0;
    thief.dashCooldown = 0;
    thief.moving = false;
    for (const g of guards) {
      const def = GUARDS.find((d) => d.name === g.name);
      g.x = def.start.x;
      g.y = def.start.y;
      g.waypointIndex = 0;
      g.pause = 0;
      g.facing = Math.PI / 2;
      g.state = 'patrol';
      g.target = null;
      g.lookTime = 0;
      g.pauseJitter = 0;
    }
    for (let i = 0; i < cameras.length; i += 1) cameras[i].angle = CAMERAS[i].baseAngle;
    for (const gem of gems) gem.taken = false;
    smokes.length = 0;
    pings.length = 0;
    state.alarm = 0;
    state.maxAlarm = 0;
    state.timesSpotted = 0;
    state.loot = false;
    state.vaultProgress = 0;
    state.score = 0;
    state.smokeLeft = TOOLS.smokeCount;
    state.coinsLeft = TOOLS.coinCount;
    state.elapsed = 0;
    state.over = false;
    state.escaped = false;
  }

  function moveCircle(body, dx, dy) {
    const nx = body.x + dx;
    if (!circleHitsWalls(nx, body.y, body.radius)) body.x = nx;
    const ny = body.y + dy;
    if (!circleHitsWalls(body.x, ny, body.radius)) body.y = ny;
  }

  function blockedBySmoke(x1, y1, x2, y2) {
    for (const s of smokes) {
      if (segmentHitsCircle(x1, y1, x2, y2, s.x, s.y, s.r)) return true;
    }
    return false;
  }

  function pointHidden(px, py) {
    for (const s of smokes) {
      const dx = px - s.x;
      const dy = py - s.y;
      if (dx * dx + dy * dy <= s.r * s.r) return true;
    }
    return false;
  }

  function canSeePoint(x, y, facing, halfAngle, range, px, py) {
    const dx = px - x;
    const dy = py - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 1) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), facing)) > halfAngle) return false;
    if (pointHidden(px, py)) return false;
    for (const w of WALLS) {
      if (segmentHitsRect(x, y, px, py, w)) return false;
    }
    if (blockedBySmoke(x, y, px, py)) return false;
    return true;
  }

  function canSee(x, y, facing, halfAngle, range) {
    return canSeePoint(x, y, facing, halfAngle, range, thief.x, thief.y);
  }

  /**
   * True when any guard or camera can see the point (px, py) right now — the
   * same cone, range, line-of-sight and smoke test as for the thief, but for
   * an arbitrary point. The screenshot pilot uses it to wait for a safe
   * crossing instead of walking into a cone.
   */
  function sees(px, py) {
    for (const g of guards) {
      if (canSeePoint(g.x, g.y, g.facing, GUARD.coneHalfAngle, GUARD.coneRange, px, py)) return true;
    }
    for (const c of cameras) {
      if (canSeePoint(c.x, c.y, c.angle, CAMERA.coneHalfAngle, CAMERA.range, px, py)) return true;
    }
    return false;
  }

  function nearestGuardTo(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const g of guards) {
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestDist) { best = g; bestDist = d; }
    }
    return best;
  }

  /**
   * One fixed step. `input` is { dx, dy, dash, smoke, coin } where dx/dy is a
   * unit direction (0,0 to stand still), dash/smoke are booleans, and coin is
   * null or { x, y }. With `harmless` set (the title screen's backdrop) the
   * patrols and cameras move but nothing detects, scores or ends the game.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;

    // Thief movement, axis by axis so walls slide instead of sticking.
    const moving = input.dx !== 0 || input.dy !== 0;
    thief.moving = moving;
    if (thief.dashCooldown > 0) thief.dashCooldown = Math.max(0, thief.dashCooldown - dt);
    if (input.dash && thief.dashCooldown === 0 && moving) {
      thief.dashTime = THIEF.dashTime;
      thief.dashCooldown = THIEF.dashCooldown;
    }
    if (thief.dashTime > 0) thief.dashTime = Math.max(0, thief.dashTime - dt);
    const speed = THIEF.speed * (thief.dashTime > 0 ? THIEF.dashMultiplier : 1);
    moveCircle(thief, input.dx * speed * dt, 0);
    moveCircle(thief, 0, input.dy * speed * dt);
    thief.x = Math.max(THIEF.radius, Math.min(FIELD.width - THIEF.radius, thief.x));
    thief.y = Math.max(THIEF.radius, Math.min(FIELD.height - THIEF.radius, thief.y));

    // Tools.
    if (input.smoke && state.smokeLeft > 0 && !harmless) {
      state.smokeLeft -= 1;
      smokes.push({ x: thief.x, y: thief.y, r: TOOLS.smokeRadius, t: TOOLS.smokeDuration });
      events |= EVENT_SMOKE;
    }
    if (input.coin && state.coinsLeft > 0 && !harmless) {
      state.coinsLeft -= 1;
      pings.push({ x: input.coin.x, y: input.coin.y, t: 1.4 });
      const guard = nearestGuardTo(input.coin.x, input.coin.y, TOOLS.coinInvestigateRadius);
      if (guard) {
        guard.state = 'investigate';
        guard.target = { x: input.coin.x, y: input.coin.y };
        guard.lookTime = TOOLS.coinInvestigateSeconds;
      }
      events |= EVENT_COIN;
    }
    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      smokes[i].t -= dt;
      if (smokes[i].t <= 0) smokes.splice(i, 1);
    }
    for (let i = pings.length - 1; i >= 0; i -= 1) {
      pings[i].t -= dt;
      if (pings[i].t <= 0) pings.splice(i, 1);
    }

    // Cameras sweep.
    for (const c of cameras) {
      c.angle = c.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed + c.phase) * CAMERA.sweepAmplitude;
    }

    // Guards patrol, investigate and react.
    for (const g of guards) {
      let target = null;
      let speed = GUARD.patrolSpeed;
      if (g.state === 'patrol') {
        const wp = g.waypoints[g.waypointIndex];
        if (g.pause > 0) {
          g.pause = Math.max(0, g.pause - dt);
          g.facing += 0.6 * dt;
        } else {
          target = wp;
          const d = Math.hypot(wp.x - g.x, wp.y - g.y);
          if (d < 6) {
            g.pause = GUARD.waypointPause + random() * 0.4;
            g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
          }
        }
      } else if (g.state === 'investigate' || g.state === 'look') {
        speed = GUARD.investigateSpeed;
        if (g.target) {
          const d = Math.hypot(g.target.x - g.x, g.target.y - g.y);
          if (d < 8) {
            g.state = 'look';
            g.lookTime -= dt;
            g.facing += 1.4 * dt;
            if (g.lookTime <= 0) {
              g.state = 'patrol';
              g.target = null;
            }
          } else {
            target = g.target;
          }
        } else {
          g.state = 'patrol';
        }
      } else if (g.state === 'alert') {
        speed = GUARD.alertSpeed;
        target = { x: thief.x, y: thief.y };
      }
      if (target) {
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.5) {
          const want = Math.atan2(dy, dx);
          g.facing += angleDiff(want, g.facing) * Math.min(1, 10 * dt);
          const stepLen = Math.min(d, speed * dt);
          moveCircle(g, (dx / d) * stepLen, 0);
          moveCircle(g, 0, (dy / d) * stepLen);
        }
      }
    }

    if (harmless) return events;

    // A guard that reaches the thief grabs them, even if the alarm has not filled.
    for (const g of guards) {
      if (Math.hypot(g.x - thief.x, g.y - thief.y) < GUARD.radius + THIEF.radius - 2) {
        state.over = true;
        return events | EVENT_CAUGHT;
      }
    }

    // Detection: every guard and camera that clearly sees the thief feeds the alarm.
    let seeing = 0;
    let seenBy = null;
    for (const g of guards) {
      if (canSee(g.x, g.y, g.facing, GUARD.coneHalfAngle, GUARD.coneRange)) {
        seeing += GUARD.detectRate;
        seenBy = g;
      }
    }
    for (const c of cameras) {
      if (canSee(c.x, c.y, c.angle, CAMERA.coneHalfAngle, CAMERA.range)) seeing += CAMERA.detectRate;
    }
    const before = state.alarm;
    if (seeing > 0) {
      state.alarm = Math.min(ALARM_MAX, state.alarm + seeing * dt);
      if (seenBy) {
        if (state.alarm >= GUARD.alertAt) {
          seenBy.state = 'alert';
        } else if (state.alarm >= GUARD.suspiciousAt && seenBy.state === 'patrol') {
          seenBy.state = 'investigate';
          seenBy.target = { x: thief.x, y: thief.y };
          seenBy.lookTime = GUARD.investigateLook;
        }
      }
    } else {
      state.alarm = Math.max(0, state.alarm - GUARD.alarmDecay * dt);
      for (const g of guards) {
        if (g.state === 'alert') {
          g.state = 'investigate';
          g.target = { x: thief.x, y: thief.y };
          g.lookTime = GUARD.investigateLook;
        }
      }
    }
    if (before < GUARD.suspiciousAt && state.alarm >= GUARD.suspiciousAt) {
      state.timesSpotted += 1;
      events |= EVENT_SPOTTED;
    }
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    if (state.alarm >= ALARM_MAX) {
      state.over = true;
      return events | EVENT_CAUGHT;
    }

    // Gems.
    for (const gem of gems) {
      if (!gem.taken && Math.hypot(gem.x - thief.x, gem.y - thief.y) < 28) {
        gem.taken = true;
        state.score += gem.value;
        events |= EVENT_GEM;
      }
    }

    // The vault: stand still beside it to pick the lock.
    const vaultDist = Math.hypot(VAULT.x - thief.x, VAULT.y - thief.y);
    if (!state.loot && vaultDist < VAULT.pickRange && !moving) {
      state.vaultProgress += dt;
      if (state.vaultProgress >= VAULT.pickSeconds) {
        state.loot = true;
        state.score += VAULT.lootValue;
        events |= EVENT_VAULT;
      }
    } else if (!state.loot) {
      state.vaultProgress = Math.max(0, state.vaultProgress - dt * 2);
    }

    // Escape: reach the exit door carrying the vault loot.
    if (state.loot
      && Math.abs(thief.x - EXIT.x) < EXIT.width / 2
      && thief.y > EXIT.y - EXIT.height
      && thief.y < EXIT.y + EXIT.height) {
      const timeBonus = Math.max(0, 300 - Math.floor(state.elapsed) * 2);
      const toolBonus = state.smokeLeft * 50 + state.coinsLeft * 50;
      state.score += 200 + timeBonus + toolBonus;
      state.escaped = true;
      state.over = true;
      return events | EVENT_ESCAPED;
    }

    return events;
  }

  reset();
  return { state, reset, step, sees };
}
