/* ============================================================
   THE DAILY GRIND — game.js (part 1: core, input, level load,
   factories, tile physics)
   ============================================================ */
(() => {
'use strict';

/* ---------------- helpers ---------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;
const hashN = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

/* ---------------- constants ---------------- */
const VIEW_H = 720;
let VIEW_W = 1280;
const T = TILE;
const GRAV = 2600, MAXFALL = 1350;
const MOVE = 352, ACCEL = 2900, AIR_ACCEL = 1950, FRICTION = 2600;
const JUMPV = 870, DJUMPV = 800;
const COYOTE = 0.1, BUFFER = 0.13;
const DASH_V = 790, DASH_T = 0.16, DASH_CD = 0.65;
const BOOST_T = 4.0;
const WALL_SLIDE_MAX = 235, WALLJ_VX = 440;
const BELT_V = 118, SPRING_V = 1330;
const CLIMB_V = 215, CLIMB_H = 132;
const LADDER_POP = -520, CLIMB_LOCK = 0.28;
const STAPLE_V = 780, STAPLE_G = 620, FIRE_CD = 0.34;
const COMBO_T = 2.5;
const COMBO_WORDS = ['AGILE!', 'SCRUMMED!', 'MOVED THE NEEDLE!', 'SHIP IT!', '10X ENERGY!'];
let comboN = 0, comboT = 0, comboPopT = 0;
let shredTickT = 0;
let runHasStapler = false;
let noStaplerHintCd = 0;
let bossIntroPlayed = false;
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const BOSS_TAUNTS = [
  "WE'RE LIKE FAMILY HERE.",
  'THIS IS JUST A RESTRUCTURING.',
  'THINK OF THE SHAREHOLDERS.',
  'YOUR ROLE IS BEING REIMAGINED.',
  "LET'S CIRCLE BACK.",
  'DID YOU SEE THE ALL-HANDS?',
  'MANDATORY FUN AT FIVE.',
];
const TITLE_TIPS = [
  'wall-jump: hug a wall mid-air, press jump again',
  'spring chairs launch you to the loot shelves',
  'chain stomps: AGILE -> SCRUMMED -> SHIP IT -> 10X',
  'employee badges open red security gates',
  'high-five coworkers for +25 morale',
  'grabbed the pager? hand it to a coworker. fast.',
  'high shelves hide extra tickets',
  'ladders: hold UP to climb, jump to hop off',
  'stapler: tap F — managers take two staples to drop',
];

const PAL = {
  skyTop: '#7ec9ff', skyBot: '#dff2ff',
  wall: '#b9c6d4', wallSeam: '#aab8c7',
  ceil: '#e8edf2',
  carpetA: '#5d6b82', carpetB: '#66748c', carpetDot: '#525f75',
  wood: '#a9743f', woodDark: '#8a5c30', woodTop: '#c58a4d',
  cab: '#6f8299', cabDark: '#5b6d84',
  box: '#c99a5f', boxTape: '#b5824a',
  plant: '#3f9b4f', plantD: '#2f7a3c', pot: '#b06a3b',
  shirt: '#ffffff', pants: '#37474f', tie: '#e53935', skin: '#ffd9b3', hair: '#4e342e',
  suit: '#5b6673', suitD: '#49525e',
  ceoSuit: '#2c2c3e', gold: '#f4c542',
  coffee: '#6f4e37', foam: '#f3e9dc',
  manila: '#e8c46b', manilaD: '#caa44e',
  exitG: '#43d17c',
};

/* ---------------- canvas ----------------
   The logical viewport is 720px tall (levels are exactly 15 tiles).
   Width derives from the device aspect ratio so the canvas fills the
   screen edge-to-edge — no page-gap letterbox bars on landscape phones.
   VIEW_W is clamped to a sane range and never exceeds the current
   level's pixel width (keeps tight arenas like the boss floor framed). */
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let currentLvlPxW = 0;           /* set on level load so the viewport can clamp */
let vignette = null;
function makeVignette() {
  vignette = document.createElement('canvas');
  vignette.width = VIEW_W; vignette.height = VIEW_H;
  const vg = vignette.getContext('2d');
  const rg = vg.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.88);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(10,14,22,0.42)');
  vg.fillStyle = rg; vg.fillRect(0, 0, VIEW_W, VIEW_H);
}
function applyViewport() {
  VIEW_W = Math.max(1280, Math.min(1920, Math.round(VIEW_H * window.innerWidth / window.innerHeight)));
  cv.width = VIEW_W; cv.height = VIEW_H;
  makeVignette();
  fit();
}
function fit() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  cv.style.width = (VIEW_W * s | 0) + 'px';
  cv.style.height = (VIEW_H * s | 0) + 'px';
}
/* camera travel limits. When the viewport is WIDER than the level
   (boss arena is 1440px vs a 1558px phone), center the room instead of
   pinning the camera at 0 and leaving a dead band on one side. */
function camBounds() {
  if (!lvl) return [0, 0];
  const max = lvl.pxW - VIEW_W;
  if (max <= 0) {
    const h = (VIEW_W - lvl.pxW) / 2;
    return [-h, h];
  }
  return [0, max];
}
function clampCam() {
  const b = camBounds();
  camX = clamp(camX, b[0], b[1]);
}
window.addEventListener('resize', () => {
  applyViewport();
  clampCam();
});
applyViewport();

/* ---------------- input ---------------- */
const Input = { l: false, r: false, d: false, jump: false, buf: 0, dashReq: false, fireReq: false };
const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowDown: 'd', s: 'd', S: 'd' };
const JUMPK = [' ', 'z', 'Z', 'w', 'W', 'ArrowUp', 'k'];
const DASHK = ['Shift', 'x', 'X', 'c'];
const FIREK = ['f', 'F'];

function pressAction(act) {
  if (act === 'jump') Input.buf = BUFFER;
  if (act === 'dash') Input.dashReq = true;
  if (act === 'fire') Input.fireReq = true;
}
function setKey(k, down) {
  if (KEYMAP[k]) Input[KEYMAP[k]] = down;
  if (JUMPK.includes(k)) { Input.jump = down; if (down) pressAction('jump'); }
  if (DASHK.includes(k) && down) pressAction('dash');
  if (FIREK.includes(k) && down) pressAction('fire');
}
window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
  if (charIntro > 0) { endPunchIn(); return; }
  if (dialogue) {
    if (e.key === 'Escape') { const cb = dialogue.onDone; dialogue = null; if (cb) cb(); }
    else advanceDialogue();
    return;
  }
  Sound.resume();
  if (e.repeat) { setKey(e.key, true); return; }
  if (e.key === 'Enter') onConfirm();
  else if (state === 'select' && ['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) {
    setAvatar(avatarIdx + (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' ? 1 : -1));
    SFX.click();
  }
  else if (state === 'select' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) { state = 'title'; SFX.click(); }
  else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  else if (e.key === 'm' || e.key === 'M') {
    const m = Sound.toggleMute();
    if (player && lvl) addPop(clamp(player.cx, camX + 60, camX + VIEW_W - 60), 120, m ? 'MUTED' : 'SOUND ON', '#cfe3ff');
  }
  else if ((e.key === 'r' || e.key === 'R') && (state === 'play' || state === 'pause' || paused)) retryLevel(true);
  else if ((e.key === 's' || e.key === 'S') && (state === 'win' || state === 'gameover')) doShare();
  setKey(e.key, true);
});
window.addEventListener('keyup', e => setKey(e.key, false));
window.addEventListener('blur', () => {
  Input.l = Input.r = Input.d = Input.jump = false;
  if (state === 'play') paused = true;
});
cv.addEventListener('pointerdown', e => {
  Sound.resume();
  if (charIntro > 0) { endPunchIn(); return; }
  if (dialogue) { advanceDialogue(); return; }
  if (state === 'select') { handleSelectTap(e); return; }
  onConfirm();
});

/* contextual DOM buttons: staff-picker arrows (title) · SHARE RUN (end screens).
   handlers only act in the right state; visibility is synced every frame. */
const uiBtns = {
  charL: document.getElementById('charL'),
  charR: document.getElementById('charR'),
  share: document.getElementById('sharebtn'),
};
if (uiBtns.charL) uiBtns.charL.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.resume();
  if (state === 'select') { setAvatar(avatarIdx - 1); SFX.click(); }
});
if (uiBtns.charR) uiBtns.charR.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.resume();
  if (state === 'select') { setAvatar(avatarIdx + 1); SFX.click(); }
});
if (uiBtns.share) uiBtns.share.addEventListener('pointerdown', e => {
  e.preventDefault(); Sound.resume();
  if (state === 'win' || state === 'gameover') doShare();
});
function syncUIButtons() {
  if (uiBtns.charL) uiBtns.charL.classList.toggle('show', state === 'select');
  if (uiBtns.charR) uiBtns.charR.classList.toggle('show', state === 'select');
  if (uiBtns.share) uiBtns.share.classList.toggle('show', state === 'win' || state === 'gameover');
  const tfire = document.getElementById('tfire');
  if (tfire) tfire.style.opacity = (player && player.hasStapler) ? '' : '0.35';   /* dimmed until grabbed */
  /* fullscreen toggle: visible on menus/screens, hidden during play/intro so it
     never covers the HUD (hearts/combo/score live in the top corners) */
  const fs = document.getElementById('fsbtn');
  if (fs) fs.classList.toggle('show', state !== 'play' && state !== 'intro');
  /* staff-select already has its own mid-screen ‹ › arrows — hide the bottom
     movement arrows there so the two never double up on mobile */
  const hideMove = state === 'select';
  for (const id of ['tleft', 'tright']) {
    const el = document.getElementById(id);
    if (el) el.style.display = hideMove ? 'none' : '';
  }
}

/* touch controls */
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  document.getElementById('touch').style.display = 'block';
  const bind = (id, down, up) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); Sound.resume(); down(); });
    el.addEventListener('pointerup', e => { e.preventDefault(); up(); });
    el.addEventListener('pointercancel', () => up());
    el.addEventListener('pointerleave', () => up());
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  bind('tleft', () => Input.l = true, () => Input.l = false);
  bind('tright', () => Input.r = true, () => Input.r = false);
  bind('tjump', () => { Input.jump = true; pressAction('jump'); }, () => Input.jump = false);
  bind('tdash', () => pressAction('dash'), () => {});
  bind('tdown', () => Input.d = true, () => Input.d = false);
  bind('tfire', () => pressAction('fire'), () => {});
}

