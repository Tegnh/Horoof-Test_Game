'use strict';

const LETTERS = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
const THEMES = [
  { id: 'red-blue', label: 'أحمر ضد أزرق', icon: '🔴 vs 🔵', t1: '#E63946', t2: '#3A7BD5' },
  { id: 'orange-green', label: 'برتقالي ضد أخضر', icon: '🟠 vs 🟢', t1: '#FF8C42', t2: '#27AE60' },
  { id: 'purple-yellow', label: 'بنفسجي ضد أصفر', icon: '🟣 vs 🟡', t1: '#8E44AD', t2: '#E6A817' }
];

let STATE = {
  themeIdx: 0, totalRounds: 3, currentRound: 1, teamScores: [0, 0], roundWins: [0, 0],
  gridSize: 5, timerSetting: 30, // القيم الافتراضية الجديدة
  cells: [], gameOver: false, roundWinAwarded: false,
};
let CELL_MAP = {};
let timerInterval = null;

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (id === 'qbank') _initQBank();
}

function buildThemeOptions() {
  const container = document.getElementById('theme-options');
  THEMES.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn';
    btn.dataset.themeIdx = i;
    btn.innerHTML = `<span class="theme-swatch" style="background:${t.t1}"></span><span class="theme-label">${t.icon}&nbsp;&nbsp;${t.label}</span><span class="theme-swatch" style="background:${t.t2}"></span>`;
    btn.addEventListener('click', () => applyTheme(i));
    container.appendChild(btn);
  });
  applyTheme(0);
}

function applyTheme(idx) {
  STATE.themeIdx = idx;
  const { t1, t2 } = THEMES[idx];
  document.documentElement.style.setProperty('--team1', t1);
  document.documentElement.style.setProperty('--team2', t2);

  const d1 = document.getElementById('prev-team1'); if (d1) d1.style.background = t1;
  const d2 = document.getElementById('prev-team2'); if (d2) d2.style.background = t2;
  const d3 = document.getElementById('t1-dot'); if (d3) d3.style.background = t1;
  const d4 = document.getElementById('t2-dot'); if (d4) d4.style.background = t2;

  if (STATE.cells.length) _repaintBoard();
  document.querySelectorAll('.theme-btn').forEach((btn, i) => btn.classList.toggle('selected', i === idx));
}

function _repaintBoard() {
  const { t1, t2 } = THEMES[STATE.themeIdx];
  const colors = ['#FFFFFF', t1, t2];
  document.querySelectorAll('#hex-svg .hex-cell').forEach((g, i) => {
    if (STATE.cells[i] == null) return;
    const owner = STATE.cells[i].owner;
    const face = g.querySelector('.hex-face');
    const text = g.querySelector('.hex-text');
    g.classList.toggle('team1', owner === 1);
    g.classList.toggle('team2', owner === 2);
    if (face) face.style.fill = colors[owner];
    if (text) text.style.fill = owner === 0 ? '#1A1A1A' : '#FFFFFF';
  });
}

// إعدادات اللعبة الجديدة
function changeRounds(delta) {
  STATE.totalRounds = Math.max(1, Math.min(9, STATE.totalRounds + delta));
  document.getElementById('rounds-display').textContent = STATE.totalRounds;
}

function changeGridSize(delta) {
  STATE.gridSize = Math.max(3, Math.min(6, STATE.gridSize + delta));
  document.getElementById('grid-display').textContent = `${STATE.gridSize} × ${STATE.gridSize}`;
}

function setTimer(seconds) {
  STATE.timerSetting = seconds;
  document.querySelectorAll('.timer-btn').forEach(b => {
    b.classList.remove('btn--black', 'selected');
    b.classList.add('btn--white');
    if (parseInt(b.dataset.time) === seconds) {
      b.classList.remove('btn--white');
      b.classList.add('btn--black', 'selected');
    }
  });
}

