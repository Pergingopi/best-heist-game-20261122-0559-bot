// Every tuning number, colour and the room layout in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  speed: 235,
  dashMultiplier: 1.85,
  dashTime: 0.35,
  dashCooldown: 1.5,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 96,
  investigateSpeed: 132,
  alertSpeed: 140,
  coneRange: 260,
  /** Half-angle of a guard's vision cone, in radians. */
  coneHalfAngle: 0.5,
  /** Alarm points per second while this guard clearly sees the thief. */
  detectRate: 30,
  /** Alarm points per second the meter cools while nobody sees the thief. */
  alarmDecay: 30,
  /** Alarm level where guards grow suspicious and investigate the last seen spot. */
  suspiciousAt: 35,
  /** Alarm level where guards move toward the thief while they can see them. */
  alertAt: 60,
  /** Seconds a guard waits at each patrol waypoint. */
  waypointPause: 0.8,
  /** Seconds a guard looks around after reaching an investigation point. */
  investigateLook: 2.5,
};

export const CAMERA = {
  range: 305,
  coneHalfAngle: 0.45,
  detectRate: 24,
  /** Radians a camera sweeps either side of its base angle. */
  sweepAmplitude: 0.7,
  /** Radians per second of the sweep. */
  sweepSpeed: 0.5,
};

export const ALARM_MAX = 100;

export const VAULT = {
  x: 640,
  y: 56,
  /** How close the thief must stand to pick the lock. */
  pickRange: 82,
  /** Seconds of standing still at the vault to open it. */
  pickSeconds: 2.5,
  lootValue: 500,
};

export const EXIT = { x: 640, y: 672, width: 110, height: 34 };

export const GEMS = [
  { x: 320, y: 405, value: 150 },
  { x: 960, y: 405, value: 150 },
];

export const TOOLS = {
  smokeCount: 2,
  smokeDuration: 4,
  smokeRadius: 92,
  coinCount: 2,
  coinRange: 430,
  coinInvestigateRadius: 520,
  coinInvestigateSeconds: 3,
};

/** Walls and cover: every rectangle blocks movement and line of sight. */
export const WALLS = [
  // Outer walls.
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  // Display cases (cover) mid-hall.
  { x: 230, y: 290, w: 180, h: 90 },
  { x: 870, y: 290, w: 180, h: 90 },
  // The central statue plinth.
  { x: 590, y: 270, w: 100, h: 100 },
  // Pillars near the vault.
  { x: 170, y: 130, w: 56, h: 56 },
  { x: 1054, y: 130, w: 56, h: 56 },
  // Benches near the entrance.
  { x: 190, y: 540, w: 160, h: 48 },
  { x: 930, y: 540, w: 160, h: 48 },
];

/** Guards and their patrol loops (waypoints in field coordinates). */
export const GUARDS = [
  {
    // A rectangle clear of the cases: the old loop ran along the cases' south
    // edge (y=380) and straight through them on its west and east legs, so
    // the guard's circle overlapped the furniture and it could never move.
    name: 'Rook',
    start: { x: 430, y: 410 },
    waypoints: [
      { x: 430, y: 410 },
      { x: 850, y: 410 },
      { x: 850, y: 210 },
      { x: 430, y: 210 },
    ],
  },
  {
    name: 'Bishop',
    start: { x: 300, y: 170 },
    waypoints: [
      { x: 300, y: 170 },
      { x: 980, y: 170 },
      { x: 980, y: 120 },
      { x: 300, y: 120 },
    ],
  },
  {
    // Paces one line across the south band, back and forth. A single line, not
    // a rectangle: its south leg would run 32 px from the entrance, close
    // enough to spot a thief who has only just stepped inside.
    name: 'Knight',
    start: { x: 250, y: 470 },
    waypoints: [
      { x: 250, y: 470 },
      { x: 1030, y: 470 },
    ],
  },
];

/** Wall cameras: a fixed mount, a base aim, and a sweep around it. */
export const CAMERAS = [
  { x: 350, y: 26, baseAngle: Math.PI / 2, phase: 0 },
  { x: 1254, y: 360, baseAngle: Math.PI, phase: 1.6 },
];

export const PALETTE = {
  floor: '#141a26',
  floorTile: '#182031',
  carpet: '#5a1f2b',
  carpetEdge: '#7a2a3a',
  wall: '#2b3247',
  wallTop: '#3a4360',
  caseGlass: '#233246',
  caseEdge: '#4a5a78',
  statue: '#3d4a6b',
  bench: '#2c3550',
  vaultDoor: '#8a6d2f',
  vaultGlow: '#f2c94c',
  exitDoor: '#2f6b4f',
  exitGlow: '#57d98a',
  thief: '#e8ecf4',
  thiefHood: '#232a3d',
  guard: '#3d5a80',
  guardTrim: '#f2c94c',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneEdge: 'rgba(242, 201, 76, 0.45)',
  cameraCone: 'rgba(229, 83, 75, 0.16)',
  cameraConeEdge: 'rgba(229, 83, 75, 0.4)',
  cameraBody: '#5a2b28',
  gem: '#f2c94c',
  gemGlow: 'rgba(242, 201, 76, 0.35)',
  smoke: 'rgba(200, 208, 220, 0.55)',
  alarmLow: '#57d98a',
  alarmMid: '#f2a93c',
  alarmHigh: '#e5534b',
  panel: 'rgba(12, 16, 26, 0.82)',
  text: '#eef1f5',
  muted: '#8b93a3',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