/* ---------------- fullscreen ---------------- */
function inFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement);
}
function toggleFullscreen() {
  const d = document;
  if (inFullscreen()) {
    const exit = d.exitFullscreen || d.webkitExitFullscreen || d.mozCancelFullScreen || d.msExitFullscreen;
    if (exit) exit.call(d);
    return;
  }
  try {
    const el = d.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      const r = req.call(el);
      /* mobile browsers (iOS Safari) reject fullscreen — swallow it, never throws */
      if (r && r.catch) r.catch(() => {});
      else applyViewport();
    }
  } catch (e) {}
}
document.addEventListener('fullscreenchange', () => { syncFsBtn(); applyViewport(); });
document.addEventListener('webkitfullscreenchange', () => { syncFsBtn(); applyViewport(); });
document.addEventListener('mozfullscreenchange', () => { syncFsBtn(); applyViewport(); });
document.addEventListener('msfullscreenchange', () => { syncFsBtn(); applyViewport(); });
function syncFsBtn() {
  const on = inFullscreen();
  const btn = document.getElementById('fsbtn');
  if (btn) { btn.innerHTML = on ? '\u2922' : '\u26F6'; btn.title = on ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'; }
}
{
  const b = document.getElementById('fsbtn');
  if (b) b.addEventListener('pointerdown', e => { e.preventDefault(); Sound.resume(); toggleFullscreen(); });
}

/* ---------------- audio alias ---------------- */
const SFX = Sound.S;

/* ---------------- game state ---------------- */
let state = 'boot';           // title | select | intro | play | clear | gameover | win
let paused = false;
let curLevel = 0;
let lvl = null;
let player = null;
let boss = null;
let camX = 0, camShake = 0, shakeX = 0, shakeY = 0;
let freezeT = 0, fadeT = 0;
let banner = null;
let introT = 0, bossIntroT = 0, clearT = 0;
let charIntro = 0, dayBannerStash = null;

/* ---------------- story mode: cinematic dialogue scenes ----------------
   bottom panel · speaker tag + portrait · typewriter text · any key advances.
   world freezes while a scene plays; onDone resumes whatever queued it. */
const CAST = {
  you:     { name: () => empName(), tint: '#ffd54f', opts: () => avatarOpts() },
  manager: { name: 'MANAGEMENT', tint: '#ff8a80', opts: () => ({ shirt: PAL.suit || '#37474f', pants: '#263238', tie: '#c62828', hair: '#787878', angry: true }) },
  ceo:     { name: 'THE CEO', tint: '#ff5252', opts: () => ({ shirt: '#2f3240', pants: '#23232f', tie: '#ffb300', hair: '#3a3a44', skin: '#f2c19a', bigHead: true, angry: true }) },
};
const SCRIPTS = {
  opening: [
    { who: 'manager', text: '{name}. The Halewyn account. Client calls in ten minutes. Where is it?' },
    { who: 'you', text: '...' },
    { who: 'manager', text: "That's what I thought. Overtime. Tonight." },
    { who: 'you', text: 'Actually... I quit.' },
    { who: 'manager', text: 'Ha! Good one. See you at standup.' },
    { who: 'you', text: '(Not this time. My exit interview starts NOW.)' },
  ],
  bossIntro: [
    { who: 'ceo', text: 'Sit down, {name}.' },
    { who: 'ceo', text: 'You cannot resign. I have decided this in a meeting.' },
    { who: 'you', text: 'The exit door is right behind you.' },
    { who: 'ceo', text: 'Then come and USE it, champ.' },
  ],
  victory: [
    { who: 'ceo', text: 'Fine... FINE. Your badge works on the way out.' },
    { who: 'you', text: "(It always did. I just needed you to say it.)" },
    { who: 'ceo', text: 'And leave the stapler.' },
    { who: 'you', text: '(No.)' },
  ],
};
let dialogue = null;   // { lines, i, chars, doneT, onDone }
function endPunchIn() {
  if (!charIntro) return;
  charIntro = 0;
  /* punch-in card done -> opening confrontation, THEN the day banner */
  playDialogue(SCRIPTS.opening, () => {
    banner = dayBannerStash; dayBannerStash = null;
    introT = Math.min(introT, 0.9);
  });
}
function playDialogue(lines, onDone) {
  dialogue = {
    lines: lines.map(l => ({ ...l, text: l.text.replace('{name}', empName()) })),
    i: 0, chars: 0, holdT: 0, onDone: onDone || null,
  };
}
function advanceDialogue() {
  if (!dialogue) return;
  const line = dialogue.lines[dialogue.i];
  if (dialogue.chars < line.text.length) dialogue.chars = line.text.length;   // finish typing first
  else {
    dialogue.i++;
    dialogue.chars = 0; dialogue.holdT = 0;
    if (dialogue.i >= dialogue.lines.length) {
      const cb = dialogue.onDone; dialogue = null;
      if (cb) cb();
    }
  }
}
function updateDialogue(dt) {
  if (!dialogue) return;
  const line = dialogue.lines[dialogue.i];
  if (dialogue.chars < line.text.length) dialogue.chars = Math.min(line.text.length, dialogue.chars + dt * 55);
  else {
    dialogue.holdT += dt;
    if (dialogue.holdT > 2.4) advanceDialogue();   // auto-advance: never stuck
  }
}
function wrapDialogue(text, maxW) {
  const g = cv.getContext('2d');
  g.font = '13px "Press Start 2P", monospace';
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawDialogue(g) {
  if (!dialogue) return;
  const d = dialogue, line = d.lines[d.i];
  const cast = CAST[line.who] || CAST.you;
  const BAR_T = 92, BAR_B = 116;
  const nm = typeof cast.name === 'function' ? cast.name() : cast.name;
  g.save();
  /* ── cinematic letterbox: world plays out on the stage between bars ── */
  g.fillStyle = '#05070c';
  g.fillRect(0, 0, VIEW_W, BAR_T);
  g.fillRect(0, VIEW_H - BAR_B, VIEW_W, BAR_B);
  g.fillStyle = cast.tint;
  g.fillRect(0, BAR_T - 3, VIEW_W, 3);
  g.fillRect(0, VIEW_H - BAR_B, VIEW_W, 3);

  /* ── top bar: portrait + speaker tag ── */
  g.save();
  g.translate(66, BAR_T - 6);
  g.scale(1.55, 1.55);
  drawEmployee(g, 0, 0, 1, perf * 7, Object.assign({ idleTap: true }, cast.opts()));
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.beginPath(); g.ellipse(66, BAR_T - 4, 38, 7, 0, 0, TAU); g.fill();
  const nw = nm.length * 12 + 26;
  g.fillStyle = '#0b0f18';
  g.beginPath(); g.roundRect(112, BAR_T - 58, nw, 30, 6); g.fill();
  g.strokeStyle = cast.tint; g.lineWidth = 2;
  g.beginPath(); g.roundRect(112, BAR_T - 58, nw, 30, 6); g.stroke();
  text(g, nm, 112 + nw / 2, BAR_T - 43, 11, cast.tint);
  text(g, line.who === 'you' ? '(that\u2019s you)' : '', 112 + nw + 16, BAR_T - 43, 8, 'rgba(207,227,255,0.4)', 'left', false);

  /* ── bottom bar: typewriter body ── */
  const shown = line.text.slice(0, Math.floor(d.chars));
  const tx = 80, maxW = VIEW_W - tx * 2;
  const wrapped = wrapDialogue(shown, maxW);
  const baseY = VIEW_H - BAR_B + 40;
  wrapped.forEach((ln, li) => {
    text(g, ln, tx, baseY + li * 26, 13, 'rgba(235,242,250,0.95)', 'left', false);
  });
  /* typing cursor: partial sentences read as intentional */
  const typing = d.chars < line.text.length;
  if (typing && Math.sin(perf * 14) > -0.3) {
    const lastLn = wrapped[wrapped.length - 1] || '';
    g.font = '13px "Press Start 2P", monospace';
    const cx2 = tx + g.measureText(lastLn).width + 6;
    const cy2 = baseY + (wrapped.length - 1) * 26;
    g.fillStyle = cast.tint;
    g.fillRect(cx2, cy2 - 9, 10, 14);
  } else if (!typing && Math.sin(perf * 6) > -0.2) {
    text(g, '\u25BC', VIEW_W - 56, VIEW_H - 26, 12, cast.tint);
  }
  text(g, 'ANY KEY \u00B7 ESC SKIP', VIEW_W - tx, VIEW_H - 12, 7, 'rgba(207,227,255,0.35)', 'right', false);
  g.restore();
}
let titlePan = 0, perf = 0;
let totals = null;
let levelStartScore = 0;
let bestScore = 0;
let bestName = '';
let pickDeathMsg = '';
try { bestScore = parseInt(localStorage.getItem('tdg_best') || '0', 10) || 0; } catch (e) {}
try { bestName = localStorage.getItem('tdg_best_name') || ''; } catch (e) {}

/* ---- your workwife: a persistent employee identity (the "Rishabh on the leaderboard" factor) ---- */
const EMP_FIRST = ['ARJUN', 'PRIYA', 'SAMIR', 'MEERA', 'ROHIT', 'ANEESH', 'DIVYA', 'KARTIK', 'NEHA', 'VIKRAM', 'TANYA', 'OMER'];
const EMP_DEPT = ['FROM ACCOUNTING', 'FROM QA', 'FROM SALES', '\u00B7 BACKLOG BARISTA', '\u00B7 MEETING SURVIVOR', '\u00B7 Q4 CASUALTY', 'FROM HR (SORRY)', '\u00B7 STANDUP COMEDIAN', 'FROM IT \u00B7 TRIED TURNING IT OFF AND ON', '\u00B7 AGILE VICTIM', 'FROM LEGAL', '\u00B7 COFFEE-BASED LIFEFORM'];
let employee = null;
try { employee = JSON.parse(localStorage.getItem('tdg_employee') || 'null'); } catch (e) {}
if (!employee || !employee.n) {
  employee = { n: pick(EMP_FIRST), d: pick(EMP_DEPT) };
  try { localStorage.setItem('tdg_employee', JSON.stringify(employee)); } catch (e) {}
}

/* ---- challenge links: #c=<score>~<name> — “beat my score” travels inside the share itself ---- */
let challenge = null;
try {
  const cm = (location.hash || '').match(/c=(\d+)~([^&]+)/);
  if (cm) challenge = { score: parseInt(cm[1], 10) || 0, name: decodeURIComponent(cm[2]).slice(0, 18), beaten: false };
} catch (e) {}
function challengeURL() {
  return location.origin + location.pathname + '#c=' + totals.score + '~' + encodeURIComponent(empName());
}

/* ---- staff selection: pick who you quit as (persisted) ---- */
const BASE_KIT = { maxHearts: 3, airJumps: 1, moveMul: 1, fireCdMul: 1, twinStaple: false,
                   dashCdMul: 1, comboTMul: 1, aggroMul: 1, saveOnce: false,
                   climbMul: 1, beltImmune: false, springMul: 1, droneFriendly: false,
                   gateSkip: false, stapleJam: false };
const AVATARS = [
  { id: 'intern', name: 'THE INTERN \u00B7 DAY ONE', blurb: '4 HEARTS \u00B7 SLIPS PAST GATES \u00B7 FAST CLIMB', tint: '#ffffff',
    card: { perk: '+4 MORALE', world: 'FAST CLIMB · SLIPS GATES', ouch: 'NOTHING. HE SUFFERS.' },
    opts: {}, kit: { maxHearts: 4, aggroMul: 220 / 310, climbMul: 1.35, gateSkip: true } },
  { id: 'priya', name: 'PRIYA \u00B7 QA, SHIPS SHAMELESSLY', fname: 'PRIYA', fdept: 'FROM QA', blurb: 'TWIN-STAPLES \u00B7 BELT-PROOF \u00B7 JAMS SHREDDERS', tint: '#ce93d8',
    card: { perk: 'TWIN-STAPLE BURST', world: 'BELT-PROOF · JAMS SHREDS', ouch: 'SLOWER FIRE CYCLE' },
    opts: { hair: '#2b1a12', hairLong: true, shirt: '#8d5a9e', pants: '#37474f', skin: '#eab98a', tie: 'none', lanyard: '#c2185b' },
    kit: { twinStaple: true, fireCdMul: 1.25, beltImmune: true, stapleJam: true } },
  { id: 'chad', name: 'CHAD \u00B7 SALES, 10X ENERGY', fname: 'CHAD', fdept: 'FROM SALES', blurb: 'TRIPLE JUMP \u00B7 BIG SPRINGS \u00B7 2 HEARTS MAX', tint: '#90caf9',
    card: { perk: 'TRIPLE JUMP · FAST DASH', world: 'BIG SPRING LAUNCHES', ouch: '2 HEARTS MAX' },
    opts: { hair: '#c99a54', shirt: '#90caf9', pants: '#263238', tie: '#ffb300', skin: '#ffd9b3', shades: true },
    kit: { airJumps: 2, dashCdMul: 0.7, maxHearts: 2, springMul: 1.22 } },
  { id: 'meera', name: 'MEERA \u00B7 HR, SMILING DANGER', fname: 'MEERA', fdept: 'FROM HR (SORRY)', blurb: 'CHEATS DEATH \u00B7 DRONE IMMUNITY \u00B7 SLOW', tint: '#80cbc4',
    card: { perk: 'CHEATS DEATH ONCE', world: 'HR DRONES IGNORE HER', ouch: '-8% MOVE SPEED' },
    opts: { hair: '#1a1a1a', bun: true, skirt: true, shirt: '#26a69a', pants: '#455a64', skin: '#c98d5a', glasses: true, tie: 'none' },
    kit: { saveOnce: true, comboTMul: 1.32, moveMul: 0.92, droneFriendly: true } },
];
for (const a of AVATARS) a.kit = Object.assign({}, BASE_KIT, a.kit);
const KIT = () => AVATARS[avatarIdx].kit;
/* identity follows the SELECTED staff member (intern keeps a random name —
   the other three are who they are). fixes "why does it say Meera?" */
function empName() {
  const a = AVATARS[avatarIdx];
  return a.fname || employee.n;
}
function empDept() {
  const a = AVATARS[avatarIdx];
  return a.fdept || employee.d;
}
let avatarIdx = 0;
try { avatarIdx = Math.min(AVATARS.length - 1, Math.max(0, parseInt(localStorage.getItem('tdg_avatar') || '0', 10) || 0)); } catch (e) {}
function setAvatar(i) {
  avatarIdx = ((i % AVATARS.length) + AVATARS.length) % AVATARS.length;
  try { localStorage.setItem('tdg_avatar', String(avatarIdx)); } catch (e) {}
}
function avatarOpts() { return AVATARS[avatarIdx].opts; }

const parts = [];
const pops = [];
const ghosts = [];

function resetTotals() {
  totals = { score: 0, coffees: 0, files: 0, stomps: 0, deaths: 0, time: 0, maxCombo: 0 };
}

/* ---------------- level construction ---------------- */
const CODE = { '#': 1, '=': 2, 'C': 3, 'x': 4, 'P': 5, 'c': 6, '-': 7, '^': 8, '>': 9, '<': 10, 'G': 12, 'H': 13 };
const SOLIDC = c => (c >= 1 && c <= 6) || c === 9 || c === 10 || c === 12;

function makePickup(kind, tx, ty) {
  return { kind, x: tx * T + (T - 30) / 2, y: ty * T + (T - 32) / 2, w: 30, h: 32, taken: false, ph: rand(TAU) };
}
function makeDoor(cx, footY) {
  return { x: cx - 36, y: footY - 100, w: 72, h: 100, locked: !!LEVELS[curLevel].boss, opened: false };
}
function makeManager(cx, footY) {
  return {
    kind: 'manager', x: cx - 17, y: footY - 46, w: 34, h: 46,
    vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, face: 1,
    grounded: false, chase: false, chaseT: 0, squashed: 0,
    ph: rand(TAU), dead: false, prevY: 0,
    get cx() { return this.x + this.w / 2; },
  };
}
function makePlat(cx, cy, axis) {
  const w = 96, h = 14;
  return { axis, ox: cx - w / 2, oy: cy - h / 2, x: cx - w / 2, y: cy - h / 2, w, h, t: rand(TAU), amp: 2.5 * T, om: 1.5, dx: 0, dy: 0 };
}
function makeSpring(cx, footY) {
  return { x: cx - 20, y: footY - 26, w: 40, h: 26, t: 0 };
}
function makeIntern(cx, footY) {
  return {
    kind: 'intern', x: cx - 13, y: footY - 36, w: 26, h: 36,
    vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, face: 1,
    grounded: false, hopT: rand(0.4, 1.1), squashed: 0, fleeing: false,
    ph: rand(TAU), dead: false, prevY: 0,
    get cx() { return this.x + this.w / 2; },
  };
}
function makeDrone(cx, cy) {
  return {
    kind: 'drone', x: cx - 17, y: cy - 14, w: 34, h: 28,
    ox: cx, oy: cy, t: rand(TAU), dir: Math.random() < 0.5 ? -1 : 1,
    ph: rand(TAU), dead: false, prevY: 0,
    get cx() { return this.x + this.w / 2; },
  };
}
function makePlayer(cx, footY) {
  return {
    x: cx - 15, y: footY - 44, w: 30, h: 44,
    vx: 0, vy: 0, face: 1, grounded: false, onOneway: false,
    coyote: 0, airJumps: KIT().airJumps, dropT: 0,
    dashT: 0, dashCd: 0, dashDir: 1,
    hearts: KIT().maxHearts, invuln: 0, boost: 0,
    hasStapler: runHasStapler, staplerHintT: 0,
    hrSaved: false,
    sqX: 1, sqY: 1, ph: 0, idleT: 0, runDustT: 0, blinkT: rand(2, 4),
    ride: null, prevY: 0, respawnLock: 0, prevVyLand: 0,
    climbing: false, climbLock: 0, fireCd: 0,
    get cx() { return this.x + this.w / 2; },
  };
}
function makeBoss(cx, footY) {
  return {
    x: cx - 58, y: footY - 150, w: 116, h: 150,
    vx: 0, vy: 0, face: -1, grounded: false, prevY: 0,
    st: 'idle', t: 0.9, hp: 3, rage: 0, invuln: 0, dying: 0, dead: false,
    lastMove: 'throw', throwLeft: 0, throwT: 0, jitter: false, rot: 0,
    staplers: [], waves: [], ph: rand(TAU), tauntT: 2.2, taunt: null,
    get cx() { return this.x + this.w / 2; },
  };
}

function loadLevel(i, opts = {}) {
  curLevel = i;
  const def = LEVELS[i];
  const built = buildGrid(def);
  lvl = {
    def, w: def.w, h: def.h, pxW: def.w * T, pxH: def.h * T,
    grid: built.grid, spawns: built.spawns,
    enemies: [], planes: [], pickups: [], plats: [],
    springs: [], interns: [], drones: [], staples: [],
    gates: [], hasKey: false, gateAnim: 0, jams: {}, planeWarns: [],
    checkpoints: [], door: null, bossDef: null,
    planeT: rand(1, 2), coworkers: [], bubbleT: rand(3, 6), bubbling: null,
    spawn: null,
  };
  levelStartScore = totals ? totals.score : 0;
  paused = false;

  for (let y = 0; y < lvl.h; y++) {
    for (let x = 0; x < lvl.w; x++) {
      const ch = lvl.grid[y][x];
      if (ch === 'o') { lvl.pickups.push(makePickup('coffee', x, y)); lvl.grid[y][x] = 0; }
      else if (ch === 'W') { lvl.pickups.push(makePickup('stapler', x, y)); lvl.grid[y][x] = 0; }
      else if (ch === 'F') { lvl.pickups.push(makePickup('file', x, y)); lvl.grid[y][x] = 0; }
      else if (ch === 'D') { lvl.pickups.push(makePickup('donut', x, y)); lvl.grid[y][x] = 0; }
      else if (ch === 'K') { lvl.pickups.push(makePickup('key', x, y)); lvl.grid[y][x] = 0; }
      else if (ch === 'G') { lvl.gates.push({ tx: x, ty: y }); lvl.grid[y][x] = 12; }
      else { const code = CODE[ch]; lvl.grid[y][x] = code === undefined ? 0 : code; }
    }
  }
  /* cache shredder tiles: proximity warnings + jam lookups */
  lvl.shreds = [];
  for (let y = 0; y < lvl.h; y++)
    for (let x = 0; x < lvl.w; x++)
      if (lvl.grid[y][x] === 8) lvl.shreds.push({ tx: x, ty: y });
  for (const s of lvl.spawns) {
    const cx = s.x * T + T / 2, footY = (s.y + 1) * T;
    if (s.ch === 'S') lvl.spawn = { x: cx, y: footY };
    else if (s.ch === 'E') lvl.door = makeDoor(cx, footY);
    else if (s.ch === 'k') lvl.checkpoints.push({ x: cx, y: footY, active: false, t: 0 });
    else if (s.ch === 'm') lvl.enemies.push(makeManager(cx, footY));
    else if (s.ch === '~') lvl.plats.push(makePlat(cx, footY - T / 2, 'h'));
    else if (s.ch === '!') lvl.plats.push(makePlat(cx, footY - T / 2, 'v'));
    else if (s.ch === 'J') lvl.springs.push(makeSpring(cx, footY));
    else if (s.ch === 'i') lvl.interns.push(makeIntern(cx, footY));
    else if (s.ch === 'h') lvl.drones.push(makeDrone(cx, s.y * T + T / 2));
    else if (s.ch === 'B') { lvl.bossDef = { x: cx, y: footY }; }
  }
  if (!lvl.spawn) lvl.spawn = { x: 3.5 * T, y: 13 * T };

  /* decorative coworkers behind desks */
  for (let y = 1; y < lvl.h - 1; y++) {
    for (let x = 1; x < lvl.w - 1; x++) {
      if (lvl.grid[y][x] === 2 && lvl.grid[y - 1][x] === 0 && Math.random() < 0.34) {
        lvl.coworkers.push({
          x: x * T + T / 2, y: y * T, ph: rand(TAU),
          skin: pick(['#ffd9b3', '#eab98a', '#c98d5a', '#8d5a3a']),
          shirt: pick(['#dfe7ee', '#cfd8e3', '#e8d8c8', '#c9d7c4']),
          bubble: null,
        });
      }
    }
  }

  player = makePlayer(lvl.spawn.x, lvl.spawn.y);
  boss = lvl.bossDef ? makeBoss(lvl.bossDef.x, lvl.bossDef.y) : null;
  parts.length = 0; pops.length = 0; ghosts.length = 0;
  currentLvlPxW = lvl.pxW;
  camX = player.cx - VIEW_W / 2;
  clampCam();
  bakeLevel();
  applyViewport();          /* refresh vignette to the new viewport */
  clampCam();
  fadeT = 0.45;

  if (!opts.ambient) {
    Sound.playSong(def.track);
    introT = def.boss ? 2.6 : 2.0;
    bossIntroT = def.boss ? 2.6 : 0;
    /* boss floors: the CEO card IS the intro — a banner here would stack on it */
    banner = def.boss ? null : {
      main: 'DAY ' + (i + 1) + ' · ' + WD[new Date().getDay()],
      sub: def.name, sub2: def.quip, t: 0, dur: introT,
    };
    state = 'intro';
  }
  if (!opts.ambient && def.boss && !bossIntroPlayed) {
    bossIntroPlayed = true;
    playDialogue(SCRIPTS.bossIntro, () => { introT = Math.max(introT, 1.4); });
  }
}

/* ---------------- tile queries & physics ---------------- */
function getTile(tx, ty) {
  if (!lvl) return 0;
  if (!(tx >= 0) || !(tx < lvl.w)) return 1;      /* NaN-safe OOB walls */
  if (!(ty >= 0) || !(ty < lvl.h)) return 0;
  const row = lvl.grid[ty];
  return row ? (row[tx] ?? 0) : 0;
}
function colScan(tx, y, h, passGate) {
  const t0 = Math.floor(y / T), t1 = Math.floor((y + h - 1) / T);
  for (let ty = t0; ty <= t1; ty++) {
    const c = getTile(tx, ty);
    if (SOLIDC(c) && !(passGate && c === 12)) return true;
  }
  return false;
}
function rowScan(ty, x, w, passGate) {
  const t0 = Math.floor(x / T), t1 = Math.floor((x + w - 1) / T);
  for (let tx = t0; tx <= t1; tx++) {
    const c = getTile(tx, ty);
    if (SOLIDC(c) && !(passGate && c === 12)) return true;
  }
  return false;
}
function onewayScan(ty, x, w) {
  const t0 = Math.floor(x / T), t1 = Math.floor((x + w - 1) / T);
  for (let tx = t0; tx <= t1; tx++) if (getTile(tx, ty) === 7) return true;
  return false;
}
/* is the entity overlapping any ladder tile? (inset so brushing an edge doesn't grab) */
function ladderOverlap(e) {
  const x0 = Math.floor((e.x + 7) / T), x1 = Math.floor((e.x + e.w - 7) / T);
  const y0 = Math.floor((e.y + 6) / T), y1 = Math.floor((e.y + e.h - 3) / T);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (getTile(tx, ty) === 13) return true;
  return false;
}
function resolveTiles(e, dt, opts = {}) {
  e.wallL = e.wallR = e.hitCeil = false;
  const wasGrounded = e.grounded;
  e.grounded = false;
  const pg = opts.passGates;
  /* X axis */
  e.x += e.vx * dt;
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w - 0.01) / T);
    if (colScan(tx, e.y, e.h, pg)) { e.x = tx * T - e.w - 0.01; e.wallR = true; if (!opts.keepVX) e.vx = 0; }
  } else if (e.vx < 0) {
    const tx = Math.floor(e.x / T);
    if (colScan(tx, e.y, e.h, pg)) { e.x = (tx + 1) * T + 0.01; e.wallL = true; if (!opts.keepVX) e.vx = 0; }
  }
  if (e.x < 2) { e.x = 2; if (e.vx < 0) e.vx = 0; e.wallL = true; }
  if (e.x + e.w > lvl.pxW - 2) { e.x = lvl.pxW - 2 - e.w; if (e.vx > 0) e.vx = 0; e.wallR = true; }
  /* Y axis */
  const prevBot = (e.prevY !== undefined ? e.prevY : e.y - e.vy * dt) + e.h;
  e.y += e.vy * dt;
  e.onOneway = false;
  if (e.vy >= 0) {
    const ty = Math.floor((e.y + e.h - 0.01) / T);
    const landedSolid = rowScan(ty, e.x, e.w, pg);
    const landedOne = (!e.dropT || e.dropT <= 0) && e.vy > 0 && prevBot <= ty * T + 8 && onewayScan(ty, e.x, e.w);
    if (landedSolid || landedOne) {
      e.y = ty * T - e.h - 0.01;
      e.vy = 0;
      e.grounded = true;
      e.onOneway = landedOne && !landedSolid;
    }
  } else {
    const ty = Math.floor(e.y / T);
    if (rowScan(ty, e.x, e.w, pg)) { e.y = (ty + 1) * T + 0.01; e.vy = 0; e.hitCeil = true; }
  }
  if (e.y < -T * 1.5) { e.y = -T * 1.5; if (e.vy < 0) e.vy = 0; }
  return wasGrounded;
}

/* belt direction under an entity's feet: 1 right, -1 left, 0 none */
function beltAt(e) {
  const ty = Math.floor((e.y + e.h + 3) / T);
  const x0 = Math.floor((e.x + 4) / T), x1 = Math.floor((e.x + e.w - 4) / T);
  let d = 0;
  for (let tx = x0; tx <= x1; tx++) {
    const c = getTile(tx, ty);
    if (c === 9) d = 1; else if (c === 10) d = -1;
  }
  return d;
}
/* collision-safe sideways nudge (belts pushing enemies) */
function nudgeX(e, dx) {
  if (!dx) return;
  const nx = e.x + dx;
  const tx = dx > 0 ? Math.floor((nx + e.w) / T) : Math.floor(nx / T);
  if (!colScan(tx, e.y, e.h)) e.x = nx;
}

/* ============================================================
   part 2: fx, combat, entity updates, boss AI, game flow
   ============================================================ */

/* ---------------- fx ---------------- */
function shake(n) { camShake = Math.min(1, camShake + n); }
function addPart(o) {
  if (parts.length < 460) parts.push(Object.assign({ t: 0, life: 0.5, vx: 0, vy: 0, g: 0, size: 4, rot: 0, vr: 0, shape: 'rect', color: '#fff', screen: false }, o));
}
function dust(x, y, n = 6, spread = 90) {
  for (let i = 0; i < n; i++) addPart({
    x: x + rand(-8, 8), y, vx: rand(-spread, spread), vy: rand(-120, -20),
    g: 300, life: rand(0.25, 0.5), size: rand(3, 7), color: 'rgba(180,170,160,0.8)', shape: 'circle',
  });
}
function sparkle(x, y, color = '#ffe082', n = 8) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), sp = rand(60, 220);
    addPart({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, life: rand(0.3, 0.6), size: rand(2, 5), color, shape: 'star' });
  }
}
function confetti(x, y, n = 60, screen = false) {
  const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#ff4081', '#b388ff'];
  for (let i = 0; i < n; i++) addPart({
    x: x + rand(-40, 40), y: y + rand(-20, 20), vx: rand(-260, 260), vy: rand(-460, -80),
    g: 700, life: rand(0.9, 1.7), size: rand(4, 8), rot: rand(TAU), vr: rand(-9, 9),
    color: pick(cols), shape: 'confetti', screen,
  });
}
function paperBurst(x, y) {
  for (let i = 0; i < 14; i++) addPart({
    x: x + rand(-10, 10), y: y + rand(-14, 14),
    vx: rand(-260, 260), vy: rand(-380, -60),
    g: 520, life: rand(0.5, 0.95), size: rand(3, 7),
    color: pick(['#fafafa', '#eceff1', '#ff8a80', '#b0bec5']),
    shape: 'rect', rot: rand(TAU), vr: rand(-11, 11),
  });
}
function titlePaper() {
  if (!lvl) return;
  addPart({
    x: rand(VIEW_W), y: -20, vx: rand(-30, 30), vy: rand(40, 90),
    life: rand(4, 7), size: rand(5, 9), color: 'rgba(255,255,255,0.45)',
    shape: 'paper', rot: rand(TAU), vr: rand(-2, 2), screen: true,
  });
}
function popWidth(text, size) {
  const g = cv.getContext('2d');
  g.font = `${size}px "Press Start 2P", monospace`;
  return g.measureText(text).width;
}
function addPop(x, y, text, color = '#fff', size = 15) {
  window.__lastPop = text;
  /* identical message near the same spot: refresh it instead of stacking */
  for (const q of pops) {
    if (q.text === text && Math.abs(q.x - x) < 70 && Math.abs(q.y - y) < 46) {
      q.t = 0; q.x = x; q.y = y;
      return;
    }
  }
  /* stack upward out of occupied space so messages never overlap */
  const w = popWidth(text, size);
  let fy = y, guard = 0;
  while (guard++ < 12) {
    const clash = pops.some(q => {
      const qw = popWidth(q.text, q.size), gapH = Math.max(size, q.size) + 8;
      return Math.abs(fy - q.y) < gapH &&
             x + w / 2 + 10 > q.x - qw / 2 && x - w / 2 - 10 < q.x + qw / 2;
    });
    if (!clash) break;
    fy -= Math.max(size, 12) + 9;
  }
  pops.push({ x, y: fy, text, color, size, t: 0, life: 1.4 });
  if (pops.length > 26) pops.splice(0, pops.length - 26);   // hard cap for perf
}
function steam(x, y) {
  addPart({ x: x + rand(-4, 4), y, vx: rand(-8, 8), vy: rand(-46, -26), g: -30, life: rand(0.5, 0.9), size: rand(3, 6), color: 'rgba(255,255,255,0.5)', shape: 'circle' });
}