// نظام المؤقت أثناء اللعب
function toggleTimer() {
  const btn = document.getElementById('board-timer-btn');
  if (STATE.timerSetting === 0) { btn.textContent = 'مفتوح'; return; }

  if (timerInterval) { // إيقاف المؤقت
    clearInterval(timerInterval); timerInterval = null;
    btn.textContent = `⏱ ${STATE.timerSetting}ث`;
    btn.classList.remove('timer-urgent');
    return;
  }

  // تشغيل المؤقت
  let timeLeft = STATE.timerSetting;
  btn.textContent = `⏱ ${timeLeft}ث`;
  btn.classList.remove('timer-urgent');

  timerInterval = setInterval(() => {
    timeLeft--;
    btn.textContent = `⏱ ${timeLeft}ث`;
    if (timeLeft <= 5) btn.classList.add('timer-urgent');
    if (timeLeft <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      btn.textContent = '⏰ انتهى الوقت!';
      setTimeout(() => {
        btn.classList.remove('timer-urgent');
        btn.textContent = `⏱ ${STATE.timerSetting}ث`;
      }, 3000);
    }
  }, 1000);
}

function startGame() {
  STATE.currentRound = 1; STATE.teamScores = [0, 0]; STATE.roundWins = [0, 0];
  STATE.gameOver = false; STATE.roundWinAwarded = false;

  const timerBtn = document.getElementById('board-timer-btn');
  timerBtn.textContent = STATE.timerSetting > 0 ? `⏱ ${STATE.timerSetting}ث` : 'مفتوح';
  timerBtn.style.display = STATE.timerSetting > 0 ? 'inline-flex' : 'none';
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  applyTheme(STATE.themeIdx); buildBoard(); showView('board');
}

// تحويل HEX لكائن ديناميكي يتجاوب مع حجم الشبكة
const HEX = {
  R: 44, PAD: 25, SHADOW: 5,
  get COLS() { return STATE.gridSize; },
  
  // 🔴 التعديل تم هنا: جعلنا جميع الأعمدة تأخذ نفس العدد تماماً
  rowsFor(col) { return STATE.gridSize; }, 
  
  cx(col) { return this.PAD + this.R + col * this.R * 1.5; },
  cy(col, row) {
    const rowDy = this.R * Math.sqrt(3);
    const offset = rowDy / 2;
    const base = this.PAD + offset + row * rowDy;
    return (col % 2 === 1) ? base + offset : base;
  },
  points(centerX, centerY, r) {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      s += `${(centerX + r * Math.cos(a)).toFixed(2)},${(centerY + r * Math.sin(a)).toFixed(2)} `;
    }
    return s.trim();
  },
  naturalSize() {
    let maxX = 0, maxY = 0;
    for (let col = 0; col < this.COLS; col++) {
      for (let row = 0; row < this.rowsFor(col); row++) {
        maxX = Math.max(maxX, this.cx(col) + this.R + this.SHADOW + this.PAD);
        maxY = Math.max(maxY, this.cy(col, row) + (this.R * Math.sqrt(3)) / 2 + this.SHADOW + this.PAD);
      }
    }
    return { w: Math.ceil(maxX), h: Math.ceil(maxY) };
  }
};

function cellAt(col, row) { const idx = CELL_MAP[`${col},${row}`]; return idx !== undefined ? STATE.cells[idx] : null; }
function isValidCell(col, row) { return col >= 0 && col < HEX.COLS && row >= 0 && row < HEX.rowsFor(col); }

function getNeighbors(col, row) {
  const n = [];
  if (isValidCell(col, row - 1)) n.push([col, row - 1]);
  if (isValidCell(col, row + 1)) n.push([col, row + 1]);
  for (const dc of [-1, 1]) {
    const adjCol = col + dc;
    if (adjCol < 0 || adjCol >= HEX.COLS) continue;
    if (col % 2 === 0) {
      if (isValidCell(adjCol, row)) n.push([adjCol, row]);
      if (isValidCell(adjCol, row - 1)) n.push([adjCol, row - 1]);
    } else {
      if (isValidCell(adjCol, row)) n.push([adjCol, row]);
      if (isValidCell(adjCol, row + 1)) n.push([adjCol, row + 1]);
    }
  }
  return n;
}

