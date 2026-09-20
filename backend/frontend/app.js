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
      <div class="login-hero">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <h1>ЗХД Шалгалт</h1>
      <p class="subtitle">Замын хөдөлгөөний дүрмийн шалгалтад бэлдэх хамгийн хялбар арга</p>
      <div id="google-signin-btn"></div>
      ${!webClientId ? '<p style="color:var(--danger);font-size:.8rem;margin-top:12px">Google нэвтрэлт тохируулагдаагүй</p>' : ''}
      <div class="login-features">
        <div class="login-feat"><div class="login-feat-icon">📝</div>600+ асуулт</div>
        <div class="login-feat"><div class="login-feat-icon">📊</div>Статистик</div>
        <div class="login-feat"><div class="login-feat-icon">🎯</div>Шалгалт</div>
      </div>
      <div id="login-download" style="margin-top:24px"></div>
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
    ${user?.isPro ? '<span class="badge badge-pro">PRO</span>' : ''}
    <span class="user-name">${esc(name)}</span>
    ${pic ? `<img class="avatar" src="${esc(pic)}" alt="">` : ''}`;
  fetch(API + '/download/check').then(r => r.json()).then(d => {
    const btn = $('#header-dl-btn');
    if (btn && d.available) btn.style.display = '';
  }).catch(() => {});
}

function nav(page, data) {
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const app = $('#app');
  app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
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
    let html = `
      <div style="margin-bottom:16px">
        <h2 class="section-title" style="margin-bottom:4px">Бүлгүүд</h2>
        <p style="font-size:.82rem;color:var(--text3);font-weight:500">${cats.length} бүлэг · Бүлэг сонгож дасгал хийгээрэй</p>
      </div>`;
    cats.forEach((c, i) => {
      const [c1, c2] = gradients[i % gradients.length];
      html += `
      <div class="cat-item ${c.locked ? 'locked' : ''}" style="animation-delay:${i * .04}s" onclick="${c.locked ? `nav('pro')` : `nav('category','${c.category_id}')`}">
        <div class="cat-icon" style="background:linear-gradient(135deg,${c1}18,${c2}25);color:${c1}">${i + 1}</div>
        <div class="cat-info">
          <div class="cat-name">${esc(c.name)}</div>
          <div class="cat-meta">
            <span>${c.completed}/${c.questionCount} асуулт</span>
            ${c.locked ? '<span class="badge badge-pro" style="font-size:.6rem;padding:1px 6px">PRO</span>' : ''}
          </div>
          ${!c.locked ? `<div class="cat-progress"><div class="cat-progress-bar" style="width:${c.progressPercent}%"></div></div>` : ''}
        </div>
        ${c.locked ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text3);flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>`}
      </div>`;
    });
    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
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
    $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