/* ---------------- combat / damage ---------------- */
function rectHit(a, b, pad = 0) {
  return a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;
}
function playerVulnerable() {
  return state === 'play' && player.invuln <= 0 && player.respawnLock <= 0;
}
/* death messages: single string or a bag of variations */
function deathMsg(cause) {
  const m = DEATH_MSGS[cause];
  return Array.isArray(m) ? pick(m) : m;
}
/* geiger-style proximity warning for active shredders */
function updateShredWarn(dt) {
  if (!lvl || !lvl.shreds || state !== 'play') return;
  const px = player.cx, py = player.y + player.h / 2;
  let best = Infinity;
  for (const s of lvl.shreds) {
    if (lvl.jams[s.tx + '_' + s.ty] > 0) continue;   // jammed = silent & safe
    const dx = px - (s.tx * T + T / 2), dy = py - (s.ty * T + T / 2);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  if (best < 175) {
    const k = 1 - best / 175;                        // 0 far → 1 close
    shredTickT -= dt;
    if (shredTickT <= 0) { SFX.tick(k); shredTickT = 0.4 - 0.28 * k; }
  } else shredTickT = 0;
}

function hurtPlayer(cause, srcX) {
  const p = player;
  if (p.invuln > 0 || p.respawnLock > 0 || state !== 'play') return;
  p.climbing = false; p.climbLock = 0;
  p.hearts--;
  SFX.hurt();
  shake(0.5);
  freezeT = 0.05;
  addPop(p.cx, p.y - 14, deathMsg(cause) || 'Ouch.', '#ff8a80', 13);
  /* MEERA · HR: "you can't fire HR" — survives her first lethal hit */
  if (p.hearts <= 0 && !(KIT().saveOnce && !p.hrSaved)) { gameOver(cause); return; }
  const grievance = p.hearts <= 0;
  if (grievance) {
    p.hrSaved = true;
    p.hearts = 1;
    addPop(p.cx, p.y - 44, 'GRIEVANCE FILED', '#80cbc4', 15);
    sparkle(p.cx, p.y, '#80cbc4', 14);
    SFX.checkpoint();
  }
  p.invuln = grievance ? 2.0 : 1.7;
  if (cause === 'pit' || cause === 'shred') respawn();
  else {
    p.vy = -430;
    p.vx = (p.cx < (srcX === undefined ? p.cx - 1 : srcX) ? -1 : 1) * 320;
  }
}
function respawn() {
  const p = player;
  fadeT = 0.5;
  p.x = lvl.spawn.x - p.w / 2;
  p.y = lvl.spawn.y - p.h - 2;
  p.vx = 0; p.vy = 0; p.invuln = 1.4; p.ride = null; p.dashT = 0;
  p.climbing = false; p.climbLock = 0;
  p.prevY = p.y;
  /* snap camera so the player is always on screen after respawn */
  camX = p.cx - VIEW_W / 2;
  clampCam();
}
function gameOver(cause) {
  pickDeathMsg = deathMsg(cause) || 'You have been let go.';
  totals.deaths++;
  state = 'gameover';
  Sound.stopSong();
  SFX.death();
  setTimeout(() => SFX.stamp(), 420);
  saveBest();
}
function saveBest() {
  try {
    if (totals.score > bestScore) { bestScore = totals.score; localStorage.setItem('tdg_best', String(bestScore)); localStorage.setItem('tdg_best_name', empName()); bestName = empName(); }
  } catch (e) {}
}
function registerStomp(x, y, verb, color) {
  comboN++; comboT = COMBO_T * KIT().comboTMul; comboPopT = 0.8;
  if (comboN > totals.maxCombo) totals.maxCombo = comboN;
  const mult = Math.min(comboN, 5);
  const pts = 100 * mult;
  totals.score += pts; totals.stomps++;
  const word = comboN >= 2 ? COMBO_WORDS[Math.min(comboN - 2, COMBO_WORDS.length - 1)] : verb;
  addPop(x, y - 8, '+' + pts + ' ' + word, color);
  if (comboN >= 2) SFX.combo(comboN);
}
function stompEnemy(m) {
  m.squashed = 0.001;
  registerStomp(m.cx, m.y - 8, 'SYNERGIZED!', '#b9f6ca');
  SFX.stomp();
  bouncePlayer();
  freezeT = 0.05; shake(0.25);
  dust(m.cx, m.y + m.h, 8, 130);
}
function bouncePlayer() {
  player.vy = Input.jump ? -640 : -560;
  player.airJumps = KIT().airJumps;
  player.prevY = player.y;
}
function collect(pk) {
  pk.taken = true;
  if (pk.kind === 'coffee') {
    totals.score += 50; totals.coffees++;
    player.boost = BOOST_T;
    addPop(pk.x + 15, pk.y - 8, '+50 CAFFEINATED!', '#ffe082');
    SFX.coin();
    sparkle(pk.x + 15, pk.y + 16, '#ffe082', 7);
  } else if (pk.kind === 'donut') {
    if (player.hearts < KIT().maxHearts) {
      player.hearts++;
      addPop(pk.x + 15, pk.y - 8, 'MORALE +1 (INSTEAD OF A RAISE)', '#f48fb1');
    } else {
      totals.score += 150;
      addPop(pk.x + 15, pk.y - 8, '+150 DONUT BREAK!', '#f48fb1');
    }
    SFX.donut();
    sparkle(pk.x + 15, pk.y + 16, '#f48fb1', 9);
  } else if (pk.kind === 'stapler') {
    player.hasStapler = true; runHasStapler = true;
    totals.score += 100;
    addPop(pk.x + 15, pk.y - 12, 'STAPLER GET!', '#ff8a80', 15);
    addPop(pk.x + 15, pk.y + 14, 'F OR \uD83D\uDCCE TO FIRE', '#cfe3ff', 9);
    SFX.key();
    sparkle(pk.x + 15, pk.y + 16, '#ff8a80', 12);
  } else if (pk.kind === 'key') {
    lvl.hasKey = true;
    addPop(pk.x + 15, pk.y - 10, 'BADGE GET!', '#82b1ff', 15);
    SFX.key();
    sparkle(pk.x + 15, pk.y + 16, '#82b1ff', 12);
    openGates();
  } else if (pk.kind === 'pager') {
    lvl.pagerOn = true; lvl.pagerT = 18; lvl.pagerPing = 1.2;
    addPop(pk.x + 15, pk.y - 10, 'ON-CALL PAGER [RING RING]', '#ef9a9a', 13);
    SFX.pager();
  } else {
    totals.score += 250; totals.files++;
    addPop(pk.x + 15, pk.y - 8, '+250 STORY POINTS!', '#ffe57f');
    SFX.file();
    sparkle(pk.x + 15, pk.y + 16, '#fff59d', 10);
  }
}
function openGates() {
  if (!lvl || !lvl.gates.length || lvl.gateAnim !== 0) return;
  lvl.gateAnim = 0.001;
  SFX.gate();
  shake(0.25);
  for (const gt of lvl.gates) {
    sparkle(gt.tx * T + T / 2, gt.ty * T + T / 2, '#82b1ff', 14);
    confetti(gt.tx * T + T / 2, gt.ty * T + 8, 16);
  }
  for (const gt of lvl.gates) lvl.grid[gt.ty][gt.tx] = 0;
}

/* ---------------- player update ---------------- */
function updatePlayer(dt) {
  const p = player;
  p.prevY = p.y;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.boost > 0) p.boost -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.dropT > 0) p.dropT -= dt;
  if (p.respawnLock > 0) p.respawnLock -= dt;
  if (p.climbLock > 0) p.climbLock -= dt;
  if (Input.buf > 0) Input.buf -= dt;

  const controlOK = state === 'play';
  const dir = (controlOK && Input.r ? 1 : 0) - (controlOK && Input.l ? 1 : 0);

  /* ride moving platform */
  if (p.ride && !p.climbing) {
    p.x += p.ride.dx; p.y += p.ride.dy;
    if (p.x + p.w < p.ride.x - 4 || p.x > p.ride.x + p.ride.w + 4 || p.vy < -60) p.ride = null;
  }

  /* ladders: hold UP to grab & climb, DOWN to slide down / drop from a ledge */
  const onLad = controlOK && p.dashT <= 0 && p.respawnLock <= 0 ? ladderOverlap(p) : false;
  if (p.climbing) {
    if (!onLad || p.dashT > 0 || state !== 'play') {
      p.climbing = false;
      /* climbed off the top while still holding up → vault onto the ledge */
      if (!onLad && Input.jump && !p.grounded && state === 'play') {
        p.vy = Math.min(p.vy, LADDER_POP);
        p.sqY = 1.16; p.sqX = 0.88;
      }
    }
  }
  if (!p.climbing && onLad && p.climbLock <= 0 && (
        (Input.jump && p.vy > -80) ||
        (Input.d && !p.grounded && p.vy >= -20))) {
    p.climbing = true;
    Input.buf = 0;
    p.vy = Math.min(p.vy, 40);
    p.airJumps = KIT().airJumps;
    SFX.land();
  }

  /* dash */
  if (Input.dashReq) {
    if (controlOK && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = DASH_T; p.dashCd = DASH_CD * KIT().dashCdMul;
      p.dashDir = dir !== 0 ? dir : p.face;
      SFX.dash();
      dust(p.cx, p.y + p.h, 5, 60);
    }
    Input.dashReq = false;
  }

  /* stapler */
  if (p.fireCd > 0) p.fireCd -= dt;
  if (noStaplerHintCd > 0) noStaplerHintCd -= dt;
  if (Input.fireReq) {
    if (!p.hasStapler) {
      /* unarmed: nudge toward the desk instead of silently doing nothing */
      if (noStaplerHintCd <= 0 && state === 'play') {
        addPop(p.cx, p.y - 34, 'YOUR STAPLER IS ON YOUR DESK!', '#ffe082', 11);
        SFX.click();
        noStaplerHintCd = 2.5;
      }
    } else if (controlOK && p.fireCd <= 0 && lvl) {
      const K = KIT();
      p.fireCd = FIRE_CD * K.fireCdMul;
      lvl.staples.push({
        x: p.cx + p.face * 22, y: p.y + 17,
        vx: p.face * (STAPLE_V + Math.max(0, p.vx * p.face) * 0.25),
        vy: -50, t: 0, dead: false,
      });
      if (K.twinStaple) lvl.staples.push({   /* QA files the bug report twice */
        x: p.cx + p.face * 22, y: p.y + 17,
        vx: p.face * ((STAPLE_V + Math.max(0, p.vx * p.face) * 0.25) * 0.94),
        vy: -150, t: 0, dead: false,
      });
      SFX.staple();
      p.sqX = 1.09; p.sqY = 0.93;
      dust(p.cx + p.face * 18, p.y + 20, 2, 40);
    }
    Input.fireReq = false;
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * DASH_V;
    p.vy = 0;
    p.face = p.dashDir;
    ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0.22 });
  } else if (p.climbing) {
    /* climb movement: gravity off, up/down rungs, slow sideways shuffle */
    const up = Input.jump, dn = Input.d;
    p.vy = ((up ? -CLIMB_V : 0) + (dn ? CLIMB_V : 0)) * KIT().climbMul;
    if (dir !== 0) { p.vx = dir * CLIMB_H; p.face = dir; }
    else p.vx *= Math.max(0, 1 - 18 * dt);
    if (up || dn) {
      p.ph += dt * 11;
      p.idleT = 0;
      if (Math.random() < 0.05) dust(p.cx + rand(-9, 9), p.y + rand(8, 34), 1, 22);
    }
    if (dn && p.grounded) p.climbing = false;   // stepped off at the bottom
  } else {
    const spd = MOVE * KIT().moveMul * (p.boost > 0 ? 1.33 : 1);
    const ac = p.grounded ? ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      p.vx += dir * ac * dt;
      p.vx = clamp(p.vx, -spd, spd);
      p.face = dir;
      p.idleT = 0;
    } else {
      p.idleT += dt;
      const fr = (p.grounded ? FRICTION : 900) * dt;
      p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr;
    }
    p.vy += GRAV * dt;
    if (p.vy < 0 && !Input.jump) p.vy += GRAV * 2.1 * dt;
    p.vy = Math.min(p.vy, MAXFALL);
  }

  /* wall slide */
  p.sliding = false;
  if (!p.grounded && !p.climbing && p.dashT <= 0 && p.vy > 0 && controlOK) {
    if ((p.wallL && Input.l) || (p.wallR && Input.r)) {
      p.sliding = true;
      p.vy = Math.min(p.vy, WALL_SLIDE_MAX);
      if (Math.random() < 0.4) addPart({
        x: p.cx + (p.wallL ? -16 : 16), y: p.y + rand(6, p.h - 6),
        vx: rand(-16, 16), vy: rand(20, 80), g: 0, life: 0.28, size: 2.6,
        color: 'rgba(214,226,236,0.75)', shape: 'circle',
      });
    }
  }

  /* jumping */
  if (p.grounded) { p.coyote = COYOTE; p.airJumps = KIT().airJumps; }
  else p.coyote -= dt;

  if (controlOK && Input.buf > 0 && p.dashT <= 0) {
    if (p.climbing) {
      /* hop off the ladder */
      p.climbing = false;
      p.climbLock = CLIMB_LOCK;
      p.vy = -JUMPV * 0.78;
      const jd = dir !== 0 ? dir : p.face;
      p.vx = jd * MOVE * 0.92;
      p.face = jd;
      p.sqY = 1.18; p.sqX = 0.86;
      p.airJumps = KIT().airJumps; p.ride = null;
      Input.buf = 0;
      SFX.jump();
      dust(p.cx, p.y + p.h - 4, 3, 55);
    } else if (p.grounded || p.coyote > 0) {
      if (p.onOneway && Input.d) {
        p.dropT = 0.18; p.grounded = false; Input.buf = 0;
      } else {
        p.vy = -JUMPV; p.coyote = 0; p.grounded = false; p.ride = null;
        p.sqY = 1.22; p.sqX = 0.84;
        dust(p.cx, p.y + p.h, 4, 50);
        SFX.jump();
        Input.buf = 0;
      }
    } else if (!p.grounded && (p.wallL || p.wallR)) {
      /* wall jump */
      const wdir = p.wallL ? 1 : -1;
      p.vy = -JUMPV * 0.97;
      p.vx = wdir * WALLJ_VX;
      p.face = wdir;
      p.sqY = 1.2; p.sqX = 0.85;
      p.airJumps = Math.max(p.airJumps, 1);
      p.ride = null;
      Input.buf = 0;
      SFX.djump();
      for (let i = 0; i < 7; i++) {
        const a = rand(TAU);
        addPart({
          x: p.cx + (wdir < 0 ? -14 : 14), y: p.y + p.h - 10,
          vx: Math.cos(a) * 90 + wdir * 170, vy: rand(-60, 120), g: 220,
          life: 0.32, size: 3.2, color: 'rgba(255,255,255,0.82)', shape: 'circle',
        });
      }
    } else if (p.airJumps > 0) {
      p.airJumps--;
      if (KIT().airJumps === 2 && p.airJumps === 0) addPop(p.cx, p.y - 30, 'EXCEEDING TARGETS!', '#90caf9');
      p.vy = -DJUMPV;
      p.sqY = 1.2; p.sqX = 0.85;
      Input.buf = 0;
      SFX.djump();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        addPart({
          x: p.cx + Math.cos(a) * 16, y: p.y + p.h - 6 + Math.sin(a) * 7,
          vx: Math.cos(a) * 130, vy: 40 + Math.sin(a) * 40, g: 0, life: 0.3,
          size: 3.5, color: 'rgba(255,255,255,0.85)', shape: 'circle',
        });
      }
    }
  }

  const wasGround = p.grounded;
  const vyBefore = p.vy;
  resolveTiles(p, dt, { passGates: KIT().gateSkip });

  /* INTERN: nobody checks his badge — slip through closed gates */
  if (KIT().gateSkip && state === 'play') {
    const gx0 = Math.floor((p.x + 4) / T), gx1 = Math.floor((p.x + p.w - 4) / T);
    const gy0 = Math.floor((p.y + 4) / T), gy1 = Math.floor((p.y + p.h - 3) / T);
    let inGate = false;
    for (let ty = gy0; ty <= gy1 && !inGate; ty++)
      for (let tx = gx0; tx <= gx1 && !inGate; tx++) if (getTile(tx, ty) === 12) inGate = true;
    if (inGate && !p.gateIn) {
      if (!lvl.tailgated) { addPop(p.cx, p.y - 26, 'TAILGATING!', '#82b1ff'); SFX.click(); lvl.tailgated = true; }
      sparkle(p.cx, p.y + 20, '#82b1ff', 5);
    }
    p.gateIn = inGate;
  }
  if (!wasGround && p.grounded) p.prevVyLand = vyBefore;

  /* moving platforms */
  if (p.vy >= 0 && !p.grounded && !p.climbing) {
    const prevBot = p.prevY + p.h;
    for (const pl of lvl.plats) {
      if (p.x + p.w > pl.x + 4 && p.x < pl.x + pl.w - 4 &&
          prevBot <= pl.y + 10 && p.y + p.h >= pl.y && p.y + p.h <= pl.y + pl.h + 16) {
        p.y = pl.y - p.h - 0.01;
        p.vy = 0;
        p.grounded = true;
        p.ride = pl;
        p.airJumps = KIT().airJumps; p.coyote = COYOTE;
        break;
      }
    }
  }
  if (!p.grounded) p.ride = null;

  /* spring chairs */
  for (const sp of lvl.springs) {
    if (sp.t > 0) sp.t -= dt;
    const prevBot2 = p.prevY + p.h;
    if (p.vy > 0 && p.x + p.w > sp.x + 4 && p.x < sp.x + sp.w - 4 &&
        prevBot2 <= sp.y + 10 && p.y + p.h >= sp.y && p.y + p.h <= sp.y + sp.h + 18) {
      p.y = sp.y - p.h - 0.01;
      p.vy = -SPRING_V * KIT().springMul;
      p.airJumps = KIT().airJumps; p.coyote = COYOTE; p.prevY = p.y;
      p.sqY = 1.38; p.sqX = 0.72;
      sp.t = 0.3;
      SFX.boing();
      shake(0.18);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU;
        addPart({
          x: sp.x + sp.w / 2 + Math.cos(a) * 20, y: sp.y + Math.sin(a) * 8,
          vx: Math.cos(a) * 170, vy: 60 + Math.sin(a) * 60, g: 300,
          life: 0.42, size: 3.5, color: '#82b1ff', shape: 'circle',
        });
      }
    }
  }

  /* conveyor belts */
  if (p.grounded && p.dashT <= 0 && !p.climbing && !KIT().beltImmune) {
    const bd = beltAt(p);
    if (bd) p.x += bd * BELT_V * dt;
  }

  /* landing juice */
  if (!wasGround && p.grounded && p.prevVyLand > 560) {
    p.sqY = 0.74; p.sqX = 1.26;
    dust(p.cx, p.y + p.h, 7, 110);
    SFX.land();
  }
  p.prevVyLand = 0;

  /* squash spring-back */
  p.sqX = lerp(p.sqX, 1, 1 - Math.exp(-14 * dt));
  p.sqY = lerp(p.sqY, 1, 1 - Math.exp(-14 * dt));

  /* run anim & dust */
  if (p.grounded && Math.abs(p.vx) > 210) {
    p.ph += dt * 13;
    p.runDustT -= dt;
    if (p.runDustT <= 0) { p.runDustT = 0.09; dust(p.cx - p.face * 10, p.y + p.h, 1, 30); }
  }
  if (p.boost > 0 && (Math.abs(p.vx) > 240 || !p.grounded) && Math.random() < 0.5) {
    ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0.25 });
  }
  p.blinkT -= dt;
  if (p.blinkT < -0.12) p.blinkT = rand(2.2, 4.5);

  /* hazards */
  if (playerVulnerable()) {
    if (p.y > lvl.pxH + 70) hurtPlayer('pit');
    else {
      const x0 = Math.floor((p.x + 6) / T), x1 = Math.floor((p.x + p.w - 6) / T);
      const y0 = Math.floor((p.y + 8) / T), y1 = Math.floor((p.y + p.h - 2) / T);
      outer:
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++)
          if (getTile(tx, ty) === 8 && !(lvl.jams[tx + '_' + ty] > 0)) {
            SFX.shred();
            paperBurst(p.cx, p.y + p.h / 2);
            hurtPlayer('shred');
            break outer;
          }
    }
  }

  /* pickups / checkpoints / door */
  for (const pk of lvl.pickups) if (!pk.taken && rectHit(p, pk, -4)) collect(pk);
  for (const ck of lvl.checkpoints) {
    ck.t += dt;
    if (!ck.active && Math.abs(p.cx - ck.x) < 42 && Math.abs((p.y + p.h) - ck.y) < 72) {
      ck.active = true;
      lvl.spawn = { x: ck.x, y: ck.y };
      totals.score += 100;
      if (p.hearts < KIT().maxHearts) { p.hearts++; addPop(ck.x, ck.y - 96, 'MORALE +1', '#69f0ae'); }
      addPop(ck.x, ck.y - 70, 'CHECKPOINT', '#69f0ae');
      SFX.checkpoint();
      sparkle(ck.x, ck.y - 62, '#69f0ae', 10);
    }
  }
  const door = lvl.door;
  if (door && !door.locked && state === 'play' &&
      p.cx > door.x + 8 && p.cx < door.x + door.w - 8 && p.y + p.h > door.y + 12) {
    levelClear();
  }
}

