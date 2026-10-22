/* core.js — 부스 게임 공통 코어 (00-core-plan.md)
 * 모든 게임 페이지: <canvas id="c"></canvas> <script src="core.js"></script> <script>게임</script>
 * 외부 파일·라이브러리 없음. 모든 그림은 캔버스 도형, 모든 소리는 Web Audio.
 */
'use strict';

// ============================================================
// 설정
// ============================================================
const CORE = {
  launcher: 'index.html',  // Esc 2초 시 이동할 곳
  isLauncher: false,       // index.html에서 true (Esc 길게 무시)
  idleSec: 15,             // 자동 복귀 시간
  escHold: 2,              // Esc 길게 누르는 시간
  resetHold: 3,            // Shift+Delete 누르는 시간
};

// ============================================================
// 화면
// ============================================================
const W = 960, H = 540;
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

(function injectStyle() {
  const s = document.createElement('style');
  s.textContent =
    'html,body{margin:0;height:100%;background:#000;overflow:hidden}' +
    'body{display:flex;align-items:center;justify-content:center}' +
    'canvas{display:block}';
  document.head.appendChild(s);
})();

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// 창 크기에 맞춰 비율 유지 확대 (남는 영역은 body 검은색)
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * scale) + 'px';
  canvas.style.height = Math.floor(H * scale) + 'px';
  canvas.width = Math.max(1, Math.round(W * scale * dpr));
  canvas.height = Math.max(1, Math.round(H * scale * dpr));
}
addEventListener('resize', fit);
fit();

function resetTransform() {
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}

// ---------- 그리기 도우미 ----------
function setFont(size) { ctx.font = `bold ${size}px ${FONT}`; }

function textWidth(str, size) { setFont(size); return ctx.measureText(str).width; }

// 굵은 글씨 + 검은 외곽선 (어떤 배경에서도 읽힘)
function text(str, x, y, size, color, align = 'center') {
  setFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.12);
  ctx.strokeStyle = '#000';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// 외곽선 없는 글씨 (밝은 판 위 작은 글씨용)
function textPlain(str, x, y, size, color, align = 'center') {
  setFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function roundPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRect(x, y, w, h, r, color, stroke, lineW = 3) {
  roundPath(x, y, w, h, r);
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lineW; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// 키보드 키 그림. on이면 초록색
function keyCap(x, y, w, h, label, on = false, size = 0) {
  const face = on ? '#51cf66' : '#f1f3f5';
  const side = on ? '#2b8a3e' : '#adb5bd';
  roundRect(x, y + 4, w, h, 8, side);
  roundRect(x, y, w, h - 2, 8, face, '#343a40', 2);
  textPlain(label, x + w / 2, y + h / 2 - 1, size || Math.min(h * 0.45, 26), '#212529');
}

// 화면 흔들림
let shakeT = 0, shakeDur = 0, shakePow = 0;
function shake(power, time) {
  shakePow = power;
  shakeT = shakeDur = time;
}

// ---------- 수학 ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ============================================================
// 입력 (e.code 기준)
// ============================================================
const keys = {};      // 지금 눌려 있음
const pressed = {};   // 이번 프레임에 새로 눌림
const released = {};  // 이번 프레임에 떼짐
const downAt = {};    // 누른 시각(ms)
const lastHeld = {};  // 마지막으로 누르고 있던 시간(초)
const mouse = { x: -1, y: -1 };
let lastInput = performance.now();

const BLOCK_DEFAULT = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'NumpadEnter', 'Tab', 'Backspace',
]);
// anyPressed()에서 무시하는 키 (운영자 키·보조 키)
const IGNORE_ANY = new Set([
  'Escape', 'KeyM', 'ShiftLeft', 'ShiftRight', 'Delete', 'Tab', 'CapsLock',
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
  'ContextMenu', 'PrintScreen', 'HangulMode', 'Lang1', 'Lang2',
]);

function keyDown(code, repeat) {
  lastInput = performance.now();
  if (repeat || keys[code]) return;   // 반복 입력은 pressed에 넣지 않음
  keys[code] = true;
  downAt[code] = performance.now();
  pressed[code] = true;
}

function keyUp(code) {
  lastInput = performance.now();
  if (!keys[code]) return;
  lastHeld[code] = (performance.now() - downAt[code]) / 1000;
  keys[code] = false;
  released[code] = true;
}

function releaseAll() {
  for (const c in keys) if (keys[c]) keyUp(c);
}

