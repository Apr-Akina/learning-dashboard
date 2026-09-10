/**
 * 雅思7.0+日常口语工作台 - 前端逻辑
 * 所有数据通过 fetch API 与后端交互，不再使用 localStorage
 */

const API_BASE = '/api';

// ========== 全局状态 ==========
let appState = {
  date: '',
  tasks: [],
  phrases: [],
  stats: null,
  mainTimer: { remaining: 3600, running: false },
};

// ========== 激励语库 ==========
const REWARDS = [
  "今日全部完成！你离 7.0 又近了一步。",
  "太棒了！坚持一天容易，坚持每一天了不起。",
  "100 个单词 + 四维训练 + 口语输出，今天的你超棒。",
  "每一个完成的今天，都是未来口语自由的基石。",
  "你已经比昨天的自己更强了，明天继续加油！",
  "碎片时间的复利，正在悄悄把你推向目标。",
];

// ========== API 请求封装 ==========
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

// ========== 初始化加载 ==========
async function initApp() {
  showLoading(true);
  try {
    // 并行获取任务和统计
    const [tasksData, statsData] = await Promise.all([
      apiGet('/tasks'),
      apiGet('/stats'),
    ]);

    appState.date = tasksData.date;
    appState.tasks = tasksData.tasks;
    appState.phrases = tasksData.phrases;
    appState.stats = statsData;

    renderDate();
    renderAll();
    bindEvents();

    showLoading(false);
  } catch (err) {
    console.error('[Init] 加载失败:', err);
    showLoadingError(err.message);
  }
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  const spinner = document.getElementById('loadingSpinner');
  const text = document.getElementById('loadingText');
  const sub = document.getElementById('loadingSub');
  const errorBox = document.getElementById('loadingError');

  if (show) {
    overlay.classList.remove('hidden');
    spinner.style.display = 'block';
    text.style.display = 'block';
    sub.style.display = 'block';
    errorBox.classList.remove('show');
  } else {
    overlay.classList.add('hidden');
  }
}

function showLoadingError(msg) {
  const overlay = document.getElementById('loadingOverlay');
  const spinner = document.getElementById('loadingSpinner');
  const text = document.getElementById('loadingText');
  const sub = document.getElementById('loadingSub');
  const errorBox = document.getElementById('loadingError');

  overlay.classList.remove('hidden');
  spinner.style.display = 'none';
  text.style.display = 'none';
  sub.style.display = 'none';
  errorBox.classList.add('show');
}