/* ---------------- manager update ---------------- */
function updateManager(m, dt) {
  if (m.squashed > 0) {
    m.squashed += dt;
    if (m.squashed > 0.55) m.dead = true;
    return;
  }
  m.prevY = m.y;
  m.vy = Math.min(m.vy + GRAV * dt, MAXFALL);
  const p = player;
  const dx = p.cx - (m.x + m.w / 2);
  const dy = Math.abs((p.y + p.h) - (m.y + m.h));
  if (state === 'play' && Math.abs(dx) < 310 * KIT().aggroMul && dy < 120 && p.invuln <= 0) {
    if (!m.chase) {
      SFX.alarm();
      addPop(m.x + m.w / 2, m.y - 18, '!', '#ff5252', 22);
    }
    m.chase = true; m.chaseT = 1.3;
    m.dir = dx > 0 ? 1 : -1;
  } else if (m.chase) {
    m.chaseT -= dt;
    if (m.chaseT <= 0) m.chase = false;
  }
  const spd = m.chase ? 185 : 88;
  m.vx = m.dir * spd;

  if (m.grounded) {
    const ftx = Math.floor((m.dir > 0 ? m.x + m.w + 5 : m.x - 5) / T);
    const midTy = Math.floor((m.y + m.h / 2) / T);
    const bodyTy = Math.floor((m.y + m.h - 8) / T);
    const footTy = Math.floor((m.y + m.h + 10) / T);
    const wallAhead = SOLIDC(getTile(ftx, midTy));
    const shredAhead = getTile(ftx, bodyTy) === 8;
    const gapAhead = !SOLIDC(getTile(ftx, footTy));
    if (wallAhead || shredAhead || (gapAhead && !m.chase)) m.dir *= -1;
  }
  resolveTiles(m, dt);
  nudgeX(m, beltAt(m) * BELT_V * dt);
  m.ph += dt * (m.chase ? 14 : 8);
  if (m.y > lvl.pxH + 120) m.dead = true;

  if (playerVulnerable() && rectHit(player, m, 4)) {
    const stomp = player.vy > 140 && (player.prevY + player.h) <= m.y + m.h * 0.4;
    if (stomp) stompEnemy(m);
    else hurtPlayer('enemy', m.x + m.w / 2);
  }
}

/* ---------------- interns (flee! hop!) ---------------- */
function updateIntern(n, dt) {
  if (n.squashed > 0) { n.squashed += dt; if (n.squashed > 0.55) n.dead = true; return; }
  n.prevY = n.y;
  n.vy = Math.min(n.vy + GRAV * dt, MAXFALL);
  const dx = player.cx - n.cx;
  n.fleeing = state === 'play' && Math.abs(dx) < 280 && Math.abs(player.y - n.y) < 150;
  if (n.fleeing) {
    n.dir = dx > 0 ? -1 : 1;
    n.face = n.dir;
  } else if (Math.random() < dt * 0.5) { n.dir *= -1; n.face = n.dir; }
  const spd = n.fleeing ? 205 : 70;
  n.vx = n.dir * spd;
  if (n.grounded && !n.fleeing) {
    n.hopT -= dt;
    if (n.hopT <= 0) { n.hopT = rand(0.55, 1.15); n.vy = -500; n.vx *= 1.25; }
    const ftx = Math.floor((n.dir > 0 ? n.x + n.w + 5 : n.x - 5) / T);
    const bodyTy = Math.floor((n.y + n.h - 8) / T);
    const footTy = Math.floor((n.y + n.h + 10) / T);
    const wallAhead = SOLIDC(getTile(ftx, Math.floor((n.y + n.h / 2) / T)));
    if (wallAhead || getTile(ftx, bodyTy) === 8 || !SOLIDC(getTile(ftx, footTy))) { n.dir *= -1; n.face = n.dir; }
  }
  resolveTiles(n, dt);
  nudgeX(n, beltAt(n) * BELT_V * dt);
  n.ph += dt * (n.fleeing ? 15 : 8);
  if (n.y > lvl.pxH + 120) {
    n.dead = true; totals.score += 50;
    addPop(clamp(n.cx, camX + 40, camX + VIEW_W - 40), lvl.pxH - 60, '+50 OOPS', '#ffe57f');
  }
  if (playerVulnerable() && rectHit(player, n, 4)) {
    const stomp = player.vy > 140 && (player.prevY + player.h) <= n.y + n.h * 0.4;
    if (stomp) {
      n.squashed = 0.001;
      registerStomp(n.cx, n.y - 8, 'MENTORED!', '#b2ebf2');
      SFX.stomp(); bouncePlayer(); freezeT = 0.04; shake(0.2);
      dust(n.cx, n.y + n.h, 6, 110);
    } else hurtPlayer('intern', n.cx);
  }
}

/* ---------------- HR drones (surveillance, but make it floaty) ---------------- */
function updateDrone(d, dt) {
  d.t += dt;
  d.x += d.dir * 46 * dt;
  if (Math.abs(d.cx - d.ox) > 84) d.dir = d.cx < d.ox ? 1 : -1;
  d.y = d.oy - 14 + Math.sin(d.t * 2.3 + d.ph) * 13;
  if (playerVulnerable() && rectHit(player, d, 2)) {
    const stomp = player.vy > 140 && (player.prevY + player.h) <= d.y + d.h * 0.55;
    if (stomp) {
      d.dead = true;
      registerStomp(d.cx, d.y - 10, 'DEFLECTED!', '#b3e5fc');
      SFX.stomp(); bouncePlayer(); freezeT = 0.04; shake(0.22);
      for (let i = 0; i < 8; i++) addPart({
        x: d.cx + rand(-8, 8), y: d.y + rand(-4, 12), vx: rand(-180, 180), vy: rand(-240, -40),
        g: 420, life: rand(0.4, 0.7), size: rand(3, 5), color: '#eceff1', shape: 'circle',
      });
    } else if (!KIT().droneFriendly) hurtPlayer('enemy', d.cx);
  }
}

/* ---------------- planes ---------------- */
function updatePlanes(dt) {
  const cfg = lvl.def.planes;
  if (cfg && (state === 'play' || state === 'title' || state === 'intro')) {
    lvl.planeT -= dt;
    if (lvl.planeT <= 0) {
      lvl.planeT = cfg.every * rand(0.75, 1.35);
      /* jetpack-joyride rule: warn at the flight altitude FIRST, then deliver */
      lvl.planeWarns.push({ by: rand(cfg.yMin * T, cfg.yMax * T), t: 0.9, spawned: false });
      SFX.incoming();
    }
  }
  for (const w of lvl.planeWarns) {
    if (w.spawned) continue;
    w.t -= dt;
    if (w.t <= 0) {
      w.spawned = true;
      lvl.planes.push({
        x: camX + VIEW_W + 90, bx: camX + VIEW_W + 90,
        by: w.by,
        y: 0, vx: cfg.speed, ph: rand(TAU), t: 0,
        crumple: 0, rot: 0, dead: false,
      });
    }
  }
  lvl.planeWarns = lvl.planeWarns.filter(w => !w.spawned);
  for (const pl of lvl.planes) {
    pl.t += dt;
    if (pl.crumple > 0) {
      pl.crumple += dt;
      pl.vy = (pl.vy || 120) + GRAV * 0.6 * dt;
      pl.y += pl.vy * dt;
      pl.rot += dt * 9;
      if (pl.y > lvl.pxH + 80 || pl.crumple > 3) pl.dead = true;
      continue;
    }
    pl.x += pl.vx * dt;
    pl.y = pl.by + Math.sin(pl.t * 3 + pl.ph) * 24;
    if (pl.x < camX - 340) { pl.dead = true; continue; }
    if (playerVulnerable()) {
      const hb = { x: pl.x - 20, y: pl.y - 10, w: 40, h: 20 };
      if (rectHit(player, hb, 2)) {
        if (player.vy > 140 && (player.prevY + player.h) <= hb.y + 14) {
          pl.crumple = 0.001; pl.vy = -140;
          registerStomp(pl.x, pl.y - 16, 'RECYCLED!', '#b3e5fc');
          SFX.stomp();
          bouncePlayer();
          freezeT = 0.04; shake(0.2);
          for (let i = 0; i < 6; i++) addPart({
            x: pl.x, y: pl.y, vx: rand(-160, 160), vy: rand(-220, -40), g: 500,
            life: 0.6, size: rand(4, 7), color: '#eceff1', shape: 'confetti', rot: rand(TAU), vr: rand(-8, 8),
          });
        } else hurtPlayer('plane', pl.x);
      }
    }
  }
  lvl.planes = lvl.planes.filter(q => !q.dead);
}

/* ---------------- player staples ---------------- */
function updateStaples(dt) {
  /* shredder jam timers tick down */
  for (const k in lvl.jams) { lvl.jams[k] -= dt; if (lvl.jams[k] <= 0) delete lvl.jams[k]; }
  for (const s of lvl.staples) {
    s.t += dt;
    s.vy += STAPLE_G * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    /* PRIYA · QA: staples jam shredders (filed as P1) */
    const jx = Math.floor(s.x / T), jy = Math.floor(s.y / T);
    if (KIT().stapleJam && getTile(jx, jy) === 8) {
      const key = jx + '_' + jy;
      if (!(key in lvl.jams)) { addPop(jx * T + T / 2, jy * T - 10, 'JAMMED!', '#ffd54f', 11); sparkle(s.x, s.y, '#ffd54f', 6); SFX.staple(); }
      lvl.jams[key] = 2.5;
      s.dead = true;
      for (let i = 0; i < 4; i++) addPart({
        x: s.x, y: s.y, vx: -Math.sign(s.vx) * rand(20, 90), vy: rand(-160, -30),
        g: 500, life: 0.3, size: rand(1.6, 3), color: '#b0bec5', shape: 'rect', rot: rand(TAU), vr: rand(-12, 12),
      });
      continue;
    }

    /* walls & bounds */
    const tx = Math.floor((s.vx > 0 ? s.x + 5 : s.x - 5) / T);
    const ty = Math.floor(s.y / T);
    if (SOLIDC(getTile(tx, ty))) {
      s.dead = true;
      for (let i = 0; i < 3; i++) addPart({
        x: s.x, y: s.y, vx: -Math.sign(s.vx) * rand(30, 120), vy: rand(-140, 20),
        g: 500, life: 0.25, size: rand(1.6, 3), color: '#b0bec5', shape: 'rect', rot: rand(TAU), vr: rand(-12, 12),
      });
      continue;
    }
    if (s.t > 2.2 || s.y > lvl.pxH + 40 || s.x < camX - 80 || s.x > camX + VIEW_W + 80) { s.dead = true; continue; }

    /* hitbox */
    const hb = { x: s.x - 8, y: s.y - 4, w: 16, h: 8 };

    /* interns: one staple, they fold */
    for (const n of lvl.interns) {
      if (!n.dead && !n.squashed && rectHit(hb, n, 2)) {
        n.squashed = 0.01; s.dead = true;
        SFX.stomp(); registerStomp(n.cx, n.y - 8, 'STAPLED!', '#ffe082');
        sparkle(n.cx, n.y + 10, '#eceff1', 5);
        break;
      }
    }
    if (s.dead) continue;

    /* HR drones: pop the balloon */
    for (const d of lvl.drones) {
      if (!d.dead && rectHit(hb, d, 2)) {
        d.dead = true; s.dead = true;
        SFX.stomp(); registerStomp(d.cx, d.y - 10, 'DEFLECTED!', '#b3e5fc');
        for (let i = 0; i < 7; i++) addPart({
          x: d.cx + rand(-8, 8), y: d.y + rand(-4, 12), vx: rand(-180, 180), vy: rand(-240, -40),
          g: 420, life: rand(0.4, 0.7), size: rand(3, 5), color: '#eceff1', shape: 'circle',
        });
        break;
      }
    }
    if (s.dead) continue;

    /* managers: two staples — first one enrages */
    for (const m of lvl.enemies) {
      if (!m.dead && !m.squashed && rectHit(hb, m, 2)) {
        m.stapHits = (m.stapHits || 0) + 1;
        if (m.stapHits >= 2) {
          m.squashed = 0.01;
          SFX.stomp(); registerStomp(m.cx, m.y - 8, 'STAPLED!', '#ffe082');
        } else {
          m.chase = true; m.chaseT = 2.6; m.dir = Math.sign(s.vx) || m.dir;
          addPop(m.cx, m.y - 20, 'OW!', '#ff8a80', 15);
          SFX.alarm();
        }
        s.dead = true;
        break;
      }
    }
    if (s.dead) continue;

    /* paper airplanes: return to sender */
    for (const pl of lvl.planes) {
      if (!pl.dead && !pl.crumple && rectHit(hb, { x: pl.x - 18, y: pl.y - 12, w: 36, h: 24 }, 2)) {
        pl.crumple = 0.001; pl.vy = -140; s.dead = true;
        SFX.stomp(); registerStomp(pl.x, pl.y - 16, 'RETURNED TO SENDER!', '#b3e5fc');
        break;
      }
    }
    if (s.dead) continue;

    /* boss contact: damage only while stunned/pantsed — otherwise armor ping */
    if (boss && !boss.dead && (!boss.dying || boss.dying <= 0) && rectHit(hb, boss, 4)) {
      if ((boss.st === 'stun' || boss.st === 'pants') && boss.invuln <= 0) {
        boss.hp--;
        boss.invuln = 0.6;
        boss.rage++;
        s.dead = true;
        totals.score += 400;
        addPop(boss.cx, boss.y - 16, '+400 STAPLED!', '#ffab91');
        SFX.bossHit(); freezeT = 0.05; shake(0.3);
        sparkle(boss.cx, boss.y + 30, '#ff8a65', 10);
        if (boss.hp <= 0) killBoss();
        else { boss.st = 'idle'; boss.t = 0.35; }
      } else {
        /* armor ping: teaches the rhythm — not now */
        s.dead = true;
        for (let i = 0; i < 3; i++) addPart({
          x: s.x + rand(-4, 4), y: s.y,
          vx: -Math.sign(s.vx) * rand(40, 140), vy: rand(-180, -40),
          g: 600, life: 0.3, size: rand(1.5, 2.8), color: '#cfd8dc', shape: 'rect', rot: rand(TAU), vr: rand(-14, 14),
        });
        if ((boss.pingCd || 0) <= 0) {
          SFX.staple();
          addPop(boss.cx, boss.y - 44, "CLANK! NOT STUNNED", '#b0bec5', 10);
          boss.pingCd = 0.3;
        }
      }
    }
  }
  lvl.staples = lvl.staples.filter(q => !q.dead);
}

/* ---------------- moving platforms ---------------- */
function updatePlats(dt) {
  for (const pl of lvl.plats) {
    pl.t += dt;
    const s = Math.sin(pl.t * pl.om);
    const nx = pl.axis === 'h' ? pl.ox + s * pl.amp : pl.ox;
    const ny = pl.axis === 'v' ? pl.oy + s * pl.amp : pl.oy;
    pl.dx = nx - pl.x; pl.dy = ny - pl.y;
    pl.x = nx; pl.y = ny;
  }
}

/* ---------------- boss ---------------- */
function updateBoss(dt) {
  const b = boss;
  if (!b) return;
  const p = player;
  if (b.invuln > 0) b.invuln -= dt;

  if (b.dead) {
    b.dying += dt;
    b.vy += GRAV * dt;
    b.y = Math.min(b.y + b.vy * dt, 13 * T - b.h);
    b.rot += dt * 2.2;
    return;
  }

  if (b.pingCd > 0) b.pingCd -= dt;

  const rageK = 1 + b.rage * 0.09;
  const speedK = 1 + b.rage * 0.10;
  b.t -= dt;
  b.face = p.cx < b.cx ? -1 : 1;

  /* corporate taunt captions */
  b.tauntT -= dt;
  if (b.tauntT <= 0) {
    b.tauntT = rand(3.5, 6);
    b.taunt = { text: pick(BOSS_TAUNTS), t: 2.4 };
    SFX.click();
  }
  if (b.taunt) { b.taunt.t -= dt; if (b.taunt.t <= 0) b.taunt = null; }

  switch (b.st) {
    case 'idle': {
      b.vx = 0;
      if (b.t <= 0) {
        b.lastMove = b.lastMove === 'leap' ? 'throw' : 'leap';
        b.st = b.lastMove === 'leap' ? 'tele' : 'tele2';
        b.warned = false;
        b.t = 0.55 / rageK;
      }
      break;
    }
    case 'tele': case 'tele2': {
      b.vx = 0;
      b.jitter = true;
      if (!b.warned) {   /* name the attack before it happens — teach the rhythm */
        b.warned = true;
        addPop(b.cx, b.y - 44, b.st === 'tele' ? 'LEAP INCOMING!' : 'VOLLEY INCOMING!', '#ffe082', 12);
      }
      if (b.t <= 0) {
        b.jitter = false;
        if (b.st === 'tele') {
          b.st = 'leap'; b.t = 0;
          b.vy = -980;
          b.vx = clamp((p.cx - b.cx) * 1.6, -560, 560) * speedK;
          SFX.pew();
        } else {
          b.st = 'throw'; b.throwLeft = 3; b.throwT = 0.08;
        }
      }
      break;
    }
    case 'leap': {
      b.vy += GRAV * 0.92 * dt;
      if (b.grounded && b.t < -0.18) {
        b.st = 'stun'; b.t = 1.35 / rageK; b.vulnDur = b.t;
        SFX.thud();
        shake(0.7);
        dust(b.cx - 40, b.y + b.h, 8, 160);
        addPop(b.cx, b.y - 30, 'DOWNTIME! HIT HIM!', '#69f0ae', 14);
        SFX.checkpoint();
        dust(b.cx + 40, b.y + b.h, 8, 160);
        b.waves.push({ x: b.x - 8, y: b.y + b.h - 30, w: 26, h: 30, vx: -430 * speedK, t: 0, dead: false });
        b.waves.push({ x: b.x + b.w - 18, y: b.y + b.h - 30, w: 26, h: 30, vx: 430 * speedK, t: 0, dead: false });
        b.vx = 0;
      }
      break;
    }
    case 'throw': {
      b.vx = 0;
      b.throwT -= dt;
      if (b.throwLeft > 0 && b.throwT <= 0) {
        b.throwLeft--; b.throwT = 0.28 / rageK;
        SFX.pew();
        const dx = p.cx - b.cx;
        b.staplers.push({
          x: b.cx + b.face * 30, y: b.y + 44,
          vx: clamp(dx * 1.4, -520, 520) * rand(0.85, 1.15),
          vy: rand(-620, -480),
          rot: 0, bounced: false, dead: false,
        });
      }
      if (b.throwLeft <= 0 && b.throwT <= 0) { b.st = 'pants'; b.t = 1.9 / rageK; b.vulnDur = b.t; addPop(b.cx, b.y - 30, 'PANTS DOWN! HIT HIM!', '#82b1ff', 14); SFX.checkpoint(); }
      break;
    }
    case 'stun': case 'pants': {
      b.vx = 0;
      if (b.t <= 0) { b.st = 'idle'; b.t = rand(0.5, 0.9) / rageK; }
      break;
    }
  }
  b.prevY = b.y;
  resolveTiles(b, dt);
  b.ph += dt * 6;

  /* staplers */
  for (const s of b.staplers) {
    s.vy += GRAV * 0.75 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.rot += dt * 10 * Math.sign(s.vx || 1);
    const tx = Math.floor(s.x / T), ty = Math.floor((s.y + 6) / T);
    if (SOLIDC(getTile(tx, ty))) {
      if (!s.bounced) { s.bounced = true; s.vy = -Math.abs(s.vy) * 0.4 - 80; s.y -= 8; dust(s.x, s.y + 10, 3, 40); }
      else { s.dead = true; dust(s.x, s.y + 8, 4, 60); }
    }
    if (s.y > lvl.pxH + 60 || s.x < 0 || s.x > lvl.pxW) s.dead = true;
    else if (playerVulnerable()) {
      const hb = { x: s.x - 13, y: s.y - 6, w: 26, h: 12 };
      if (rectHit(player, hb, 2)) { s.dead = true; hurtPlayer('staple', s.x); }
    }
  }
  b.staplers = b.staplers.filter(s => !s.dead);

  /* shockwaves */
  for (const w of b.waves) {
    w.x += w.vx * dt;
    w.t += dt;
    if (Math.random() < 0.35) dust(w.x + w.w / 2, w.y + w.h, 1, 20);
    const tx = Math.floor((w.vx > 0 ? w.x + w.w : w.x) / T);
    const ty = Math.floor((w.y + w.h - 4) / T);
    if (SOLIDC(getTile(tx, ty))) w.dead = true;
    else if (playerVulnerable() && rectHit(player, w)) hurtPlayer('wave', w.x);
  }
  b.waves = b.waves.filter(w => !w.dead);

  /* contact & stomp */
  if (playerVulnerable() && rectHit(player, b, 10)) {
    const vuln = b.st === 'stun' || b.st === 'pants';
    const stomp = player.vy > 140 && (player.prevY + player.h) <= b.y + b.h * 0.32;
    if (stomp && vuln) {
      b.hp--;
      totals.score += 500;
      addPop(b.cx, b.y - 16, '+500 PINK-SLIPPED!', '#ffab91');
      SFX.bossHit();
      bouncePlayer();
      freezeT = 0.09; shake(0.65);
      sparkle(b.cx, b.y + 24, '#ff8a65', 14);
      b.invuln = 0.6;
      if (b.hp <= 0) killBoss();
      else { b.st = 'idle'; b.t = 0.4; b.rage++; }
    } else if (!vuln && b.invuln <= 0) {
      hurtPlayer('boss', b.cx);
    }
  }
}
function killBoss() {
  const b = boss;
  b.dead = true; b.dying = 0; b.vy = -350;
  totals.score += 2000;
  addPop(b.cx, b.y - 24, 'YOU ARE FREE!', '#ffd54f', 17);
  SFX.thud();
  setTimeout(() => SFX.fanfare(), 500);
  Sound.stopSong();
  freezeT = 0.5;
  shake(0.9);
  confetti(b.cx, b.y + 40, 130);
  /* victory exit must spawn UNLOCKED — curLevel is still the boss floor here,
     so the factory default would stamp it LOCKED and soft-lock the win */
  lvl.door = makeDoor(lvl.pxW / 2, 13 * T);
  lvl.door.locked = false;
  addPop(lvl.pxW / 2, 9.6 * T, 'EXIT UNLOCKED!', '#69f0ae', 15);
  playDialogue(SCRIPTS.victory);
}