addEventListener('keydown', (e) => {
  if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
  ensureAudio();
  keyDown(e.code, e.repeat);
});
addEventListener('keyup', (e) => {
  if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
  keyUp(e.code);
});
// 창 전환 시 모든 키 해제 (키 고착 방지)
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

function updateMouse(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
}
canvas.addEventListener('mousedown', (e) => {
  updateMouse(e);
  if (e.button !== 0) return;
  e.preventDefault();
  ensureAudio();
  keyDown('Mouse0', false);
});
addEventListener('mouseup', (e) => { if (e.button === 0) keyUp('Mouse0'); });
addEventListener('mousemove', updateMouse);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function heldTime(code) {
  return keys[code] ? (performance.now() - downAt[code]) / 1000 : 0;
}

// 짧게 눌렀다 뗐는지 (이번 프레임에 떼졌고 maxSec 미만으로 눌렀음)
function tapped(code, maxSec) {
  return !!released[code] && lastHeld[code] < maxSec;
}

function anyPressed() {
  for (const c in pressed) {
    if (!IGNORE_ANY.has(c) && !/^F\d+$/.test(c)) return true;
  }
  return false;
}

function mouseIn(x, y, w, h) {
  return mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
}

function clickIn(x, y, w, h) {
  return !!pressed.Mouse0 && mouseIn(x, y, w, h);
}

// 키 이름 (화면 표시용)
const KEY_LABEL = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc',
  ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift',
  ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: 'Alt', AltRight: '오른쪽 Alt',
  MetaLeft: 'Win', MetaRight: 'Win', Backspace: 'Back', Tab: 'Tab', CapsLock: 'Caps',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
  Mouse0: '클릭', HangulMode: '한/영', Lang1: '한/영', Lang2: '한자', ContextMenu: '메뉴',
};
function keyName(code) {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  let m;
  if ((m = /^Key(.)$/.exec(code))) return m[1];
  if ((m = /^Digit(.)$/.exec(code))) return m[1];
  if ((m = /^Numpad(.+)$/.exec(code))) return 'Num ' + m[1];
  return code;
}

// 2인 대전 키 (keytest.html과 versus.html이 함께 사용)
const VERSUS_KEYS = {
  p1: { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', fire: ['KeyF'] },
  p2: { up: 'KeyU', left: 'KeyH', down: 'KeyJ', right: 'KeyK', fire: ['KeyL'] },
};

// ============================================================
// 소리 (Web Audio로 생성)
// ============================================================
let actx = null;
let muted = false;
try { muted = localStorage.getItem('booth_mute') === '1'; } catch (e) { /* 저장소 없음 */ }

// 첫 키 입력 시 생성·재개 (브라우저 자동재생 정책)
function ensureAudio() {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { /* 소리 없이 진행 */ }
}

// to를 주면 freq → to로 미끄러짐
function tone(freq, dur, type = 'square', vol = 0.08, delay = 0, to = 0) {
  if (muted || !actx) return;
  try {
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) { /* 무시 */ }
}

function beep(freq, dur, type = 'square', vol = 0.08, delay = 0) {
  tone(freq, dur, type, vol, delay);
}

function notes(freqs, step, type = 'square', vol = 0.08) {
  freqs.forEach((f, i) => tone(f, step * 0.9, type, vol, i * step));
}

const sfx = {
  pick: (k = 1) => beep(660 * k, 0.06),
  bonus: () => { beep(988, 0.12); beep(1318, 0.12, 'square', 0.08, 0.12); },
  hit: (f = 120, d = 0.25) => beep(f, d, 'sawtooth', 0.1),
  coin: () => beep(1046, 0.05),
  jump: () => tone(440, 0.08, 'square', 0.06, 0, 660),
  count: () => beep(523, 0.12),
  go: () => beep(784, 0.3),
  up: () => notes([523, 659, 784], 0.06),
  over: () => notes([523, 392, 262], 0.14),
  win: () => notes([523, 659, 784, 1046], 0.11),
  throw: () => tone(330, 0.07, 'triangle', 0.1, 0, 560),
  tick: () => beep(220, 0.03, 'triangle', 0.06),
  select: () => beep(880, 0.04),
};

function setMuted(m) {
  muted = m;
  try { localStorage.setItem('booth_mute', m ? '1' : '0'); } catch (e) { /* 무시 */ }
}

// ============================================================
// 순위 (localStorage)
// ============================================================
const RANK_MAX = 10;

const storageOK = (() => {
  try {
    localStorage.setItem('__booth_test', '1');
    localStorage.removeItem('__booth_test');
    return true;
  } catch (e) { return false; }
})();

function loadRank(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(v)) return [];
    return v.filter((r) => r && typeof r.name === 'string' && typeof r.score === 'number');
  } catch (e) { return []; }
}

