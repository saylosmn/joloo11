/* ЗХД Шалгалт — Single Page Application */
const $ = s => document.querySelector(s);
const API = '/api';
let token = localStorage.getItem('token');
let user = null;
let config = null;
let currentPage = 'home';

// ── API helper ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Алдаа (${res.status})`);
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
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f97316','#10b981','#3b82f6','#eab308'];
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

// ── Widget builders ─────────────────────────────────────────
function buildProgressRingWidget(pct) {
  const r = 54, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#6366f1';
  return `
    <div class="widget-card" style="animation-delay:.08s">
      <div style="display:flex;align-items:center;gap:20px">
        <div class="progress-ring" style="width:120px;height:120px;flex-shrink:0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="10"/>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10"
              stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
              style="filter:drop-shadow(0 2px 8px ${color}40);transition:stroke-dashoffset 1.2s var(--ease-out-expo)"/>
          </svg>
          <div class="progress-text">
            <span style="font-size:1.6rem;font-weight:900;color:${color}">${pct}%</span>
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
          <div class="widget-icon" style="background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.12))">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
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
        <div class="widget-icon" style="background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.12))">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
        <div class="widget-icon" style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(249,115,22,.12))">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"><path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2Z"/></svg>
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
        <div class="widget-icon" style="background:linear-gradient(135deg,rgba(236,72,153,.12),rgba(139,92,246,.12))">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
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
        <div style="display:flex;flex-direction:column;gap:12px;background:rgba(255,255,255,0.08);border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,0.15)">
          <p style="color:rgba(255,255,255,0.85);font-size:.85rem;font-weight:600;margin:0">Утасны дугаар</p>
          <input id="code-phone" type="tel" placeholder="99112233" maxlength="15" class="code-input-field">
          <p style="color:rgba(255,255,255,0.85);font-size:.85rem;font-weight:600;margin:0">4 оронтой код</p>
          <div style="display:flex;gap:8px;justify-content:center" id="code-digits-row">
            <input class="code-digit" type="tel" maxlength="1" data-idx="0" oninput="codeDigitInput(this,0)" onkeydown="codeDigitKey(event,0)">
            <input class="code-digit" type="tel" maxlength="1" data-idx="1" oninput="codeDigitInput(this,1)" onkeydown="codeDigitKey(event,1)">
            <input class="code-digit" type="tel" maxlength="1" data-idx="2" oninput="codeDigitInput(this,2)" onkeydown="codeDigitKey(event,2)">
            <input class="code-digit" type="tel" maxlength="1" data-idx="3" oninput="codeDigitInput(this,3)" onkeydown="codeDigitKey(event,3)">
          </div>
          <p id="code-error" style="color:#fca5a5;font-size:.8rem;text-align:center;margin:0;display:none"></p>
          <button onclick="submitCodeLogin()" id="code-submit-btn" class="code-submit-btn">Нэвтрэх</button>
        </div>
      </div>
      <div class="login-features">
        <div class="login-feat"><div class="login-feat-icon">📝</div>800+ асуулт</div>
        <div class="login-feat"><div class="login-feat-icon">📊</div>Дэлгэрэнгүй статистик</div>
        <div class="login-feat"><div class="login-feat-icon">🎯</div>Жинхэнэ шалгалт</div>
        <div class="login-feat"><div class="login-feat-icon">🏆</div>36 бүлэг</div>
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

function showCodeLoginForm() {
  const form = document.getElementById('code-login-form');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function codeDigitInput(el, idx) {
  el.value = el.value.replace(/\D/g, '').slice(0, 1);
  if (el.value && idx < 3) {
    const next = document.querySelectorAll('.code-digit')[idx + 1];
    if (next) next.focus();
  }
}

function codeDigitKey(e, idx) {
  if (e.key === 'Backspace') {
    const digits = document.querySelectorAll('.code-digit');
    if (!digits[idx].value && idx > 0) {
      digits[idx - 1].focus();
    }
  }
}

async function submitCodeLogin() {
  const phone = (document.getElementById('code-phone')?.value || '').trim();
  const digits = document.querySelectorAll('.code-digit');
  const code = Array.from(digits).map(d => d.value).join('');
  const errEl = document.getElementById('code-error');
  const btn = document.getElementById('code-submit-btn');

  if (phone.length < 6 || code.length < 4) {
    if (errEl) { errEl.textContent = 'Утасны дугаар болон 4 оронтой код оруулна уу'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Уншиж байна...'; }

  try {
    const data = await api('/auth/code-login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    token = data.session_token;
    user = data.user;
    localStorage.setItem('token', token);
    showApp();
  } catch (e) {
    if (errEl) { errEl.textContent = e.message || 'Нэвтрэхэд алдаа гарлаа'; errEl.style.display = 'block'; }
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
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const app = $('#app');
  app.innerHTML = showDotLoader();
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
    const gradients = [
      ['#3b82f6','#2563eb'],['#8b5cf6','#7c3aed'],['#ec4899','#db2777'],
      ['#f97316','#ea580c'],['#14b8a6','#0d9488'],['#84cc16','#65a30d'],
      ['#06b6d4','#0891b2'],['#ef4444','#dc2626'],['#6366f1','#4f46e5'],
      ['#eab308','#ca8a04']
    ];
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
            <div class="welcome-stat-label">Нийт дэвшилт</div>
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
          <div class="quick-action-icon" style="background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.1))">🎯</div>
          <div class="quick-action-label">Шалгалт</div>
        </div>
        <div class="quick-action" onclick="nav('stats')" style="animation-delay:.1s">
          <div class="quick-action-icon" style="background:linear-gradient(135deg,rgba(16,185,129,.1),rgba(5,150,105,.1))">📊</div>
          <div class="quick-action-label">Статистик</div>
        </div>
        <div class="quick-action" onclick="nav('bookmarks')" style="animation-delay:.15s">
          <div class="quick-action-icon" style="background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(249,115,22,.1))">⭐</div>
          <div class="quick-action-label">Хадгалсан</div>
        </div>
      </div>

      ${buildWeeklyHeatmap()}

      ${buildMotivationalQuote()}

      ${buildTopCategoriesWidget(cats, gradients)}

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 class="section-title" style="margin-bottom:0">📚 Бүх бүлгүүд</h2>
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

function renderPracticeQuestion() {
  const { questions, index } = practiceData;
  if (!questions.length) { $('#app').innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-title">Асуулт олдсонгүй</div></div>'; return; }
  const q = questions[index];
  const backLabel = q.category_name || 'Буцах';
  const pct = Math.round(((index + 1) / questions.length) * 100);
  let html = `
    <div class="back-btn" onclick="nav('home')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      ${esc(backLabel)}
    </div>
    <div class="progress-header">
      <div class="progress-header-bar"><div class="progress-header-fill" style="width:${pct}%"></div></div>
      <div class="progress-header-text">${index + 1}/${questions.length}</div>
    </div>
    <div class="card">
      <div class="q-header">
        <span class="q-counter">Асуулт ${index + 1}</span>
        <button class="q-bookmark" onclick="toggleBookmark('${q.question_id}')" title="${q.isBookmarked ? 'Хасах' : 'Хадгалах'}">${q.isBookmarked ? '★' : '☆'}</button>
      </div>
      ${q.imageUrl ? `<img class="q-image" src="${q.imageUrl}" alt="Зураг" loading="lazy">` : ''}
      <div class="q-text">${esc(q.questionText)}</div>
      <div class="q-options" id="q-options">
        ${q.options.map((o, oi) => `
          <button class="q-option" data-key="${o.key}" onclick="answerPractice('${q.question_id}','${o.key}')" style="animation-delay:${oi * .05}s">
            <span class="key">${o.key}</span>
            <span>${esc(o.text)}</span>
          </button>`).join('')}
      </div>
      <div id="q-feedback"></div>
      <div class="q-nav">
        <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="practiceNav(-1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Өмнөх
        </button>
        <button class="btn btn-primary" ${index === questions.length - 1 ? 'disabled' : ''} onclick="practiceNav(1)">
          Дараах
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;
  $('#app').innerHTML = html;
}