/* ---------------- ambient fx ---------------- */
function updateFx(dt) {
  /* combo window */
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboN = 0; }
  if (comboPopT > 0) comboPopT -= dt;
  /* gate open animation */
  if (lvl.gateAnim > 0 && lvl.gateAnim < 1) lvl.gateAnim = Math.min(1, lvl.gateAnim + dt * 1.6);
  /* on-call pager curse */
  if (lvl.pagerOn) {
    lvl.pagerT -= dt;
    lvl.pagerPing -= dt;
    if (lvl.pagerPing <= 0) {
      lvl.pagerPing = 2.2;
      SFX.pager();
      addPop(player.cx, player.y - 26, 'RING RING', '#ef9a9a', 11);
    }
    if (lvl.pagerT <= 0) {
      lvl.pagerOn = false;
      totals.score += 250;
      addPop(player.cx, player.y - 26, '+250 ESCALATED. NOT YOUR PROBLEM.', '#b9f6ca', 12);
    }
  }
  /* high-fives (+ pager handoff) */
  for (const c of lvl.coworkers) {
    c.hi = c.hi || 0;
    if (c.hi > 0) c.hi -= dt;
    if (c.hiDone) continue;
    if (state === 'play' && player.grounded && Math.abs(player.cx - c.x) < 52 && Math.abs((player.y + player.h) - c.y) < 74) {
      c.hiDone = true; c.hi = 0.8;
      totals.score += 25;
      SFX.hifive();
      sparkle(c.x, c.y - 60, '#ffd740', 6);
      if (lvl.pagerOn) {
        lvl.pagerOn = false;
        totals.score += 150;
        addPop(c.x, c.y - 96, 'PAGER OFFLOADED! +150', '#69f0ae');
      } else {
        addPop(c.x, c.y - 96, '+25 HIGH FIVE!', '#ffd740');
      }
    }
  }

  for (const q of parts) {
    q.t += dt;
    q.vy += q.g * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.rot += (q.vr || 0) * dt;
    if (q.shape === 'confetti' || q.shape === 'paper') q.vx *= 0.995;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
  for (const q of pops) q.y -= 24 * dt;
  for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].t += dt) > pops[i].life) pops.splice(i, 1);
  for (const gh of ghosts) gh.t -= dt;
  for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].t <= 0) ghosts.splice(i, 1);

  lvl.bubbleT -= dt;
  if (lvl.bubbleT <= 0) {
    lvl.bubbleT = rand(4.5, 9);
    if (lvl.coworkers.length) {
      const c = pick(lvl.coworkers);
      c.bubble = { text: pick(COWORKER_LINES), t: 3 };
      lvl.bubbling = c;
    }
  }
  if (lvl.bubbling) {
    lvl.bubbling.bubble.t -= dt;
    if (lvl.bubbling.bubble.t <= 0) { lvl.bubbling.bubble = null; lvl.bubbling = null; }
  }
}

/* ---------------- flow ---------------- */
function onConfirm() {
  if (state === 'title') { state = 'select'; Sound.resume(); }
  else if (state === 'select') startGame();
  else if (state === 'gameover') retryLevel(false);
  else if (state === 'win') { state = 'title'; loadLevel(0, { ambient: true }); Sound.playSong('main'); }
  else if (paused) paused = false;
}
/* tap a card on the staff-select screen to select; tap again to lock in */
function handleSelectTap(e) {
  const rect = cv.getBoundingClientRect();
  const vx = (e.clientX - rect.left) / rect.width * VIEW_W;
  const vy = (e.clientY - rect.top) / rect.height * VIEW_H;
  const CW = 262, GAP = 22, X0 = (VIEW_W - (CW * 4 + GAP * 3)) / 2, Y0 = 168, CH = 380;
  const i = Math.floor((vx - X0) / (CW + GAP));
  if (vx < X0 || i < 0 || i > 3 || vy < Y0 || vy > Y0 + CH) return;
  if (i === avatarIdx) onConfirm();          /* second tap locks in */
  else { setAvatar(i); SFX.click(); }
}
function togglePause() {
  if (state === 'play' || state === 'intro') paused = !paused;
}
function startGame() {
  resetTotals();
  runHasStapler = false;
  bossIntroPlayed = false;
  curHint = null;
  loadLevel(0);
  /* jetpack-joyride-style punch-in card: the chosen staffer's moment */
  dayBannerStash = banner; banner = null;
  charIntro = 4.2;
  SFX.click();
}
function retryLevel(manual) {
  totals.score = levelStartScore;
  loadLevel(curLevel);
  if (manual) addPop(player.cx, player.y - 22, 'RESTARTED', '#cfe3ff');
}
function levelClear() {
  state = 'clear';
  clearT = 0;
  totals.score += 1000;
  addPop(player.cx, player.y - 32, '+1000 CLOCKED OUT!', '#69f0ae', 15);
  SFX.door();
  setTimeout(() => SFX.fanfare(), 350);
  confetti(player.cx, player.y, 55);
  saveBest();
}
function finishWin() {
  state = 'win';
  Sound.stopSong();
  SFX.fanfare();
  saveBest();
}
function rankFor(deaths) {
  if (deaths === 0) return ['10X ENGINEER (ALLEGEDLY)', '#ffd54f'];
  if (deaths <= 2) return ['STAFF ENGINEER, VIBE DIVISION', '#7ce38b'];
  if (deaths <= 4) return ['PROMOTABLE. DO NOT FACT-CHECK.', '#8ecbff'];
  return ['UNPAID INTERN (PAID IN EXPOSURE)', '#ff9e9e'];
}

/* ---------------- share cards (the viral loop) ---------------- */
let shareToast = null;
function multLabel() { return Math.min(comboN, 5); }
function buildShareWin() {
  const rk = rankFor(totals.deaths)[0];
  const mm = String(Math.floor(totals.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(totals.time % 60)).padStart(2, '0');
  return 'I was let go from THE DAILY GRIND today.\n' +
    'Grateful for the journey. Some reflections:\n\n' +
    '\u{1F4BC} Shareholder value created: ' + totals.score + '\n' +
    '\u23F1 Time served: ' + mm + ':' + ss + '\n' +
    '\u2615 Coffees: ' + totals.coffees + ' \u00B7 \u{1F3AB} Tickets shipped: ' + totals.files + ' \u00B7 \u{1F4A5} Managers synergized: ' + totals.stomps + '\n' +
    '\u{1F480} Rage quits: ' + totals.deaths + ' \u00B7 \u26A1 Best combo: x' + Math.max(1, totals.maxCombo || 0) + '\n' +
    '\u{1F3C6} Final rank: ' + rk + '\n\n' +
    'Hiring? Just asking.\n\u2014 ' + empName() + ' ' + empDept();
}
function buildShareDead() {
  let s = 'Performance review complete. Results below.\n\n' +
    '\u{1F480} Cause: ' + pickDeathMsg + '\n' +
    '\u{1F4BC} Shareholder value generated: ' + totals.score + '\n' +
    '\u{1F4C9} Verdict: will reapply immediately.\n';
  if (challenge && challenge.beaten) s += '\n\u26A0 CHALLENGE CRUSHED: ' + challenge.name + '\'s ' + challenge.score + ' did not survive contact.\n';
  s += '\nThe game is called THE DAILY GRIND.\n\u2014 ' + empName() + ' ' + empDept();
  return s;
}
async function doShare() {
  const kind = state === 'win' ? 'win' : 'dead';
  const body = kind === 'win' ? buildShareWin() : buildShareDead();
  const url = challengeURL();
  const payload = { text: body + '\n' + url, url };
  const native = () => navigator.share
    ? navigator.share(payload).then(() => { shareToast = { text: 'SHARED!', t: 2 }; return true; }).catch(() => false)
    : Promise.resolve(false);
  /* phones live in WhatsApp/DMs → native sheet first; desktop → clipboard first */
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) { if (await native()) return; }
  try { await navigator.clipboard.writeText(payload.text); shareToast = { text: 'COPIED! GO POST IT', t: 2 }; return; } catch (e) {}
  if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) { if (await native()) return; }
  shareToast = { text: 'CLIPBOARD BLOCKED — SCREENSHOT IT', t: 2 };
}

/* ============================================================
   part 3: rendering, HUD, screens, main loop, boot
   ============================================================ */

/* ---------------- static tile bake ---------------- */
let bake = null;
function bakeLevel() {
  bake = document.createElement('canvas');
  bake.width = lvl.pxW; bake.height = lvl.pxH;
  const g = bake.getContext('2d');
  for (let y = 0; y < lvl.h; y++) {
    for (let x = 0; x < lvl.w; x++) {
      const c = lvl.grid[y][x];
      if (!c || c === 8 || c === 9 || c === 10 || c === 12) continue;
      drawTile(g, c, x * T, y * T, y > 0 && getTile(x, y - 1) === 0);
    }
  }
}
function drawTile(g, c, x, y, airAbove) {
  switch (c) {
    case 1: {
      g.fillStyle = PAL.wall;
      g.fillRect(x, y, T, T);
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
      if (airAbove) {
        g.fillStyle = PAL.carpetA; g.fillRect(x, y, T, 14);
        g.fillStyle = PAL.carpetB; g.fillRect(x, y, T, 5);
        g.fillStyle = PAL.carpetDot;
        for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i * 12, y + 8, 3, 3);
      }
      break;
    }
    case 2: {
      g.clearRect(x, y, T, T);
      g.fillStyle = PAL.woodTop; g.fillRect(x - 2, y, T + 4, 10);
      g.fillStyle = PAL.wood; g.fillRect(x + 4, y + 10, T - 8, 22);
      g.fillStyle = PAL.woodDark;
      g.fillRect(x + 8, y + 15, T - 16, 3);
      g.fillRect(x + 8, y + 23, T - 16, 3);
      g.fillRect(x + 6, y + 32, 6, 16); g.fillRect(x + T - 12, y + 32, 6, 16);
      break;
    }
    case 3: {
      g.fillStyle = PAL.cab; g.fillRect(x + 2, y, T - 4, T);
      g.fillStyle = PAL.cabDark; g.fillRect(x + 2, y + T / 2 - 2, T - 4, 4);
      g.fillStyle = '#d7e0ea';
      g.fillRect(x + T / 2 - 8, y + 12, 16, 4);
      g.fillRect(x + T / 2 - 8, y + T / 2 + 9, 16, 4);
      break;
    }
    case 4: {
      g.fillStyle = PAL.box; g.fillRect(x + 2, y + 2, T - 4, T - 2);
      g.strokeStyle = PAL.boxTape; g.lineWidth = 3;
      g.strokeRect(x + 5, y + 5, T - 10, T - 10);
      g.beginPath(); g.moveTo(x + T / 2, y + 2); g.lineTo(x + T / 2, y + T); g.stroke();
      g.lineWidth = 1;
      break;
    }
    case 5: {
      g.fillStyle = PAL.pot;
      g.beginPath();
      g.moveTo(x + 10, y + T - 16); g.lineTo(x + T - 10, y + T - 16);
      g.lineTo(x + T - 15, y + T); g.lineTo(x + 15, y + T); g.closePath(); g.fill();
      g.fillStyle = PAL.plant;
      for (const [ox, oy, r] of [[T / 2, 12, 12], [T / 2 - 10, 20, 9], [T / 2 + 10, 20, 9], [T / 2, 26, 10]]) {
        g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill();
      }
      g.fillStyle = PAL.plantD;
      g.beginPath(); g.arc(x + T / 2 - 7, y + 15, 6, 0, TAU); g.fill();
      break;
    }
    case 6: {
      g.fillStyle = '#e3ebf2'; g.fillRect(x + 8, y + 14, T - 16, T - 14);
      g.fillStyle = '#9fd8ff';
      g.beginPath();
      g.moveTo(x + 12, y + 16); g.lineTo(x + T - 12, y + 16);
      g.quadraticCurveTo(x + T - 12, y, x + T / 2, y);
      g.quadraticCurveTo(x + 12, y, x + 12, y + 16);
      g.fill();
      g.fillStyle = '#5b6d84'; g.fillRect(x + 14, y + T - 12, T - 28, 5);
      break;
    }
    case 7: {
      g.fillStyle = '#8fa3b8'; g.fillRect(x, y, T, 10);
      g.fillStyle = '#6f8299';
      g.fillRect(x, y, T, 3);
      g.fillRect(x + 6, y + 10, 5, 6); g.fillRect(x + T - 11, y + 10, 5, 6);
      break;
    }
    case 13: {   /* ladder — office issue, safety-annotated */
      /* soft shadow so it reads against the pale wall */
      g.fillStyle = 'rgba(40,60,80,0.10)';
      g.fillRect(x + 13, y, 8, T); g.fillRect(x + T - 19, y, 8, T);
      /* rails */
      for (const rx of [11, T - 17]) {
        g.fillStyle = '#4f6472'; g.fillRect(x + rx, y - 2, 6, T + 4);
        g.fillStyle = '#7c93a3'; g.fillRect(x + rx + 1, y - 2, 2, T + 4);
      }
      /* rungs */
      for (let i = 0; i < 3; i++) {
        const ry = y + 6 + i * 16;
        g.fillStyle = '#8fa6b5'; g.fillRect(x + 14, ry, T - 28, 5);
        g.fillStyle = '#c3d4de'; g.fillRect(x + 14, ry, T - 28, 2);
      }
      break;
    }
  }
}

/* ---------------- parallax background ---------------- */
function drawBG(g) {
  const sg = g.createLinearGradient(0, 0, 0, VIEW_H);
  sg.addColorStop(0, PAL.skyTop); sg.addColorStop(1, PAL.skyBot);
  g.fillStyle = sg; g.fillRect(0, 0, VIEW_W, VIEW_H);
  /* sun */
  g.fillStyle = 'rgba(255,236,160,0.9)';
  g.beginPath(); g.arc(VIEW_W * 0.78, 110, 46, 0, TAU); g.fill();
  /* clouds */
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 5; i++) {
    const cx0 = ((i * 430 + 120 - camX * 0.08 - perf * 12) % (VIEW_W + 400) + VIEW_W + 400) % (VIEW_W + 400) - 200;
    const cy0 = 60 + (i % 3) * 55;
    g.beginPath();
    g.arc(cx0, cy0, 22, 0, TAU); g.arc(cx0 + 24, cy0 - 8, 17, 0, TAU); g.arc(cx0 + 46, cy0, 20, 0, TAU);
    g.fill();
  }
  drawSkyline(g, 0.18, '#9db4c8', 0.62);
  drawSkyline(g, 0.32, '#7e97ad', 0.78);
  /* interior wall */
  g.fillStyle = PAL.wall;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  /* windows */
  const spacing = 6.5 * T;
  const n0 = Math.floor(camX / spacing) - 1;
  for (let n = n0; n < n0 + Math.ceil(VIEW_W / spacing) + 2; n++) {
    const wx = n * spacing + 1.4 * T - camX;
    if (wx > VIEW_W + 60 || wx + 2.7 * T < -60) continue;
    drawWindow(g, wx, 1.05 * T, 2.7 * T, 3.5 * T, n);
  }
  /* wall seams */
  g.fillStyle = 'rgba(0,0,0,0.05)';
  const seam = 2 * T;
  const s0 = Math.floor(camX / seam);
  for (let n = s0; n < s0 + VIEW_W / seam + 2; n++) g.fillRect(n * seam - camX, 0, 3, VIEW_H);
  /* ceiling */
  g.fillStyle = PAL.ceil;
  g.fillRect(0, 0, VIEW_W, 0.62 * T);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  g.fillRect(0, 0.62 * T - 4, VIEW_W, 4);
  /* lights */
  const lsp = 3.2 * T;
  const l0 = Math.floor(camX / lsp);
  for (let n = l0; n < l0 + VIEW_W / lsp + 2; n++) {
    const lx = n * lsp + 0.5 * T - camX;
    const fl = hashN(n * 7.13) > 0.94 ? (Math.sin(perf * 31 + n) > 0 ? 1 : 0.35) : 1;
    g.fillStyle = '#cfd8df';
    g.fillRect(lx, 6, 56, 14);
    g.fillStyle = `rgba(255,250,225,${0.95 * fl})`;
    g.fillRect(lx + 4, 9, 48, 9);
    const gl = g.createLinearGradient(0, 20, 0, 240);
    gl.addColorStop(0, `rgba(255,248,215,${0.055 * fl})`);
    gl.addColorStop(1, 'rgba(255,248,215,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(lx + 6, 20); g.lineTo(lx + 50, 20);
    g.lineTo(lx + 78, 240); g.lineTo(lx - 22, 240);
    g.closePath(); g.fill();
  }
}
function drawSkyline(g, par, color, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  const off = camX * par;
  const bw = 90;
  const n0 = Math.floor(off / bw) - 1;
  for (let n = n0; n < n0 + VIEW_W / bw + 3; n++) {
    const bh = 120 + hashN(n * 3.7) * 240;
    const bx = n * bw - off;
    g.fillRect(bx, VIEW_H - bh, bw - 14, bh);
    if (hashN(n * 9.1) > 0.5) g.fillRect(bx + 18, VIEW_H - bh - 26, 12, 26);
  }
  g.restore();
}
function drawWindow(g, x, y, w, h, seed) {
  g.save();
  g.translate(x, y);
  const sg = g.createLinearGradient(0, 0, 0, h);
  sg.addColorStop(0, '#6cc3ff'); sg.addColorStop(1, '#eaf7ff');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath(); g.rect(0, 0, w, h); g.clip();
  g.fillStyle = 'rgba(125,150,172,0.85)';
  const off = camX * 0.25 + seed * 37;
  for (let i = 0; i < 7; i++) {
    const bh2 = 26 + hashN(seed * 5 + i * 2.3) * 52;
    g.fillRect(((i * 34 - off) % (w + 40) + w + 40) % (w + 40) - 20, h - bh2 - 14, 24, bh2);
  }
  g.fillStyle = '#c9dbe8';
  g.fillRect(0, h - 14, w, 14);
  g.restore();
  g.strokeStyle = '#f4f7fa'; g.lineWidth = 7;
  g.strokeRect(0, 0, w, h);
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2;
  g.strokeRect(-4, -4, w + 8, h + 8);
  g.fillStyle = '#dde5ec';
  g.fillRect(-7, h + 4, w + 14, 9);
  g.restore();
}