function checkWin(team) {
  const seeds = (team === 1)
    ? STATE.cells.filter(c => c.owner === 1 && c.row === 0)
    : STATE.cells.filter(c => c.owner === 2 && c.col === 0);
  if (!seeds.length) return false;
  const visited = new Set(seeds.map(c => `${c.col},${c.row}`));
  const queue = [...seeds];
  while (queue.length) {
    const { col, row } = queue.shift();
    const atEnd = (team === 1) ? row === HEX.rowsFor(col) - 1 : col === HEX.COLS - 1;
    if (atEnd) return true;
    for (const [nc, nr] of getNeighbors(col, row)) {
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      const nb = cellAt(nc, nr);
      if (nb && nb.owner === team) { visited.add(key); queue.push(nb); }
    }
  }
  return false;
}

function buildBoard() {
  STATE.gameOver = false; STATE.roundWinAwarded = false; STATE.teamScores = [0, 0];
  const svg = document.getElementById('hex-svg');
  svg.classList.remove('game-over');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // خوارزمية الخلط المتقدمة لضمان توزيع جديد وعادل للحروف
  const letters = (() => {
    let total = 0; for (let c = 0; c < HEX.COLS; c++) total += HEX.rowsFor(c);
    let pool = [];
    while (pool.length < total) {
      let temp = [...LETTERS];
      for (let i = temp.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[temp[i], temp[j]] = [temp[j], temp[i]]; }
      pool.push(...temp);
    }
    return pool.slice(0, total);
  })();

  STATE.cells = []; CELL_MAP = {}; let idx = 0;
  for (let col = 0; col < HEX.COLS; col++) {
    for (let row = 0; row < HEX.rowsFor(col); row++) {
      STATE.cells.push({ letter: letters[idx], owner: 0, col, row });
      CELL_MAP[`${col},${row}`] = idx++;
    }
  }

  const { w, h } = HEX.naturalSize();
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  // مهم جداً للشبكات الكبيرة (6×6) لكي تتناسب مع الشاشة بدون سكرول
  svg.style.width = '100%';
  svg.style.height = '100%';
  const NS = 'http://www.w3.org/2000/svg';

  const bgGroup = document.createElementNS(NS, 'g');
  const polyTop = document.createElementNS(NS, 'polygon');
  polyTop.setAttribute('points', `0,0 ${w},0 ${w / 2},${h / 2}`); polyTop.setAttribute('class', 'bg-t1');
  const polyBot = document.createElementNS(NS, 'polygon');
  polyBot.setAttribute('points', `0,${h} ${w},${h} ${w / 2},${h / 2}`); polyBot.setAttribute('class', 'bg-t1');
  const polyLeft = document.createElementNS(NS, 'polygon');
  polyLeft.setAttribute('points', `0,0 0,${h} ${w / 2},${h / 2}`); polyLeft.setAttribute('class', 'bg-t2');
  const polyRight = document.createElementNS(NS, 'polygon');
  polyRight.setAttribute('points', `${w},0 ${w},${h} ${w / 2},${h / 2}`); polyRight.setAttribute('class', 'bg-t2');
  bgGroup.append(polyTop, polyBot, polyLeft, polyRight);
  svg.appendChild(bgGroup);

  let cellIdx = 0;
  for (let col = 0; col < HEX.COLS; col++) {
    for (let row = 0; row < HEX.rowsFor(col); row++) {
      const cX = HEX.cx(col), cY = HEX.cy(col, row), cell = STATE.cells[cellIdx], ci = cellIdx++;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'hex-cell');
      const shadow = document.createElementNS(NS, 'polygon');
      shadow.setAttribute('points', HEX.points(cX + HEX.SHADOW, cY + HEX.SHADOW, HEX.R - 1.5));
      shadow.setAttribute('fill', '#1A1A1A');
      const face = document.createElementNS(NS, 'polygon');
      face.setAttribute('class', 'hex-face');
      face.setAttribute('points', HEX.points(cX, cY, HEX.R - 1.5));
      face.setAttribute('fill', '#FFFFFF');
      face.setAttribute('stroke', '#1A1A1A');
      face.setAttribute('stroke-width', '3');
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('class', 'hex-text');
      text.setAttribute('x', cX.toFixed(2)); text.setAttribute('y', cY.toFixed(2));
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', '#1A1A1A'); text.textContent = cell.letter;
      g.append(shadow, face, text);
      g.addEventListener('click', () => _openColorPicker(ci, g));
      svg.appendChild(g);
    }
  }
  _updateTopBar(); _updateNeutralChip();
}