async function answerPractice(qid, key) {
  const btns = document.querySelectorAll('#q-options .q-option');
  btns.forEach(b => b.disabled = true);
  try {
    const res = await api('/practice/answer', {
      method: 'POST',
      body: JSON.stringify({ question_id: qid, selectedKey: key }),
    });
    btns.forEach(b => {
      const k = b.dataset.key;
      if (k === res.correctKey) b.classList.add('correct');
      if (k === key && !res.isCorrect) b.classList.add('wrong');
    });
    if (res.explanation) {
      $('#q-feedback').innerHTML = `<div class="q-explanation">💡 ${esc(res.explanation)}</div>`;
    }
    trackDailyQuestion();
    const q = practiceData.questions[practiceData.index];
    if (q) q._answered = true;
  } catch (e) {
    toast(e.message);
    btns.forEach(b => b.disabled = false);
  }
}

function practiceNav(dir) {
  practiceData.index += dir;
  if (practiceData.index < 0) practiceData.index = 0;
  if (practiceData.index >= practiceData.questions.length) practiceData.index = practiceData.questions.length - 1;
  renderPracticeQuestion();
}

async function toggleBookmark(qid) {
  try {
    const res = await api(`/questions/${qid}/bookmark`, { method: 'POST' });
    const q = practiceData.questions[practiceData.index];
    if (q) q.isBookmarked = res.isBookmarked;
    renderPracticeQuestion();
    toast(res.isBookmarked ? '⭐ Хадгалагдлаа' : 'Хасагдлаа');
  } catch (e) { toast(e.message); }
}