function saveRank(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch (e) { return false; }
}

function resetRank(key) {
  try { localStorage.removeItem(key); } catch (e) { /* 무시 */ }
}

// 0점 초과이면서 10위 안
function qualifies(key, score) {
  if (!(score > 0)) return false;
  const list = loadRank(key);
  return list.length < RANK_MAX || score > list[RANK_MAX - 1].score;
}

// 추가 후 내림차순(같은 점수는 먼저 기록한 사람이 위), 상위 10개 유지. 새 항목 인덱스 반환 (밖이면 -1)
function addRank(key, name, score) {
  const list = loadRank(key);
  const entry = { name, score, time: Date.now() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.time - b.time);
  const kept = list.slice(0, RANK_MAX);
  saveRank(key, kept);
  return kept.indexOf(entry);
}

// 이니셜 금지어 (일치하면 ??? 로 저장)
const BANNED = new Set([
  'FUK', 'FUC', 'FCK', 'FUX', 'FKU', 'SEX', 'SXY', 'ASS', 'DIK', 'DIC', 'COK', 'CUM', 'CUN',
  'KKK', 'NIG', 'NGR', 'FAG', 'TIT', 'PIS', 'SHT', 'WTF', 'XXX', 'GAY', 'JAP', 'NAZ',
  'SIB', 'SSB', 'SBL', 'BYS', 'BSN', 'JOT', 'ZOT', 'GSK', 'GSE', 'MCN', 'ZZI',
]);

// ============================================================
// 장면
// 장면 객체: { name, enter(), update(dt), draw(ctx), idle }
//   idle: false → 자동 복귀 안 함 (PLAY, 이니셜 입력)
//   noMute: true → M 음소거 비활성 (이니셜 입력)
//   allowReset: true + rankKey → Shift+Delete 3초로 순위 초기화 (순위표)
// ============================================================
let scene = null;
let titleScene = null;
let sceneTime = 0;   // 현재 장면에 들어온 뒤 지난 시간(초)

function setScene(s, skipEnter = false) {
  scene = s;
  sceneTime = 0;
  lastInput = performance.now();   // 장면이 바뀌면 방치 시간 다시 셈
  if (!skipEnter && s.enter) s.enter();
}

function goTitle() { setScene(titleScene); }

let lastFrameT = 0;
function start(title) {
  titleScene = title;
  setScene(title);
  requestAnimationFrame(frame);
}

// ---------- 운영자 기능 ----------
let escFired = false, resetFired = false, opMsg = '', opMsgT = 0;

function updateOperator(dt) {
  if (pressed.KeyM && !scene.noMute) {
    setMuted(!muted);
    if (!muted) sfx.select();
  }

  if (!keys.Escape) escFired = false;
  if (!CORE.isLauncher && !escFired && heldTime('Escape') >= CORE.escHold) {
    escFired = true;
    location.href = CORE.launcher;
  }

  if (!keys.Delete) resetFired = false;
  if (scene.allowReset && !resetFired && resetHeldTime() >= CORE.resetHold) {
    resetFired = true;
    resetRank(scene.rankKey);
    if (scene.onReset) scene.onReset();
    opMsg = '순위를 초기화했습니다';
    opMsgT = 2;
    sfx.over();
  }
  if (opMsgT > 0) opMsgT -= dt;
}

function resetHeldTime() {
  const shift = Math.max(heldTime('ShiftLeft'), heldTime('ShiftRight'));
  return Math.min(shift, heldTime('Delete'));
}

function drawMuteIcon() {
  const x = W - 34, y = 8;
  roundRect(x - 4, y - 2, 32, 28, 6, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 8, 6, 8);
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 14, y + 2); ctx.lineTo(x + 14, y + 22); ctx.lineTo(x + 7, y + 16);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 17, y + 7); ctx.lineTo(x + 25, y + 17);
  ctx.moveTo(x + 25, y + 7); ctx.lineTo(x + 17, y + 17);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawOverlay() {
  if (muted) drawMuteIcon();

  const esc = heldTime('Escape');
  if (!CORE.isLauncher && esc > 0.15 && !escFired) {
    const p = Math.min(1, esc / CORE.escHold);
    rect(0, 0, W, 10, 'rgba(0,0,0,0.6)');
    rect(0, 0, W * p, 10, '#fff');
    text('처음 화면으로…', W / 2, 30, 18, '#fff');
  }

  const rs = scene.allowReset ? resetHeldTime() : 0;
  if (rs > 0.15 && !resetFired) {
    const p = Math.min(1, rs / CORE.resetHold);
    rect(0, H - 14, W, 14, 'rgba(0,0,0,0.6)');
    rect(0, H - 14, W * p, 14, '#fa5252');
    text('순위 초기화', W / 2, H - 36, 22, '#ff8787');
  }
  if (opMsgT > 0) text(opMsg, W / 2, H - 36, 22, '#ff8787');
}