let activeCellIdx = null; let activeGroupEl = null;

function _openColorPicker(idx, groupEl) {
  if (STATE.gameOver) return;
  activeCellIdx = idx; activeGroupEl = groupEl;
  const { t1, t2 } = THEMES[STATE.themeIdx];
  document.getElementById('btn-pick-t1').style.background = t1;
  document.getElementById('btn-pick-t2').style.background = t2;
  openModal('modal-color');
}

function setCellOwner(owner) {
  closeModal('modal-color');
  if (activeCellIdx === null) return;
  const cell = STATE.cells[activeCellIdx];
  const prev = cell.owner;
  if (prev === owner) return;

  cell.owner = owner;
  if (prev === 1) STATE.teamScores[0]--; if (prev === 2) STATE.teamScores[1]--;
  if (owner === 1) STATE.teamScores[0]++; if (owner === 2) STATE.teamScores[1]++;

  const groupEl = activeGroupEl;
  const faceEl = groupEl.querySelector('.hex-face');
  const textEl = groupEl.querySelector('.hex-text');
  const { t1, t2 } = THEMES[STATE.themeIdx];
  const colors = ['#FFFFFF', t1, t2];

  groupEl.classList.toggle('team1', owner === 1);
  groupEl.classList.toggle('team2', owner === 2);
  if (faceEl) faceEl.style.fill = colors[owner];
  if (textEl) textEl.style.fill = owner === 0 ? '#1A1A1A' : '#FFFFFF';

  _updateTopBar(); _updateNeutralChip();

  if (owner === 1 && checkWin(1)) { _handleRoundWin(1); }
  else if (owner === 2 && checkWin(2)) { _handleRoundWin(2); }

  activeCellIdx = null; activeGroupEl = null;
}

function _handleRoundWin(team) {
  STATE.gameOver = true; STATE.roundWinAwarded = true; STATE.roundWins[team - 1]++;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; document.getElementById('board-timer-btn').classList.remove('timer-urgent'); }

  document.getElementById('hex-svg').classList.add('game-over');
  document.querySelectorAll('#hex-svg .hex-cell').forEach((g, i) => { if (STATE.cells[i] && STATE.cells[i].owner === team) g.classList.add('win-pulse'); });

  const theme = THEMES[STATE.themeIdx];
  const color = team === 1 ? theme.t1 : theme.t2;
  const name = team === 1 ? 'الفريق الأول' : 'الفريق الثاني';
  document.getElementById('win-content').innerHTML = `<div class="win-trophy">🏆</div><div class="win-team-name" style="color:${color}">${name} يفوز بالجولة!</div><div class="win-score-detail">وصل إلى الطرف المقابل بنجاح ✓</div>`;

  const isLast = STATE.currentRound >= STATE.totalRounds;
  document.querySelector('#modal-win .win-modal-action')?.remove();
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn btn--black btn--full win-modal-action';
  actionBtn.textContent = isLast ? '🏁 عرض النتيجة النهائية' : '▶ الجولة التالية';
  actionBtn.onclick = () => { closeModal('modal-win'); isLast ? _showFinalModal() : _advanceRound(); };
  document.querySelector('#modal-win .modal-box').appendChild(actionBtn);

  setTimeout(() => openModal('modal-win'), 300);
}

function nextRound() {
  if (!STATE.roundWinAwarded) { const [s0, s1] = STATE.teamScores; if (s0 > s1) STATE.roundWins[0]++; else if (s1 > s0) STATE.roundWins[1]++; }
  if (STATE.currentRound >= STATE.totalRounds) { _showFinalModal(); return; }
  _advanceRound();
}

function _advanceRound() {
  STATE.currentRound++;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; document.getElementById('board-timer-btn').classList.remove('timer-urgent'); }
  buildBoard();
}

function _showFinalModal() {
  const [w0, w1] = STATE.roundWins; const theme = THEMES[STATE.themeIdx]; let html;
  if (w0 > w1) html = `<div class="win-trophy">🏆</div><div class="win-team-name" style="color:${theme.t1}">الفريق الأول يفوز!</div><div class="win-score-detail">${w0} جولة &nbsp;·&nbsp; ${w1} جولة</div>`;
  else if (w1 > w0) html = `<div class="win-trophy">🏆</div><div class="win-team-name" style="color:${theme.t2}">الفريق الثاني يفوز!</div><div class="win-score-detail">${w1} جولة &nbsp;·&nbsp; ${w0} جولة</div>`;
  else html = `<div class="win-trophy">🤝</div><div class="win-team-name">تعادل!</div><div class="win-score-detail">${w0} جولة لكل فريق</div>`;
  document.getElementById('win-content').innerHTML = html;
  document.querySelector('#modal-win .win-modal-action')?.remove();
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn btn--black btn--full win-modal-action';
  actionBtn.textContent = 'العودة للقائمة الرئيسية';
  actionBtn.onclick = () => { closeModal('modal-win'); showView('menu'); };
  document.querySelector('#modal-win .modal-box').appendChild(actionBtn);
  openModal('modal-win');
}

function _updateTopBar() {
  document.getElementById('t1-score').textContent = STATE.teamScores[0];
  document.getElementById('t2-score').textContent = STATE.teamScores[1];
  document.getElementById('round-badge').textContent = `جولة ${STATE.currentRound} / ${STATE.totalRounds}`;
  document.getElementById('next-round-btn').textContent = STATE.currentRound < STATE.totalRounds ? 'الجولة التالية ←' : '🏁 إنهاء اللعبة';
}
function _updateNeutralChip() { document.getElementById('neutral-count').textContent = `${STATE.cells.filter(c => c.owner === 0).length} محايدة`; }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function handleBackdrop(event, id) { if (event.target === event.currentTarget) closeModal(id); }
function confirmQuit() { if (window.confirm('هل تريد إنهاء اللعبة والعودة للقائمة الرئيسية؟')) showView('menu'); }

let _qBankBuilt = false;

function _initQBank() {
  if (_qBankBuilt) return;
  _qBankBuilt = true;
  const container = document.getElementById('letter-grid');
  if (!container) return;
  LETTERS.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.addEventListener('click', () => _showLetterQs(letter, btn));
    container.appendChild(btn);
  });
}

function _showLetterQs(letter, clickedBtn) {
  document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('selected'));
  clickedBtn.classList.add('selected');

  const questions = QUESTION_BANK[letter] || [];

  const panel = document.getElementById('q-panel');
  if (!panel) return;

  if (questions.length === 0) {
    panel.innerHTML = `
      <div class="q-panel__empty">
        <span class="q-panel__icon">🔎</span>
        <p>لا توجد أسئلة مضافة لهذا الحرف حالياً.</p>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <div class="q-panel__header">
      <div class="q-letter-badge">${letter}</div>
      <div class="q-panel__header-text">
        <h3>أسئلة حرف ${letter}</h3>
        <small>${questions.length} أسئلة متوفرة</small>
      </div>
    </div>
    <div class="q-list">
      ${questions.map(q => `
        <div class="q-item">
          <span class="q-cat">${q.cat}</span>
          <span class="q-text">${q.q}</span>
          <span class="q-ans">الإجابة: ${q.a}</span>
        </div>`).join('')}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => { buildThemeOptions(); });