// ========== 渲染函数 ==========
function renderDate() {
  const d = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  document.getElementById('dateBadge').textContent =
    `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

function renderAll() {
  renderVocab();
  renderTimeline();
  renderPhrases();
  renderCheckin();
  updateProgress();
  updateMainTimerDisplay();
}

function renderVocab() {
  const newTask = appState.tasks.find(t => t.id === 'vocab_new');
  const reviewTask = appState.tasks.find(t => t.id === 'vocab_review');
  document.getElementById('vocabNewDone').textContent = newTask ? newTask.status : 0;
  document.getElementById('vocabReviewDone').textContent = reviewTask ? reviewTask.status : 0;
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const basicsTasks = appState.tasks.filter(t => t.category === 'basics');

  basicsTasks.forEach(task => {
    const done = task.status === true;
    const item = document.createElement('div');
    item.className = 'tl-item' + (done ? ' done' : '');
    item.innerHTML = `
      <div class="tl-card">
        <div class="tl-check ${done ? 'checked' : ''}" data-task="${task.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="tl-content">
          <div class="tl-time">${task.time || ''}</div>
          <div class="tl-name">${task.name}</div>
        </div>
        <span class="tl-dur">${task.duration || ''}</span>
      </div>
    `;

    // 点击勾选框
    item.querySelector('.tl-check').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTask(task.id);
    });

    // 点击卡片打开 Tips + 计时器
    item.querySelector('.tl-card').addEventListener('click', () => {
      openTipsModal(task);
    });

    container.appendChild(item);
  });
}

function renderPhrases() {
  const grid = document.getElementById('phrasesGrid');
  grid.innerHTML = '';

  appState.phrases.forEach(p => {
    const card = document.createElement('div');
    card.className = 'phrase-card' + (p.mastered ? ' mastered' : '');
    card.innerHTML = `
      <div class="phrase-en">${p.en}</div>
      <div class="phrase-zh">${p.zh}</div>
      <span class="phrase-scene">${p.scene}</span>
    `;
    card.addEventListener('click', () => openPhraseDetail(p.id));
    grid.appendChild(card);
  });
}

function renderCheckin() {
  if (!appState.stats) return;

  document.getElementById('streakNum').textContent = appState.stats.streak_days;

  // 本周圆点
  const dotsContainer = document.getElementById('weekDots');
  dotsContainer.innerHTML = '';

  if (appState.stats.week_checkins) {
    appState.stats.week_checkins.forEach(day => {
      const dot = document.createElement('div');
      dot.className = 'week-dot';
      if (day.checked) dot.classList.add('checked');
      if (day.isToday) dot.classList.add('today');
      dot.textContent = day.day;
      dotsContainer.appendChild(dot);
    });
  }

  // 打卡按钮状态
  const checkinTask = appState.tasks.find(t => t.id === 'checkin');
  const btn = document.getElementById('checkinBtn');
  if (checkinTask && checkinTask.status === true) {
    btn.textContent = '今日已打卡';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
  } else {
    btn.textContent = '今日打卡';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

function updateProgress() {
  if (!appState.stats) return;

  const cats = appState.stats.categories || {};
  const vocabPct = cats.vocab || 0;
  const basicsPct = cats.basics || 0;
  const speakingPct = cats.speaking || 0;

  document.getElementById('progVocab').style.width = vocabPct + '%';
  document.getElementById('pctVocab').textContent = vocabPct + '%';
  document.getElementById('progBasics').style.width = basicsPct + '%';
  document.getElementById('pctBasics').textContent = basicsPct + '%';
  document.getElementById('progSpeaking').style.width = speakingPct + '%';
  document.getElementById('pctSpeaking').textContent = speakingPct + '%';

  checkAllDone();
}

// ========== 任务操作 ==========
async function toggleTask(taskId) {
  try {
    const result = await apiPost('/tasks/complete', { taskId });

    // 更新本地状态
    const task = appState.tasks.find(t => t.id === taskId);
    if (task) {
      if (task.type === 'count') {
        task.status = result.status;
      } else {
        task.status = result.done;
      }
    }

    // 如果是打卡，更新统计
    if (taskId === 'checkin' && result.streak !== undefined) {
      appState.stats.streak_days = result.streak;
    }

    // 刷新统计数据
    await refreshStats();

    renderAll();

    if (result.done === true) {
      showToast('任务完成！继续保持。');
    } else if (result.mastered === true) {
      showToast('已标记掌握，太棒了！');
    }
  } catch (err) {
    showToast('操作失败: ' + err.message);
  }
}

async function refreshStats() {
  try {
    appState.stats = await apiGet('/stats');
  } catch (err) {
    console.error('[Stats] 刷新失败:', err);
  }
}

// ========== 单词 +1 ==========
async function vocabPlus(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (task.status >= task.target) {
    showToast('目标已完成！');
    return;
  }
  await toggleTask(taskId);
}

// ========== 语块详情 ==========
let currentPhraseId = null;

function openPhraseDetail(id) {
  const p = appState.phrases.find(x => x.id === id);
  if (!p) return;
  currentPhraseId = id;
  document.getElementById('pdEn').textContent = p.en;
  document.getElementById('pdZh').textContent = p.zh;
  document.getElementById('pdScene').textContent = p.scene;
  document.getElementById('pdExample').textContent = p.example;
  document.getElementById('pdTip').textContent = p.tip;
  document.getElementById('pdMasterBtn').textContent = p.mastered ? '取消掌握' : '标记掌握';
  document.getElementById('phraseModal').classList.add('active');
}

async function togglePhraseMastered() {
  try {
    const taskId = `phrase_${currentPhraseId}`;
    const result = await apiPost('/tasks/complete', { taskId });

    const p = appState.phrases.find(x => x.id === currentPhraseId);
    if (p) p.mastered = result.mastered;

    await refreshStats();
    renderAll();

    document.getElementById('phraseModal').classList.remove('active');
    showToast(result.mastered ? '已标记掌握，太棒了！' : '已取消掌握');
  } catch (err) {
    showToast('操作失败: ' + err.message);
  }
}

// ========== Tips 弹窗 ==========
function openTipsModal(task) {
  document.getElementById('tipsTitle').textContent = task.name;
  const content = document.getElementById('tipsContent');
  content.innerHTML = '';

  if (task.tips && task.tips.length > 0) {
    task.tips.forEach(tip => {
      const section = document.createElement('div');
      section.className = 'tip-section';
      section.innerHTML = `
        <h4>${tip.title}</h4>
        <p>${tip.text}</p>
      `;
      content.appendChild(section);
    });
  }

  // 添加开始计时按钮
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
  actions.innerHTML = `
    <button class="btn btn-ghost" style="flex:1" id="tipsOnlyClose">仅查看</button>
    <button class="btn btn-blue" style="flex:1" id="tipsStartTimer">开始 ${task.duration || '计时'}</button>
  `;
  content.appendChild(actions);
  document.getElementById('tipsModal').classList.add('active');

  document.getElementById('tipsOnlyClose').onclick = () => {
    document.getElementById('tipsModal').classList.remove('active');
  };
  document.getElementById('tipsStartTimer').onclick = () => {
    document.getElementById('tipsModal').classList.remove('active');
    openTimerModal(task.name, '专注完成本项任务，结束后自动提醒', task.timerSec || 600);
  };
}

// ========== 计时器（前端本地，不持久化） ==========
let mainTimerInterval = null;
let modalTimerInterval = null;
let modalTimerSec = 0;
let modalTimerRunning = false;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateMainTimerDisplay() {
  document.getElementById('mainTimer').textContent = formatTime(appState.mainTimer.remaining);
}

function startMainTimer() {
  if (appState.mainTimer.running) return;
  appState.mainTimer.running = true;
  document.getElementById('mainStartBtn').textContent = '暂停';
  mainTimerInterval = setInterval(() => {
    if (appState.mainTimer.remaining > 0) {
      appState.mainTimer.remaining--;
      updateMainTimerDisplay();
    } else {
      pauseMainTimer();
      showToast('今日 60 分钟学习目标达成！');
    }
  }, 1000);
}

function pauseMainTimer() {
  appState.mainTimer.running = false;
  document.getElementById('mainStartBtn').textContent = '继续';
  clearInterval(mainTimerInterval);
}

function resetMainTimer() {
  pauseMainTimer();
  appState.mainTimer.remaining = 3600;
  updateMainTimerDisplay();
  document.getElementById('mainStartBtn').textContent = '开始';
}

function openTimerModal(title, sub, seconds) {
  modalTimerSec = seconds;
  modalTimerRunning = false;
  document.getElementById('timerModalTitle').textContent = title;
  document.getElementById('timerModalSub').textContent = sub;
  document.getElementById('timerModalDisplay').textContent = formatTime(seconds);
  document.getElementById('timerModalDisplay').classList.remove('warning');
  document.getElementById('timerModalToggle').textContent = '开始';
  document.getElementById('timerModal').classList.add('active');
}

function toggleModalTimer() {
  if (modalTimerRunning) {
    modalTimerRunning = false;
    clearInterval(modalTimerInterval);
    document.getElementById('timerModalToggle').textContent = '继续';
  } else {
    modalTimerRunning = true;
    document.getElementById('timerModalToggle').textContent = '暂停';
    modalTimerInterval = setInterval(() => {
      if (modalTimerSec > 0) {
        modalTimerSec--;
        const disp = document.getElementById('timerModalDisplay');
        disp.textContent = formatTime(modalTimerSec);
        if (modalTimerSec <= 10) disp.classList.add('warning');
      } else {
        clearInterval(modalTimerInterval);
        modalTimerRunning = false;
        document.getElementById('timerModalToggle').textContent = '开始';
        showToast('计时结束！做得好！');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }
}

function closeTimerModal() {
  clearInterval(modalTimerInterval);
  modalTimerRunning = false;
  document.getElementById('timerModal').classList.remove('active');
}

// ========== 打卡 ==========
async function doCheckin() {
  const checkinTask = appState.tasks.find(t => t.id === 'checkin');
  if (checkinTask && checkinTask.status === true) return;
  await toggleTask('checkin');
}

// ========== 全部完成检测 ==========
function checkAllDone() {
  const vocabNew = appState.tasks.find(t => t.id === 'vocab_new');
  const vocabReview = appState.tasks.find(t => t.id === 'vocab_review');
  const basicsDone = appState.tasks
    .filter(t => t.category === 'basics')
    .every(t => t.status === true);
  const phrasesDone = appState.phrases.every(p => p.mastered);
  const shadow = appState.tasks.find(t => t.id === 'shadow_reading');
  const monologue = appState.tasks.find(t => t.id === 'bathroom_monologue');
  const checkin = appState.tasks.find(t => t.id === 'checkin');

  const vocabDone =
    (vocabNew ? vocabNew.status >= 25 : false) &&
    (vocabReview ? vocabReview.status >= 75 : false);
  const speakingDone =
    (shadow ? shadow.status === true : false) &&
    (monologue ? monologue.status === true : false);
  const checkedIn = checkin ? checkin.status === true : false;

  if (vocabDone && basicsDone && phrasesDone && speakingDone && checkedIn) {
    const banner = document.getElementById('rewardBanner');
    if (!banner.classList.contains('show')) {
      const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];
      document.getElementById('rewardText').textContent = reward;
      banner.classList.add('show');
    }
  }
}

// ========== Toast ==========
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 主计时器
  document.getElementById('mainStartBtn').addEventListener('click', () => {
    if (appState.mainTimer.running) pauseMainTimer();
    else startMainTimer();
  });
  document.getElementById('mainResetBtn').addEventListener('click', resetMainTimer);

  // 单词
  document.getElementById('vocabStartBtn').addEventListener('click', () => {
    openTimerModal('单词快速过脸熟', '通勤 5 分钟 · 不求记住，求脸熟', 300);
  });
  document.getElementById('vocabNewPlus').addEventListener('click', () => vocabPlus('vocab_new'));
  document.getElementById('vocabReviewPlus').addEventListener('click', () => vocabPlus('vocab_review'));

  // 计时器弹窗
  document.getElementById('timerModalToggle').addEventListener('click', toggleModalTimer);
  document.getElementById('timerModalClose').addEventListener('click', closeTimerModal);
  document.getElementById('timerModal').addEventListener('click', (e) => {
    if (e.target.id === 'timerModal') closeTimerModal();
  });

  // Tips 弹窗关闭
  document.getElementById('tipsCloseBtn').addEventListener('click', () => {
    document.getElementById('tipsModal').classList.remove('active');
  });
  document.getElementById('tipsModal').addEventListener('click', (e) => {
    if (e.target.id === 'tipsModal') document.getElementById('tipsModal').classList.remove('active');
  });

  // 口语三斧头
  document.getElementById('shadowBtn').addEventListener('click', async () => {
    await toggleTask('shadow_reading');
    openTimerModal('影子跟读', '播放音频，延迟 0.5 秒跟读，模仿语调和节奏', 30);
  });
  document.getElementById('monologueBtn').addEventListener('click', async () => {
    await toggleTask('bathroom_monologue');
    openTimerModal('浴室独白', '用英语自言自语今天发生的事，不怕说错，只管说', 300);
  });

  // 语块弹窗
  document.getElementById('pdCloseBtn').addEventListener('click', () => {
    document.getElementById('phraseModal').classList.remove('active');
  });
  document.getElementById('pdMasterBtn').addEventListener('click', togglePhraseMastered);
  document.getElementById('phraseModal').addEventListener('click', (e) => {
    if (e.target.id === 'phraseModal') document.getElementById('phraseModal').classList.remove('active');
  });

  // 打卡
  document.getElementById('checkinBtn').addEventListener('click', doCheckin);

  // 重试按钮
  document.getElementById('retryBtn').addEventListener('click', () => {
    showLoading(true);
    initApp();
  });
}

// ========== 启动 ==========
initApp();