// ---------- 메인 루프 ----------
function frame(t) {
  requestAnimationFrame(frame);
  const dt = lastFrameT ? clamp((t - lastFrameT) / 1000, 0, 0.05) : 1 / 60;
  lastFrameT = t;
  sceneTime += dt;

  try {
    stepFrame(dt);
  } catch (e) {
    // 행사 중 한 번의 오류로 화면이 멈추지 않게: 기록만 남기고 다음 프레임 계속
    if (!frameErrorLogged) { frameErrorLogged = true; console.error(e); }
  }

  for (const c in pressed) delete pressed[c];
  for (const c in released) delete released[c];
}

let frameErrorLogged = false;
function stepFrame(dt) {
  updateOperator(dt);

  // 자동 복귀: idle 장면에서 마지막 입력 후 15초
  if (scene.idle !== false && scene !== titleScene &&
      performance.now() - lastInput > CORE.idleSec * 1000) {
    goTitle();
  }

  const before = scene;
  if (scene.update) scene.update(dt);
  if (shakeT > 0) shakeT -= dt;

  resetTransform();
  rect(0, 0, W, H, '#000');
  if (shakeT > 0 && scene === before) {
    const p = shakePow * (shakeT / shakeDur);
    ctx.translate(rand(-p, p), rand(-p, p));
  }
  scene.draw(ctx);
  resetTransform();
  drawOverlay();
}

// ============================================================
// 공통 장면
// ============================================================

// 3·2·1 각 0.7초 + GO! 0.4초. 다음 장면의 enter()를 먼저 불러 배경으로 그림
function CountdownScene(next) {
  const STEP = 0.7, GO = 0.4;
  let shown = -1;
  return {
    name: 'COUNTDOWN',
    idle: true,
    enter() {
      shown = -1;
      if (next.enter) next.enter();
    },
    update() {
      const idx = sceneTime < STEP * 3 ? Math.floor(sceneTime / STEP) : 3;
      if (idx !== shown) {
        shown = idx;
        if (idx < 3) sfx.count(); else sfx.go();
      }
      if (sceneTime >= STEP * 3 + GO) setScene(next, true);
    },
    draw(c) {
      next.draw(c);
      rect(0, 0, W, H, 'rgba(0,0,0,0.35)');
      let label, p;
      if (sceneTime < STEP * 3) {
        label = String(3 - Math.floor(sceneTime / STEP));
        p = (sceneTime % STEP) / STEP;
      } else {
        label = 'GO!';
        p = Math.min(1, (sceneTime - STEP * 3) / GO);
      }
      // 커졌다 작아짐
      const s = p < 0.25 ? 0.5 + (p / 0.25) * 1.0 : 1.5 - ((p - 0.25) / 0.75) * 0.5;
      c.save();
      c.translate(W / 2, H / 2);
      c.scale(s, s);
      text(label, 0, 0, 140, label === 'GO!' ? '#69db7c' : '#ffd43b');
      c.restore();
    },
  };
}

// 이니셜 3칸 입력. next(idx)가 있으면 그 장면으로, 없으면 순위표로
function InitialsScene(rankKey, score, next) {
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let chars, pos, quietT, done;

  function save(name) {
    if (done) return;
    done = true;
    const idx = addRank(rankKey, name, score);
    sfx.win();
    setScene(next ? next(idx) : RankScene(rankKey, idx));
  }

  function shiftLetter(d) {
    const cur = chars[pos] ? AZ.indexOf(chars[pos]) : (d > 0 ? -1 : 26);
    chars[pos] = AZ[(cur + d + 26) % 26];
    sfx.select();
  }

  return {
    name: 'INITIALS',
    idle: false,
    noMute: true,   // M을 이니셜로 입력할 수 있게
    enter() {
      chars = ['', '', ''];
      pos = 0;
      quietT = 0;
      done = false;
    },
    update(dt) {
      if (Object.keys(pressed).length) quietT = 0; else quietT += dt;
      if (quietT >= CORE.idleSec) { save('---'); return; }
      if (sceneTime < 0.4) return;   // 결과 화면에서 누르던 키가 바로 들어오지 않게

      for (const c in pressed) {
        const m = /^Key([A-Z])$/.exec(c);
        if (m) {
          chars[pos] = m[1];
          if (pos < 2) pos++;
          sfx.select();
        }
      }
      if (pressed.ArrowUp) shiftLetter(1);
      if (pressed.ArrowDown) shiftLetter(-1);
      if (pressed.ArrowLeft) pos = Math.max(0, pos - 1);
      if (pressed.ArrowRight) pos = Math.min(2, pos + 1);
      if (pressed.Backspace) {
        if (chars[pos]) chars[pos] = '';
        else if (pos > 0) { pos--; chars[pos] = ''; }
      }
      if (pressed.Enter || pressed.NumpadEnter) {
        let name = chars.map((ch) => ch || '-').join('');
        if (BANNED.has(name)) name = '???';
        save(name);
      }
    },
    draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1c2a4a');
      g.addColorStop(1, '#3b2a5a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      text('순위 등록!', W / 2, 70, 52, '#ffd43b');
      text(`점수 ${score}`, W / 2, 135, 34, '#fff');

      const bw = 110, bh = 130, gap = 30;
      const x0 = W / 2 - (bw * 3 + gap * 2) / 2;
      const blink = Math.floor(sceneTime * 3) % 2 === 0;
      for (let i = 0; i < 3; i++) {
        const x = x0 + i * (bw + gap), y = 180;
        const cur = i === pos;
        roundRect(x, y, bw, bh, 14, cur ? '#fff9db' : '#f1f3f5',
          cur ? (blink ? '#fab005' : '#e67700') : '#868e96', cur ? 6 : 3);
        if (chars[i]) textPlain(chars[i], x + bw / 2, y + bh / 2 + 4, 84, '#212529');
        else textPlain('_', x + bw / 2, y + bh / 2 + 4, 84, cur && blink ? '#adb5bd' : '#dee2e6');
        if (cur) {
          text('▲', x + bw / 2, y - 18, 20, '#fab005');
          text('▼', x + bw / 2, y + bh + 18, 20, '#fab005');
        }
      }

      text('영어 글자 3개를 누르고  Enter', W / 2, 375, 30, '#fff');
      text('↑ ↓ 글자 바꾸기   ← → 칸 옮기기   Back 지우기', W / 2, 420, 22, '#ced4da');
      if (quietT > 5) {
        text(`${Math.ceil(CORE.idleSec - quietT)}초 뒤 자동 저장`, W / 2, 480, 22, '#ff8787');
      }
    },
  };
}

// 상위 10개 순위표. 5초 후 또는 아무 키 → 시작 화면
function RankScene(rankKey, highlightIndex = -1, title = '순위') {
  const MEDAL = ['#ffd43b', '#dee2e6', '#e8a15c'];
  let list = [], waitT = 0, hi = highlightIndex;
  return {
    name: 'RANK',
    idle: true,
    allowReset: true,
    rankKey,
    enter() {
      list = loadRank(rankKey);
      waitT = 0;
      hi = highlightIndex;
    },
    onReset() {
      list = [];
      hi = -1;
      waitT = 0;
    },
    update(dt) {
      // 운영자가 Shift/Delete를 누르는 동안은 넘어가지 않음
      const op = keys.ShiftLeft || keys.ShiftRight || keys.Delete;
      if (!op) waitT += dt;
      if (waitT >= 5 || (sceneTime > 0.6 && anyPressed())) goTitle();
    },
    draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#16213e');
      g.addColorStop(1, '#0f3460');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      text(title, W / 2, 50, 44, '#ffd43b');
      if (!list.length) {
        text('아직 기록이 없어요', W / 2, H / 2, 34, '#ced4da');
      }
      const rowH = 38, y0 = 108;
      for (let i = 0; i < list.length; i++) {
        const y = y0 + i * rowH;
        const r = list[i];
        if (i === hi) {
          const on = Math.floor(sceneTime * 4) % 2 === 0;
          roundRect(250, y - rowH / 2 + 2, 460, rowH - 4, 8, on ? 'rgba(255,212,59,0.45)' : 'rgba(255,212,59,0.15)');
        }
        const color = i < 3 ? MEDAL[i] : '#fff';
        text(`${i + 1}`, 300, y, 28, color, 'right');
        text(r.name, 400, y, 30, color, 'center');
        text(String(r.score), 680, y, 30, color, 'right');
      }
      const left = Math.max(0, Math.ceil(5 - waitT));
      text(`아무 키나 누르면 처음으로 (${left})`, W / 2, H - 22, 18, '#adb5bd');
    },
  };
}