/* ---------------- shredders (animated, world coords) ---------------- */
function drawShredders(g) {
  for (let y = 0; y < lvl.h; y++) {
    for (let x = 0; x < lvl.w; x++) {
      if (lvl.grid[y][x] !== 8) continue;
      const sx = x * T, sy = y * T;
      const jammed = lvl.jams[x + '_' + y] > 0;
      /* proximity danger outline (skipped while jammed — silence = safe) */
      if (!jammed && player && state === 'play') {
        const dx = player.cx - (sx + T / 2), dy = (player.y + 22) - (sy + T / 2);
        if (dx * dx + dy * dy < 175 * 175) {
          g.strokeStyle = `rgba(255,23,68,${0.5 + Math.sin(perf * 12) * 0.3})`;
          g.lineWidth = 4;
          g.strokeRect(sx + 1, sy + 1, T - 2, T - 2);
        }
      }
      g.save();
      g.beginPath(); g.rect(sx, sy + 30, T, 18); g.clip();
      g.fillStyle = '#f2c500'; g.fillRect(sx, sy + 30, T, 18);
      g.fillStyle = '#222222';
      for (let i = -1; i < 5; i++) {
        g.save();
        g.translate(sx + i * 14, sy + 39); g.rotate(0.5);
        g.fillRect(0, -14, 7, 30);
        g.restore();
      }
      g.restore();
      g.fillStyle = '#1b1f26';
      g.fillRect(sx + 3, sy + 8, T - 6, 22);
      g.save();
      g.beginPath(); g.rect(sx + 4, sy + 9, T - 8, 20); g.clip();
      g.strokeStyle = '#aab6c2'; g.lineWidth = 5;
      const off = jammed ? 6 : (perf * 60) % 18;
      for (let i = -1; i < 5; i++) {
        g.beginPath();
        g.moveTo(sx + i * 18 + off, sy + 30);
        g.lineTo(sx + i * 18 + off + 12, sy + 8);
        g.stroke();
      }
      g.restore();
      g.fillStyle = jammed ? '#69f0ae' : (Math.sin(perf * 9) > 0 ? '#ff1744' : '#5e1017');
      g.fillRect(sx + T - 10, sy + 34, 5, 5);
      if (jammed) {   /* the culprit: one staple, wedged in the mouth */
        g.fillStyle = '#b0bec5';
        g.fillRect(sx + T / 2 - 6, sy + 26, 12, 3);
        g.fillRect(sx + T / 2 - 6, sy + 31, 12, 3);
        g.fillRect(sx + T / 2 - 6, sy + 26, 2, 8);
        g.fillRect(sx + T / 2 + 4, sy + 26, 2, 8);
      }
    }
  }
}

/* ---------------- characters ---------------- */
function text(g, str, x, y, size, color, align = 'center', outline = true) {
  g.font = `${size}px "Press Start 2P", monospace`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (outline) { g.fillStyle = 'rgba(10,14,22,0.85)'; g.fillText(str, x + 2, y + 2); }
  g.fillStyle = color;
  g.fillText(str, x, y);
}

function drawEmployee(g, fx, fy, face, ph, o = {}) {
  g.save();
  g.translate(fx, fy);
  g.scale(face * (o.sqX || 1), (o.sqY || 1));
  const legSw = o.moving ? Math.sin(ph) * 9 : (o.idleTap ? Math.sin(perf * 6) * 2.5 : 0);
  const armSw = o.moving ? -Math.sin(ph) * 0.35 : 0;
  const bob = o.moving ? Math.abs(Math.cos(ph)) * 2 : Math.sin(perf * 2) * 1;
  /* legs */
  g.fillStyle = o.pants || PAL.pants;
  g.fillRect(-9 + legSw * 0.5, -18, 7, 18 - Math.max(0, legSw * 0.35));
  g.fillRect(2 - legSw * 0.5, -18, 7, 18 - Math.max(0, -legSw * 0.35));
  g.fillStyle = '#263238';
  g.fillRect(-10 + legSw * 0.5, -4, 9, 4);
  g.fillRect(1 - legSw * 0.5, -4, 9, 4);
  if (o.skirt) {
    g.fillStyle = o.pants || PAL.pants;
    g.beginPath();
    g.moveTo(-11, -20); g.lineTo(11, -20); g.lineTo(14, -7 + Math.sin(ph) * (o.moving ? 1 : 0)); g.lineTo(-14, -7 - Math.sin(ph) * (o.moving ? 1 : 0));
    g.closePath(); g.fill();
  }
  /* torso */
  g.fillStyle = o.shirt || PAL.shirt;
  g.beginPath(); g.roundRect(-11, -34 - bob, 22, 18, 4); g.fill();
  /* tie */
  if (o.tie !== 'none') {
    g.fillStyle = o.tie || PAL.tie;
    g.beginPath();
    g.moveTo(-2, -33 - bob); g.lineTo(3, -33 - bob);
    g.lineTo(2 + Math.sin(ph * 1.3) * 1.5, -22 - bob);
    g.lineTo(-1, -22 - bob); g.closePath(); g.fill();
  } else if (o.lanyard) {
    g.strokeStyle = o.lanyard; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-6, -33 - bob); g.lineTo(0, -24 - bob); g.lineTo(6, -33 - bob); g.stroke();
    g.fillStyle = '#eceff1'; g.fillRect(-3, -25 - bob, 6, 7);
  }
  /* arm */
  g.fillStyle = o.shirt || PAL.shirt;
  g.save();
  g.translate(8, -31 - bob); g.rotate(armSw);
  g.fillRect(0, 0, 6, 13);
  g.fillStyle = o.skin || PAL.skin;
  g.fillRect(0, 12, 6, 4);
  g.restore();
  /* long hair: back silhouette BEFORE the head so strands frame the face
     instead of painting a band across the chin (the mystery-beard fix) */
  if (o.hairLong) {
    g.fillStyle = o.hair || PAL.hair;
    g.beginPath(); g.roundRect(-10.5, -51 - bob, 23, 24, 10); g.fill();
  }
  /* head */
  g.fillStyle = o.skin || PAL.skin;
  g.beginPath(); g.arc(1, -41 - bob, 9.5, 0, TAU); g.fill();
  /* hair */
  g.fillStyle = o.hair || PAL.hair;
  g.beginPath(); g.arc(0, -44 - bob, 9.5, Math.PI * 0.95, Math.PI * 1.98); g.fill();
  g.fillRect(-8.5, -45 - bob, 8, 4);
  if (o.bun) {
    g.beginPath(); g.arc(-2, -53 - bob, 5, 0, TAU); g.fill();
  }
  /* face */
  if (o.dizzy) {
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    g.fillText('@', 4, -38 - bob);
  } else {
    g.fillStyle = '#263238';
    if (o.blink) g.fillRect(3, -42 - bob, 5, 1.6);
    else {
      g.fillRect(4, -43 - bob, 2.6, 3.4);
      if (!o.bigHead) g.fillRect(8, -43 - bob, 2.2, 3.4);
    }
  }
  if (o.shades) {
    g.fillStyle = '#101318';
    g.fillRect(-1, -44 - bob, 12, 4);
    g.strokeStyle = '#101318'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-4, -43.5 - bob); g.lineTo(-1, -43 - bob); g.stroke();
  }
  if (o.glasses) {
    g.strokeStyle = '#263238'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(4.5, -42 - bob, 3.4, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-2, -42.5 - bob); g.lineTo(1.5, -42.4 - bob); g.stroke();
  }
  if (o.angry) {
    g.strokeStyle = '#263238'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -47 - bob); g.lineTo(7, -44.5 - bob); g.stroke();
  }
  if (o.mouthOpen) {
    g.fillStyle = '#7d4038';
    g.beginPath(); g.arc(5, -36.5 - bob, 2.4, 0, TAU); g.fill();
  }
  g.restore();
}

function drawPlayer(g) {
  const p = player;
  if (p.invuln > 0) {
    /* flicker between ghosted and solid instead of vanishing */
    g.globalAlpha = Math.floor(p.invuln * 14) % 2 === 0 ? 0.35 : 1;
  }
  if (p.boost > 0) {
    g.save();
    g.globalAlpha *= 0.22 + Math.sin(perf * 14) * 0.08;
    g.fillStyle = '#ffb300';
    g.beginPath(); g.ellipse(p.cx, p.y + p.h / 2, 27, 33, 0, 0, TAU); g.fill();
    g.restore();
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) g.globalAlpha = 0.35;
  }
  drawEmployee(g, p.cx, p.y + p.h, p.face, p.ph, Object.assign({
    sqX: p.sqX, sqY: p.sqY,
    moving: p.grounded && Math.abs(p.vx) > 60,
    idleTap: p.grounded && Math.abs(p.vx) < 20 && p.idleT > 3,
    blink: p.blinkT < 0,
  }, avatarOpts()));
  g.globalAlpha = 1;
}
function drawGhost(g, gh) {
  const a = gh.t / 0.25 * 0.35;
  g.save();
  g.globalAlpha = Math.max(0, a);
  g.fillStyle = player.boost > 0 ? '#ffb300' : '#82b1ff';
  g.beginPath(); g.roundRect(gh.x + 4, gh.y + 10, 22, 26, 5); g.fill();
  g.beginPath(); g.arc(gh.x + 16, gh.y + 8, 9, 0, TAU); g.fill();
  g.restore();
}
function drawManager(g, m) {
  if (m.dead) return;
  const cx = m.x + m.w / 2;
  if (m.squashed > 0) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - m.squashed / 0.55);
    g.translate(cx, m.y + m.h);
    g.scale(1.45, 0.26);
    g.translate(-cx, -(m.y + m.h));
    drawEmployee(g, cx, m.y + m.h, m.face, m.ph, { shirt: PAL.suit, pants: PAL.suitD, tie: '#c62828', hair: '#787878', angry: true });
    g.restore();
    return;
  }
  drawEmployee(g, cx, m.y + m.h, m.face, m.ph, {
    shirt: PAL.suit, pants: PAL.suitD, tie: '#c62828',
    hair: '#787878', angry: true, mouthOpen: m.chase,
    moving: true,
  });
  if (m.chase) {
    text(g, '!', cx, m.y - 12 + Math.sin(perf * 10) * 2, 16, '#ff5252');
  }
}
function drawIntern(g, n) {
  if (n.dead) return;
  const cx = n.cx;
  if (n.squashed > 0) {
    g.save();
    g.globalAlpha = Math.max(0, 1 - n.squashed / 0.55);
    g.translate(cx, n.y + n.h);
    g.scale(1.4, 0.26);
    drawEmployee(g, cx - cx * 0 + 0, 0, n.face, n.ph, { shirt: '#26a69a', pants: '#00695c', tie: '#ffd740', hair: '#3e2723' });
    g.restore();
    return;
  }
  g.save();
  g.translate(cx, n.y + n.h);
  g.scale(0.8, 0.8);
  drawEmployee(g, 0, 0, n.face, n.ph, {
    shirt: '#26a69a', pants: '#00695c', tie: '#ffd740', hair: '#3e2723',
    moving: true, mouthOpen: n.fleeing,
  });
  g.restore();
  if (n.fleeing) text(g, '?!', cx, n.y - 10, 12, '#4dd0e1');
}
function drawDrone(g, d) {
  if (d.dead) return;
  const cx = d.cx;
  /* surveillance balloon */
  g.fillStyle = '#eceff1';
  g.beginPath(); g.ellipse(cx, d.y - 4, 13, 16, Math.sin(d.t * 2) * 0.08, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.ellipse(cx - 4, d.y - 9, 4, 6, -0.4, 0, TAU); g.fill();
  /* glasses */
  g.fillStyle = '#37474f';
  g.fillRect(cx - 8, d.y - 6, 6, 5); g.fillRect(cx + 2, d.y - 6, 6, 5); g.fillRect(cx - 2, d.y - 4, 4, 1.5);
  g.fillStyle = '#ef9a9a';
  g.fillRect(cx - 7, d.y - 5, 2, 2); g.fillRect(cx + 3, d.y - 5, 2, 2);
  /* string + tiny HR body */
  g.strokeStyle = '#90a4ae'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx, d.y + 11); g.lineTo(cx, d.y + 15); g.stroke();
  g.fillStyle = '#7e57c2';
  g.beginPath(); g.roundRect(cx - 9, d.y + 14, 18, 13, 4); g.fill();
  g.fillStyle = '#b39ddb';
  g.fillRect(cx - 9, d.y + 17, 18, 3);
}
function drawPlane(g, pl) {
  g.save();
  g.translate(pl.x, pl.y);
  if ((pl.vx || 0) < 0) g.scale(-1, 1);   /* nose leads the flight direction */
  if (pl.crumple > 0) g.rotate(pl.rot);
  else g.rotate(Math.cos(pl.t * 3 + pl.ph) * 0.22);
  g.fillStyle = '#fafafa';
  g.beginPath();
  g.moveTo(-22, 8); g.lineTo(20, 0); g.lineTo(-22, -8); g.lineTo(-14, 0); g.closePath();
  g.fill();
  g.strokeStyle = '#b0bec5'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-22, 0); g.lineTo(20, 0); g.stroke();
  g.fillStyle = '#e3f2fd';
  g.beginPath(); g.moveTo(-22, 8); g.lineTo(-6, 2); g.lineTo(-22, -2); g.closePath(); g.fill();
  g.restore();
}

function drawStaples(g) {
  for (const s of lvl.staples) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(Math.sin(s.t * 26) * 0.22);
    g.fillStyle = '#78909c';
    g.fillRect(-7, -3, 14, 3);
    g.fillRect(-6, -1, 2.5, 6);
    g.fillRect(3.5, -1, 2.5, 6);
    g.fillStyle = '#cfd8dc';
    g.fillRect(-7, -3, 14, 1);
    g.restore();
  }
}
function drawPickup(g, pk) {
  if (pk.taken) return;
  const bob = Math.sin(perf * 3 + pk.ph) * 4;
  g.save();
  g.translate(pk.x + 15, pk.y + 16 + bob);
  if (pk.kind === 'coffee') {
    g.fillStyle = PAL.foam;
    g.beginPath(); g.roundRect(-11, -8, 22, 20, 4); g.fill();
    g.fillStyle = PAL.coffee;
    g.beginPath(); g.roundRect(-11, -8, 22, 7, 3); g.fill();
    g.strokeStyle = PAL.foam; g.lineWidth = 3.5;
    g.beginPath(); g.arc(13, 2, 6, -1.2, 1.2); g.stroke();
    if (Math.random() < 0.05) steam(pk.x + 15, pk.y + 16 + bob);
  } else if (pk.kind === 'donut') {
    g.rotate(Math.sin(perf * 2 + pk.ph) * 0.1);
    g.fillStyle = '#d4a373';
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill();
    g.fillStyle = '#f48fb1';
    g.beginPath(); g.arc(0, -2, 11, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + pk.ph;
      g.fillStyle = ['#fff59d', '#b39ddb', '#80cbc4', '#ffe57f'][i % 4];
      g.fillRect(Math.cos(a) * 7 - 1.5, -2 + Math.sin(a) * 7 - 1.5, 3, 2);
    }
    g.fillStyle = '#8d5524';
    g.beginPath(); g.arc(0, -2, 4.5, 0, TAU); g.fill();
  } else if (pk.kind === 'stapler') {
    /* attention beam pulling the eye to the desk */
    const pulse = 0.10 + Math.sin(perf * 5 + pk.ph) * 0.06;
    g.fillStyle = `rgba(105,240,174,${pulse})`;
    g.fillRect(-20, -170, 40, 168);
    g.rotate(Math.sin(perf * 2.4 + pk.ph) * 0.1);
    /* the trusty red stapler, waiting on the desk */
    g.fillStyle = '#c62828';
    g.beginPath(); g.roundRect(-14, -8, 28, 13, 3); g.fill();
    g.fillStyle = '#b71c1c';
    g.beginPath(); g.roundRect(-14, -12, 28, 7, 3); g.fill();
    g.fillStyle = '#eceff1';
    g.fillRect(-11, -6, 22, 3);
    g.fillStyle = '#90a4ae';
    g.beginPath(); g.arc(-9, 5.5, 2.2, 0, TAU); g.arc(9, 5.5, 2.2, 0, TAU); g.fill();
    /* periodic glint so it reads as valuable */
    if (Math.sin(perf * 3 + pk.ph) > 0.92) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(2, -16); g.lineTo(10, -24); g.stroke();
    }
  } else if (pk.kind === 'key') {
    g.rotate(Math.sin(perf * 3 + pk.ph) * 0.12);
    g.fillStyle = '#42a5f5';
    g.beginPath(); g.roundRect(-13, -9, 26, 18, 3); g.fill();
    g.fillStyle = '#e3f2fd';
    g.fillRect(-13, -4, 26, 4);
    g.fillStyle = '#bbdefb';
    g.fillRect(-9, 3, 12, 3);
    g.fillStyle = '#1565c0';
    g.beginPath(); g.arc(-8, -1.5, 2.5, 0, TAU); g.fill();
  } else if (pk.kind === 'pager') {
    g.rotate(Math.sin(perf * 6 + pk.ph) * 0.08);
    g.fillStyle = '#c62828';
    g.beginPath(); g.roundRect(-10, -7, 20, 15, 3); g.fill();
    g.strokeStyle = '#8e0000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(4, -7); g.lineTo(9, -14); g.stroke();
    g.fillStyle = Math.sin(perf * 10) > 0 ? '#ff8a80' : '#5e1017';
    g.fillRect(-6, -2, 12, 4);
    g.fillStyle = '#ffcdd2';
    g.fillRect(-6, 3, 8, 2);
  } else {
    g.rotate(Math.sin(perf * 2 + pk.ph) * 0.08);
    /* jira-style ticket */
    g.fillStyle = '#42a5f5';
    g.beginPath(); g.roundRect(-14, -10, 28, 21, 3); g.fill();
    g.fillStyle = '#e3f2fd';
    g.fillRect(-14, -10, 6, 21);
    g.fillStyle = '#bbdefb';
    g.fillRect(-5, -5, 15, 3);
    g.fillRect(-5, 0, 15, 3);
    g.fillRect(-5, 5, 10, 3);
  }
  g.restore();
}
function drawPlat(g, pl) {
  g.fillStyle = '#78909c';
  g.beginPath(); g.roundRect(pl.x, pl.y, pl.w, pl.h, 4); g.fill();
  g.fillStyle = '#b0bec5';
  g.fillRect(pl.x + 3, pl.y + 2, pl.w - 6, 4);
  g.fillStyle = '#ffb300';
  g.fillRect(pl.x + 8, pl.y + pl.h - 4, 8, 3);
  g.fillRect(pl.x + pl.w - 16, pl.y + pl.h - 4, 8, 3);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.font = 'bold 12px monospace';
  g.fillText(pl.axis === 'v' ? '~' : '~', pl.x + pl.w / 2 - 4, pl.y - 5);
}
function drawSpring(g, sp) {
  const comp = sp.t > 0 ? Math.sin((sp.t / 0.3) * Math.PI) * 10 : 0;
  g.save();
  /* swivel chair */
  g.fillStyle = '#455a64';
  g.beginPath(); g.roundRect(sp.x + 1, sp.y - 6 + comp * 0.4, 9, 20, 3); g.fill();
  g.fillStyle = '#37474f';
  g.beginPath(); g.roundRect(sp.x + 3, sp.y + 8 + comp, sp.w - 6, 12, 4); g.fill();
  g.fillStyle = '#546e7a';
  g.fillRect(sp.x + sp.w / 2 - 4, sp.y + 18 + comp * 0.5, 8, Math.max(2, sp.h - 20 - comp));
  g.fillStyle = '#263238';
  g.fillRect(sp.x + 5, sp.y + sp.h - 4, sp.w - 10, 4);
  if (comp > 0) {
    g.strokeStyle = '#ffb300'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sp.x + sp.w / 2 - 6, sp.y + sp.h - 5); g.lineTo(sp.x + sp.w / 2 + 6, sp.y + 14); g.stroke();
  }
  g.restore();
}
function drawBelts(g) {
  for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) {
    const c = lvl.grid[y][x];
    if (c !== 9 && c !== 10) continue;
    const sx = x * T, sy = y * T, dir = c === 9 ? 1 : -1;
    g.fillStyle = '#1c2128'; g.fillRect(sx, sy + 12, T, T - 12);
    g.fillStyle = '#333a44'; g.fillRect(sx, sy, T, 12);
    g.fillStyle = '#454e59'; g.fillRect(sx, sy, T, 3);
    g.save();
    g.beginPath(); g.rect(sx, sy + 3.5, T, 8); g.clip();
    g.strokeStyle = '#ffb300'; g.lineWidth = 2.5;
    const off = ((perf * 90 * dir) % 18 + 18) % 18;
    for (let i = -1; i < 4; i++) {
      const bx = sx + i * 18 + (dir > 0 ? off : 18 - off);
      g.beginPath();
      g.moveTo(bx - dir * 4, sy + 4.5); g.lineTo(bx + dir * 3, sy + 8); g.lineTo(bx - dir * 4, sy + 11.5);
      g.stroke();
    }
    g.restore();
  }
}
function drawGates(g) {
  if (!lvl.gates.length || lvl.gateAnim >= 1) return;
  const a = lvl.gateAnim > 0 ? clamp(1 - lvl.gateAnim, 0, 1) : 1;
  for (const gt of lvl.gates) {
    const sx = gt.tx * T, sy = gt.ty * T;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = '#263238';
    g.fillRect(sx + 4, sy, T - 8, T);
    g.fillStyle = '#37474f';
    for (let i = 0; i < 3; i++) g.fillRect(sx + 8, sy + 6 + i * 14, T - 16, 8);
    const led = lvl.hasKey ? '#69f0ae' : (Math.sin(perf * 6) > 0 ? '#ff1744' : '#5e1017');
    g.fillStyle = led;
    g.fillRect(sx + T / 2 - 3, sy + T - 12, 6, 6);
    g.restore();
  }
}
function drawCheckpoint(g, ck) {
  const x = ck.x, y = ck.y;
  g.fillStyle = '#78909c';
  g.fillRect(x - 3, y - 64, 6, 64);
  g.fillStyle = ck.active ? '#43d17c' : '#546e7a';
  g.beginPath(); g.roundRect(x - 16, y - 98, 32, 34, 5); g.fill();
  g.fillStyle = '#10241a';
  g.beginPath(); g.arc(x, y - 81, 9, 0, TAU); g.fill();
  g.strokeStyle = ck.active ? '#7cf7b0' : '#90a4ae';
  g.lineWidth = 2;
  g.beginPath();
  const aa = ck.active ? perf * 5 : -Math.PI / 2;
  g.moveTo(x, y - 81);
  g.lineTo(x + Math.cos(aa) * 6, y - 81 + Math.sin(aa) * 6);
  g.stroke();
  if (ck.active) {
    g.fillStyle = `rgba(105,240,174,${0.22 + Math.sin(perf * 5) * 0.1})`;
    g.beginPath(); g.arc(x, y - 81, 24 + Math.sin(perf * 5) * 3, 0, TAU); g.fill();
  }
}
function drawDoor(g, d) {
  const on = !d.locked;
  if (on) {
    g.save();
    g.globalAlpha = 0.15 + Math.sin(perf * 4) * 0.06;
    g.fillStyle = PAL.exitG;
    g.beginPath();
    g.moveTo(d.x, d.y); g.lineTo(d.x + d.w, d.y);
    g.lineTo(d.x + d.w + 46, d.y - 130); g.lineTo(d.x - 46, d.y - 130);
    g.closePath(); g.fill();
    g.restore();
  }
  g.fillStyle = '#37474f';
  g.beginPath(); g.roundRect(d.x - 6, d.y - 8, d.w + 12, d.h + 8, 6); g.fill();
  g.fillStyle = on ? '#2e5741' : '#5d4037';
  g.fillRect(d.x, d.y, d.w, d.h);
  g.fillStyle = on ? 'rgba(129,230,167,0.35)' : 'rgba(255,205,120,0.25)';
  g.fillRect(d.x + 8, d.y + 10, d.w / 2 - 12, 44);
  g.fillRect(d.x + d.w / 2 + 4, d.y + 10, d.w / 2 - 12, 44);
  g.fillStyle = '#cfd8dc';
  g.fillRect(d.x + d.w / 2 - 10, d.y + 52, 6, 14);
  g.fillRect(d.x + d.w / 2 + 4, d.y + 52, 6, 14);
  g.fillStyle = '#10241a';
  g.beginPath(); g.roundRect(d.x + 6, d.y - 30, d.w - 12, 20, 4); g.fill();
  text(g, on ? 'EXIT' : 'LOCKED', d.x + d.w / 2, d.y - 19, 10, on ? PAL.exitG : '#ef5350');
}
function drawBoss(g) {
  const b = boss;
  if (!b) return;
  g.save();
  if (b.dead) {
    g.globalAlpha = Math.max(0, 1 - b.dying * 0.3);
    g.translate(b.cx, b.y + b.h);
    g.rotate(Math.min(1.5, b.rot));
    g.translate(-b.cx, -(b.y + b.h));
  }
  if (b.jitter) g.translate(rand(-3, 3), 0);
  const flash = b.invuln > 0 && Math.floor(b.invuln * 20) % 2 === 0;
  g.save();
  g.translate(b.cx, b.y + b.h);
  g.scale(b.face * 2.35, 2.35);
  drawEmployee(g, 0, 0, 1, b.ph, {
    shirt: flash ? '#ffffff' : PAL.ceoSuit, pants: '#23232f', tie: PAL.gold,
    hair: '#3a3a44', skin: '#f2c19a',
    moving: Math.abs(b.vx) > 40, angry: true,
    mouthOpen: b.st === 'tele' || b.st === 'leap',
    dizzy: b.st === 'stun' || b.st === 'pants',
    bigHead: true,
  });
  g.restore();
  if (!b.dead) {
    g.fillStyle = '#111111';
    const hx = b.cx + b.face * 3;
    g.fillRect(hx - 13, b.y + 30, 24, 8);
    g.fillRect(hx + 13, b.y + 31, 9, 6);
  }
  if ((b.st === 'stun' || b.st === 'pants') && !b.dead) {
    for (let i = 0; i < 3; i++) {
      const a = perf * 4 + i * TAU / 3;
      text(g, '*', b.cx + Math.cos(a) * 36, b.y - 12 + Math.sin(a) * 9, 14, '#ffd740');
    }
    /* vulnerability countdown: how long the window stays open */
    const bw = 120, frac = clamp(b.t / (b.vulnDur || 1), 0, 1);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.roundRect(b.cx - bw / 2 - 3, b.y - 34, bw + 6, 12, 5); g.fill();
    g.fillStyle = frac > 0.35 ? '#69f0ae' : '#ff8a80';
    g.fillRect(b.cx - bw / 2, b.y - 31, bw * frac, 6);
  }
  if (b.taunt && !b.dead) {
    const ta = clamp(b.taunt.t / 0.3, 0, 1);
    g.save();
    g.globalAlpha = Math.min(1, ta);
    const tw = Math.max(150, b.taunt.text.length * 11 + 30);
    g.fillStyle = 'rgba(20,10,10,0.88)';
    g.beginPath(); g.roundRect(b.cx - tw / 2, b.y - 66, tw, 28, 6); g.fill();
    g.strokeStyle = '#ff5252'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(b.cx - tw / 2, b.y - 66, tw, 28, 6); g.stroke();
    text(g, b.taunt.text, b.cx, b.y - 52, 10, '#ff8a80');
    g.restore();
  }
  g.restore();
}
function drawProjectiles(g) {
  const b = boss;
  if (!b) return;
  for (const s of b.staplers) {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.rot);
    g.fillStyle = '#90a4ae';
    g.beginPath(); g.roundRect(-13, -5, 26, 10, 3); g.fill();
    g.fillStyle = '#ff7043';
    g.fillRect(6, -3, 6, 6);
    g.restore();
  }
  for (const w of b.waves) {
    const hh = w.h * (0.8 + Math.sin(w.t * 22) * 0.2);
    g.fillStyle = 'rgba(255,171,64,0.88)';
    g.beginPath();
    g.moveTo(w.x, w.y + w.h);
    g.lineTo(w.x + w.w / 2, w.y + w.h - hh);
    g.lineTo(w.x + w.w, w.y + w.h);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(w.x + w.w / 2 - 2, w.y + w.h - hh * 0.6, 4, hh * 0.5);
  }
}
function drawParticles(g, screenPass) {
  for (const q of parts) {
    if (!!q.screen !== screenPass) continue;
    const a = clamp(1 - q.t / q.life, 0, 1);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = q.color;
    if (q.shape === 'circle') {
      g.beginPath(); g.arc(q.x, q.y, q.size * (0.6 + a * 0.4), 0, TAU); g.fill();
    } else if (q.shape === 'star') {
      g.translate(q.x, q.y);
      g.font = `${q.size * 3}px monospace`;
      g.fillText('+', -q.size, q.size);
    } else if (q.shape === 'paper') {
      g.translate(q.x, q.y); g.rotate(q.rot);
      g.fillRect(-q.size, -q.size / 2, q.size * 2, q.size);
    } else {
      g.translate(q.x, q.y); g.rotate(q.rot || 0);
      g.fillRect(-q.size / 2, -q.size / 2, q.size, q.size);
    }
    g.restore();
  }
}
function drawPops(g) {
  for (const q of pops) {
    const a = clamp(1 - q.t / q.life, 0, 1);
    g.save();
    g.globalAlpha = a;
    text(g, q.text, q.x, q.y, q.size, q.color);
    g.restore();
  }
}

