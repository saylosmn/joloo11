/* ЗХД Шалгалт — Single Page Application */
const $ = s => document.querySelector(s);
const API = '/api';
let token = localStorage.getItem('token');
let user = null;
let config = null;
let currentPage = 'home';

// ── API helper ──────────────────────────────────────────────
// Нэвтрэх хүсэлтүүд: 401 нь сесс дууссан гэсэн үг биш, харин "код буруу" гэсэн
// хариу тул дэлгэцийг дахин зурахгүй — алдааг нэвтрэх форм дээр нь үзүүлнэ.
const AUTH_PATHS = ['/auth/google', '/auth/code-login'];

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.detail || `Алдаа (${res.status})`;
    if (res.status === 401 && !AUTH_PATHS.some(a => path.startsWith(a))) logout();
    throw new Error(message);
  }
  return res.json();
}

function toast(msg, ms = 2500) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

function pageTransition(callback) {
  const app = $('#app');
  app.classList.add('page-exit');
  setTimeout(() => {
    callback();
    app.classList.remove('page-exit');
    app.classList.add('page-enter');
    setTimeout(() => app.classList.remove('page-enter'), 400);
  }, 180);
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  const colors = ['#2f52dd','#12798a','#3f7d42','#b07d16','#b1553a','#71519c','#c9871f'];
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 4000);
}

function animateCounter(el, target, duration = 800) {
  let start = 0;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const circle = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  circle.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px;position:absolute;border-radius:50%;background:rgba(255,255,255,.25);transform:scale(0);animation:rippleWave .5s ease-out;pointer-events:none`;
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
}

function showDotLoader() {
  return '<div class="dot-loader"><span></span><span></span><span></span></div>';
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Сайн шөнө';
  if (h < 12) return 'Өглөөний мэнд';
  if (h < 18) return 'Өдрийн мэнд';
  return 'Оройн мэнд';
}

function showSkeleton(count = 4) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="skeleton skeleton-card" style="animation-delay:${i * .1}s"></div>`;
  }
  return html;
}

/* ══════════════════════════════════════════════════════════════════════════
   Асуултын UX — үсгийн хэмжээ, зураг томруулах, дэлгэц дүүрэн горим,
   хариултын дараах автомат шилжилт, гар товчлуур.
   ══════════════════════════════════════════════════════════════════════════ */

const ICON = {
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4"/><path d="M15 3h4a2 2 0 012 2v4"/><path d="M9 21H5a2 2 0 01-2-2v-4"/><path d="M15 21h4a2 2 0 002-2v-4"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.36 2.64L3 8"/><polyline points="3 3 3 8 8 8"/></svg>',
  fast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>',
};

// ── Үсгийн хэмжээ ───────────────────────────────────────────
const Q_SCALES = [1, 1.15, 1.32, 1.52];
let qScaleIdx = Math.min(Q_SCALES.length - 1, Math.max(0, parseInt(localStorage.getItem('qScale') || '0', 10) || 0));

function applyQScale() {
  document.documentElement.style.setProperty('--q-scale', String(Q_SCALES[qScaleIdx]));
  document.querySelectorAll('.q-tool-step').forEach(el => {
    el.textContent = `${qScaleIdx + 1}/${Q_SCALES.length}`;
  });
}

function cycleQScale() {
  qScaleIdx = (qScaleIdx + 1) % Q_SCALES.length;
  localStorage.setItem('qScale', String(qScaleIdx));
  applyQScale();
}

// ── Автомат шилжилт ─────────────────────────────────────────
function autoNextOn() { return localStorage.getItem('autoNext') !== '0'; }

function toggleAutoNext() {
  localStorage.setItem('autoNext', autoNextOn() ? '0' : '1');
  const on = autoNextOn();
  document.querySelectorAll('.q-tool-auto').forEach(b => b.classList.toggle('on', on));
  toast(on ? '⚡ Автомат шилжилт асаалттай' : 'Автомат шилжилт унтраалаа');
}

let autoNextTimer = null;

function cancelAutoNext() {
  if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
}

/** Сонгосон хариулт дээр дүүрэх шугам зурж, дараа нь `go()`-г дуудна. */
function scheduleAutoNext(delay, go) {
  cancelAutoNext();
  if (!autoNextOn()) return;
  const picked = document.querySelector('.q-options .q-option.selected, .q-options .q-option.correct');
  if (picked && !picked.querySelector('.q-autobar')) {
    const bar = document.createElement('span');
    bar.className = 'q-autobar';
    bar.style.animation = `autoBar ${delay}ms linear forwards`;
    picked.appendChild(bar);
  }
  autoNextTimer = setTimeout(() => { autoNextTimer = null; go(); }, delay);
}

// ── Багажны мөр ─────────────────────────────────────────────
function buildQTools() {
  return `
    <div class="q-tools">
      <button class="q-tool" onclick="cycleQScale()" title="Асуултын үсгийн хэмжээ">
        Aa<span class="q-tool-step">${qScaleIdx + 1}/${Q_SCALES.length}</span>
      </button>
      <button class="q-tool q-tool-auto ${autoNextOn() ? 'on' : ''}" onclick="toggleAutoNext()"
              title="Хариулсны дараа автоматаар дараагийн асуулт руу шилжих">${ICON.fast}</button>
      <button class="q-tool" onclick="openReader()" title="Асуултыг дэлгэц дүүрэн томруулах">${ICON.expand}</button>
    </div>`;
}

function buildQFigure(url, caption) {
  if (!url) return '';
  return `
    <div class="q-figure">
      <img class="q-image" src="${url}" alt="${esc(caption || 'Асуултын зураг')}" decoding="async"
           onclick="zoomFigure(this)">
      <button class="q-zoom-btn" onclick="zoomFigure(this)" title="Зургийг томруулах">${ICON.expand}Томруулах</button>
    </div>`;
}

/* Эх өгөгдөлд хариултын текст өөрийн үсгээ давтсан байдаг ("А. Аюулгүйн арал").
   Зүүн талын үсгэн тэмдэг үүнийг аль хэдийн харуулж байгаа тул давхардлыг хасна. */
function optionText(o) {
  const text = String(o.text || '');
  const m = text.match(/^\s*([А-ЯA-Za-zа-я])\s*[.)．]\s*/);
  return m && m[1].toUpperCase() === String(o.key).toUpperCase() ? text.slice(m[0].length) : text;
}

function buildQOptions(q, st) {
  return q.options.map((o, i) => {
    let cls = '';
    if (st.revealed) {
      if (o.key === st.correctKey) cls = 'correct';
      else if (o.key === st.selected) cls = 'wrong';
      else cls = 'dim';
    } else if (o.key === st.selected) cls = 'selected';
    const lock = st.revealed || st.locked ? 'disabled' : '';
    return `
      <button class="q-option ${cls}" data-key="${o.key}" ${lock}
              onclick="pickOption('${o.key}')" style="animation-delay:${i * .035}s">
        <span class="key">${o.key}</span>
        <span>${esc(optionText(o))}</span>
        <span class="hint">${i + 1}</span>
      </button>`;
  }).join('');
}

/* `activeQ` нь одоо дэлгэц дээр харагдаж буй асуултыг тодорхойлно. Дэлгэц дүүрэн
   горим болон гар товчлуур хоёулаа үүнээс уншина. */
let activeQ = null;   // { q, mode:'practice'|'exam', st }

function pickOption(key) {
  if (!activeQ) return;
  if (activeQ.mode === 'exam') examAnswer(key);
  else answerPractice(activeQ.q.question_id, key);
}

/* ── Зураг томруулах цонх ─────────────────────────────────────
   Хуруугаар чимхэх, дугуй эргүүлэх, давхар товших, чирэх — бүгд ажиллана. */
const LB = { el: null, img: null, stage: null, label: null, scale: 1, x: 0, y: 0, pts: new Map(), pinch: null, lastTap: 0 };
const LB_MIN = 1, LB_MAX = 8;

function zoomFigure(el) {
  const fig = el.closest('.q-figure') || el.parentElement;
  const img = el.tagName === 'IMG' ? el : (fig && fig.querySelector('img'));
  if (img) openLightbox(img.currentSrc || img.src, img.alt);
}

