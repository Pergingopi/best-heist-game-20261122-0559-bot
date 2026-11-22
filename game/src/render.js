// Every pixel the player sees: the vault hall, the cover, the vision cones, the
// guards and cameras, the thief, the loot, the smoke, and the HUD with its alarm
// meter. The renderer only paints the state it is given; it never changes a rule.

import {
  ALARM_MAX, CAMERA, EXIT, FIELD, FONT, GUARD, PALETTE, THIEF, VAULT,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const TAU = Math.PI * 2;

function drawCone(ctx, x, y, facing, halfAngle, range, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawWallRect(ctx, r) {
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(r.x, r.y, r.w, 4);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawRoom(state) {
    // Floor and its tile grid.
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.floorTile;
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 24); ctx.lineTo(x, 696); ctx.stroke();
    }
    for (let y = 104; y < FIELD.height; y += 80) {
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(1256, y); ctx.stroke();
    }
    // The red carpet runner from the entrance to the vault.
    ctx.fillStyle = PALETTE.carpet;
    ctx.fillRect(560, 24, 160, 672);
    ctx.fillStyle = PALETTE.carpetEdge;
    ctx.fillRect(560, 24, 6, 672);
    ctx.fillRect(714, 24, 6, 672);
    // The vault door, glowing gold, at the north wall — drawn just below the
    // HUD panel, which covers the wall itself.
    ctx.fillStyle = state.loot ? '#3f7d5a' : PALETTE.vaultDoor;
    ctx.fillRect(VAULT.x - 70, 54, 140, 18);
    ctx.fillStyle = '#241c08';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.loot ? 'OPEN' : 'VAULT', VAULT.x, 63);
    // The exit door at the south wall, its label inside the door so it never
    // meets the hint line at the bottom.
    ctx.fillStyle = PALETTE.exitDoor;
    ctx.fillRect(EXIT.x - EXIT.width / 2, 696 - 22, EXIT.width, 22);
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText('EXIT', EXIT.x, 685);
  }

  function drawCover() {
    // Display cases: glass tops with a glinting artifact inside.
    for (const r of [
      { x: 230, y: 290, w: 180, h: 90 },
      { x: 870, y: 290, w: 180, h: 90 },
    ]) {
      ctx.fillStyle = PALETTE.caseGlass;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = PALETTE.caseEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x + 14, r.y + r.h - 12);
      ctx.lineTo(r.x + 60, r.y + 12);
      ctx.stroke();
    }
    // The central statue plinth.
    ctx.fillStyle = PALETTE.statue;
    ctx.fillRect(590, 270, 100, 100);
    ctx.fillStyle = '#4d5c85';
    ctx.beginPath();
    ctx.arc(640, 320, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.statue;
    ctx.fillRect(636, 288, 8, 24);
    // Pillars and benches.
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(170, 130, 56, 56);
    ctx.fillRect(1054, 130, 56, 56);
    ctx.fillStyle = PALETTE.bench;
    ctx.fillRect(190, 540, 160, 48);
    ctx.fillRect(930, 540, 160, 48);
  }

  function drawCones(state) {
    for (const g of state.guards) {
      const alerted = g.state === 'alert';
      drawCone(ctx, g.x, g.y, g.facing, GUARD.coneHalfAngle, GUARD.coneRange,
        alerted ? 'rgba(229, 83, 75, 0.25)' : PALETTE.cone,
        alerted ? 'rgba(229, 83, 75, 0.55)' : PALETTE.coneEdge);
    }
    for (const c of state.cameras) {
      drawCone(ctx, c.x, c.y, c.angle, CAMERA.coneHalfAngle, CAMERA.range,
        PALETTE.cameraCone, PALETTE.cameraConeEdge);
    }
  }

  function drawCameras(state) {
    for (const c of state.cameras) {
      ctx.fillStyle = PALETTE.cameraBody;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e5534b';
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(c.angle) * 6, c.y + Math.sin(c.angle) * 6, 4, 0, TAU);
      ctx.fill();
    }
  }

  function drawLoot(state) {
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 4);
    for (const gem of state.gems) {
      if (gem.taken) continue;
      ctx.fillStyle = `rgba(242, 201, 76, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y, 26, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(gem.x, gem.y - 12);
      ctx.lineTo(gem.x + 10, gem.y);
      ctx.lineTo(gem.x, gem.y + 12);
      ctx.lineTo(gem.x - 10, gem.y);
      ctx.closePath();
      ctx.fill();
    }
    if (!state.loot) {
      ctx.fillStyle = `rgba(242, 201, 76, ${0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(VAULT.x, VAULT.y + 16, 30, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(VAULT.x, VAULT.y + 4);
      ctx.lineTo(VAULT.x + 11, VAULT.y + 16);
      ctx.lineTo(VAULT.x, VAULT.y + 28);
      ctx.lineTo(VAULT.x - 11, VAULT.y + 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PALETTE.guardTrim;
      ctx.lineWidth = 2;
      ctx.stroke();
      // The direction the guard is looking.
      ctx.strokeStyle = PALETTE.guardTrim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.facing) * (g.radius + 7), g.y + Math.sin(g.facing) * (g.radius + 7));
      ctx.stroke();
      // A mark over a guard that is suspicious or alerted.
      if (g.state === 'investigate' || g.state === 'look') {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = 'bold 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', g.x, g.y - g.radius - 14);
      } else if (g.state === 'alert') {
        ctx.fillStyle = PALETTE.alarmHigh;
        ctx.font = 'bold 22px ' + FONT;
        ctx.fillText('!', g.x, g.y - g.radius - 14);
      }
    }
  }

  function drawThief(state) {
    const t = state.thief;
    // A soft ring while the lockpick is running.
    if (state.vaultProgress > 0 && !state.loot) {
      ctx.strokeStyle = PALETTE.vaultGlow;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (state.vaultProgress / 2.5));
      ctx.stroke();
    }
    // A light figure on the dark floor: the thief must read at a glance, so
    // the body is pale with a dark outline, not a dark hood lost in the dark.
    ctx.fillStyle = PALETTE.thief;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.thiefHood;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.thiefHood;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5, 0, TAU);
    ctx.fill();
    // The loot the thief is carrying.
    if (state.loot) {
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(t.x + 12, t.y - 14);
      ctx.lineTo(t.x + 18, t.y - 8);
      ctx.lineTo(t.x + 12, t.y - 2);
      ctx.lineTo(t.x + 6, t.y - 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSmokeAndPings(state) {
    for (const s of state.smokes) {
      ctx.fillStyle = PALETTE.smoke;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.4, s.y + s.r * 0.25, s.r * 0.6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x + s.r * 0.45, s.y - s.r * 0.3, s.r * 0.55, 0, TAU);
      ctx.fill();
    }
    for (const p of state.pings) {
      const grow = 1 - p.t / 1.4;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.9 * (1 - grow)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 + grow * 46, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, TAU);
      ctx.fill();
    }
  }

  function drawHud(state, screen) {
    // Top panel.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'left';
    const gemsTaken = state.gems.filter((g) => g.taken).length;
    ctx.fillText(`◆ ${gemsTaken}/2   ${state.loot ? '⬢ VAULT' : '○ VAULT'}`, 24, 27);
    ctx.textAlign = 'center';
    ctx.fillText('THE GILDED VAULT', FIELD.width / 2, 27);
    // Alarm meter.
    const meterX = FIELD.width - 320;
    const meterW = 220;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillStyle = state.alarm >= 80 ? PALETTE.alarmHigh : state.alarm >= 35 ? PALETTE.alarmMid : PALETTE.text;
    ctx.fillText('ALARM', meterX, 18);
    ctx.fillStyle = '#0c101a';
    ctx.fillRect(meterX, 30, meterW, 12);
    ctx.fillStyle = state.alarm >= 80 ? PALETTE.alarmHigh : state.alarm >= 35 ? PALETTE.alarmMid : PALETTE.alarmLow;
    ctx.fillRect(meterX, 30, meterW * (state.alarm / ALARM_MAX), 12);
    ctx.strokeStyle = PALETTE.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, 30, meterW, 12);
    // Tools and timer, right side below the panel.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(FIELD.width - 320, 60, 296, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + FONT;
    ctx.textAlign = 'left';
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    ctx.fillText(
      `Smoke ${'●'.repeat(state.smokeLeft)}${'○'.repeat(2 - state.smokeLeft)}   Coin ${'●'.repeat(state.coinsLeft)}${'○'.repeat(2 - state.coinsLeft)}   ${mins}:${String(secs).padStart(2, '0')}`,
      FIELD.width - 308, 76,
    );
    // Score, bottom left.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, FIELD.height - 34, 190, 34);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, 18, FIELD.height - 16);
    if (screen === SCREEN_PLAY) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('WASD / arrows to move · Q smoke · click to toss a coin · Shift to dash', FIELD.width / 2, FIELD.height - 14);
    }
    // The alarm's red edge while the heat is high.
    if (state.alarm >= 60 && (screen === SCREEN_PLAY || screen === SCREEN_OVER)) {
      const pulse = 0.12 + 0.08 * Math.sin(state.elapsed * 6);
      ctx.strokeStyle = `rgba(229, 83, 75, ${pulse + 0.15})`;
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, FIELD.width - 14, FIELD.height - 14);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(10, 13, 22, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('THE GILDED VAULT', FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px ' + FONT;
    ctx.fillText('A midnight heist in the Meridian Gallery', FIELD.width / 2, 258);
    ctx.font = '19px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Sneak past the guards and the cameras. Pick the vault. Slip out the exit.', FIELD.width / 2, 300);
    ctx.fillText('WASD / arrows to move · Q smoke pellet · click to toss a noise coin · Shift to dash', FIELD.width / 2, 332);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press Space or click to start', FIELD.width / 2, 400);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '20px ' + FONT;
      ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 440);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 13, 22, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 54px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.font = '20px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or Space to keep sneaking', FIELD.width / 2, 380);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(40, 8, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.alarmHigh;
    ctx.font = 'bold 64px ' + FONT;
    ctx.fillText('CAUGHT!', FIELD.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText(`The alarm hit ${Math.round(state.maxAlarm)} — the guards closed in.`, FIELD.width / 2, 350);
    ctx.fillText(`Score ${state.score} · Best ${Math.max(best, state.score)}`, FIELD.width / 2, 390);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '20px ' + FONT;
    ctx.fillText('Press Space or click to try again', FIELD.width / 2, 440);
  }

  function drawWin(state, best) {
    ctx.fillStyle = 'rgba(8, 22, 14, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.font = 'bold 58px ' + FONT;
    ctx.fillText('CLEAN GETAWAY!', FIELD.width / 2, 290);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px ' + FONT;
    ctx.fillText('The vault is empty and you are gone before sunrise.', FIELD.width / 2, 340);
    ctx.fillText(`Score ${state.score} · Best ${Math.max(best, state.score)}`, FIELD.width / 2, 380);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '20px ' + FONT;
    ctx.fillText('Press Space or click to run it again', FIELD.width / 2, 430);
  }

  function draw(state, screen, best) {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    drawRoom(state);
    drawCones(state);
    drawCover();
    drawCameras(state);
    drawLoot(state);
    drawGuards(state);
    drawSmokeAndPings(state);
    drawThief(state);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw };
}
