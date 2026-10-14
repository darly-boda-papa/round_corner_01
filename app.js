// Neon Edge Live — 디스플레이 라운드 코너 끝단을 따라 네온 선을 돌려 코너 두께 일관성을 확인

const PALETTES = [
  { name: '무지개', stops: ['#ff3d81', '#ff8a3d', '#f7f16b', '#5dff9b', '#35ecff', '#5f8bff', '#c96bff'] },
  { name: '갤럭시', stops: ['#6a8bff', '#9a6bff', '#d46bd4', '#8b5cff'] },
  { name: '오로라', stops: ['#5dff9b', '#35ecff', '#6a8bff', '#48e0c0'] },
  { name: '선셋', stops: ['#ff5f6d', '#ff9d5c', '#ffd36b', '#ff7eb3'] },
];
const HIDE_MS = 3000;
const $ = (id) => document.getElementById(id);

const DEFAULTS = { radius: 39, width: 3, speed: 2, cw: 1, pi: 0 };
const cfg = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('neonLiveCfg2') || 'null');
  if (saved) Object.assign(cfg, saved);
} catch (e) {}
if (!PALETTES[cfg.pi]) cfg.pi = 0;

let fsState = '축소됨';
let angle = 0;
let last = performance.now();

function save() {
  try { localStorage.setItem('neonLiveCfg2', JSON.stringify(cfg)); } catch (e) {}
}

function stopsStr(stops) {
  const a = stops.slice();
  if (a[0] !== a[a.length - 1]) a.push(a[0]);
  return a.join(', ');
}

// ===== 전체화면 =====
// 브라우저·설치 앱 모두 사용자 터치가 있어야 전체화면 API 진입이 허용됨.
// 설치 앱(manifest display: fullscreen)이라도 단말·브라우저에 따라 상태바가 남는 경우가 있어,
// display-mode가 아니라 '창이 실제로 디스플레이 전체를 덮는지'로 판단한다.
const apiFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const coversScreen = () => innerHeight > 0 && Math.abs(screen.width - innerWidth) <= 2 && Math.abs(screen.height - innerHeight) <= 2;
const isFull = () => apiFull() || coversScreen();

function enterFull() {
  if (apiFull()) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) { try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
}

// 사용자가 '전체화면 해제' 버튼으로 직접 나간 경우에는 탭해도 다시 전체화면으로 들어가지 않음
let userExited = false;
const canFull = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

function toggleFull() {
  if (apiFull()) {
    userExited = true;
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) { try { ex.call(document); } catch (e) {} }
  } else {
    userExited = false;
    enterFull();
  }
}

function updateFsUI() {
  fsState = isFull() ? '전체화면' : '축소됨';
  // 전체화면 API로 들어간 상태만 해제 가능 (manifest 전체화면은 앱 스스로 해제할 수 없음)
  $('nlv-full').textContent = apiFull() ? '전체화면 해제' : '전체화면';
  $('nlv-full').hidden = !canFull || (!apiFull() && coversScreen());
  $('nlv-start').hidden = isFull() || userExited || !canFull;
  applyStyles();
  showDiag();
}

// 진단 정보: 창 크기와 디스플레이 크기를 비교해 상태바·컷아웃 영역이 빠졌는지 확인
function showDiag() {
  const mode = ['fullscreen', 'standalone', 'minimal-ui', 'browser'].find((m) => matchMedia('(display-mode: ' + m + ')').matches) || '?';
  $('nlv-diag').textContent = '창 ' + innerWidth + '×' + innerHeight + ' / 화면 ' + screen.width + '×' + screen.height
    + ' · ' + mode + ' · API ' + (apiFull() ? 'on' : 'off');
}

// ===== 초기화 =====
function resetCfg() {
  Object.assign(cfg, DEFAULTS);
  save();
  syncControls();
}

// ===== 화면 꺼짐 방지 =====
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {}
}

// ===== 하단 UI 자동 숨김 =====
let hideTimer = 0;
const panelOpen = () => !$('nlv-panel').hidden;

function showUI() {
  $('nlv-ui').classList.remove('nlv-off');
  clearTimeout(hideTimer);
  // 설정 패널이 열려 있는 동안에는 숨기지 않음
  if (!panelOpen()) hideTimer = setTimeout(() => $('nlv-ui').classList.add('nlv-off'), HIDE_MS);
}