function openLightbox(src, caption) {
  if (!src) return;
  closeLightbox();
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `
    <div class="lightbox-bar">
      <div class="lightbox-title">${esc(caption || 'Асуултын зураг')}</div>
      <div class="lightbox-actions">
        <button class="lb-btn" data-act="out" title="Жижигрүүлэх">${ICON.minus}</button>
        <div class="lb-zoom-label">100%</div>
        <button class="lb-btn" data-act="in" title="Томруулах">${ICON.plus}</button>
        <button class="lb-btn" data-act="reset" title="Анхны хэмжээ">${ICON.reset}</button>
        <button class="lb-btn" data-act="close" title="Хаах">${ICON.close}</button>
      </div>
    </div>
    <div class="lightbox-stage"><img class="lightbox-img smooth" src="${src}" alt="${esc(caption || '')}" draggable="false"></div>
    <div class="lightbox-foot">Чимхэж томруул · давхар товшиж ойрт · чирж хөдөлгө</div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';

  LB.el = el;
  LB.img = el.querySelector('.lightbox-img');
  LB.stage = el.querySelector('.lightbox-stage');
  LB.label = el.querySelector('.lb-zoom-label');
  LB.scale = 1; LB.x = 0; LB.y = 0; LB.pts.clear(); LB.pinch = null;
  lbApply();

  el.querySelectorAll('.lb-btn').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'in') lbZoomBy(1.5);
    else if (act === 'out') lbZoomBy(1 / 1.5);
    else if (act === 'reset') lbSet(1, 0, 0, true);
    else closeLightbox();
  }));

  const stage = LB.stage;
  stage.addEventListener('wheel', lbWheel, { passive: false });
  stage.addEventListener('pointerdown', lbDown);
  stage.addEventListener('pointermove', lbMove);
  stage.addEventListener('pointerup', lbUp);
  stage.addEventListener('pointercancel', lbUp);
  stage.addEventListener('dblclick', e => {
    e.preventDefault();
    lbToggleZoom(e.clientX, e.clientY);
  });
}

function closeLightbox() {
  const reader = document.querySelector('.lightbox.reader');
  const el = LB.el;
  if (!el && !reader) return;
  if (el) { el.remove(); LB.el = null; LB.img = null; LB.stage = null; }
  if (reader && reader !== el) reader.remove();
  if (!document.querySelector('.lightbox')) document.body.style.overflow = '';
}

function lbApply(smooth) {
  if (!LB.img) return;
  LB.img.classList.toggle('smooth', !!smooth);
  LB.img.style.transform = `translate3d(${LB.x}px,${LB.y}px,0) scale(${LB.scale})`;
  if (LB.label) LB.label.textContent = Math.round(LB.scale * 100) + '%';
  if (LB.stage) LB.stage.style.cursor = LB.scale > 1 ? 'grab' : 'zoom-in';
}

function lbClampPan() {
  if (!LB.img || !LB.stage) return;
  // Зургийг тайзны гадна бүрэн гаргахгүй барих
  const r = LB.img.getBoundingClientRect();
  const s = LB.stage.getBoundingClientRect();
  const maxX = Math.max(0, (r.width - s.width) / 2);
  const maxY = Math.max(0, (r.height - s.height) / 2);
  LB.x = Math.max(-maxX, Math.min(maxX, LB.x));
  LB.y = Math.max(-maxY, Math.min(maxY, LB.y));
}

function lbSet(scale, x, y, smooth) {
  LB.scale = Math.max(LB_MIN, Math.min(LB_MAX, scale));
  LB.x = x; LB.y = y;
  if (LB.scale === 1) { LB.x = 0; LB.y = 0; }
  lbApply(smooth);
  if (LB.scale > 1) { lbClampPan(); lbApply(smooth); }
}

/** Дэлгэцийн (cx,cy) цэгийг байрандаа барьж байгаад масштабыг өөрчилнө. */
function lbZoomAt(next, cx, cy, smooth) {
  if (!LB.stage) return;
  const s = LB.stage.getBoundingClientRect();
  const ox = cx - (s.left + s.width / 2);
  const oy = cy - (s.top + s.height / 2);
  const k = Math.max(LB_MIN, Math.min(LB_MAX, next)) / LB.scale;
  lbSet(LB.scale * k, ox - (ox - LB.x) * k, oy - (oy - LB.y) * k, smooth);
}

function lbZoomBy(factor) {
  if (!LB.stage) return;
  const s = LB.stage.getBoundingClientRect();
  lbZoomAt(LB.scale * factor, s.left + s.width / 2, s.top + s.height / 2, true);
}

function lbToggleZoom(cx, cy) {
  if (LB.scale > 1.05) lbSet(1, 0, 0, true);
  else lbZoomAt(2.8, cx, cy, true);
}

function lbWheel(e) {
  e.preventDefault();
  lbZoomAt(LB.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
}

function lbDown(e) {
  if (!LB.stage) return;
  LB.stage.setPointerCapture(e.pointerId);
  LB.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (LB.pts.size === 2) {
    const [a, b] = [...LB.pts.values()];
    LB.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: LB.scale };
  } else {
    LB.drag = { x: e.clientX, y: e.clientY, ox: LB.x, oy: LB.y, moved: 0 };
    LB.stage.classList.add('panning');
  }
}

function lbMove(e) {
  if (!LB.pts.has(e.pointerId)) return;
  LB.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (LB.pts.size >= 2 && LB.pinch) {
    const [a, b] = [...LB.pts.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    lbZoomAt(LB.pinch.scale * (dist / LB.pinch.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
  }

  if (!LB.drag) return;
  const dx = e.clientX - LB.drag.x;
  const dy = e.clientY - LB.drag.y;
  LB.drag.moved = Math.max(LB.drag.moved, Math.hypot(dx, dy));
  if (LB.scale > 1) {
    LB.x = LB.drag.ox + dx;
    LB.y = LB.drag.oy + dy;
    lbClampPan();
    lbApply();
  } else if (dy > 0) {
    // 1x үед доош чирвэл хаана
    LB.y = dy * .5;
    if (LB.el) LB.el.style.opacity = String(Math.max(.25, 1 - dy / 420));
    lbApply();
  }
}

function lbUp(e) {
  LB.pts.delete(e.pointerId);
  if (LB.pts.size < 2) LB.pinch = null;
  if (LB.stage) LB.stage.classList.remove('panning');
  const drag = LB.drag;
  LB.drag = null;
  if (!LB.el) return;

  if (LB.scale <= 1) {
    if (LB.y > 110) { closeLightbox(); return; }
    LB.el.style.opacity = '';
    LB.y = 0; lbApply(true);
    // Хөдөлгөөнгүй товшилт = давхар товшилт эсвэл ойртуулах
    if (drag && drag.moved < 6) {
      const now = Date.now();
      if (now - LB.lastTap < 300) { LB.lastTap = 0; lbToggleZoom(e.clientX, e.clientY); }
      else LB.lastTap = now;
    }
  } else if (drag && drag.moved < 6) {
    const now = Date.now();
    if (now - LB.lastTap < 300) { LB.lastTap = 0; lbToggleZoom(e.clientX, e.clientY); }
    else LB.lastTap = now;
  }
}

/* ── Асуултыг дэлгэц дүүрэн харах горим ──────────────────── */
function openReader() {
  if (!activeQ) return;
  closeLightbox();
  const el = document.createElement('div');
  el.className = 'lightbox reader';
  el.innerHTML = `
    <div class="lightbox-bar">
      <div class="lightbox-title">${esc(activeQ.title || 'Асуулт')}</div>
      <div class="lightbox-actions">
        <button class="lb-btn" onclick="cycleQScale()" title="Үсгийн хэмжээ"
                style="width:auto;padding:0 11px;font-size:.72rem;font-weight:700">Aa</button>
        <button class="lb-btn" onclick="closeLightbox()" title="Хаах">${ICON.close}</button>
      </div>
    </div>
    <div class="lightbox-stage"><div class="reader-body" id="reader-body">${buildReaderBody()}</div></div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
}

function buildReaderBody() {
  if (!activeQ) return '';
  const { q, st } = activeQ;
  return `
    ${buildQFigure(q.imageUrl, q.questionText)}
    <div class="q-text">${esc(q.questionText)}</div>
    <div class="q-options" id="reader-options">${buildQOptions(q, st)}</div>
    ${st.explanation ? `<div class="q-explanation"><b>Тайлбар:</b> ${esc(st.explanation)}</div>` : ''}`;
}

/** Үндсэн дэлгэц дээр хариулсны дараа нээлттэй байгаа томруулсан харагдацыг шинэчилнэ. */
function syncReader() {
  const body = document.getElementById('reader-body');
  if (body) body.innerHTML = buildReaderBody();
}

// ── Гар товчлуур ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

  if (e.key === 'Escape') { closeLightbox(); return; }

  if (LB.el) {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); lbZoomBy(1.5); }
    else if (e.key === '-') { e.preventDefault(); lbZoomBy(1 / 1.5); }
    else if (e.key === '0') { e.preventDefault(); lbSet(1, 0, 0, true); }
    return;
  }

  if (!activeQ) return;
  const keys = activeQ.q.options.map(o => o.key);
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= keys.length) { e.preventDefault(); pickOption(keys[n - 1]); return; }
  const byLetter = keys.find(k => k.toLowerCase() === e.key.toLowerCase());
  if (byLetter) { e.preventDefault(); pickOption(byLetter); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); activeQ.next && activeQ.next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); activeQ.prev && activeQ.prev(); }
  else if (e.key.toLowerCase() === 'f') { e.preventDefault(); openReader(); }
});

/* Бүлгийн өнгө: нэг ханалтын түвшинд байгаа зургаан өнгө — солонго биш. */
const CAT_COLORS = [
  ['#2f52dd','#1f3ba8'], ['#12798a','#0c5865'], ['#3f7d42','#2c5a2e'],
  ['#b07d16','#8a6110'], ['#b1553a','#8a4029'], ['#71519c','#543a76'],
];