/* ---------------- HUD & overlays ---------------- */
/* ---------------- contextual first-run hints (teach at point of use) ---------------- */
const HINTS_KEY = 'tdg_hints_v1';
let hintsSeen = {};
try { hintsSeen = JSON.parse(localStorage.getItem(HINTS_KEY) || '{}'); } catch (e) {}
const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches;
const HINT_DUR = 4.4;
const HINT_DEFS = [
  { id: 'move', x0: 0, x1: 27 * T,
    msg: COARSE ? '\u25C0 \u25B6 RUN \u00b7 TAP JUMP TWICE = DOUBLE-JUMP'
                : '\u2190\u2192 RUN \u00b7 SPACE JUMP x2 \u00b7 SHIFT DASH' },
  { id: 'ladder', x0: 18 * T, x1: 28 * T,
    msg: COARSE ? 'HOLD JUMP AT LADDERS TO CLIMB'
                : 'HOLD \u2191 AT LADDERS TO CLIMB \u00b7 \u2193 DESCEND' },
  { id: 'stapler', x0: 33 * T, x1: 42 * T,
    msg: COARSE ? 'TAP \ud83d\udcce TO STAPLE \u00b7 MANAGERS TAKE TWO'
                : 'F FIRES STAPLES \u00b7 MANAGERS TAKE TWO' },
];
let curHint = null;   // {id, msg, t} — one at a time, fades after ~4s
function updateHints(dt) {
  if (curHint) {
    curHint.t += dt;
    if (curHint.t > HINT_DUR) { markHintSeen(curHint.id); curHint = null; }
    return;
  }
  if (state !== 'play' || curLevel !== 0 || !player) return;
  for (const h of HINT_DEFS) {
    if (!hintsSeen[h.id] && player.cx > h.x0 && player.cx < h.x1) {
      curHint = { id: h.id, msg: h.msg, t: 0 };
      break;                                   // progressive: one concept at a time
    }
  }
}
function markHintSeen(id) {
  hintsSeen[id] = true;
  try { localStorage.setItem(HINTS_KEY, JSON.stringify(hintsSeen)); } catch (e) {}
}
function drawHints(g) {
  if (!curHint || state !== 'play') return;
  const a = clamp(curHint.t / 0.35, 0, 1) * clamp((HINT_DUR - curHint.t) / 0.5, 0, 1);
  const size = COARSE ? 9 : 10;
  g.font = `${size}px "Press Start 2P", monospace`;
  const tw = g.measureText(curHint.msg).width;
  const bw = tw + 44, bh = 34, bx = VIEW_W / 2 - bw / 2, by = 64;
  g.save();
  g.globalAlpha = a * 0.94;
  g.fillStyle = 'rgba(13,20,32,0.88)';
  g.beginPath(); g.roundRect(bx, by, bw, bh, 8); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.stroke();
  text(g, curHint.msg, VIEW_W / 2, by + bh / 2 + 1, size, '#ffe082', 'center', false);
  g.restore();
}
function resetHints() {
  hintsSeen = {};
  try { localStorage.removeItem(HINTS_KEY); } catch (e) {}
  curHint = null;
}
function drawChallengeTarget(g) {
  if (!challenge || challenge.beaten || state !== 'play') return;
  text(g, 'TARGET ' + challenge.name + ' \u00B7 ' + challenge.score, VIEW_W / 2, 108, 9,
       totals.score >= challenge.score * 0.8 ? '#ffd54f' : 'rgba(255,138,128,0.85)');
}