// ── Exam menu ───────────────────────────────────────────────
async function renderExamMenu() {
  try {
    const [limits, active] = await Promise.all([
      api('/me/limits'),
      api('/exam/active'),
    ]);
    let html = `<h2 class="section-title">🎯 Шалгалт</h2>`;

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

      <div class="card card-gradient" style="position:relative;overflow:hidden">
        <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:var(--gradient-primary);opacity:.06;pointer-events:none"></div>
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
      html += '<h2 class="section-title" style="margin-top:20px">📋 Сүүлийн шалгалтууд</h2>';
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
          <div class="quick-action-icon" style="background:var(--warning-light)">⭐</div>
          <div class="quick-action-label">Хадгалсан</div>
        </div>
        <div class="quick-action" onclick="nav('wrong')" style="animation-delay:.1s">
          <div class="quick-action-icon" style="background:var(--danger-light)">❌</div>
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
  startExamTimer();
  renderExamQuestion();
}

function startExamTimer() {
  clearInterval(examTimer);
  examTimer = setInterval(() => {
    examState.remaining--;
    const timerEl = $('#exam-timer');
    if (timerEl) {
      timerEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${formatTime(examState.remaining)}`;
      timerEl.className = 'exam-timer ' + (examState.remaining > 300 ? 'ok' : '');
    }
    if (examState.remaining <= 0) {
      clearInterval(examTimer);
      submitExam();
    }
  }, 1000);
}

function renderExamQuestion() {
  const { questions, answers, index, remaining } = examState;
  const q = questions[index];
  const timerClass = remaining > 300 ? 'ok' : '';
  const answeredCount = Object.keys(answers).length;
  const pct = Math.round(((index + 1) / questions.length) * 100);
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <button class="btn btn-outline btn-sm" onclick="confirmAbandon()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Болих
      </button>
      <div style="font-size:.75rem;color:var(--text3);font-weight:600">${answeredCount}/${questions.length} хариулсан</div>
      <div class="exam-timer ${timerClass}" id="exam-timer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        ${formatTime(remaining)}
      </div>
    </div>
    <div class="progress-header" style="margin-bottom:10px">
      <div class="progress-header-bar"><div class="progress-header-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="exam-progress-dots">
      ${questions.map((qq, i) => `
        <div class="exam-dot ${answers[qq.question_id] ? 'answered' : ''} ${i === index ? 'current' : ''}"
             onclick="examGo(${i})">${i + 1}</div>`).join('')}
    </div>
    <div class="card">
      <div class="q-counter" style="margin-bottom:10px">Асуулт ${index + 1} / ${questions.length}</div>
      ${q.imageUrl ? `<img class="q-image" src="${q.imageUrl}" alt="" loading="lazy">` : ''}
      <div class="q-text">${esc(q.questionText)}</div>
      <div class="q-options">
        ${q.options.map(o => `
          <button class="q-option ${answers[q.question_id] === o.key ? 'selected' : ''}"
                  data-key="${o.key}" onclick="examAnswer('${o.key}')">
            <span class="key">${o.key}</span>
            <span>${esc(o.text)}</span>
          </button>`).join('')}
      </div>
      <div class="q-nav" style="margin-top:18px">
        <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="examGo(${index - 1})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        ${index === questions.length - 1
          ? `<button class="btn btn-primary btn-lg" style="flex:2" onclick="confirmSubmitExam()">✓ Дуусгах</button>`
          : `<button class="btn btn-primary" style="flex:2" onclick="examGo(${index + 1})">Дараах →</button>`}
        <button class="btn btn-outline" ${index === questions.length - 1 ? 'disabled' : ''} onclick="examGo(${index + 1})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>`;
  $('#app').innerHTML = html;
}

async function examAnswer(key) {
  const q = examState.questions[examState.index];
  examState.answers[q.question_id] = key;
  try {
    await api('/exam/answer', {
      method: 'POST',
      body: JSON.stringify({ session_id: examState.session_id, question_id: q.question_id, selectedKey: key }),
    });
  } catch {}
  renderExamQuestion();
}

function examGo(i) {
  if (i < 0 || i >= examState.questions.length) return;
  examState.index = i;
  renderExamQuestion();
}

function confirmAbandon() {
  if (confirm('Шалгалтаа орхих уу? Өнөөдрийн эрх зарцуулагдсан хэвээр байна.')) {
    clearInterval(examTimer);
    api('/exam/abandon', { method: 'POST' }).catch(() => {});
    examState = null;
    nav('exam');
  }
}

function confirmSubmitExam() {
  const unanswered = examState.questions.filter(q => !examState.answers[q.question_id]).length;
  let msg = 'Шалгалтаа дуусгах уу?';
  if (unanswered) msg += ` (${unanswered} хариулаагүй асуулт байна)`;
  if (confirm(msg)) submitExam();
}

async function submitExam() {
  clearInterval(examTimer);
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
      <div class="result-circle ${cls}">
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
      <h2 class="section-title">📝 Хариултууд</h2>`;
    result.detail.forEach((d, i) => {
      html += `
        <div class="review-item ${d.isCorrect ? 'correct-review' : 'wrong-review'}" style="animation-delay:${i * .04}s">
          <div class="review-q">${i + 1}. ${esc(d.questionText)}</div>
          ${d.imageUrl ? `<img class="review-img" src="${d.imageUrl}" loading="lazy">` : ''}
          ${d.options.map(o => {
            let cls = '';
            if (o.key === d.correctKey) cls = 'correct';
            else if (o.key === d.selectedKey && !d.isCorrect) cls = 'wrong';
            return `<div class="q-option ${cls}" style="margin-bottom:4px;cursor:default;pointer-events:none"><span class="key">${o.key}</span><span>${esc(o.text)}</span></div>`;
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
      <h2 class="section-title">📊 Миний статистик</h2>
      <div class="stat-grid">
        <div class="stat-card" data-color="blue" style="animation-delay:.05s"><div class="stat-value">${s.totalAnswered}</div><div class="stat-label">Нийт хариулсан</div></div>
        <div class="stat-card" data-color="green" style="animation-delay:.1s"><div class="stat-value">${s.correctPercent}%</div><div class="stat-label">Зөв хариулт</div></div>
        <div class="stat-card" data-color="purple" style="animation-delay:.15s"><div class="stat-value">${s.examsTaken}</div><div class="stat-label">Шалгалт өгсөн</div></div>
        <div class="stat-card" data-color="cyan" style="animation-delay:.2s"><div class="stat-value">${passRate}%</div><div class="stat-label">Тэнцсэн хувь</div></div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:18px">
        <div class="card" style="flex:1;text-align:center;margin-bottom:0;padding:18px 12px">
          <div style="font-size:2rem;margin-bottom:4px">${s.currentStreak > 0 ? '🔥' : '❄️'}</div>
          <div style="font-size:1.4rem;font-weight:900;color:${s.currentStreak > 0 ? '#f97316' : 'var(--text3)'}">${s.currentStreak}</div>
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
      html += '<h2 class="section-title" style="margin-top:8px">📚 Бүлгээр</h2>';
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
      html += '<h2 class="section-title" style="margin-top:8px">📋 Сүүлийн шалгалтууд</h2>';
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
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = next === 'dark' ? '#0c0e1a' : '#f0f2f8';
}

function updateThemeIcon() {
  document.querySelectorAll('.theme-toggle, #login-theme-toggle').forEach(btn => {
    const theme = document.documentElement.getAttribute('data-theme');
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  });
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.content = saved === 'dark' ? '#0c0e1a' : '#f0f2f8';
  }
  updateThemeIcon();
}

// ── Header scroll effect ────────────────────────────────────
window.addEventListener('scroll', () => {
  const header = $('#app-header');
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── Init ────────────────────────────────────────────────────
initTheme();
initApp();