// ── Widget builders ─────────────────────────────────────────
function buildProgressRingWidget(pct) {
  const r = 54, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 75 ? 'var(--success)' : pct >= 40 ? 'var(--gold)' : 'var(--primary)';
  return `
    <div class="widget-card" style="animation-delay:.08s">
      <div style="display:flex;align-items:center;gap:20px">
        <div class="progress-ring" style="width:120px;height:120px;flex-shrink:0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--sunken)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
              stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
              style="transition:stroke-dashoffset 1.1s var(--ease-out-expo)"/>
          </svg>
          <div class="progress-text">
            <span class="num" style="font-size:1.55rem;font-weight:800;color:${color}">${pct}%</span>
            <span style="font-size:.6rem;color:var(--text3);font-weight:600">дэвшилт</span>
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:.95rem;margin-bottom:6px">Нийт дэвшилт</div>
          <div style="font-size:.78rem;color:var(--text2);line-height:1.6;margin-bottom:10px">
            ${pct >= 75 ? 'Маш сайн! Та бараг бэлэн байна 🎉' : pct >= 40 ? 'Сайн ажиллаж байна! Үргэлжлүүлээрэй 💪' : 'Эхлэл сайхан! Дасгал хийгээрэй 📖'}
          </div>
          <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 1s var(--ease-out-expo)"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildDailyGoalWidget(done, total) {
  const todayKey = new Date().toDateString();
  const todayDone = parseInt(localStorage.getItem('daily_' + todayKey) || '0');
  const dailyGoal = 20;
  const goalPct = Math.min(100, Math.round((todayDone / dailyGoal) * 100));
  const segments = [];
  for (let i = 0; i < 5; i++) {
    const filled = todayDone >= (i + 1) * (dailyGoal / 5);
    segments.push(`<div class="goal-segment ${filled ? 'filled' : ''}" style="animation-delay:${i * .08}s"></div>`);
  }
  return `
    <div class="widget-card widget-daily-goal" style="animation-delay:.05s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="widget-icon" style="background:var(--primary-light);color:var(--primary)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div style="font-weight:800;font-size:.88rem">Өнөөдрийн зорилт</div>
            <div style="font-size:.7rem;color:var(--text3);font-weight:500">${todayDone}/${dailyGoal} асуулт</div>
          </div>
        </div>
        <div class="goal-pct" style="color:${goalPct >= 100 ? 'var(--success)' : 'var(--primary)'}">${goalPct}%</div>
      </div>
      <div class="goal-segments">${segments.join('')}</div>
      ${goalPct >= 100 ? '<div style="text-align:center;margin-top:10px;font-size:.78rem;color:var(--success);font-weight:700">✨ Өнөөдрийн зорилт биелсэн!</div>' : ''}
    </div>`;
}

function buildWeeklyHeatmap() {
  const days = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = 'daily_' + d.toDateString();
    const count = parseInt(localStorage.getItem(key) || '0');
    const level = count === 0 ? 0 : count < 5 ? 1 : count < 15 ? 2 : count < 30 ? 3 : 4;
    const isToday = i === 6;
    cells += `
      <div class="heatmap-day ${isToday ? 'today' : ''}" style="animation-delay:${i * .04}s">
        <div class="heatmap-label">${days[(dayOfWeek - 6 + i + 7) % 7]}</div>
        <div class="heatmap-cell level-${level}" title="${count} асуулт"></div>
        <div class="heatmap-count">${count}</div>
      </div>`;
  }
  return `
    <div class="widget-card" style="animation-delay:.12s">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div class="widget-icon" style="background:var(--success-light);color:var(--success)">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style="font-weight:800;font-size:.88rem">Долоо хоногийн идэвхи</div>
      </div>
      <div class="heatmap-row">${cells}</div>
      <div class="heatmap-legend">
        <span style="font-size:.65rem;color:var(--text3)">Бага</span>
        <div class="heatmap-cell level-0" style="width:14px;height:14px"></div>
        <div class="heatmap-cell level-1" style="width:14px;height:14px"></div>
        <div class="heatmap-cell level-2" style="width:14px;height:14px"></div>
        <div class="heatmap-cell level-3" style="width:14px;height:14px"></div>
        <div class="heatmap-cell level-4" style="width:14px;height:14px"></div>
        <span style="font-size:.65rem;color:var(--text3)">Их</span>
      </div>
    </div>`;
}

function buildMotivationalQuote() {
  const quotes = [
    { text: 'Бүх зүйл дасгалаар эхэлдэг.', emoji: '💪' },
    { text: 'Өнөөдрийн хичээл, маргаашийн амжилт.', emoji: '🌟' },
    { text: 'Алхам бүр зорилгод ойртуулна.', emoji: '🎯' },
    { text: 'Тууштай байвал бүх зүйл боломжтой.', emoji: '🔥' },
    { text: 'Мэдлэг бол хамгийн үнэтэй хөрөнгө.', emoji: '📚' },
    { text: 'Амжилт бол сонголт, тохиол биш.', emoji: '⭐' },
    { text: 'Бэлтгэл сайтай бол шалгалт хялбар.', emoji: '✨' },
    { text: 'Өөрийгөө хөгжүүл, ирээдүйгээ бүтээ.', emoji: '🚀' },
  ];
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  return `
    <div class="widget-card widget-quote" style="animation-delay:.15s">
      <div class="quote-emoji">${q.emoji}</div>
      <div class="quote-text">"${q.text}"</div>
      <div class="quote-label">Өнөөдрийн зоригийн үг</div>
    </div>`;
}

function buildTopCategoriesWidget(cats, gradients) {
  const sorted = cats.filter(c => !c.locked && c.completed > 0).sort((a, b) => {
    const pA = a.questionCount ? a.completed / a.questionCount : 0;
    const pB = b.questionCount ? b.completed / b.questionCount : 0;
    return pB - pA;
  }).slice(0, 3);
  if (!sorted.length) return '';
  let items = '';
  sorted.forEach((c, i) => {
    const pct = c.questionCount ? Math.round((c.completed / c.questionCount) * 100) : 0;
    const ci = cats.indexOf(c);
    const [c1] = gradients[ci % gradients.length];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    items += `
      <div class="top-cat-item" style="animation-delay:${i * .06}s" onclick="nav('category','${c.category_id}')">
        <div class="top-cat-medal">${medal}</div>
        <div class="top-cat-info">
          <div class="top-cat-name">${esc(c.name)}</div>
          <div class="top-cat-bar">
            <div class="top-cat-fill" style="width:${pct}%;background:${c1}"></div>
          </div>
        </div>
        <div class="top-cat-pct" style="color:${c1}">${pct}%</div>
      </div>`;
  });
  return `
    <div class="widget-card" style="animation-delay:.18s">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div class="widget-icon" style="background:var(--gold-light);color:var(--gold)">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2Z"/></svg>
        </div>
        <div style="font-weight:800;font-size:.88rem">Шилдэг бүлгүүд</div>
      </div>
      ${items}
    </div>`;
}

function buildAchievementWidget(stats) {
  const achievements = [];
  if (stats.totalAnswered >= 10) achievements.push({ icon: '🌱', title: 'Эхлэгч', desc: '10 асуулт хариулсан' });
  if (stats.totalAnswered >= 100) achievements.push({ icon: '📖', title: 'Суралцагч', desc: '100 асуулт хариулсан' });
  if (stats.totalAnswered >= 500) achievements.push({ icon: '🧠', title: 'Мэргэжилтэн', desc: '500 асуулт хариулсан' });
  if (stats.examsPassed >= 1) achievements.push({ icon: '✅', title: 'Анхны тэнцэлт', desc: 'Шалгалтад тэнцсэн' });
  if (stats.examsPassed >= 5) achievements.push({ icon: '🏅', title: 'Туршлагатай', desc: '5 шалгалтад тэнцсэн' });
  if (stats.currentStreak >= 3) achievements.push({ icon: '🔥', title: 'Халуун цуваа', desc: `${stats.currentStreak} хоног дараалсан` });
  if (stats.currentStreak >= 7) achievements.push({ icon: '💎', title: 'Долоо хоногийн аварга', desc: '7 хоног дараалсан' });
  if (stats.correctPercent >= 80) achievements.push({ icon: '🎯', title: 'Оноо буугч', desc: '80%+ зөв хариулт' });
  if (!achievements.length) {
    achievements.push({ icon: '🌟', title: 'Эхлээд үз', desc: 'Асуулт хариулж эхлээрэй' });
  }
  let items = achievements.slice(0, 4).map((a, i) => `
    <div class="achievement-item" style="animation-delay:${i * .06}s">
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-title">${a.title}</div>
      <div class="achievement-desc">${a.desc}</div>
    </div>`).join('');
  return `
    <div class="widget-card" style="animation-delay:.1s">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div class="widget-icon" style="background:var(--gold-light);color:var(--gold)">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div style="font-weight:800;font-size:.88rem">Амжилтууд</div>
      </div>
      <div class="achievement-grid">${items}</div>
    </div>`;
}

function trackDailyQuestion() {
  const key = 'daily_' + new Date().toDateString();
  const c = parseInt(localStorage.getItem(key) || '0');
  localStorage.setItem(key, String(c + 1));
}

// ── Auth ────────────────────────────────────────────────────
async function initApp() {
  try { config = await api('/config'); } catch { config = {}; }
  if (token) {
    try {
      user = await api('/auth/me');
      showApp();
    } catch {
      token = null;
      localStorage.removeItem('token');
      showLogin();
    }
  } else {
    showLogin();
  }
}

function showLogin() {
  $('#app-header').style.display = 'none';
  $('#bottom-nav').classList.remove('show');
  const webClientId = config?.google?.webClientId;
  $('#app').innerHTML = `
    <div class="login-screen">
      <div class="login-bg">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>
      <div class="login-hero">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="login-tagline">Монголын #1 жолооны апп</div>
      <h1>ЗХД Шалгалт</h1>
      <p class="subtitle">Замын хөдөлгөөний дүрмийн шалгалтад бэлдэх хамгийн хялбар арга</p>
      <div id="google-signin-btn"></div>
      ${!webClientId ? '<p style="color:var(--danger);font-size:.8rem;margin-top:12px">Google нэвтрэлт тохируулагдаагүй</p>' : ''}
      <div style="width:100%;max-width:320px;margin-top:16px">
        <button onclick="showCodeLoginForm()" class="code-login-toggle-btn">🔑 Кодоор нэвтрэх</button>
      </div>
      <div id="code-login-form" style="display:none;width:100%;max-width:320px;margin-top:16px">
        <div class="code-form-box">
          <p class="code-form-label">4 оронтой код</p>
          <div style="display:flex;gap:8px;justify-content:center" id="code-digits-row">
            ${[0, 1, 2, 3].map(i => `
            <input class="code-digit" type="tel" inputmode="numeric" maxlength="1" data-idx="${i}"
                   aria-label="Кодын ${i + 1}-р орон"
                   ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'}
                   oninput="codeDigitInput(this,${i})" onkeydown="codeDigitKey(event,${i})" onpaste="codeDigitPaste(event)">`).join('')}
          </div>
          <p id="code-error" class="code-error-text" style="display:none"></p>
          <button onclick="submitCodeLogin()" id="code-submit-btn" class="code-submit-btn">Нэвтрэх</button>
        </div>
      </div>
      <div id="login-download" style="margin-top:24px;width:100%;max-width:320px"></div>
      <button class="theme-toggle" id="login-theme-toggle" onclick="toggleTheme()" style="position:fixed;top:16px;right:16px;z-index:10" title="Горим солих">☀️</button>
    </div>`;
  if (webClientId && window.google) {
    google.accounts.id.initialize({
      client_id: webClientId,
      callback: handleGoogleResponse,
    });
    google.accounts.id.renderButton($('#google-signin-btn'), {
      theme: 'outline', size: 'large', text: 'signin_with', locale: 'mn',
    });
  }
  checkApkAvailable('login-download');
  updateThemeIcon();
}

async function handleGoogleResponse(response) {
  try {
    const data = await api('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: response.credential }),
    });
    token = data.session_token;
    user = data.user;
    localStorage.setItem('token', token);
    showApp();
  } catch (e) {
    toast(e.message);
  }
}

const CODE_LEN = 4;

function codeDigitEls() {
  return Array.from(document.querySelectorAll('.code-digit'));
}

function showCodeLoginForm() {
  const form = document.getElementById('code-login-form');
  if (!form) return;
  const open = form.style.display === 'none';
  form.style.display = open ? 'block' : 'none';
  if (open) {
    clearCodeError();
    codeDigitEls()[0]?.focus();
  }
}

function clearCodeError() {
  const errEl = document.getElementById('code-error');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  codeDigitEls().forEach(d => d.classList.remove('invalid'));
}

function showCodeError(msg) {
  const errEl = document.getElementById('code-error');
  if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  codeDigitEls().forEach(d => d.classList.add('invalid'));
  const row = document.getElementById('code-digits-row');
  if (row) {
    row.classList.remove('shake-once');
    void row.offsetWidth;              // дахин сэргээж анимацийг эхнээс нь тоглуулна
    row.classList.add('shake-once');
  }
}

/** Оруулсан кодыг сервер рүү явуулахаас өмнө шалгана. Алдаагүй бол null. */
function validateCode(code) {
  if (!code) return 'Кодоо оруулна уу';
  if (/\D/.test(code)) return 'Зөвхөн тоо оруулна уу';
  if (code.length < CODE_LEN) return `${CODE_LEN} оронтой кодоо бүтэн оруулна уу`;
  return null;
}

function currentCode() {
  return codeDigitEls().map(d => d.value).join('');
}

function fillCodeDigits(text, from = 0) {
  const nums = text.replace(/\D/g, '').slice(0, CODE_LEN - from).split('');
  const digits = codeDigitEls();
  nums.forEach((n, i) => { if (digits[from + i]) digits[from + i].value = n; });
  const nextIdx = Math.min(from + nums.length, CODE_LEN - 1);
  digits[nextIdx]?.focus();
}

function codeDigitInput(el, idx) {
  clearCodeError();
  const raw = el.value.replace(/\D/g, '');
  if (raw.length > 1) { el.value = ''; fillCodeDigits(raw, idx); return; }
  el.value = raw;
  if (el.value && idx < CODE_LEN - 1) codeDigitEls()[idx + 1]?.focus();
}

function codeDigitPaste(e) {
  const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!text) return;
  e.preventDefault();
  clearCodeError();
  fillCodeDigits(text, 0);
}

function codeDigitKey(e, idx) {
  const digits = codeDigitEls();
  if (e.key === 'Backspace' && !digits[idx].value && idx > 0) {
    digits[idx - 1].focus();
  } else if (e.key === 'ArrowLeft' && idx > 0) {
    e.preventDefault();
    digits[idx - 1].focus();
  } else if (e.key === 'ArrowRight' && idx < CODE_LEN - 1) {
    e.preventDefault();
    digits[idx + 1].focus();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    submitCodeLogin();
  }
}

async function submitCodeLogin() {
  const code = currentCode();
  const btn = document.getElementById('code-submit-btn');

  const invalid = validateCode(code);
  if (invalid) {
    showCodeError(invalid);
    codeDigitEls()[Math.min(code.length, CODE_LEN - 1)]?.focus();
    return;
  }

  clearCodeError();
  if (btn) { btn.disabled = true; btn.textContent = 'Шалгаж байна...'; }

  try {
    const data = await api('/auth/code-login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    token = data.session_token;
    user = data.user;
    localStorage.setItem('token', token);
    showApp();
  } catch (e) {
    // Буруу код — мессежийг үзүүлээд талбарыг цэвэрлэж дахин оролдох боломж өгнө.
    showCodeError(e.message || 'Код буруу байна');
    codeDigitEls().forEach(d => { d.value = ''; });
    codeDigitEls()[0]?.focus();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Нэвтрэх'; }
  }
}

function logout() {
  api('/auth/logout', { method: 'POST' }).catch(() => {});
  token = null;
  user = null;
  localStorage.removeItem('token');
  showLogin();
}

// ── Navigation ──────────────────────────────────────────────
function showApp() {
  $('#app-header').style.display = '';
  $('#bottom-nav').classList.add('show');
  renderHeader();
  nav(currentPage);
}

function renderHeader() {
  const pic = user?.picture || '';
  const name = user?.profileName || user?.name || '';
  $('#header-right').innerHTML = `
    <a href="/api/download/app" class="header-download-btn" id="header-dl-btn" style="display:none" title="Апп татах" download>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </a>
    ${user?.isPro ? '<span class="badge badge-pro" style="animation:none;font-size:.6rem;padding:3px 8px">PRO</span>' : ''}
    <span class="user-name">${esc(name)}</span>
    ${pic ? `<img class="avatar" src="${esc(pic)}" alt="">` : ''}
    <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Горим солих">☀️</button>`;
  updateThemeIcon();
  fetch(API + '/download/check').then(r => r.json()).then(d => {
    const btn = $('#header-dl-btn');
    if (btn && d.available) btn.style.display = '';
  }).catch(() => {});
}