// ===== 설정 =====
function buildPalettes() {
  const host = $('nlv-palettes');
  host.innerHTML = '';
  PALETTES.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nlv-pal';
    b.dataset.pi = i;
    b.style.background = 'conic-gradient(' + stopsStr(p.stops) + ')';
    b.textContent = p.name;
    b.addEventListener('click', () => { cfg.pi = i; applyStyles(); save(); });
    host.appendChild(b);
  });
}

function wire() {
  $('nlv-gear').addEventListener('click', () => {
    $('nlv-panel').hidden = !$('nlv-panel').hidden;
    showUI();
  });
  $('nlv-full').addEventListener('click', toggleFull);
  $('nlv-reset').addEventListener('click', resetCfg);

  $('nlv-radius').addEventListener('input', (e) => { cfg.radius = +e.target.value; applyStyles(); save(); });
  $('nlv-width').addEventListener('input', (e) => { cfg.width = +e.target.value; applyStyles(); save(); });
  $('nlv-speed').addEventListener('input', (e) => { cfg.speed = +e.target.value; applyStyles(); save(); });

  document.querySelectorAll('.nlv-dir').forEach((b) => {
    b.addEventListener('click', () => { cfg.cw = +b.dataset.cw; syncControls(); save(); });
  });

  // 화면 탭: 숨겨진 UI를 다시 보이게 하고, 패널 바깥을 탭하면 패널을 닫음
  document.addEventListener('pointerdown', (e) => {
    if (!userExited) enterFull();
    $('nlv-start').hidden = true;
    keepAwake();
    const inUI = e.target.closest('#nlv-panel, #nlv-gear');
    if (!inUI && panelOpen()) $('nlv-panel').hidden = true;
    showUI();
  });

  document.addEventListener('fullscreenchange', updateFsUI);
  document.addEventListener('webkitfullscreenchange', updateFsUI);
  window.addEventListener('resize', updateFsUI);
  document.addEventListener('visibilitychange', keepAwake);
}

function syncControls() {
  $('nlv-radius').value = cfg.radius;
  $('nlv-width').value = cfg.width;
  $('nlv-speed').value = cfg.speed;
  document.querySelectorAll('.nlv-dir').forEach((b) => {
    b.classList.toggle('on', +b.dataset.cw === cfg.cw);
  });
  applyStyles();
}

function applyStyles() {
  const { radius, width, speed, cw, pi } = cfg;
  const stops = stopsStr(PALETTES[pi].stops);
  const ringBg = 'conic-gradient(from var(--a), ' + stops + ')';
  const hlBg = 'conic-gradient(from var(--a),'
    + ' rgba(255,255,255,0) 0deg, rgba(255,255,255,0) 285deg,'
    + ' rgba(255,255,255,0.15) 320deg, rgba(255,255,255,0.95) 342deg,'
    + ' rgba(255,255,255,0.15) 356deg, rgba(255,255,255,0) 360deg)';

  const ring = $('nlv-ring'), glow = $('nlv-glow'), hl = $('nlv-hl'), screen = $('nlv-screen');
  ring.style.background = ringBg; ring.style.borderRadius = radius + 'px';
  glow.style.background = ringBg; glow.style.borderRadius = radius + 'px';
  hl.style.background = hlBg; hl.style.borderRadius = radius + 'px';
  screen.style.inset = width + 'px';
  screen.style.borderRadius = Math.max(0, radius - width) + 'px';

  $('nlv-radius-v').textContent = radius;
  $('nlv-width-v').textContent = width;
  $('nlv-speed-v').textContent = speed.toFixed(1);
  document.querySelectorAll('.nlv-pal').forEach((b) => b.classList.toggle('on', +b.dataset.pi === pi));
  $('nlv-readout').textContent = fsState + ' · ' + radius + 'dp · ' + width + 'px · '
    + speed.toFixed(1) + 's · ' + (cw ? '시계' : '반시계') + ' · ' + PALETTES[pi].name;
}

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const dir = cfg.cw ? 1 : -1;
  angle = (angle + dir * (360 / cfg.speed) * dt) % 360;
  $('nlv-wrap').style.setProperty('--a', angle.toFixed(2) + 'deg');
  requestAnimationFrame(loop);
}

buildPalettes();
wire();
syncControls();
updateFsUI();
enterFull();
keepAwake();
showUI();
requestAnimationFrame(loop);

// ===== 오프라인 앱(PWA) =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $('offlineTag').hidden = false; })
    .catch((err) => console.warn('서비스 워커 등록 실패', err));
}

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });
