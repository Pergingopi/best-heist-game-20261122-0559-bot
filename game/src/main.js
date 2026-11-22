// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// caught and escaped.
//
// ?seed=N fixes the patrols. ?shot=play|vault|escape|caught (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CAUGHT, EVENT_COIN, EVENT_ESCAPED, EVENT_GEM,
  EVENT_SMOKE, EVENT_SPOTTED, EVENT_VAULT,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_PAUSE, ACTION_SMOKE, createInput,
} from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  createRenderer,
} from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

// The canvas's backing store is 300x150 unless it is set: the CSS stretches
// it to the window, so without this the game renders soft and blurry. Size it
// to the window (capped at 2x for very dense displays) and keep it sized.
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
}
window.addEventListener('resize', resize);
resize();

const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Pick the vault, then slip out the exit.');
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(escaped
      ? `Clean getaway. Score ${world.state.score}. Best ${best}.`
      : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function playSoundFor(events) {
    if (events & EVENT_GEM) sound.pickup();
    if (events & EVENT_VAULT) sound.vault();
    if (events & EVENT_SPOTTED) sound.spotted();
    if (events & EVENT_SMOKE) sound.smoke();
    if (events & EVENT_COIN) sound.coin();
    if (events & EVENT_CAUGHT) sound.caught();
    if (events & EVENT_ESCAPED) sound.win();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, dash: false, smoke: false, coin: null }, true);
      return;
    }
    const dir = input.direction();
    const actions = input.takeActions();
    const coin = input.takeCoin(world.state.thief.x, world.state.thief.y);
    if (actions & ACTION_DASH) sound.dash();
    const events = world.step(STEP, {
      dx: dir.dx, dy: dir.dy,
      dash: (actions & ACTION_DASH) !== 0,
      smoke: (actions & ACTION_SMOKE) !== 0,
      coin,
    }, false);
    playSoundFor(events);
    if (events & (EVENT_CAUGHT | EVENT_ESCAPED)) endGame((events & EVENT_ESCAPED) !== 0);
  }

  function handleActions() {
    // On the play screen, clicks are the noise coin and the queued bits belong
    // to step(): only the pause key is read here, and only peeked at, so the
    // smoke and dash presses are not swallowed.
    if (screen === SCREEN_PLAY) {
      if (input.peekActions() & ACTION_PAUSE) {
        input.takeActions();
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    const actions = input.takeActions();
    const click = input.takeClick();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if ((actions & ACTION_CONFIRM) || click) {
        sound.ensure();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if ((actions & (ACTION_PAUSE | ACTION_CONFIRM)) || click) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