function nav(page, data) {
  currentPage = page;
  cancelAutoNext();
  closeLightbox();
  activeQ = null;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const app = $('#app');
  app.innerHTML = showDotLoader();
  window.scrollTo({ top: 0, behavior: 'instant' });
  switch (page) {
    case 'home': renderHome(); break;
    case 'exam': renderExamMenu(); break;
    case 'stats': renderStats(); break;
    case 'profile': renderProfile(); break;
    case 'category': renderCategory(data); break;
    case 'practice': renderPractice(data); break;
    case 'exam-session': renderExamSession(data); break;
    case 'exam-result': renderExamResult(data); break;
    case 'attempt-detail': renderAttemptDetail(data); break;
    case 'bookmarks': renderBookmarks(); break;
    case 'wrong': renderWrong(); break;
    case 'pro': renderPro(); break;
    case 'bank-pay': renderBankPay(data); break;
    default: renderHome();
  }
}

// ── Home (categories) ───────────────────────────────────────
async function renderHome() {
  try {
    const cats = await api('/categories');
    const gradients = CAT_COLORS;
    const totalQ = cats.reduce((s, c) => s + (c.questionCount || 0), 0);
    const totalDone = cats.reduce((s, c) => s + (c.completed || 0), 0);
    const overallPct = totalQ ? Math.round((totalDone / totalQ) * 100) : 0;
    const firstName = (user?.profileName || user?.name || '').split(' ')[0] || 'Хэрэглэгч';

    let html = `
      <div class="welcome-banner">
        <h2>${getGreeting()}, ${esc(firstName)}! 👋</h2>
        <p>Өнөөдөр ч давтлага хийгээрэй</p>
        <div class="welcome-stats">
          <div class="welcome-stat">
            <div class="welcome-stat-value stat-value" data-count="${overallPct}">${overallPct}%</div>
            <div class="welcome-stat-label">Дэвшилт</div>
          </div>
          <div class="welcome-stat">
            <div class="welcome-stat-value stat-value" data-count="${totalDone}">${totalDone}</div>
            <div class="welcome-stat-label">Хариулсан</div>
          </div>
          <div class="welcome-stat">
            <div class="welcome-stat-value stat-value" data-count="${cats.length}">${cats.length}</div>
            <div class="welcome-stat-label">Бүлэг</div>
          </div>
        </div>
      </div>

      ${buildDailyGoalWidget(totalDone, totalQ)}

      ${buildProgressRingWidget(overallPct)}

      <div class="quick-actions" style="grid-template-columns:1fr 1fr 1fr">
        <div class="quick-action" onclick="nav('exam')" style="animation-delay:.05s">
          <div class="quick-action-icon" style="background:var(--primary-light);color:var(--primary)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg></div>
          <div class="quick-action-label">Шалгалт</div>
        </div>
        <div class="quick-action" onclick="nav('stats')" style="animation-delay:.1s">
          <div class="quick-action-icon" style="background:var(--success-light);color:var(--success)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <div class="quick-action-label">Статистик</div>
        </div>
        <div class="quick-action" onclick="nav('bookmarks')" style="animation-delay:.15s">
          <div class="quick-action-icon" style="background:var(--gold-light);color:var(--gold)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.6 15 9 22 9.9 17 14.7 18.2 21.5 12 18.3 5.8 21.5 7 14.7 2 9.9 9 9 12 2.6"/></svg></div>
          <div class="quick-action-label">Хадгалсан</div>
        </div>
      </div>

      ${buildWeeklyHeatmap()}

      ${buildMotivationalQuote()}

      ${buildTopCategoriesWidget(cats, gradients)}

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 class="section-title" style="margin-bottom:0">Бүх бүлгүүд</h2>
        <span style="font-size:.75rem;color:var(--text3);font-weight:600">${cats.length} бүлэг</span>
      </div>

      <div class="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="cat-search" placeholder="Бүлэг хайх..." oninput="filterCategories(this.value)">
      </div>

      <div id="cat-list">`;

    cats.forEach((c, i) => {
      const [c1, c2] = gradients[i % gradients.length];
      const pct = c.questionCount ? Math.round((c.completed / c.questionCount) * 100) : 0;
      html += `
      <div class="cat-item ${c.locked ? 'locked' : ''}" data-name="${esc(c.name).toLowerCase()}" style="animation-delay:${i * .03}s" onclick="${c.locked ? `nav('pro')` : `nav('category','${c.category_id}')`}">
        <div class="cat-icon" style="background:linear-gradient(135deg,${c1}15,${c2}22);color:${c1}">
          ${c.locked ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' : (i + 1)}
        </div>
        <div class="cat-info">
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-meta">
            <span>${c.completed}/${c.questionCount}</span>
            ${c.locked ? '<span class="badge badge-pro" style="font-size:.55rem;padding:1px 6px;animation:none">PRO</span>' : `<span style="color:${c1};font-weight:700">${pct}%</span>`}
          </div>
          ${!c.locked ? `<div class="cat-progress"><div class="cat-progress-bar" style="width:${c.progressPercent}%"></div></div>` : ''}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--text3);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    });
    html += '</div>';

    if (!user?.isPro) {
      html += `
        <div class="tip-card" style="margin-top:16px;cursor:pointer" onclick="nav('pro')">
          <div class="tip-card-icon">💎</div>
          <div><strong>PRO-д шинэчлэх</strong> — Бүх 36 бүлэг, хязгааргүй шалгалт, алдаатай асуултын горим</div>
        </div>`;
    }

    html += `
      <button class="fab" onclick="startExam()" title="Шалгалт эхлүүлэх">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>`;

    $('#app').innerHTML = html;

    setTimeout(() => {
      document.querySelectorAll('.stat-value[data-count]').forEach(el => {
        animateCounter(el, parseInt(el.dataset.count));
      });
    }, 200);
  } catch (e) {
    $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div><div class="empty-title">Алдаа гарлаа</div>${esc(e.message)}</div>`;
  }
}

function filterCategories(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('#cat-list .cat-item').forEach(el => {
    const name = el.getAttribute('data-name') || '';
    el.style.display = !q || name.includes(q) ? '' : 'none';
  });
}

// ── Category questions (practice) ───────────────────────────
let practiceData = { questions: [], index: 0, catId: '' };

async function renderCategory(catId) {
  try {
    const qs = await api(`/categories/${catId}/questions`);
    practiceData = { questions: qs, index: 0, catId };
    renderPracticeQuestion();
  } catch (e) {
    if (e.message.includes('PRO')) { nav('pro'); return; }
    $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`;
  }
}

function renderPractice(data) {
  if (data && data.questions) practiceData = data;
  renderPracticeQuestion();
}

// Зөв хариулсан бол шууд урагшилна; буруу бол тайлбарыг уншихад хугацаа өгнө.
const AUTO_NEXT_CORRECT = 620;
const AUTO_NEXT_WRONG = 2600;

function renderPracticeQuestion(dir) {
  cancelAutoNext();
  const { questions, index } = practiceData;
  if (!questions.length) { $('#app').innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Асуулт олдсонгүй</div></div>'; return; }
  const q = questions[index];
  const backLabel = q.category_name || 'Буцах';
  const pct = Math.round(((index + 1) / questions.length) * 100);

  activeQ = {
    q,
    mode: 'practice',
    title: `${esc(backLabel)} · ${index + 1}/${questions.length}`,
    st: { selected: q._selected || null, correctKey: q._correctKey || null, explanation: q._explanation || '', revealed: !!q._answered },
    next: () => practiceNav(1),
    prev: () => practiceNav(-1),
  };

  $('#app').innerHTML = `
    <div class="back-btn" onclick="nav('home')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      ${esc(backLabel)}
    </div>
    <div class="progress-header">
      <div class="progress-header-bar"><div class="progress-header-fill" style="width:${pct}%"></div></div>
      <div class="progress-header-text">${index + 1}/${questions.length}</div>
    </div>
    <div class="card q-stage ${dir < 0 ? 'back' : ''}">
      <div class="q-header">
        <span class="q-counter">Асуулт ${index + 1}</span>
        <div style="display:flex;align-items:center;gap:5px">
          ${buildQTools()}
          <button class="q-bookmark ${q.isBookmarked ? 'on' : ''}" onclick="toggleBookmark('${q.question_id}')"
                  title="${q.isBookmarked ? 'Хадгалсанаас хасах' : 'Хадгалах'}">${q.isBookmarked ? '★' : '☆'}</button>
        </div>
      </div>
      ${buildQFigure(q.imageUrl, q.questionText)}
      <div class="q-text">${esc(q.questionText)}</div>
      <div class="q-options" id="q-options">${buildQOptions(q, activeQ.st)}</div>
      <div id="q-feedback">${activeQ.st.explanation ? `<div class="q-explanation"><b>Тайлбар:</b> ${esc(activeQ.st.explanation)}</div>` : ''}</div>
      <div class="q-nav">
        <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="practiceNav(-1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Өмнөх
        </button>
        <button class="btn btn-primary" ${index === questions.length - 1 ? 'disabled' : ''} onclick="practiceNav(1)">
          Дараах
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;
  applyQScale();
}

async function answerPractice(qid, key) {
  const q = practiceData.questions[practiceData.index];
  if (!q || q._answered) return;
  cancelAutoNext();

  // Сүлжээг хүлээхгүйгээр сонголтыг шууд тэмдэглэнэ.
  q._selected = key;
  if (activeQ) activeQ.st.selected = key;
  markOptions({ selected: key });
  syncReader();

  try {
    const res = await api('/practice/answer', {
      method: 'POST',
      body: JSON.stringify({ question_id: qid, selectedKey: key }),
    });
    q._answered = true;
    q._correctKey = res.correctKey;
    q._explanation = res.explanation || '';
    // Хариу ирэх хооронд өөр асуулт руу шилжсэн бол DOM-д хүрэхгүй.
    if (!onQuestion(qid)) return;
    const st = { selected: key, correctKey: res.correctKey, explanation: q._explanation, revealed: true };
    activeQ.st = st;
    markOptions(st);
    const fb = $('#q-feedback');
    if (fb) fb.innerHTML = res.explanation ? `<div class="q-explanation"><b>Тайлбар:</b> ${esc(res.explanation)}</div>` : '';
    syncReader();
    trackDailyQuestion();

    const last = practiceData.index >= practiceData.questions.length - 1;
    if (!last) {
      scheduleAutoNext(res.isCorrect ? AUTO_NEXT_CORRECT : AUTO_NEXT_WRONG,
                       () => { if (onQuestion(qid)) practiceNav(1); });
    }
  } catch (e) {
    q._selected = null;
    if (onQuestion(qid)) {
      activeQ.st.selected = null;
      markOptions({});
      syncReader();
    }
    toast(e.message);
  }
}

/** Асуулт `qid` одоо ч дэлгэц дээр харагдаж байна уу. */
function onQuestion(qid) {
  return !!activeQ && activeQ.q.question_id === qid;
}

/** Хариултын товчнуудын төлөвийг бүхэлд нь дахин зурахгүйгээр шинэчилнэ. */
function markOptions(st) {
  document.querySelectorAll('.q-options .q-option').forEach(b => {
    const k = b.dataset.key;
    b.classList.remove('selected', 'correct', 'wrong', 'dim');
    b.disabled = !!st.revealed;
    const bar = b.querySelector('.q-autobar');
    if (bar) bar.remove();
    if (st.revealed) {
      if (k === st.correctKey) b.classList.add('correct');
      else if (k === st.selected) b.classList.add('wrong');
      else b.classList.add('dim');
    } else if (k === st.selected) {
      b.classList.add('selected');
    }
  });
}

function practiceNav(dir) {
  cancelAutoNext();
  const next = practiceData.index + dir;
  if (next < 0 || next >= practiceData.questions.length) return;
  practiceData.index = next;
  renderPracticeQuestion(dir);
  if (document.querySelector('.lightbox.reader')) syncReader();
}

async function toggleBookmark(qid) {
  const btn = document.querySelector('.q-bookmark');
  try {
    const res = await api(`/questions/${qid}/bookmark`, { method: 'POST' });
    const q = practiceData.questions[practiceData.index];
    if (q) q.isBookmarked = res.isBookmarked;
    if (btn) {
      btn.textContent = res.isBookmarked ? '★' : '☆';
      btn.classList.toggle('on', res.isBookmarked);
      btn.title = res.isBookmarked ? 'Хадгалсанаас хасах' : 'Хадгалах';
    }
    toast(res.isBookmarked ? '★ Хадгаллаа' : 'Хадгалсанаас хаслаа');
  } catch (e) { toast(e.message); }
}

// ── Exam menu ───────────────────────────────────────────────
async function renderExamMenu() {
  try {
    const [limits, active] = await Promise.all([
      api('/me/limits'),
      api('/exam/active'),
    ]);
    let html = `<h2 class="section-title">Шалгалт</h2>`;

    if (active.active) {
      html += `
        <div class="card card-glow" style="border-left:4px solid var(--warning)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--warning-light);display:flex;align-items:center;justify-content:center">⏳</div>
            <div>
              <div style="font-weight:700;font-size:.92rem">Дуусаагүй шалгалт</div>
              <div style="font-size:.75rem;color:var(--text3)">Үргэлжлүүлж дуусгана уу</div>
            </div>
          </div>
          <button class="btn btn-primary btn-block" onclick="startExam()">Үргэлжлүүлэх</button>
        </div>`;
    }

    if (active.expiredAttempt) {
      html += `
        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--danger-light);display:flex;align-items:center;justify-content:center">⏰</div>
            <div>
              <div style="font-weight:700;font-size:.88rem">Хугацаа дууссан</div>
              <div style="font-size:.78rem;color:var(--text3)">${active.expiredAttempt.score}/${active.expiredAttempt.total} (${active.expiredAttempt.percent}%)</div>
            </div>
          </div>
          <button class="btn btn-outline btn-block btn-sm" onclick="nav('attempt-detail','${active.expiredAttempt.attempt_id}')">Дэлгэрэнгүй харах</button>
        </div>`;
    }

    const examLeft = limits.isPro ? '∞' : `${Math.max(0, limits.freeDailyExams - limits.examsTaken)}`;
    const qLeft = limits.isPro ? '∞' : `${Math.max(0, limits.freeDailyQuestions - limits.questionsAnswered)}`;
    html += `
      <div class="stat-grid">
        <div class="stat-card" data-color="purple" style="animation-delay:.05s"><div class="stat-value">${examLeft}</div><div class="stat-label">Өнөөдрийн шалгалт</div></div>
        <div class="stat-card" data-color="blue" style="animation-delay:.1s"><div class="stat-value">${qLeft}</div><div class="stat-label">Өнөөдрийн асуулт</div></div>
      </div>

      <div class="card card-gradient">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="width:44px;height:44px;border-radius:14px;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div>
            <div style="font-weight:700;font-size:.95rem">Шинэ шалгалт</div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <span style="background:var(--surface2);padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:600;color:var(--text3)">20 асуулт</span>
              <span style="background:var(--surface2);padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:600;color:var(--text3)">25 мин</span>
              <span style="background:var(--success-light);padding:2px 8px;border-radius:6px;font-size:.7rem;font-weight:700;color:var(--success)">≥75%</span>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-block btn-lg" onclick="startExam()">
          Эхлүүлэх
        </button>
      </div>`;

    const attempts = await api('/attempts?limit=5');
    if (attempts.length) {
      html += '<h2 class="section-title" style="margin-top:20px">Сүүлийн шалгалтууд</h2>';
      attempts.forEach((a, i) => {
        html += `
          <div class="card" style="cursor:pointer;padding:14px 16px;animation-delay:${i * .05}s" onclick="nav('attempt-detail','${a.attempt_id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:32px;height:32px;border-radius:10px;background:${a.passed ? 'var(--success-light)' : 'var(--danger-light)'};display:flex;align-items:center;justify-content:center;font-size:.85rem">${a.passed ? '✓' : '✕'}</div>
                <div>
                  <span style="font-size:.85rem;font-weight:700">${a.score}/${a.total}</span>
                  <span style="font-size:.78rem;color:var(--text3);margin-left:6px">${a.percent}%</span>
                </div>
              </div>
              <span style="font-size:.72rem;color:var(--text3);font-weight:500">${formatDate(a.finishedAt)}</span>
            </div>
          </div>`;
      });
    }

    html += `
      <div class="divider-text" style="margin-top:20px">Бусад</div>
      <div class="quick-actions">
        <div class="quick-action" onclick="nav('bookmarks')" style="animation-delay:.05s">
          <div class="quick-action-icon" style="background:var(--gold-light);color:var(--gold)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2.6 15 9 22 9.9 17 14.7 18.2 21.5 12 18.3 5.8 21.5 7 14.7 2 9.9 9 9 12 2.6"/></svg></div>
          <div class="quick-action-label">Хадгалсан</div>
        </div>
        <div class="quick-action" onclick="nav('wrong')" style="animation-delay:.1s">
          <div class="quick-action-icon" style="background:var(--danger-light);color:var(--danger)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <div class="quick-action-label">Алдаатай</div>
        </div>
      </div>`;
    if (!user?.isPro) {
      html += `<button class="btn btn-pro btn-block btn-lg" style="margin-top:8px" onclick="nav('pro')">👑 PRO болох</button>`;
    }

    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`; }
}

// ── Exam session ────────────────────────────────────────────
let examState = null;
let examTimer = null;

async function startExam(categoryId) {
  try {
    const url = categoryId ? `/exam/start?category_id=${categoryId}` : '/exam/start';
    const data = await api(url);
    examState = {
      session_id: data.session_id,
      questions: data.questions,
      answers: data.answers || {},
      remaining: data.remainingSeconds,
      index: 0,
    };
    nav('exam-session');
  } catch (e) { toast(e.message); }
}

function renderExamSession() {
  if (!examState) { nav('exam'); return; }
  const { questions, answers, remaining } = examState;
  const answered = Object.keys(answers).length;

  // Хүрээг нэг удаа зурж, дараа нь зөвхөн асуултын хэсгийг сольдог —
  // ингэснээр хариулт дарахад шилжилт шууд мэдрэгдэнэ.
  $('#app').innerHTML = `
    <div class="exam-bar">
      <button class="btn btn-outline btn-sm" onclick="confirmAbandon()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Болих
      </button>
      <div class="exam-answered" id="exam-answered">${answered}/${questions.length}</div>
      <div class="exam-timer ${remaining > 300 ? 'ok' : ''}" id="exam-timer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        ${formatTime(remaining)}
      </div>
    </div>
    <div class="progress-header" style="margin-bottom:10px">
      <div class="progress-header-bar"><div class="progress-header-fill" id="exam-progress" style="width:0%"></div></div>
    </div>
    <div class="exam-progress-dots" id="exam-dots">
      ${questions.map((qq, i) => `<div class="exam-dot" data-i="${i}" onclick="examGo(${i})">${i + 1}</div>`).join('')}
    </div>
    <div id="exam-card"></div>`;

  startExamTimer();
  renderExamQuestion();
}

function startExamTimer() {
  clearInterval(examTimer);
  examTimer = setInterval(() => {
    examState.remaining--;
    const timerEl = $('#exam-timer');
    if (timerEl) {
      timerEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${formatTime(examState.remaining)}`;
      timerEl.className = 'exam-timer'
        + (examState.remaining > 300 ? ' ok' : '')
        + (examState.remaining <= 60 ? ' low' : '');
    }
    if (examState.remaining <= 0) {
      clearInterval(examTimer);
      submitExam();
    }
  }, 1000);
}

// Шалгалтын горимд зөв/буруугаа шууд хэлэхгүй тул сонгомогц бараг шууд урагшилна.
const AUTO_NEXT_EXAM = 210;

function renderExamQuestion(dir) {
  cancelAutoNext();
  const card = $('#exam-card');
  if (!card) { renderExamSession(); return; }

  const { questions, answers, index } = examState;
  const q = questions[index];
  const last = index === questions.length - 1;
  const st = { selected: answers[q.question_id] || null, revealed: false };

  activeQ = {
    q,
    mode: 'exam',
    title: `Шалгалт · Асуулт ${index + 1}/${questions.length}`,
    st,
    next: () => examGo(index + 1),
    prev: () => examGo(index - 1),
  };

  card.innerHTML = `
    <div class="card q-stage ${dir < 0 ? 'back' : ''}">
      <div class="q-header">
        <span class="q-counter">Асуулт ${index + 1} / ${questions.length}</span>
        ${buildQTools()}
      </div>
      ${buildQFigure(q.imageUrl, q.questionText)}
      <div class="q-text">${esc(q.questionText)}</div>
      <div class="q-options" id="q-options">${buildQOptions(q, st)}</div>
      <div class="q-nav">
        <button class="btn btn-outline btn-icon" ${index === 0 ? 'disabled' : ''} onclick="examGo(${index - 1})" title="Өмнөх" style="flex:0 0 auto">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        ${last
          ? `<button class="btn btn-accent" style="flex:1" onclick="submitExam()">Шалгалт дуусгах</button>`
          : `<button class="btn btn-primary" style="flex:1" onclick="examGo(${index + 1})">Дараах
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
             </button>`}
      </div>
    </div>`;

  updateExamChrome();
  applyQScale();
}

/** Цэгүүд, тоолуур, явцын мөрийг дахин зурахгүйгээр шинэчилнэ. */
function updateExamChrome() {
  const { questions, answers, index } = examState;
  document.querySelectorAll('#exam-dots .exam-dot').forEach((d, i) => {
    d.classList.toggle('answered', !!answers[questions[i].question_id]);
    d.classList.toggle('current', i === index);
  });
  const counter = $('#exam-answered');
  if (counter) counter.textContent = `${Object.keys(answers).length}/${questions.length}`;
  const bar = $('#exam-progress');
  if (bar) bar.style.width = Math.round(((index + 1) / questions.length) * 100) + '%';
}

function examAnswer(key) {
  const q = examState.questions[examState.index];
  const last = examState.index === examState.questions.length - 1;
  cancelAutoNext();

  examState.answers[q.question_id] = key;
  if (activeQ) activeQ.st.selected = key;
  markOptions({ selected: key });
  updateExamChrome();
  syncReader();

  // Сервер рүү бичихийг хүлээхгүй — шилжилт хойшлохгүй байх нь чухал.
  api('/exam/answer', {
    method: 'POST',
    body: JSON.stringify({ session_id: examState.session_id, question_id: q.question_id, selectedKey: key }),
  }).catch(() => {});

  if (!last) {
    scheduleAutoNext(AUTO_NEXT_EXAM,
                     () => { if (onQuestion(q.question_id)) examGo(examState.index + 1); });
  }
}

function examGo(i) {
  cancelAutoNext();
  if (!examState || i < 0 || i >= examState.questions.length) return;
  const dir = i < examState.index ? -1 : 1;
  examState.index = i;
  renderExamQuestion(dir);
  if (document.querySelector('.lightbox.reader')) syncReader();
}

function confirmAbandon() {
  if (confirm('Шалгалтаа орхих уу? Өнөөдрийн эрх зарцуулагдсан хэвээр байна.')) {
    clearInterval(examTimer);
    api('/exam/abandon', { method: 'POST' }).catch(() => {});
    examState = null;
    nav('exam');
  }
}

// Дуусгахад асуухгүй — шууд илгээнэ. Дараалаад дарахад давхар илгээхээс сэргийлнэ.
let examSubmitting = false;

async function submitExam() {
  if (!examState || examSubmitting) return;
  examSubmitting = true;
  clearInterval(examTimer);
  const btn = document.querySelector('.q-nav .btn-accent');
  if (btn) { btn.disabled = true; btn.textContent = 'Илгээж байна...'; }
  try {
    const result = await api('/exam/submit', {
      method: 'POST',
      body: JSON.stringify({ session_id: examState.session_id }),
    });
    examState = null;
    nav('exam-result', result);
  } catch (e) {
    toast(e.message);
    examState = null;
    nav('exam');
  } finally {
    examSubmitting = false;
  }
}

// ── Exam result ─────────────────────────────────────────────
function renderExamResult(result) {
  if (!result) { nav('exam'); return; }
  if (result.passed) showConfetti();
  const cls = result.passed ? 'pass' : 'fail';
  let html = `
    <div class="card result-card ${cls}">
      <div class="result-bg"></div>
      <div class="result-emoji">${result.passed ? '🎉' : '💪'}</div>
      <div class="result-circle ${cls}" style="--pct:${result.percent}">
        <div class="score">${result.percent}%</div>
        <div class="label">${result.score}/${result.total}</div>
      </div>
      <div class="result-title">${result.passed ? 'Тэнцлээ!' : 'Тэнцсэнгүй'}</div>
      <div class="result-desc">
        ${result.passed ? 'Баяр хүргэе! Та амжилттай тэнцлээ.' : `Тэнцэхэд ≥75% шаардлагатай. Та ${result.percent}% авлаа.`}
      </div>
      ${result.durationSeconds ? `<div class="result-meta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${Math.floor(result.durationSeconds / 60)} мин ${result.durationSeconds % 60} сек</div>` : ''}
    </div>`;

  if (result.detail) {
    const wrongCount = result.detail.filter(d => !d.isCorrect).length;
    html += `
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div class="stat-card" data-color="green" style="flex:1"><div class="stat-value">${result.score}</div><div class="stat-label">Зөв</div></div>
        <div class="stat-card" data-color="red" style="flex:1"><div class="stat-value">${wrongCount}</div><div class="stat-label">Буруу</div></div>
      </div>
      <h2 class="section-title">Хариултууд</h2>`;
    result.detail.forEach((d, i) => {
      html += `
        <div class="review-item ${d.isCorrect ? 'correct-review' : 'wrong-review'}" style="animation-delay:${i * .04}s">
          <div class="review-q">${i + 1}. ${esc(d.questionText)}</div>
          ${d.imageUrl ? `<img class="review-img" src="${d.imageUrl}" alt="${esc(d.questionText)}" loading="lazy" onclick="openLightbox(this.src, this.alt)" title="Томруулах">` : ''}
          ${d.options.map(o => {
            let cls = '';
            if (o.key === d.correctKey) cls = 'correct';
            else if (o.key === d.selectedKey && !d.isCorrect) cls = 'wrong';
            return `<div class="q-option ${cls}" style="margin-bottom:4px;cursor:default;pointer-events:none"><span class="key">${o.key}</span><span>${esc(optionText(o))}</span></div>`;
          }).join('')}
          ${d.explanation ? `<div class="q-explanation">💡 ${esc(d.explanation)}</div>` : ''}
        </div>`;
    });
  }

  html += `
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="btn btn-outline" style="flex:1" onclick="nav('exam')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Буцах
      </button>
      <button class="btn btn-primary" style="flex:1" onclick="startExam()">Дахин өгөх</button>
    </div>`;
  $('#app').innerHTML = html;
}

// ── Attempt detail ──────────────────────────────────────────
async function renderAttemptDetail(attemptId) {
  try {
    const a = await api(`/attempts/${attemptId}`);
    renderExamResult(a);
  } catch (e) { $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`; }
}

// ── Bookmarks ───────────────────────────────────────────────
async function renderBookmarks() {
  try {
    const qs = await api('/questions/bookmarked');
    if (!qs.length) {
      $('#app').innerHTML = `
        <div class="back-btn" onclick="nav('exam')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Буцах</div>
        <div class="empty"><div class="empty-icon">⭐</div><div class="empty-title">Хадгалсан асуулт алга</div>Асуулт дээрх ☆ товчийг дарж хадгалаарай</div>`;
      return;
    }
    practiceData = { questions: qs, index: 0, catId: '' };
    renderPracticeQuestion();
  } catch (e) { $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`; }
}

// ── Wrong questions ─────────────────────────────────────────
async function renderWrong() {
  try {
    const qs = await api('/questions/wrong');
    if (!qs.length) {
      $('#app').innerHTML = `
        <div class="back-btn" onclick="nav('exam')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> Буцах</div>
        <div class="empty"><div class="empty-icon">✨</div><div class="empty-title">Алдаатай асуулт алга</div>Танд алдаа хийгээгүй байна</div>`;
      return;
    }
    practiceData = { questions: qs, index: 0, catId: '' };
    renderPracticeQuestion();
  } catch (e) {
    if (e.message.includes('PRO')) { nav('pro'); return; }
    $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`;
  }
}