function renderPractice(data) {
  if (data && data.questions) {
    practiceData = data;
  }
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  const { questions, index } = practiceData;
  if (!questions.length) { $('#app').innerHTML = '<div class="empty">Асуулт олдсонгүй</div>'; return; }
  const q = questions[index];
  const backLabel = q.category_name || 'Буцах';
  let html = `
    <div class="back-btn" onclick="nav('home')">← ${esc(backLabel)}</div>
    <div class="card">
      <div class="q-header">
        <span class="q-counter">${index + 1} / ${questions.length}</span>
        <button class="q-bookmark" onclick="toggleBookmark('${q.question_id}')">${q.isBookmarked ? '★' : '☆'}</button>
      </div>
      ${q.imageUrl ? `<img class="q-image" src="${q.imageUrl}" alt="Зураг" loading="lazy">` : ''}
      <div class="q-text">${esc(q.questionText)}</div>
      <div class="q-options" id="q-options">
        ${q.options.map(o => `
          <button class="q-option" data-key="${o.key}" onclick="answerPractice('${q.question_id}','${o.key}')">
            <span class="key">${o.key}</span>
            <span>${esc(o.text)}</span>
          </button>`).join('')}
      </div>
      <div id="q-feedback"></div>
      <div class="q-nav">
        <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="practiceNav(-1)">← Өмнөх</button>
        <button class="btn btn-primary" ${index === questions.length - 1 ? 'disabled' : ''} onclick="practiceNav(1)">Дараах →</button>
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
      $('#q-feedback').innerHTML = `<div class="q-explanation">${esc(res.explanation)}</div>`;
    }
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
    toast(res.isBookmarked ? 'Хадгалагдлаа' : 'Хасагдлаа');
  } catch (e) { toast(e.message); }
}

// ── Exam menu ───────────────────────────────────────────────
async function renderExamMenu() {
  try {
    const [limits, active] = await Promise.all([
      api('/me/limits'),
      api('/exam/active'),
    ]);
    let html = '<h2 class="section-title">Шалгалт</h2>';

    if (active.active) {
      html += `
        <div class="card" style="border-left:3px solid var(--warning)">
          <p style="font-weight:600;margin-bottom:8px">Дуусаагүй шалгалт байна</p>
          <button class="btn btn-primary btn-block" onclick="startExam()">Үргэлжлүүлэх</button>
        </div>`;
    }

    if (active.expiredAttempt) {
      html += `
        <div class="card">
          <p style="font-weight:600;margin-bottom:4px">Сүүлийн шалгалтын хугацаа дууссан</p>
          <p style="font-size:.85rem;color:var(--text3);margin-bottom:8px">Оноо: ${active.expiredAttempt.score}/${active.expiredAttempt.total} (${active.expiredAttempt.percent}%)</p>
          <button class="btn btn-outline" onclick="nav('attempt-detail','${active.expiredAttempt.attempt_id}')">Дэлгэрэнгүй</button>
        </div>`;
    }

    const examLeft = limits.isPro ? '∞' : `${Math.max(0, limits.freeDailyExams - limits.examsTaken)}`;
    const qLeft = limits.isPro ? '∞' : `${Math.max(0, limits.freeDailyQuestions - limits.questionsAnswered)}`;
    html += `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${examLeft}</div><div class="stat-label">Өнөөдрийн шалгалт</div></div>
        <div class="stat-card"><div class="stat-value">${qLeft}</div><div class="stat-label">Өнөөдрийн асуулт</div></div>
      </div>
      <div class="card" style="position:relative;overflow:hidden">
        <div style="position:absolute;top:0;right:0;width:80px;height:80px;background:linear-gradient(135deg,var(--primary-light),transparent);border-radius:0 0 0 80px;opacity:.5"></div>
        <p style="font-weight:700;margin-bottom:4px;font-size:.95rem">Шинэ шалгалт эхлүүлэх</p>
        <p style="font-size:.8rem;color:var(--text3);margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap">
          <span style="background:var(--surface2);padding:2px 8px;border-radius:6px">20 асуулт</span>
          <span style="background:var(--surface2);padding:2px 8px;border-radius:6px">25 минут</span>
          <span style="background:var(--success-light);padding:2px 8px;border-radius:6px;color:var(--success)">≥75%</span>
        </p>
        <button class="btn btn-primary btn-block" onclick="startExam()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Эхлүүлэх
        </button>
      </div>`;

    // Recent attempts
    const attempts = await api('/attempts?limit=5');
    if (attempts.length) {
      html += '<h2 class="section-title" style="margin-top:16px">Сүүлийн шалгалтууд</h2>';
      attempts.forEach(a => {
        html += `
          <div class="card" style="cursor:pointer" onclick="nav('attempt-detail','${a.attempt_id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">${a.passed ? 'Тэнцсэн' : 'Тэнцээгүй'}</span>
                <span style="font-size:.82rem;margin-left:8px">${a.score}/${a.total} (${a.percent}%)</span>
              </div>
              <span style="font-size:.75rem;color:var(--text3)">${formatDate(a.finishedAt)}</span>
            </div>
          </div>`;
      });
    }

    // Quick links
    html += `
      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="btn btn-outline" style="flex:1" onclick="nav('bookmarks')">★ Хадгалсан</button>
        <button class="btn btn-outline" style="flex:1" onclick="nav('wrong')">✕ Алдаатай</button>
      </div>`;
    if (!user?.isPro) {
      html += `<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="nav('pro')">PRO болох</button>`;
    }

    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
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
    if (timerEl) timerEl.innerHTML = formatTime(examState.remaining);
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
  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <button class="btn btn-outline" style="padding:6px 12px;font-size:.8rem" onclick="confirmAbandon()">Болих</button>
      <div class="exam-timer ${timerClass}" id="exam-timer">${formatTime(remaining)}</div>
    </div>
    <div class="exam-progress-dots">
      ${questions.map((qq, i) => `
        <div class="exam-dot ${answers[qq.question_id] ? 'answered' : ''} ${i === index ? 'current' : ''}"
             onclick="examGo(${i})">${i + 1}</div>`).join('')}
    </div>
    <div class="card">
      <div class="q-counter" style="margin-bottom:8px">${index + 1} / ${questions.length}</div>
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
      <div class="q-nav" style="margin-top:16px">
        <button class="btn btn-outline" ${index === 0 ? 'disabled' : ''} onclick="examGo(${index - 1})">←</button>
        ${index === questions.length - 1
          ? `<button class="btn btn-primary" style="flex:2" onclick="confirmSubmitExam()">Дуусгах</button>`
          : `<button class="btn btn-primary" style="flex:2" onclick="examGo(${index + 1})">Дараах →</button>`}
        <button class="btn btn-outline" ${index === questions.length - 1 ? 'disabled' : ''} onclick="examGo(${index + 1})">→</button>
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
  } catch { /* autosave fail is not critical */ }
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
  const cls = result.passed ? 'pass' : 'fail';
  let html = `
    <div class="card" style="text-align:center;padding:28px 20px;position:relative;overflow:hidden">
      ${result.passed ? '<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(16,185,129,.04),rgba(5,150,105,.08));pointer-events:none"></div>' : ''}
      <div style="font-size:2.5rem;margin-bottom:12px">${result.passed ? '🎉' : '💪'}</div>
      <div class="result-circle ${cls}" style="animation:scaleIn .5s ease">
        <div class="score">${result.percent}%</div>
        <div class="label">${result.score}/${result.total}</div>
      </div>
      <h2 style="margin-bottom:6px;font-weight:800">${result.passed ? 'Тэнцлээ!' : 'Тэнцсэнгүй'}</h2>
      <p style="color:var(--text2);font-size:.88rem;margin-bottom:16px;line-height:1.5">
        ${result.passed ? 'Баяр хүргэе! Та амжилттай тэнцлээ.' : `Тэнцэхэд ≥75% шаардлагатай. Та ${result.percent}% авлаа.`}
      </p>
      ${result.durationSeconds ? `<p style="font-size:.8rem;color:var(--text3);display:flex;align-items:center;justify-content:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${Math.floor(result.durationSeconds / 60)} мин ${result.durationSeconds % 60} сек</p>` : ''}
    </div>`;

  if (result.detail) {
    html += '<h2 class="section-title" style="margin-top:16px">Хариултууд</h2>';
    result.detail.forEach((d, i) => {
      html += `
        <div class="review-item ${d.isCorrect ? 'correct-review' : 'wrong-review'}">
          <div class="review-q">${i + 1}. ${esc(d.questionText)}</div>
          ${d.imageUrl ? `<img class="review-img" src="${d.imageUrl}" loading="lazy">` : ''}
          ${d.options.map(o => {
            let cls = '';
            if (o.key === d.correctKey) cls = 'correct';
            else if (o.key === d.selectedKey && !d.isCorrect) cls = 'wrong';
            return `<div class="q-option ${cls}" style="margin-bottom:4px;cursor:default"><span class="key">${o.key}</span><span>${esc(o.text)}</span></div>`;
          }).join('')}
          ${d.explanation ? `<div class="q-explanation">${esc(d.explanation)}</div>` : ''}
        </div>`;
    });
  }

  html += `
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-outline" style="flex:1" onclick="nav('exam')">Буцах</button>
      <button class="btn btn-primary" style="flex:1" onclick="startExam()">Дахин өгөх</button>
    </div>`;
  $('#app').innerHTML = html;
}

// ── Attempt detail ──────────────────────────────────────────
async function renderAttemptDetail(attemptId) {
  try {
    const a = await api(`/attempts/${attemptId}`);
    renderExamResult(a);
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── Bookmarks ───────────────────────────────────────────────
async function renderBookmarks() {
  try {
    const qs = await api('/questions/bookmarked');
    let html = '<div class="back-btn" onclick="nav(\'exam\')">← Буцах</div><h2 class="section-title">★ Хадгалсан асуултууд</h2>';
    if (!qs.length) { html += '<div class="empty">Хадгалсан асуулт алга</div>'; }
    else {
      practiceData = { questions: qs, index: 0, catId: '' };
      renderPracticeQuestion();
      return;
    }
    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── Wrong questions ─────────────────────────────────────────
async function renderWrong() {
  try {
    const qs = await api('/questions/wrong');
    let html = '<div class="back-btn" onclick="nav(\'exam\')">← Буцах</div><h2 class="section-title">✕ Алдаатай асуултууд</h2>';
    if (!qs.length) { html += '<div class="empty">Алдаатай асуулт алга</div>'; }
    else {
      practiceData = { questions: qs, index: 0, catId: '' };
      renderPracticeQuestion();
      return;
    }
    $('#app').innerHTML = html;
  } catch (e) {
    if (e.message.includes('PRO')) { nav('pro'); return; }
    $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ── Stats ───────────────────────────────────────────────────
async function renderStats() {
  try {
    const s = await api('/stats');
    let html = `
      <h2 class="section-title">📊 Миний статистик</h2>
      <div class="stat-grid">
        <div class="stat-card" style="animation-delay:.05s"><div class="stat-value">${s.totalAnswered}</div><div class="stat-label">Хариулсан</div></div>
        <div class="stat-card" style="animation-delay:.1s"><div class="stat-value">${s.correctPercent}%</div><div class="stat-label">Зөв хариулт</div></div>
        <div class="stat-card" style="animation-delay:.15s"><div class="stat-value">${s.examsTaken}</div><div class="stat-label">Шалгалт өгсөн</div></div>
        <div class="stat-card" style="animation-delay:.2s"><div class="stat-value">${s.examsPassed}</div><div class="stat-label">Тэнцсэн</div></div>
        <div class="stat-card" style="animation-delay:.25s"><div class="stat-value">${s.currentStreak}🔥</div><div class="stat-label">Дараалсан өдөр</div></div>
        <div class="stat-card" style="animation-delay:.3s"><div class="stat-value">${s.bookmarks}</div><div class="stat-label">Хадгалсан</div></div>
      </div>`;

    if (s.perCategory && s.perCategory.length) {
      html += '<h2 class="section-title" style="margin-top:16px">Бүлгээр</h2>';
      s.perCategory.forEach(c => {
        const pct = c.questionCount ? Math.round((c.correct / c.questionCount) * 100) : 0;
        html += `
          <div class="card" style="padding:10px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:.82rem;font-weight:600">${esc(c.name)}</span>
              <span style="font-size:.75rem;color:var(--text3)">${c.correct}/${c.questionCount}</span>
            </div>
            <div class="cat-progress"><div class="cat-progress-bar" style="width:${pct}%"></div></div>
          </div>`;
      });
    }

    if (s.recentExams && s.recentExams.length) {
      html += '<h2 class="section-title" style="margin-top:16px">Сүүлийн шалгалтууд</h2>';
      s.recentExams.forEach(a => {
        html += `
          <div class="card" style="padding:10px 14px;cursor:pointer" onclick="nav('attempt-detail','${a.attempt_id}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">${a.passed ? 'Тэнцсэн' : 'Тэнцээгүй'}</span>
                <span style="font-size:.82rem;margin-left:6px">${a.score}/${a.total}</span>
              </div>
              <span style="font-size:.72rem;color:var(--text3)">${formatDate(a.finishedAt)}</span>
            </div>
          </div>`;
      });
    }

    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── Profile ─────────────────────────────────────────────────
async function renderProfile() {
  const pic = user?.picture || '';
  const email = user?.email || '';
  const name = user?.profileName || '';
  let html = `
    <div class="card profile-section" style="position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:60px;background:var(--gradient-primary);opacity:.08"></div>
      ${pic ? `<img class="profile-avatar" src="${esc(pic)}" alt="">` : '<div class="profile-avatar" style="background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:1.8rem">👤</div>'}
      <h3 style="font-weight:800;font-size:1.1rem">${esc(user?.name || 'Хэрэглэгч')}</h3>
      <p class="profile-email">${esc(email)}</p>
      ${user?.isPro ? '<div style="margin-top:10px"><span class="badge badge-pro" style="padding:4px 12px">PRO</span></div>' : ''}
    </div>
    <div class="card">
      <h3 style="font-size:.92rem;margin-bottom:6px;font-weight:700">Профайл нэр</h3>
      <p style="font-size:.76rem;color:var(--text3);margin-bottom:10px;font-weight:500">3-20 тэмдэгт, латин үсэг/тоо/доогуур зураас</p>
      <input class="profile-name-input" id="pname" value="${esc(name)}" placeholder="profile_name" maxlength="20">
      <div id="pname-status" style="font-size:.78rem;margin-top:6px;font-weight:600"></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="saveName()">Хадгалах</button>
    </div>`;
  if (!user?.isPro) {
    html += `
      <div class="card" style="text-align:center;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(245,158,11,.05),rgba(239,68,68,.05));pointer-events:none"></div>
        <span class="badge badge-pro" style="margin-bottom:10px">PRO</span>
        <p style="font-weight:700;margin-bottom:10px">Бүх боломжийг нээгээрэй</p>
        <button class="btn btn-primary" onclick="nav('pro')">PRO болох</button>
      </div>`;
  }
  html += `<div id="profile-download" style="margin-top:16px"></div>`;
  html += `<button class="btn btn-danger btn-block" style="margin-top:12px" onclick="logout()">Гарах</button>`;
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
        if (!r.valid) { el.textContent = r.reason; el.style.color = 'var(--danger)'; }
        else if (!r.available) { el.textContent = r.reason; el.style.color = 'var(--danger)'; }
        else { el.textContent = 'Боломжтой!'; el.style.color = 'var(--success)'; }
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
    toast('Хадгалагдлаа!');
  } catch (e) { toast(e.message); }
}

// ── PRO page ────────────────────────────────────────────────
async function renderPro() {
  if (user?.isPro) {
    $('#app').innerHTML = `
      <div class="card" style="text-align:center;padding:32px 20px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(245,158,11,.06),rgba(239,68,68,.06));pointer-events:none"></div>
        <div style="font-size:3rem;margin-bottom:12px">👑</div>
        <span class="badge badge-pro" style="font-size:.85rem;padding:5px 16px;margin-bottom:12px">PRO</span>
        <h2 style="font-weight:800;margin-top:12px">Та PRO хэрэглэгч!</h2>
        <p style="color:var(--text2);margin-top:8px;line-height:1.5">Бүх бүлэг, бүх боломж танд нээлттэй.</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="nav('home')">Нүүр хуудас</button>
      </div>`;
    return;
  }
  try {
    const plan = await api('/payments/plan');
    let html = `
      <div class="back-btn" onclick="nav('home')">← Буцах</div>
      <div class="card pro-hero">
        <span class="badge badge-pro" style="font-size:.9rem;padding:4px 14px">PRO</span>
        <h2 style="margin-top:12px">Бүх боломжийг нээгээрэй</h2>
        <div class="pro-price">${plan.amount?.toLocaleString()}₮</div>
        <p style="color:var(--text3);font-size:.85rem">Нэг удаагийн төлбөр</p>
      </div>
      <div class="card">
        <ul class="pro-features">
          <li>Бүх бүлгийн асуултууд</li>
          <li>Хязгааргүй өдрийн асуулт</li>
          <li>Хязгааргүй шалгалт</li>
          <li>Алдаатай асуултын горим</li>
          <li>Бүх шинэчлэлт үнэгүй</li>
        </ul>
      </div>`;
    if (plan.qpay) {
      html += `<button class="btn btn-primary btn-block" style="margin-bottom:8px" onclick="createQPayPayment()">QPay-ээр төлөх</button>`;
    }
    if (plan.bankTransfer) {
      html += `<button class="btn btn-outline btn-block" onclick="createBankPayment()">Дансаар шилжүүлэх</button>`;
    }
    $('#app').innerHTML = html;
  } catch (e) { $('#app').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
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
    bankApps = '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">' +
      p.urls.map(u => `<a href="${esc(u.link)}" target="_blank" class="btn btn-outline" style="font-size:.78rem;padding:6px 10px">${esc(u.description || u.name)}</a>`).join('') +
      '</div>';
  }
  overlay.innerHTML = `
    <div class="modal">
      <h3>QPay төлбөр</h3>
      ${p.qr_image ? `<img src="data:image/png;base64,${p.qr_image}" style="width:200px;margin:0 auto;display:block;border-radius:8px" alt="QR">` : ''}
      ${p.short_url ? `<p style="text-align:center;margin-top:8px"><a href="${esc(p.short_url)}" target="_blank">Холбоос нээх</a></p>` : ''}
      ${bankApps}
      <p style="font-size:.8rem;color:var(--text3);margin-top:12px;text-align:center">Төлбөр хийсний дараа доорх товчийг дарна уу</p>
      <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="checkPayment('${p.payment_id}',this)">Төлбөр шалгах</button>
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
      toast('Та PRO боллоо! 🎉');
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
    <div class="back-btn" onclick="nav('pro')">← Буцах</div>
    <div class="card">
      <h3 style="margin-bottom:12px">Дансаар шилжүүлэх</h3>
      <div class="bank-info">
        <div class="bank-row"><span class="label">Банк:</span><span class="value">${esc(b.bankName)}</span></div>
        <div class="bank-row"><span class="label">Данс:</span><span class="value">${esc(b.accountNumber)}</span> <span class="copy-btn" onclick="copyText('${esc(b.accountNumber)}')">Хуулах</span></div>
        <div class="bank-row"><span class="label">Нэр:</span><span class="value">${esc(b.accountName)}</span></div>
        ${b.iban ? `<div class="bank-row"><span class="label">IBAN:</span><span class="value">${esc(b.iban)}</span> <span class="copy-btn" onclick="copyText('${esc(b.iban)}')">Хуулах</span></div>` : ''}
        <div class="bank-row"><span class="label">Дүн:</span><span class="value">${b.amount?.toLocaleString()}₮</span></div>
        <div class="bank-row"><span class="label">Гүйлгээний утга:</span><span class="value" style="color:var(--primary)">${esc(data.ref)}</span> <span class="copy-btn" onclick="copyText('${esc(data.ref)}')">Хуулах</span></div>
      </div>
      ${b.qrUrl ? `<div style="text-align:center;margin-top:12px"><img src="${b.qrUrl}" style="max-width:200px;border-radius:8px" alt="QR"></div>` : ''}
      <div style="background:var(--warning-light);padding:10px;border-radius:8px;margin-top:12px;font-size:.82rem;line-height:1.5">
        <strong>Анхаар:</strong> Гүйлгээний утга дээр <code>${esc(data.ref)}</code> кодыг заавал бичнэ үү.
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="claimBankPayment('${data.payment_id}')" id="claim-btn">Шилжүүлсэн гэж мэдэгдэх</button>
    <p style="font-size:.78rem;color:var(--text3);margin-top:8px;text-align:center">Админ баталгаажуулсны дараа PRO идэвхжинэ</p>`;
  $('#app').innerHTML = html;
}

async function claimBankPayment(paymentId) {
  const btn = $('#claim-btn');
  btn.disabled = true;
  btn.textContent = 'Илгээж байна...';
  try {
    await api(`/payments/bank/${paymentId}/claim`, { method: 'POST' });
    toast('Мэдэгдэл илгээгдлээ. Админ баталгаажуулахыг хүлээнэ үү.');
    btn.textContent = 'Илгээгдсэн ✓';
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
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Хуулагдлаа!')).catch(() => {});
}

// ── Init ────────────────────────────────────────────────────
initApp();