function drawMug(g, x, y, full) {
  g.save();
  g.translate(x, y);
  if (full) {
    g.fillStyle = PAL.foam;
    g.beginPath(); g.roundRect(-9, -7, 18, 16, 3); g.fill();
    g.fillStyle = PAL.coffee;
    g.beginPath(); g.roundRect(-9, -7, 18, 5, 2); g.fill();
    g.strokeStyle = PAL.foam; g.lineWidth = 3;
    g.beginPath(); g.arc(11, 1, 5, -1.2, 1.2); g.stroke();
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(-9, -7, 18, 16, 3); g.stroke();
  }
  g.restore();
}
function drawHUD(g) {
  text(g, 'MORALE', 28, 28, 10, 'rgba(255,255,255,0.75)', 'left');
  for (let i = 0; i < KIT().maxHearts; i++) drawMug(g, 38 + i * 36, 54, i < player.hearts);
  if (player.boost > 0) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(24, 74, 104, 10);
    g.fillStyle = '#ffb300';
    g.fillRect(26, 76, 100 * (player.boost / BOOST_T), 6);
  }
  text(g, 'SHAREHOLDER VALUE', VIEW_W - 28, 28, 10, 'rgba(255,255,255,0.75)', 'right');
  text(g, String(totals.score).padStart(6, '0'), VIEW_W - 28, 52, 15, '#fff', 'right');
  if (bestScore > 0) text(g, 'BEST ' + bestScore, VIEW_W - 28, 76, 9, 'rgba(255,255,255,0.5)', 'right');

  /* combo meter */
  if (comboN >= 2 && comboT > 0) {
    const cw = 170, cxp = VIEW_W / 2 - cw / 2;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.roundRect(cxp, 18, cw, 34, 8); g.fill();
    const pul = 1 + Math.max(0, comboPopT) * 0.5;
    g.save();
    g.translate(VIEW_W / 2, 33); g.scale(pul, pul);
    text(g, 'COMBO x' + multLabel(), 0, 0, 13, '#ffd740');
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(cxp + 12, 44, cw - 24, 4);
    g.fillStyle = '#ffd740'; g.fillRect(cxp + 12, 44, (cw - 24) * clamp(comboT / COMBO_T, 0, 1), 4);
  }

  if (boss && !boss.dead && bossIntroT <= 0 && state !== 'clear') {
    const bw = 420, bx = VIEW_W / 2 - bw / 2, by = VIEW_H - 48;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.roundRect(bx - 4, by - 4, bw + 8, 26, 6); g.fill();
    g.fillStyle = '#3a1c1c';
    g.fillRect(bx, by, bw, 18);
    const frac = clamp(boss.hp / 3, 0, 1);
    g.fillStyle = '#ff5252';
    g.fillRect(bx, by, bw * frac, 18);
    g.fillStyle = '#ffcdd2';
    g.fillRect(bx, by, bw * frac, 5);
    text(g, 'EGO', VIEW_W / 2, by - 14, 10, '#ffcdd2');
  }
}
function drawBannerFx(g, dt) {
  if (!banner) return;
  banner.t += dt;
  if (banner.t > banner.dur + 0.5) { banner = null; return; }
  const t = banner.t;
  const a = t < 0.25 ? t / 0.25 : t > banner.dur ? clamp(1 - (t - banner.dur) / 0.5, 0, 1) : 1;
  g.save();
  g.globalAlpha = a;
  g.fillStyle = 'rgba(13,18,28,0.55)';
  g.fillRect(0, VIEW_H * 0.3, VIEW_W, 156);
  g.fillStyle = '#ffd54f';
  g.fillRect(0, VIEW_H * 0.3, VIEW_W, 3);
  g.fillRect(0, VIEW_H * 0.3 + 153, VIEW_W, 3);
  text(g, banner.main, VIEW_W / 2, VIEW_H * 0.3 + 44, 34, '#ffd54f');
  text(g, banner.sub, VIEW_W / 2, VIEW_H * 0.3 + 92, 15, '#fff');
  text(g, banner.sub2, VIEW_W / 2, VIEW_H * 0.3 + 122, 10, 'rgba(255,255,255,0.72)');
  g.restore();
}
function drawStaffSelect(g) {
  g.fillStyle = 'rgba(8,10,16,0.86)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  text(g, "WHO'S QUITTING TODAY?", VIEW_W / 2, 92, 30, '#ffd54f');
  text(g, 'PICK YOUR STAFF — EVERYONE PLAYS DIFFERENT', VIEW_W / 2, 134, 11, 'rgba(207,227,255,0.75)');

  const CW = 262, GAP = 22, X0 = (VIEW_W - (CW * 4 + GAP * 3)) / 2, Y0 = 168, CH = 380;
  for (let i = 0; i < AVATARS.length; i++) {
    const A = AVATARS[i], sel = i === avatarIdx;
    const x = X0 + i * (CW + GAP), y = Y0 + (sel ? -6 : 0);
    /* card */
    g.fillStyle = sel ? 'rgba(28,36,52,0.96)' : 'rgba(18,24,34,0.88)';
    g.beginPath(); g.roundRect(x, y, CW, CH, 14); g.fill();
    g.strokeStyle = sel ? A.tint : 'rgba(255,255,255,0.16)';
    g.lineWidth = sel ? 4 : 2;
    g.beginPath(); g.roundRect(x, y, CW, CH, 14); g.stroke();
    /* single focal cue: chevron above the selected card */
    if (sel && Math.sin(perf * 5) > -0.2) {
      g.fillStyle = '#69f0ae';
      g.beginPath();
      g.moveTo(x + CW / 2 - 12, y - 24); g.lineTo(x + CW / 2 + 12, y - 24); g.lineTo(x + CW / 2, y - 8);
      g.closePath(); g.fill();
    }
    /* portrait */
    g.save();
    g.translate(x + CW / 2, y + 148);
    g.scale(1.9, 1.9);
    drawEmployee(g, 0, 0, 1, perf * 9 + i * 1.7, Object.assign({ moving: true }, A.opts));
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.ellipse(x + CW / 2, y + 152, 44, 9, 0, 0, TAU); g.fill();
    const parts = A.name.split(' · ');
    text(g, parts[0], x + CW / 2, y + 198, 13, A.tint);
    if (parts[1]) text(g, parts[1], x + CW / 2, y + 222, 8, 'rgba(207,227,255,0.6)');
    /* kit rows: colored glyph carries the meaning — legend lives at screen bottom, once */
    text(g, '\u25B2', x + 30, y + 258, 9, '#69f0ae');
    text(g, A.card.perk, x + 48, y + 258, 8, 'rgba(255,255,255,0.92)', 'left');
    text(g, '\u25B2', x + 30, y + 282, 9, '#82b1ff');
    text(g, A.card.world, x + 48, y + 282, 8, 'rgba(255,255,255,0.92)', 'left');
    text(g, '\u25B2', x + 30, y + 306, 9, '#ff8a80');
    text(g, A.card.ouch, x + 48, y + 306, 8, 'rgba(255,255,255,0.92)', 'left');
  }
  text(g, 'GREEN PERK · BLUE WORLD · RED OUCH', VIEW_W / 2, Y0 + CH + 36, 8, 'rgba(207,227,255,0.45)');
  if (Math.sin(perf * 4) > -0.3) text(g, 'ENTER / TAP SELECTED CARD TO SIGN', VIEW_W / 2, VIEW_H - 76, 10, '#69f0ae');
  text(g, '< > BROWSE · ESC BACK · F11 FULLSCREEN', VIEW_W / 2, VIEW_H - 42, 10, 'rgba(207,227,255,0.7)');
}
/* jetpack-joyride-style punch-in card: one beat, one name, skippable */
const INTRO_QUOTES = [
  'FIRST DAY. HOPE IN EVERY POCKET.',
  'FILED 47 BUGS BEFORE 9 AM.',
  'CRUSHED Q3. AND THE COPIER.',
  'HERE TO HELP. ALLEGEDLY.',
];
function drawCharIntro(g) {
  const t = 4.2 - charIntro;
  const a = clamp(t / 0.25, 0, 1);
  g.save();
  g.fillStyle = `rgba(8,10,16,${0.92 * a})`;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.globalAlpha = a;
  /* big runner, feet anchored */
  g.save();
  g.translate(VIEW_W * 0.30, VIEW_H * 0.66);
  g.scale(2.5, 2.5);
  drawEmployee(g, 0, 0, 1, perf * 13, Object.assign({ moving: true }, avatarOpts()));
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.ellipse(VIEW_W * 0.30, VIEW_H * 0.66 + 8, 58, 11, 0, 0, TAU); g.fill();
  /* name plate */
  const nx = VIEW_W * 0.52;
  text(g, empName(), nx, VIEW_H * 0.36, 46, '#ffd54f');
  text(g, AVATARS[avatarIdx].name.split(' \u00B7 ')[1] || AVATARS[avatarIdx].name, nx, VIEW_H * 0.445, 13, AVATARS[avatarIdx].tint);
  text(g, '\u201C' + INTRO_QUOTES[avatarIdx] + '\u201D', nx, VIEW_H * 0.53, 11, 'rgba(255,255,255,0.8)');
  text(g, AVATARS[avatarIdx].blurb, nx, VIEW_H * 0.60, 8, AVATARS[avatarIdx].tint);
  /* progress + skip hint */
  const p = clamp(t / 4.2, 0, 1);
  g.fillStyle = 'rgba(255,255,255,0.15)';
  g.fillRect(nx - 150, VIEW_H * 0.68, 300, 6);
  g.fillStyle = '#69f0ae';
  g.fillRect(nx - 150, VIEW_H * 0.68, 300 * p, 6);
  if (Math.sin(perf * 4) > -0.3) text(g, 'ANY KEY TO START', nx, VIEW_H * 0.77, 9, 'rgba(207,227,255,0.7)');
  g.restore();
}
function drawTitle(g) {
  g.fillStyle = 'rgba(10,14,24,0.62)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (Math.random() < 0.04) titlePaper();
  const title = 'THE DAILY GRIND';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  let totalW = 0;
  g.font = '50px "Press Start 2P", monospace';
  for (const ch of title) totalW += g.measureText(ch).width;
  let lx = VIEW_W / 2 - totalW / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i];
    g.font = '50px "Press Start 2P", monospace';
    const cw = g.measureText(ch).width;
    const yy = 165 + Math.sin(perf * 2.2 + i * 0.42) * 7;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillText(ch, lx + 4, yy + 5);
    g.fillStyle = i % 2 ? '#ffd54f' : '#ffffff';
    g.fillText(ch, lx, yy);
    lx += cw;
  }
  text(g, 'ESCAPE THE OFFICE · OUTRUN MANAGEMENT · QUIT GLORIOUSLY', VIEW_W / 2, 232, 11, '#cfe3ff');
  if (Math.sin(perf * 4) > -0.25) text(g, 'PRESS ENTER / TAP TO PUNCH IN', VIEW_W / 2, 380, 15, '#69f0ae');
  if (bestScore > 0) {
    text(g, 'OFFICE RECORD ' + bestScore + (bestName ? ' · HELD BY ' + bestName : ''), VIEW_W / 2, 472, 10, 'rgba(255,255,255,0.65)');
  }

  if (challenge) {
    text(g, '⚠ CHALLENGE: ' + challenge.name + ' POSTED ' + challenge.score, VIEW_W / 2, 500, 11, '#ff8a80');
    text(g, 'BEAT IT TO CLAIM BRAGGING RIGHTS', VIEW_W / 2, 522, 8, 'rgba(255,158,158,0.8)');
  }
  text(g, 'ENTER / TAP · ARROWS/WASD MOVE · SPACE JUMP x2 · SHIFT DASH · F11 FULLSCREEN', VIEW_W / 2, VIEW_H - 40, 9, 'rgba(255,255,255,0.55)');
  const tip = TITLE_TIPS[Math.floor(perf / 3.4) % TITLE_TIPS.length];
  text(g, tip, VIEW_W / 2, VIEW_H - 62, 9, 'rgba(255,255,255,0.55)');
}
function drawGameOverScreen(g) {
  g.fillStyle = 'rgba(10,10,16,0.72)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  /* termination doc: stamp · score · cause · one action */
  g.fillStyle = 'rgba(18,20,26,0.94)';
  g.beginPath(); g.roundRect(VIEW_W / 2 - 380, 150, 760, 400, 8); g.fill();
  g.strokeStyle = '#37474f'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(VIEW_W / 2 - 366, 164, 732, 372, 6); g.stroke();
  text(g, 'FINAL PERFORMANCE REVIEW', VIEW_W / 2, 196, 11, '#90a4ae');
  g.save();
  g.translate(VIEW_W / 2, 276);
  g.rotate(-0.07);
  g.strokeStyle = '#ff5252'; g.lineWidth = 5;
  g.beginPath(); g.roundRect(-330, -40, 660, 80, 8); g.stroke();
  text(g, 'TERMINATION STAMPED', 0, 0, 24, '#ff5252');
  g.restore();
  text(g, 'SHAREHOLDER VALUE', VIEW_W / 2, 356, 10, 'rgba(255,255,255,0.55)');
  text(g, String(totals.score), VIEW_W / 2, 398, 30, '#ffd54f');
  text(g, 'CAUSE: ' + pickDeathMsg.slice(0, 42), VIEW_W / 2, 442, 9, '#ffcdd2');
  if (Math.sin(perf * 4) > -0.25) text(g, 'ENTER / TAP — REAPPLY', VIEW_W / 2, 492, 15, '#69f0ae');
  text(g, 'S OR SHARE RUN · SEND THE OBITUARY', VIEW_W / 2, 524, 8, 'rgba(105,240,174,0.75)');
}
function drawWinScreen(g) {
  g.fillStyle = 'rgba(8,12,20,0.8)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  if (Math.random() < 0.3) confetti(rand(VIEW_W), -10, 3, true);
  const [rk, rc] = rankFor(totals.deaths);
  /* exit-interview card — same object language as the gameover review.
     3-second scan: celebrate → rank (hero) → score → one action.
     everything else is one dim garnish line. */
  g.fillStyle = 'rgba(18,20,26,0.94)';
  g.beginPath(); g.roundRect(VIEW_W / 2 - 380, 150, 760, 400, 8); g.fill();
  g.strokeStyle = '#37474f'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(VIEW_W / 2 - 366, 164, 732, 372, 6); g.stroke();
  text(g, 'YOU ESCAPED!', VIEW_W / 2, 208, 38, '#69f0ae');
  text(g, 'FINAL RANK', VIEW_W / 2, 272, 10, 'rgba(255,255,255,0.6)');
  text(g, rk, VIEW_W / 2, 314, 21, rc);
  text(g, 'SCORE', VIEW_W / 2, 376, 10, 'rgba(255,255,255,0.55)');
  text(g, String(totals.score), VIEW_W / 2, 416, 30, '#ffd54f');
  const mm = String(Math.floor(totals.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(totals.time % 60)).padStart(2, '0');
  text(g, mm + ':' + ss + ' · ' + totals.coffees + ' COFFEE · ' + totals.files + ' TICKETS · ' + totals.stomps + ' STOMPS · ' + totals.deaths + ' RAGE QUITS · x' + Math.max(1, totals.maxCombo || 0) + ' COMBO', VIEW_W / 2, 470, 9, 'rgba(255,255,255,0.6)');
  if (Math.sin(perf * 4) > -0.25) text(g, 'ENTER / TAP — RELIVE THE DREAM', VIEW_W / 2, 504, 15, '#69f0ae');
  text(g, 'S OR SHARE RUN · POST THE NEWS', VIEW_W / 2, 530, 8, 'rgba(105,240,174,0.75)');
}
function drawPauseOverlay(g) {
  g.fillStyle = 'rgba(8,12,20,0.66)';
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  text(g, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 30, 28, '#fff');
  text(g, 'grab a coffee — P resume · M mute · R restart · F11 fullscreen', VIEW_W / 2, VIEW_H / 2 + 26, 11, 'rgba(255,255,255,0.75)');
}

/* ---------------- main loop ---------------- */
function update(dt) {
  perf += dt;
  if (fadeT > 0) fadeT -= dt;
  if (freezeT > 0) { freezeT -= dt; return; }
  camShake = Math.max(0, camShake - dt * 1.7);

  if (state === 'title') {
    titlePan += dt;
    if (lvl) {
      camX = (titlePan * 42) % Math.max(1, lvl.pxW - VIEW_W);
      updatePlanes(dt);
      updateFx(dt);
    }
    return;
  }
  if (state === 'win') { updateFx(dt); return; }
  if (state === 'gameover') { updateFx(dt); return; }
  if (state === 'select') { updateFx(dt); return; }
  if (dialogue) { updateDialogue(dt); updateFx(dt); return; }
  if (charIntro > 0) {
    charIntro -= dt;
    if (charIntro <= 0) endPunchIn();
    updateFx(dt);
    return;
  }
  if (paused) return;

  totals.time += dt;
  updateHints(dt);

  /* challenge overtake */
  if (challenge && !challenge.beaten && challenge.score > 0 && state === 'play' && totals.score >= challenge.score) {
    challenge.beaten = true;
    if (player) {
      addPop(player.cx, player.y - 34, 'CHALLENGE LEAD!', '#ffd54f');
      sparkle(player.cx, player.y, '#ffd54f', 12);
      SFX.checkpoint();
    }
  }
  if (introT > 0) introT -= dt;
  if (bossIntroT > 0) bossIntroT -= dt;
  if (state === 'intro' && introT <= 0 && bossIntroT <= 0) state = 'play';

  updatePlats(dt);
  updatePlayer(dt);
  for (const m of lvl.enemies) updateManager(m, dt);
  lvl.enemies = lvl.enemies.filter(m => !m.dead);
  for (const n of lvl.interns) updateIntern(n, dt);
  lvl.interns = lvl.interns.filter(n => !n.dead);
  for (const dr of lvl.drones) updateDrone(dr, dt);
  lvl.drones = lvl.drones.filter(dr => !dr.dead);
  updatePlanes(dt);
  updateStaples(dt);
  if (boss && bossIntroT <= 0) updateBoss(dt);
  updateShredWarn(dt);
  updateFx(dt);

  if (state === 'clear') {
    clearT += dt;
    if (clearT > 2.1) {
      if (curLevel + 1 < LEVELS.length) loadLevel(curLevel + 1);
      else finishWin();
    }
  }

  const look = player.face * 110 + player.vx * 0.14;
  const cb = camBounds();
  const target = clamp(player.cx + look - VIEW_W / 2, cb[0], cb[1]);
  camX = lerp(camX, target, 1 - Math.exp(-7 * dt));

  /* NaN safety net (defense-in-depth after the missing-getter incident) */
  if (!isFinite(player.vx)) player.vx = 0;
  if (!isFinite(player.vy)) player.vy = 0;
  if (!isFinite(player.x) || !isFinite(player.y)) { player.x = lvl.spawn.x; player.y = lvl.spawn.y - player.h; }
  if (!isFinite(player.sqX)) player.sqX = 1;
  if (!isFinite(player.sqY)) player.sqY = 1;
  if (!isFinite(player.ph)) player.ph = 0;
  if (!isFinite(camX)) {
    camX = player.cx - VIEW_W / 2;
    clampCam();
  }

  const sh = camShake * camShake * 13;
  shakeX = rand(-sh, sh);
  shakeY = rand(-sh, sh);
}

function render(dt) {
  const g = ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!lvl) { g.fillStyle = '#0b0f18'; g.fillRect(0, 0, VIEW_W, VIEW_H); return; }

  drawBG(g);

  g.save();
  g.translate(-Math.round(camX) + shakeX, shakeY);

  g.drawImage(bake, 0, 0);

  /* coworkers */
  for (const c of lvl.coworkers) {
    if (c.x < camX - 80 || c.x > camX + VIEW_W + 80) continue;
    const bob = Math.sin(perf * 7 + c.ph) * 2;
    g.fillStyle = c.shirt;
    g.beginPath(); g.roundRect(c.x - 12, c.y - 26 + bob, 24, 18, 4); g.fill();
    g.fillStyle = c.skin;
    g.beginPath(); g.arc(c.x, c.y - 34 + bob, 8, 0, TAU); g.fill();
    g.fillStyle = '#37474f';
    g.beginPath(); g.arc(c.x, c.y - 37 + bob, 8, Math.PI, TAU); g.fill();
    g.fillStyle = c.skin;
    if (c.hi > 0) {
      const up = Math.sin(Math.min(1, (0.8 - c.hi) * 4) * Math.PI / 2);
      g.fillRect(c.x - 17, c.y - 34 - up * 16, 6, 14);
      g.fillRect(c.x + 11, c.y - 34 - up * 16, 6, 14);
    } else {
      g.fillRect(c.x - 15, c.y - 10 + Math.sin(perf * 13 + c.ph) * 2, 6, 5);
      g.fillRect(c.x + 9, c.y - 10 + Math.cos(perf * 12 + c.ph) * 2, 6, 5);
    }
    if (c.bubble) {
      g.font = '10px monospace';
      const tw2 = Math.max(90, g.measureText(c.bubble.text).width + 16);
      g.fillStyle = 'rgba(255,255,255,0.94)';
      g.beginPath(); g.roundRect(c.x - tw2 / 2, c.y - 86, tw2, 24, 6); g.fill();
      g.beginPath();
      g.moveTo(c.x - 5, c.y - 62); g.lineTo(c.x + 7, c.y - 62); g.lineTo(c.x, c.y - 53);
      g.closePath(); g.fill();
      g.fillStyle = '#263238';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(c.bubble.text, c.x, c.y - 74);
    }
  }

  for (const ck of lvl.checkpoints) drawCheckpoint(g, ck);
  if (lvl.door) drawDoor(g, lvl.door);
  drawGates(g);
  for (const pl of lvl.plats) drawPlat(g, pl);
  for (const sp of lvl.springs) drawSpring(g, sp);
  for (const pk of lvl.pickups) drawPickup(g, pk);
  drawBelts(g);
  drawShredders(g);
  /* incoming-plane warnings: blinking '!' pinned to the right edge at flight altitude */
  if (lvl.planeWarns) {
    for (const w of lvl.planeWarns) {
      if (w.spawned || Math.sin(perf * 16) < -0.1) continue;
      const wx = camX + VIEW_W - 34;
      g.fillStyle = '#ff5252';
      g.beginPath();
      g.moveTo(wx, w.by - 16); g.lineTo(wx + 14, w.by + 8); g.lineTo(wx - 14, w.by + 8);
      g.closePath(); g.fill();
      text(g, '!', wx, w.by - 1, 12, '#0b0f18', 'center', false);
    }
  }
  for (const pl of lvl.planes) drawPlane(g, pl);
  drawStaples(g);
  for (const m of lvl.enemies) drawManager(g, m);
  for (const n of lvl.interns) drawIntern(g, n);
  for (const dr of lvl.drones) drawDrone(g, dr);
  drawProjectiles(g);
  drawBoss(g);
  if (state !== 'title') {
    for (const gh of ghosts) drawGhost(g, gh);
    drawPlayer(g);
  }
  drawParticles(g, false);
  drawPops(g);

  g.restore();

  /* screen-space */
  drawParticles(g, true);
  g.drawImage(vignette, 0, 0);
  /* brand watermark — screenshots carry the name */
  text(g, 'THE DAILY GRIND', 24, VIEW_H - 18, 8, 'rgba(255,255,255,0.42)', 'left', false);

  /* UI layers — strict back-to-front so cinematics always sit on top */
  if (state === 'title') {
    drawTitle(g);
  } else if (state === 'select') {
    drawStaffSelect(g);
  } else {
    const endScreen = state === 'gameover' || state === 'win';
    const cinematic = charIntro > 0 || !!dialogue;
    if (!endScreen && !cinematic) {
      drawHUD(g);
      drawHints(g);
      drawChallengeTarget(g);
    }
    if (shareToast) {
      shareToast.t -= dt;
      const a = clamp(shareToast.t / 0.4, 0, 1);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = 'rgba(6,20,12,0.9)';
      const tw = shareToast.text.length * 8 + 40;
      g.beginPath(); g.roundRect(VIEW_W / 2 - tw / 2, 70, tw, 34, 8); g.fill();
      text(g, shareToast.text, VIEW_W / 2, 87, 11, '#69f0ae');
      g.restore();
      if (shareToast.t <= 0) shareToast = null;
    }
    drawBannerFx(g, dt);
    if (state === 'gameover') drawGameOverScreen(g);
    else if (state === 'win') drawWinScreen(g);
    else if (paused) drawPauseOverlay(g);
  }

  /* cinematic scenes sit above every gameplay layer */
  if (charIntro > 0) drawCharIntro(g);
  if (dialogue) drawDialogue(g);

  if (fadeT > 0) {
    g.fillStyle = `rgba(8,10,16,${clamp(fadeT * 2, 0, 1)})`;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (boss && bossIntroT > 0) {
    const k = clamp(bossIntroT / 0.4, 0, 1);
    g.fillStyle = 'rgba(8,10,16,1)';
    g.fillRect(0, 0, VIEW_W, 70 * k);
    g.fillRect(0, VIEW_H - 70 * k, VIEW_W, 70 * k);
    if (bossIntroT < 2.1) {
      text(g, 'THE CEO', VIEW_W / 2, VIEW_H / 2 - 60, 34, '#ff8a80');
      text(g, 'has never opened a Jira ticket in his life', VIEW_W / 2, VIEW_H / 2 - 14, 11, '#ffcdd2');
    }
  }
}

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  dt = Math.min(dt, 1 / 20);
  syncUIButtons();
  try {
    update(dt);
    render(dt);
  } catch (err) {
    console.error(err);
  }
}

/* ---------------- boot ---------------- */
resetTotals();
loadLevel(0, { ambient: true });
state = 'title';
/* dev/QA: ?screen=select parks on a screen for screenshots (harmless in prod) */
const __park = (location.search.match(/[?&]screen=(title|select|play)/) || [])[1];
if (__park) {
  if (__park === 'select') state = 'select';
  else if (__park === 'play') startGame();
}
requestAnimationFrame(frame);

/* test hooks (harmless in production) */
window.__G = {
  state: () => state,
  start: () => startGame(),
  warp: i => { resetTotals(); loadLevel(i); },
  info: () => ({ state, camX, px: player && player.x, py: player && player.y, hearts: player && player.hearts,
    invuln: player && player.invuln, sqX: player && player.sqX, sqY: player && player.sqY,
    face: player && player.face, ph: player && player.ph, grounded: player && player.grounded,
    vx: player && player.vx, vy: player && player.vy,
    cx: player && player.cx, w: player && player.w, h: player && player.h,
    enemies: lvl ? lvl.enemies.length : 0, interns: lvl ? lvl.interns.length : 0, drones: lvl ? lvl.drones.length : 0,
    hasKey: lvl ? lvl.hasKey : false, gates: lvl ? lvl.gates.length : 0, pagerOn: !!(lvl && lvl.pagerOn),
    combo: comboN, comboT: Math.round(comboT * 100) / 100,
    bossHp: boss ? boss.hp : null, climbing: !!(player && player.climbing),
    score: totals ? totals.score : 0, staples: lvl ? lvl.staples.length : 0,
    aj: player ? player.airJumps : null, maxHearts: KIT().maxHearts,
    bossSt: boss ? boss.st : null,
    bossRect: boss ? { x: Math.round(boss.x), y: Math.round(boss.y), w: boss.w, h: boss.h } : null,
    bossDead: boss ? boss.dead : null, bossVuln: boss ? (boss.st === 'stun' || boss.st === 'pants') && boss.invuln <= 0 : false,
    doorLocked: lvl && lvl.door ? lvl.door.locked : null,
    respawnLock: player ? Math.round(player.respawnLock * 100) / 100 : null }),
  press: (k, down = true) => setKey(k, down),
};
/* demo-page hooks: exercise real game logic without playing a full run */
window.__MEMES = {
  coworkers: COWORKER_LINES,
  deaths: DEATH_MSGS,
  taunts: BOSS_TAUNTS,
  combos: COMBO_WORDS,
  tips: TITLE_TIPS,
  ranks: rankFor,
  shareWin: buildShareWin,
  shareDead: buildShareDead,
};
Object.assign(window.__G, {
  kill: cause => hurtPlayer(cause),
  kit: () => AVATARS[avatarIdx].kit,
  punch: v => { charIntro = (v === undefined ? 4.2 : v); },
  bosshp: n => { if (boss) boss.hp = Math.max(1, n); },
  give: () => { if (player) { player.hasStapler = true; runHasStapler = true; } },
  popList: () => pops.map(p => ({ text: p.text, x: Math.round(p.x), y: Math.round(p.y) })),
  dlg: () => dialogue ? { i: dialogue.i, total: dialogue.lines.length, chars: Math.floor(dialogue.chars), who: dialogue.lines[dialogue.i].who } : null,
  dlgHold: () => { if (dialogue) { dialogue.holdT = -600; } },
  avatar: i => { if (i !== undefined) setAvatar(i); return { idx: avatarIdx, name: AVATARS[avatarIdx].name }; },
  identity: () => ({ employee, challenge, bestScore, bestName }),
  tp: (x, y) => { if (player) { player.x = x; player.y = y; player.vx = 0; player.vy = 0; player.prevY = y; player.ride = null; } },
  hintState: () => ({ seen: Object.assign({}, hintsSeen), cur: curHint ? curHint.id : null }),
  hintsReset: () => resetHints(),
  heal: () => { if (player && player.hearts < KIT().maxHearts) player.hearts++; },
  badge: () => { if (lvl) { lvl.hasKey = true; openGates(); } },
  world: () => ({
    springs: lvl ? lvl.springs.map(s => ({ x: s.x, y: s.y })) : [],
    ladders: (() => { const t = []; if (lvl) for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) if (lvl.grid[y][x] === 13) t.push({ x: x * T, y: y * T }); return t; })(),
    drones: lvl ? lvl.drones.map(d => ({ x: d.x, y: d.y })) : [],
    interns: lvl ? lvl.interns.map(n => ({ x: n.x, y: n.y, fleeing: n.fleeing, grounded: n.grounded, sq: n.squashed > 0 })) : [],
    planeWarns: lvl && lvl.planeWarns ? lvl.planeWarns.map(w => ({ by: Math.round(w.by), t: Math.round(w.t * 100) / 100, spawned: w.spawned })) : [],
    planesLive: lvl ? lvl.planes.length : 0,
    gates: lvl ? lvl.gates.map(g => ({ tx: g.tx, ty: g.ty })) : [],
    shredders: (() => { const t = []; if (lvl) for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) if (lvl.grid[y][x] === 8) t.push({ tx: x, ty: y }); return t; })(),
    jams: () => Object.assign({}, lvl.jams),
    tile: (tx, ty) => (lvl.grid[ty] ? lvl.grid[ty][tx] : null),
    beltTiles: (() => { const t = []; if (lvl) for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) { const c = lvl.grid[y][x]; if (c === 9 || c === 10) t.push({ x: x * T, y: y * T, dir: c === 9 ? 1 : -1 }); } return t; })(),
  }),
  stompHere: () => registerStomp(player.cx, player.y - 10, 'SYNERGIZED!', '#b9f6ca'),
  pop: t => addPop(player.cx, player.y - 24, String(t), '#ffffff'),
  win: () => { resetTotals(); Object.assign(totals, { score: 14875, coffees: 25, files: 23, stomps: 24, deaths: 4, time: 239, maxCombo: 3 }); state = 'win'; },
  pager: () => { if (lvl) { lvl.pagerOn = true; lvl.pagerT = 18; lvl.pagerPing = 1; } },
});
})();