// ── Stats ───────────────────────────────────────────────────
async function renderStats() {
  try {
    const s = await api('/stats');
    const passRate = s.examsTaken ? Math.round((s.examsPassed / s.examsTaken) * 100) : 0;
    let html = `
      <h2 class="section-title">Миний статистик</h2>
      <div class="stat-grid">
        <div class="stat-card" data-color="blue" style="animation-delay:.05s"><div class="stat-value">${s.totalAnswered}</div><div class="stat-label">Нийт хариулсан</div></div>
        <div class="stat-card" data-color="green" style="animation-delay:.1s"><div class="stat-value">${s.correctPercent}%</div><div class="stat-label">Зөв хариулт</div></div>
        <div class="stat-card" data-color="purple" style="animation-delay:.15s"><div class="stat-value">${s.examsTaken}</div><div class="stat-label">Шалгалт өгсөн</div></div>
        <div class="stat-card" data-color="cyan" style="animation-delay:.2s"><div class="stat-value">${passRate}%</div><div class="stat-label">Тэнцсэн хувь</div></div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:18px">
        <div class="card" style="flex:1;text-align:center;margin-bottom:0;padding:18px 12px">
          <div style="font-size:2rem;margin-bottom:4px">${s.currentStreak > 0 ? '🔥' : '❄️'}</div>
          <div style="font-size:1.4rem;font-weight:900;color:${s.currentStreak > 0 ? 'var(--gold)' : 'var(--text3)'}">${s.currentStreak}</div>
          <div style="font-size:.7rem;color:var(--text3);font-weight:600;margin-top:2px">Дараалсан өдөр</div>
        </div>
        <div class="card" style="flex:1;text-align:center;margin-bottom:0;padding:18px 12px">
          <div style="font-size:2rem;margin-bottom:4px">⭐</div>
          <div style="font-size:1.4rem;font-weight:900;color:var(--warning)">${s.bookmarks}</div>
          <div style="font-size:.7rem;color:var(--text3);font-weight:600;margin-top:2px">Хадгалсан</div>
        </div>
        <div class="card" style="flex:1;text-align:center;margin-bottom:0;padding:18px 12px">
          <div style="font-size:2rem;margin-bottom:4px">✅</div>
          <div style="font-size:1.4rem;font-weight:900;color:var(--success)">${s.examsPassed}</div>
          <div style="font-size:.7rem;color:var(--text3);font-weight:600;margin-top:2px">Тэнцсэн</div>
        </div>
      </div>

      ${buildProgressRingWidget(s.correctPercent || 0)}

      ${buildAchievementWidget(s)}

      ${buildWeeklyHeatmap()}`;

    if (s.perCategory && s.perCategory.length) {
      html += '<h2 class="section-title" style="margin-top:8px">Бүлгээр</h2>';
      s.perCategory.forEach((c, i) => {
        const pct = c.questionCount ? Math.round((c.correct / c.questionCount) * 100) : 0;
        const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--text3)';
        html += `
          <div class="card" style="padding:12px 16px;animation-delay:${i * .03}s">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:.82rem;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span>
              <span style="font-size:.75rem;font-weight:700;color:${color};margin-left:8px">${pct}%</span>
            </div>
            <div class="cat-progress"><div class="cat-progress-bar" style="width:${pct}%;${pct >= 80 ? 'background:var(--gradient-success)' : pct < 50 ? 'background:var(--surface3)' : ''}"></div></div>
          </div>`;
      });
    }

    if (s.recentExams && s.recentExams.length) {
      html += '<h2 class="section-title" style="margin-top:8px">Сүүлийн шалгалтууд</h2>';
      s.recentExams.forEach((a, i) => {
        html += `
          <div class="card" style="padding:12px 16px;cursor:pointer;animation-delay:${i * .04}s" onclick="nav('attempt-detail','${a.attempt_id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:28px;height:28px;border-radius:8px;background:${a.passed ? 'var(--success-light)' : 'var(--danger-light)'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:${a.passed ? 'var(--success)' : 'var(--danger)'}">${a.passed ? '✓' : '✕'}</div>
                <span style="font-size:.85rem;font-weight:700">${a.score}/${a.total}</span>
              </div>
              <span style="font-size:.72rem;color:var(--text3)">${formatDate(a.finishedAt)}</span>
            </div>
          </div>`;
      });
    }

    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`; }
}

// ── Profile ─────────────────────────────────────────────────
async function renderProfile() {
  const pic = user?.picture || '';
  const email = user?.email || '';
  const name = user?.profileName || '';
  let html = `
    <div class="card profile-section" style="position:relative;overflow:hidden">
      <div class="profile-header-bg"></div>
      ${pic ? `<img class="profile-avatar" src="${esc(pic)}" alt="">` : '<div class="profile-avatar" style="background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff">👤</div>'}
      <div class="profile-name">${esc(user?.name || 'Хэрэглэгч')}</div>
      <p class="profile-email">${esc(email)}</p>
      <div class="profile-badges">
        ${user?.isPro ? '<span class="badge badge-pro" style="padding:5px 14px">PRO</span>' : '<span class="badge badge-free">FREE</span>'}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:36px;height:36px;border-radius:10px;background:var(--primary-light);display:flex;align-items:center;justify-content:center">✏️</div>
        <div>
          <div style="font-weight:700;font-size:.92rem">Профайл нэр</div>
          <div style="font-size:.72rem;color:var(--text3)">3-20 тэмдэгт, латин үсэг/тоо</div>
        </div>
      </div>
      <input class="profile-name-input" id="pname" value="${esc(name)}" placeholder="profile_name" maxlength="20">
      <div id="pname-status" style="font-size:.78rem;margin-top:6px;font-weight:600"></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="saveName()">Хадгалах</button>
    </div>`;

  if (!user?.isPro) {
    html += `
      <div class="card" style="text-align:center;position:relative;overflow:hidden;cursor:pointer" onclick="nav('pro')">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(245,158,11,.06),rgba(239,68,68,.06));pointer-events:none"></div>
        <div class="pro-crown">👑</div>
        <span class="badge badge-pro" style="margin-bottom:10px">PRO</span>
        <p style="font-weight:700;margin-bottom:4px">Бүх боломжийг нээгээрэй</p>
        <p style="font-size:.78rem;color:var(--text3);margin-bottom:14px">36 бүлэг, хязгааргүй шалгалт</p>
        <button class="btn btn-pro btn-block">PRO болох</button>
      </div>`;
  }

  html += `<div id="profile-download" style="margin-top:16px"></div>`;
  html += `
    <button class="btn btn-danger btn-block" style="margin-top:12px" onclick="logout()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Гарах
    </button>`;
  $('#app').innerHTML = html;
  checkApkAvailable('profile-download');

  const input = $('#pname');
  let checkTimeout;
  input.addEventListener('input', () => {
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(async () => {
      const v = input.value.trim();
      if (!v) { $('#pname-status').textContent = ''; return; }
      try {
        const r = await api(`/profile/check-name?name=${encodeURIComponent(v)}`);
        const el = $('#pname-status');
        if (!el) return;
        if (!r.valid) { el.textContent = '✕ ' + r.reason; el.style.color = 'var(--danger)'; }
        else if (!r.available) { el.textContent = '✕ ' + r.reason; el.style.color = 'var(--danger)'; }
        else { el.textContent = '✓ Боломжтой!'; el.style.color = 'var(--success)'; }
      } catch {}
    }, 400);
  });
}

async function saveName() {
  const name = $('#pname')?.value?.trim();
  if (!name) return;
  try {
    user = await api('/profile/set-name', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    renderHeader();
    toast('✓ Хадгалагдлаа!');
  } catch (e) { toast(e.message); }
}

// ── PRO page ────────────────────────────────────────────────
async function renderPro() {
  if (user?.isPro) {
    $('#app').innerHTML = `
      <div class="card" style="text-align:center;padding:36px 24px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(245,158,11,.06),rgba(239,68,68,.06));pointer-events:none"></div>
        <div class="pro-crown">👑</div>
        <span class="badge badge-pro" style="font-size:.85rem;padding:6px 18px;margin-bottom:14px">PRO ХЭРЭГЛЭГЧ</span>
        <h2 style="font-weight:900;margin-top:12px;font-size:1.3rem">Та PRO хэрэглэгч!</h2>
        <p style="color:var(--text2);margin-top:8px;line-height:1.6;font-size:.88rem">Бүх бүлэг, бүх боломж танд нээлттэй.</p>
        <button class="btn btn-primary btn-lg" style="margin-top:24px" onclick="nav('home')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          Нүүр хуудас
        </button>
      </div>`;
    return;
  }
  try {
    const plan = await api('/payments/plan');
    let html = `
      <div class="back-btn" onclick="nav('home')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Буцах
      </div>
      <div class="card pro-hero">
        <div class="pro-crown">👑</div>
        <span class="badge badge-pro" style="font-size:.9rem;padding:5px 16px">PRO</span>
        <h2 style="margin-top:14px;font-size:1.3rem">Бүх боломжийг нээгээрэй</h2>
        <div class="pro-price">${plan.amount?.toLocaleString()}₮</div>
        <div class="pro-price-sub">Нэг удаагийн төлбөр · Хязгааргүй хугацаа</div>
      </div>
      <div class="card">
        <ul class="pro-features">
          <li>Бүх 36 бүлгийн асуултууд</li>
          <li>Хязгааргүй өдрийн асуулт</li>
          <li>Хязгааргүй шалгалт өгөх</li>
          <li>Алдаатай асуултын давтлага</li>
          <li>Дэлгэрэнгүй статистик</li>
          <li>Бүх шинэчлэлт үнэгүй</li>
        </ul>
      </div>`;
    if (plan.qpay) {
      html += `<button class="btn btn-pro btn-block btn-lg" style="margin-bottom:10px" onclick="createQPayPayment()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        QPay-ээр төлөх
      </button>`;
    }
    if (plan.bankTransfer) {
      html += `<button class="btn btn-outline btn-block btn-lg" onclick="createBankPayment()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11"/></svg>
        Дансаар шилжүүлэх
      </button>`;
    }
    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty"><div class="empty-icon">😕</div>${esc(e.message)}</div>`; }
}

