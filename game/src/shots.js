// The screenshot scenes behind ?shot=play|vault|escape|caught. Each one plays the
// real rules forward from a fresh world for a fixed script of waypoints, so the
// frame is what a short game really looks like and the same seed always gives the
// same frame.
//
// The pilot is a cautious thief, not a scripted ghost: it only starts a leg when
// the whole leg is unwatched, falls back to a spot no patrol or camera ever
// watches while it waits for a gap, and runs for cover (dashing) when the alarm
// climbs past the point a near miss becomes a chase. Brief sightings are
// tolerated — the meter cools — so it does not flee on every glimpse. Only the
// caught scene is reckless — it walks into the middle and stands in the open.
// The lockpick needs standing still, so a waypoint can carry a wait.
import { STEP, THIEF } from './config.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const ARRIVE = 14;
const MAX_SECONDS = 120;
/** A guard this close is a grab waiting to happen, seen or not. */
const TOO_CLOSE = 56;

function runScript(world, waypoints, maxSeconds, reckless, trace, endOnComplete) {
  world.reset();
  const start = { x: world.state.thief.x, y: world.state.thief.y };
  let index = 0;
  let waitLeft = 0;
  let acted = false;

  // Places to break line of sight: south of the display cases and south of the
  // benches, where the furniture stands between the thief and the patrols.
  const COVER = [
    { x: 320, y: 420 }, { x: 960, y: 420 },
    { x: 270, y: 620 }, { x: 1010, y: 620 },
  ];
  // Spots no patrol or camera ever watches, where the thief can wait out a
  // patrol: the entrance, south of the west case, and south of the benches.
  // (The east case's spot is watched by the east camera, so it is cover for a
  // dash through, not a place to wait.)
  const SAFE = [
    start,
    { x: 320, y: 420 },
    { x: 270, y: 620 },
    { x: 1010, y: 620 },
  ];
  /** The alarm level where a sighting stops being a near miss and the thief runs for cover. */
  const DANGER_ALARM = 50;

  let retreatTarget = null;

  // A guard within grab range triggers a short dodge first — away from that
  // guard, blended toward the entrance so the dodge never pins the thief
  // against a wall. Running straight away from a guard once drove the thief
  // into the south-west corner, where it was cornered and caught.
  function dodgeDirection(thief) {
    let nearest = null;
    let best = Infinity;
    for (const g of world.state.guards) {
      const d = Math.hypot(g.x - thief.x, g.y - thief.y);
      if (d < best) { best = d; nearest = g; }
    }
    const away = nearest
      ? { dx: thief.x - nearest.x, dy: thief.y - nearest.y }
      : { dx: 0, dy: 1 };
    const awayLen = Math.hypot(away.dx, away.dy) || 1;
    const homeX = start.x - thief.x;
    const homeY = start.y - thief.y;
    const homeLen = Math.hypot(homeX, homeY) || 1;
    const dx = away.dx / awayLen + (homeX / homeLen) * 0.7;
    const dy = away.dy / awayLen + (homeY / homeLen) * 0.7;
    const d = Math.hypot(dx, dy) || 1;
    return { dx: dx / d, dy: dy / d };
  }

  function guardTooClose(thief) {
    for (const g of world.state.guards) {
      if (Math.hypot(g.x - thief.x, g.y - thief.y) < TOO_CLOSE) return true;
    }
    return false;
  }

  // The nearest cover point that is not itself being watched right now; the
  // entrance is the fallback, being the one spot no patrol line reaches.
  function pickCover(thief) {
    let best = null;
    let bestD = Infinity;
    for (const p of [...COVER, start]) {
      if (world.sees(p.x, p.y)) continue;
      const d = Math.hypot(p.x - thief.x, p.y - thief.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best || start;
  }

  function nearestSafe(thief) {
    let best = SAFE[0];
    let bestD = Infinity;
    for (const p of SAFE) {
      const d = Math.hypot(p.x - thief.x, p.y - thief.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // True when no guard or camera can see any point of the next stretch of the
  // leg right now. Only the near stretch is checked, not the whole leg: the
  // patrols move while the thief walks, so a whole leg is rarely clear at
  // once and demanding it stalls the thief short of every crossing.
  const LOOKAHEAD = 120;
  function legClear(from, to) {
    const full = Math.hypot(to.x - from.x, to.y - from.y);
    const d = Math.min(full, LOOKAHEAD);
    const ux = (to.x - from.x) / (full || 1);
    const uy = (to.y - from.y) / (full || 1);
    const steps = Math.max(1, Math.ceil(d / 20));
    for (let i = 0; i <= steps; i += 1) {
      const x = from.x + ux * d * (i / steps);
      const y = from.y + uy * d * (i / steps);
      if (world.sees(x, y)) return false;
    }
    return true;
  }

  function moveToward(input, thief, target, dash) {
    const dx = target.x - thief.x;
    const dy = target.y - thief.y;
    const d = Math.hypot(dx, dy);
    if (d < ARRIVE) return true;
    input.dx = dx / d;
    input.dy = dy / d;
    input.dash = dash;
    return false;
  }

  const limit = Math.min(maxSeconds, MAX_SECONDS);
  for (let t = 0; t < limit / STEP; t += 1) {
    const input = { dx: 0, dy: 0, dash: false, smoke: false, coin: null };
    const thief = world.state.thief;
    let decision = 'waypoint';
    if (!reckless && guardTooClose(thief)) {
      // A guard is about to grab the thief: dodge, dashing.
      const dir = dodgeDirection(thief);
      input.dx = dir.dx;
      input.dy = dir.dy;
      input.dash = true;
      decision = 'dodge';
    } else if (!reckless && retreatTarget) {
      // Already running for cover: keep going until it is reached.
      if (moveToward(input, thief, retreatTarget, true)) retreatTarget = null;
      decision = 'cover';
    } else if (!reckless && world.state.alarm > DANGER_ALARM) {
      // The heat is on: break line of sight behind cover, dashing.
      retreatTarget = pickCover(thief);
      if (moveToward(input, thief, retreatTarget, true)) retreatTarget = null;
      decision = 'cover';
    } else {
      const wp = waypoints[index];
      if (wp) {
        if (waitLeft > 0) {
          waitLeft -= STEP;
          if (waitLeft <= 0) {
            index += 1;
            acted = false;
          }
          decision = 'wait';
        } else {
          const dx = wp.x - thief.x;
          const dy = wp.y - thief.y;
          const d = Math.hypot(dx, dy);
          if (d < ARRIVE) {
            if (wp.act === 'smoke' && !acted) { input.smoke = true; acted = true; }
            if (wp.act && wp.act.coin && !acted) { input.coin = wp.act.coin; acted = true; }
            if (wp.wait && world.sees(thief.x, thief.y)) {
              // A timed wait (the lockpick) only starts when the spot is
              // clear; otherwise fall back to a safe spot and try again.
              moveToward(input, thief, nearestSafe(thief), false);
              decision = 'wait-clear';
            } else if (wp.wait) {
              waitLeft = wp.wait;
              decision = 'wait';
            } else {
              index += 1;
              acted = false;
              decision = 'arrive';
            }
          } else if (reckless) {
            input.dx = dx / d;
            input.dy = dy / d;
          } else if (!legClear(thief, wp)) {
            // The way ahead is watched: fall back to the nearest safe spot
            // and wait there. Standing in the open while a guard walks into
            // range is how the thief gets caught — the alarm climbs while it
            // waits, and by the time it runs the guard is already chasing.
            const safe = nearestSafe(thief);
            decision = moveToward(input, thief, safe, false) ? 'hold' : 'safe';
          } else {
            input.dx = dx / d;
            input.dy = dy / d;
          }
        }
      }
    }
    const events = world.step(STEP, input, false);
    if (trace) {
      trace({
        t: world.state.elapsed, decision,
        thief: { x: thief.x, y: thief.y },
        alarm: world.state.alarm,
        guards: world.state.guards.map((g) => ({ name: g.name, x: g.x, y: g.y, state: g.state })),
        waypoint: index,
      });
    }
    if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) break;
    // The scene is staged: once the script is played out, the frame is the
    // thief at the last waypoint — not wherever it retreats to afterwards.
    if (endOnComplete && index >= waypoints.length) break;
  }
  const state = world.state;
  const screen = state.escaped ? SCREEN_WIN : state.over ? SCREEN_OVER : SCREEN_PLAY;
  return { screen, best: state.score };
}

const SCRIPTS = {
  // Mid-heist, sneaking past the patrols after taking the west gem.
  play: {
    maxSeconds: 40,
    waypoints: [
      { x: 640, y: 540 },
      { x: 330, y: 410, wait: 0.4 },
      { x: 500, y: 440 },
      { x: 700, y: 440 },
    ],
  },
  // At the vault, picking the lock while the north patrol passes. The route
  // goes around the statue's west side: straight up the middle runs into it.
  vault: {
    maxSeconds: 75,
    waypoints: [
      { x: 640, y: 540 },
      { x: 520, y: 300 },
      { x: 520, y: 100 },
      { x: 640, y: 92, wait: 3.0 },
    ],
  },
  // The full run: vault, then smoke on the way back and out the exit.
  escape: {
    maxSeconds: 110,
    waypoints: [
      { x: 640, y: 540 },
      { x: 520, y: 300 },
      { x: 520, y: 100 },
      { x: 640, y: 92, wait: 3.0 },
      { x: 520, y: 300, act: 'smoke' },
      { x: 640, y: 540, act: { coin: { x: 900, y: 470 } } },
      { x: 640, y: 660 },
    ],
  },
  // Straight into the middle patrol's path, standing in the open. This one
  // does not end on completion: the thief stands there until it is caught.
  caught: {
    maxSeconds: 60,
    reckless: true,
    waypoints: [
      { x: 640, y: 430 },
    ],
  },
};

/**
 * Set `world` to the named scene (play, vault, escape or caught; any other name
 * is play) and return the screen to draw over it and the best score to show.
 * `trace`, when given, is called every step with the pilot's decision and the
 * state, for debugging the staging.
 */
export function stageShot(name, world, trace) {
  const script = SCRIPTS[name] || SCRIPTS.play;
  return runScript(world, script.waypoints, script.maxSeconds, !!script.reckless, trace, name !== 'caught');
}