async function createQPayPayment() {
  try {
    const p = await api('/payments/create', { method: 'POST', body: '{"plan":"pro"}' });
    if (p.alreadyPro) {
      user.isPro = true;
      renderHeader();
      toast('Та PRO боллоо!');
      nav('home');
      return;
    }
    showQPayModal(p);
  } catch (e) { toast(e.message); }
}

function showQPayModal(p) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  let bankApps = '';
  if (p.urls && p.urls.length) {
    bankApps = '<div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px">' +
      p.urls.map(u => `<a href="${esc(u.link)}" target="_blank" class="btn btn-outline btn-sm">${esc(u.description || u.name)}</a>`).join('') +
      '</div>';
  }
  overlay.innerHTML = `
    <div class="modal">
      <h3>QPay төлбөр</h3>
      ${p.qr_image ? `<img src="data:image/png;base64,${p.qr_image}" style="width:200px;margin:0 auto;display:block;border-radius:12px;box-shadow:var(--shadow-md)" alt="QR">` : ''}
      ${p.short_url ? `<p style="text-align:center;margin-top:10px"><a href="${esc(p.short_url)}" target="_blank" class="btn btn-outline btn-sm">Холбоос нээх</a></p>` : ''}
      ${bankApps}
      <p style="font-size:.8rem;color:var(--text3);margin-top:14px;text-align:center">Төлбөр хийсний дараа доорх товчийг дарна уу</p>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="checkPayment('${p.payment_id}',this)">Төлбөр шалгах</button>
      <button class="btn btn-outline btn-block" style="margin-top:8px" onclick="this.closest('.modal-overlay').remove()">Хаах</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function checkPayment(paymentId, btn) {
  btn.disabled = true;
  btn.textContent = 'Шалгаж байна...';
  try {
    const p = await api(`/payments/${paymentId}`);
    if (p.isPro) {
      user.isPro = true;
      renderHeader();
      document.querySelector('.modal-overlay')?.remove();
      toast('🎉 Та PRO боллоо!');
      nav('home');
    } else {
      btn.textContent = 'Төлбөр илрээгүй. Дахин шалгах';
      btn.disabled = false;
    }
  } catch (e) {
    toast(e.message);
    btn.textContent = 'Дахин шалгах';
    btn.disabled = false;
  }
}

async function createBankPayment() {
  try {
    const p = await api('/payments/bank/create', { method: 'POST' });
    nav('bank-pay', p);
  } catch (e) { toast(e.message); }
}

async function renderBankPay(data) {
  if (!data) { nav('pro'); return; }
  const b = data.bank || {};
  let html = `
    <div class="back-btn" onclick="nav('pro')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      Буцах
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="width:40px;height:40px;border-radius:12px;background:var(--primary-light);display:flex;align-items:center;justify-content:center">🏦</div>
        <h3 style="margin-bottom:0;font-size:1rem">Дансаар шилжүүлэх</h3>
      </div>
      <div class="bank-info">
        <div class="bank-row"><span class="label">Банк</span><span class="value">${esc(b.bankName)}</span></div>
        <div class="bank-row"><span class="label">Данс</span><span class="value">${esc(b.accountNumber)}</span> <span class="copy-btn" onclick="copyText('${esc(b.accountNumber)}')">Хуулах</span></div>
        <div class="bank-row"><span class="label">Нэр</span><span class="value">${esc(b.accountName)}</span></div>
        ${b.iban ? `<div class="bank-row"><span class="label">IBAN</span><span class="value">${esc(b.iban)}</span> <span class="copy-btn" onclick="copyText('${esc(b.iban)}')">Хуулах</span></div>` : ''}
        <div class="bank-row"><span class="label">Дүн</span><span class="value" style="font-size:1rem;color:var(--primary)">${b.amount?.toLocaleString()}₮</span></div>
        <div class="bank-row"><span class="label">Гүйлгээний утга</span><span class="value" style="color:var(--primary);font-size:.95rem">${esc(data.ref)}</span> <span class="copy-btn" onclick="copyText('${esc(data.ref)}')">Хуулах</span></div>
      </div>
      ${b.qrUrl ? `<div style="text-align:center;margin-top:14px"><img src="${b.qrUrl}" style="max-width:200px;border-radius:12px;box-shadow:var(--shadow-md)" alt="QR"></div>` : ''}
      <div style="background:var(--warning-light);padding:12px 14px;border-radius:var(--radius-xs);margin-top:14px;font-size:.82rem;line-height:1.6;display:flex;gap:8px;align-items:flex-start">
        <span style="font-size:1rem">⚠️</span>
        <span>Гүйлгээний утга дээр <strong style="color:var(--primary)">${esc(data.ref)}</strong> кодыг заавал бичнэ үү.</span>
      </div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" onclick="claimBankPayment('${data.payment_id}')" id="claim-btn">Шилжүүлсэн гэж мэдэгдэх</button>
    <p style="font-size:.78rem;color:var(--text3);margin-top:8px;text-align:center">Админ баталгаажуулсны дараа PRO идэвхжинэ</p>`;
  $('#app').innerHTML = html;
}

async function claimBankPayment(paymentId) {
  const btn = $('#claim-btn');
  btn.disabled = true;
  btn.textContent = 'Илгээж байна...';
  try {
    await api(`/payments/bank/${paymentId}/claim`, { method: 'POST' });
    toast('✓ Мэдэгдэл илгээгдлээ');
    btn.textContent = '✓ Илгээгдсэн';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-success');
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = 'Шилжүүлсэн гэж мэдэгдэх';
  }
}

// ── App Download ───────────────────────────────────────────
async function checkApkAvailable(containerId) {
  try {
    const res = await fetch(API + '/download/check');
    const data = await res.json();
    const el = document.getElementById(containerId);
    if (!el || !data.available) return;
    const sizeMB = (data.size / (1024 * 1024)).toFixed(1);
    el.innerHTML = `
      <a href="/api/download/app" class="download-btn" download>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <div class="download-btn-text">
          <span class="download-btn-title">Апп татах (Android)</span>
          <span class="download-btn-size">${data.filename} · ${sizeMB} MB</span>
        </div>
      </a>`;
  } catch {}
}

// ── Utilities ───────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(sec) {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('✓ Хуулагдлаа!')).catch(() => {});
}

// ── Theme toggle ───────────────────────────────────────────
/** Хадгалсан горим байхгүй бол системийн тохиргоог дагана. */
function effectiveTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  applyThemeChrome();
}

function applyThemeChrome() {
  const theme = effectiveTheme();
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = theme === 'dark' ? '#0e0f12' : '#f4f1e9';
  document.querySelectorAll('.theme-toggle, #login-theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    btn.title = theme === 'dark' ? 'Цайвар горим' : 'Бараан горим';
  });
}

// renderHeader() зэрэг хуучин дуудлагуудыг ажиллуулж байхаар үлдээв.
const updateThemeIcon = applyThemeChrome;

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  applyThemeChrome();
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => { if (!localStorage.getItem('theme')) applyThemeChrome(); });
}

// ── Header scroll effect ────────────────────────────────────
window.addEventListener('scroll', () => {
  const header = $('#app-header');
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── Init ──────────────────────────────────────
initTheme();
applyQScale();
initApp();
