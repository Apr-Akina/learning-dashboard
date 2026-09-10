/**
 * 雅思学习工作台 - API 路由
 * 包含数据库初始化、任务管理、语块管理、统计接口
 */
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();

// ========== 数据库初始化 ==========
const DB_PATH = path.join(__dirname, 'database', 'learning.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] 连接失败:', err.message);
  } else {
    console.log('[DB] SQLite 数据库已连接');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    // 进度表
    db.run(`CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      date TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('[DB] progress 表创建失败:', err);
      else console.log('[DB] progress 表就绪');
    });

    // 用户统计表
    db.run(`CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streak_days INTEGER DEFAULT 0,
      last_checkin_date TEXT
    )`, (err) => {
      if (err) console.error('[DB] user_stats 表创建失败:', err);
      else {
        console.log('[DB] user_stats 表就绪');
        // 初始化一条统计记录
        db.get(`SELECT COUNT(*) as cnt FROM user_stats`, (err, row) => {
          if (row && row.cnt === 0) {
            db.run(`INSERT INTO user_stats (streak_days, last_checkin_date) VALUES (0, NULL)`);
          }
        });
      }
    });
  });
}

// ========== 工具函数 ==========
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 基于日期的简单哈希，保证同一天返回相同的随机语块
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ========== 30+ 高频万能语块库 ==========
const PHRASE_BANK = [
  { en: "I'll have the..., please.", zh: "请给我来……", scene: "点餐", example: "I'll have the grilled salmon, please.", tip: "重读 have 和菜品名，please 轻读降调，体现礼貌但不犹豫。" },
  { en: "Could you tell me how to get to...?", zh: "您能告诉我怎么去……吗？", scene: "问路", example: "Could you tell me how to get to the nearest subway station?", tip: "Could you 连读成 /kʊdʒə/，get to 弱读为 /gɛtə/。" },
  { en: "How have you been lately?", zh: "最近怎么样？", scene: "工作寒暄", example: "Hey Tom, how have you been lately? Long time no see!", tip: "been lately 连读，语调上扬表示关心，是 native 最常用的寒暄开场。" },
  { en: "From my perspective,...", zh: "在我看来……", scene: "表达观点", example: "From my perspective, remote work boosts productivity.", tip: "perspective 重音在第二音节 /pɚˈspɛktɪv/，雅思口语 Part 3 高分表达。" },
  { en: "I was wondering if you could...", zh: "我在想您是否可以……", scene: "礼貌请求", example: "I was wondering if you could help me with this report.", tip: "比 Can you 礼貌十倍，was wondering 用过去进行时表委婉，职场必备。" },
  { en: "I couldn't agree more.", zh: "我完全同意。", scene: "同意对方", example: "I couldn't agree more. That's exactly what I was thinking.", tip: "否定词 + 比较级表最高级，语气强烈且地道，避免反复说 I agree。" },
  { en: "I see your point, but...", zh: "我理解你的意思，但是……", scene: "委婉反对", example: "I see your point, but we need to consider the budget.", tip: "先肯定再转折，商务沟通黄金句式，but 后稍作停顿增强说服力。" },
  { en: "I'm a bit under the weather.", zh: "我有点不舒服。", scene: "描述感受", example: "I'm a bit under the weather today, so I'll work from home.", tip: "习语表达，比 I'm sick 更地道委婉，under the weather 连读流畅。" },
  { en: "Let's catch up sometime.", zh: "有空聚聚。", scene: "社交邀约", example: "It was great seeing you! Let's catch up sometime next week.", tip: "catch up 表示叙旧，sometime 轻读，是告别时自然邀约的万能句。" },
  { en: "Do you have this in a different size?", zh: "这个有别的尺码吗？", scene: "购物", example: "I like this jacket. Do you have this in a medium?", tip: "in a different size 中 in a 连读，购物场景最高频问句之一。" },
  { en: "Would you mind if I...?", zh: "您介意我……吗？", scene: "征得许可", example: "Would you mind if I take a rain check on our meeting?", tip: "if I 后接动词原形，mind 后用 if 从句，比 Can I 正式得多。" },
  { en: "That sounds like a plan.", zh: "听起来不错，就这么定了。", scene: "确认安排", example: "Dinner at 7 then? That sounds like a plan!", tip: "口语中表示同意计划的地道说法，比 OK 更有参与感和热情。" },
  { en: "I'm tied up until...", zh: "我一直忙到……", scene: "时间安排", example: "I'm tied up until 3 PM. Can we meet after that?", tip: "tied up 比喻忙得脱不开身，比 I'm busy 形象生动，职场高频。" },
  { en: "Let me get back to you on that.", zh: "我稍后回复你。", scene: "暂缓答复", example: "That's a good question. Let me get back to you on that by Friday.", tip: "无法立即回答时的专业表达，商务邮件和口语万能短语。" },
  { en: "It's on me.", zh: "我请客。", scene: "聚餐买单", example: "Don't worry about the bill, it's on me today.", tip: "简短有力，比 I'll pay 自然，注意 on 重读，me 轻读。" },
  { en: "I'm looking forward to...", zh: "我期待……", scene: "表达期待", example: "I'm looking forward to our collaboration next quarter.", tip: "to 是介词，后接名词或动名词，邮件结尾和口语都高频。" },
  { en: "Could you give me a hand with...?", zh: "能帮我搭把手吗？", scene: "请求帮助", example: "Could you give me a hand with this heavy box?", tip: "give me a hand 比 help me 更口语化、更友好，熟人之间常用。" },
  { en: "I'm running a bit late.", zh: "我可能会晚一点到。", scene: "迟到告知", example: "Sorry, I'm running a bit late. I'll be there in 10 minutes.", tip: "比 I'm late 更委婉，running late 是地道的迟到预告表达。" },
  { en: "Let's call it a day.", zh: "今天就到这儿吧。", scene: "结束工作", example: "We've made great progress. Let's call it a day.", tip: "团队收工时的常用句，表示今天工作圆满结束。" },
  { en: "I'll keep you posted.", zh: "我会随时通知你进展。", scene: "保持沟通", example: "I'll keep you posted once I hear back from the client.", tip: "keep you posted = 持续更新信息，比 I'll tell you 更专业。" },
  { en: "That's a good point.", zh: "说得有道理。", scene: "认可对方", example: "That's a good point. I hadn't thought of it that way.", tip: "讨论中认可对方观点的万能句，比 You're right 更得体。" },
  { en: "I'm not sure I follow.", zh: "我没太听懂。", scene: "请求澄清", example: "I'm not sure I follow. Could you explain that again?", tip: "比 I don't understand 更委婉，暗示是对方没讲清楚而非自己笨。" },
  { en: "Let's figure this out together.", zh: "我们一起想办法。", scene: "协作解决", example: "Don't worry, let's figure this out together.", tip: "体现团队精神的表达，figure out = 弄明白、解决。" },
  { en: "I'll take your word for it.", zh: "我信你说的。", scene: "表示信任", example: "If you say it's safe, I'll take your word for it.", tip: "表示信任对方的判断，口语中非常地道的说法。" },
  { en: "It's not rocket science.", zh: "这没那么难。", scene: "鼓励/轻描淡写", example: "Just follow the instructions. It's not rocket science.", tip: "常用习语，表示事情不难，鼓励对方不要畏难。" },
  { en: "I'm on the fence about...", zh: "我对……还在犹豫。", scene: "表达犹豫", example: "I'm on the fence about accepting that job offer.", tip: "on the fence = 骑墙、犹豫，比 I'm not sure 更形象。" },
  { en: "Let's touch base next week.", zh: "下周再联系沟通。", scene: "预约沟通", example: "Let's touch base next week to review the progress.", tip: "touch base = 联系、沟通，源自棒球术语，职场高频。" },
  { en: "I'll play it by ear.", zh: "到时候看情况吧。", scene: "灵活应对", example: "I don't have a fixed plan. I'll play it by ear.", tip: "play it by ear = 见机行事，源自音乐即兴演奏。" },
  { en: "That's the last straw.", zh: "真是忍无可忍了。", scene: "表达愤怒", example: "He missed the deadline again? That's the last straw!", tip: "the last straw = 最后一根稻草，忍耐力的极限。" },
  { en: "I'm over the moon.", zh: "我太开心了。", scene: "表达喜悦", example: "I got the promotion! I'm over the moon!", tip: "over the moon = 欣喜若狂，比 very happy 生动得多。" },
  { en: "Break a leg!", zh: "祝你好运！", scene: "祝福/鼓励", example: "You've got the interview tomorrow? Break a leg!", tip: "看似诅咒实为祝福，演出前的传统祝福语，日常也可用。" },
  { en: "Let's grab a coffee sometime.", zh: "有空一起喝杯咖啡。", scene: "社交邀约", example: "It was nice meeting you. Let's grab a coffee sometime.", tip: "grab a coffee = 随便喝杯咖啡，轻松的社交邀约方式。" },
];

// ========== 任务定义 ==========
const TASK_DEFINITIONS = [
  { id: 'vocab_new', name: '今日新词', type: 'count', target: 25, category: 'vocab' },
  { id: 'vocab_review', name: '复习旧词', type: 'count', target: 75, category: 'vocab' },
  { id: 'morning_listen', name: '泛听 + 跟读模仿', type: 'boolean', category: 'basics', time: '早通勤', duration: '6 min', timerSec: 360 },
  { id: 'morning_read', name: '阅读短文 · 记3个好句', type: 'boolean', category: 'basics', time: '早通勤', duration: '15 min', timerSec: 900 },
  { id: 'noon_dictation', name: '精听听写（1分钟素材）', type: 'boolean', category: 'basics', time: '午休', duration: '10 min', timerSec: 600 },
  { id: 'evening_retell', name: '口语复述', type: 'boolean', category: 'basics', time: '晚上', duration: '10 min', timerSec: 600 },
  { id: 'evening_translate', name: '汉译英回译', type: 'boolean', category: 'basics', time: '晚上', duration: '10 min', timerSec: 600 },
  { id: 'shadow_reading', name: '影子跟读', type: 'boolean', category: 'speaking', duration: '30 sec', timerSec: 30 },
  { id: 'bathroom_monologue', name: '浴室独白', type: 'boolean', category: 'speaking', duration: '5 min', timerSec: 300 },
  { id: 'checkin', name: '今日打卡', type: 'boolean', category: 'checkin' },
];

// 任务详细 Tips
const TASK_TIPS = {
  morning_listen: [
    { title: '泛听要点', text: '选 3-5 分钟的英语播客或新闻，不暂停、不查词，抓大意和语调即可。通勤时戴耳机循环播放，让耳朵先适应语流。' },
    { title: '跟读模仿法', text: '听到一句后暂停，逐句模仿原音的语音语调，特别关注连读（如 get in → /gɛtɪn/）、弱读（of → /əv/）和重音位置。录下自己的声音与原音对比。' },
    { title: '通勤提醒', text: '注意力放在「声音的节奏」而非「每个词的意思」，先建立耳朵对英语节奏的敏感度。' },
  ],
  morning_read: [
    { title: '选材建议', text: '选 200-300 词的短文（BBC Learning English、经济学人 Espresso 均可），难度略高于当前水平即可。' },
    { title: '好句摘抄法', text: '遇到好的表达立即摘抄到本子或备忘录，每天至少 3 句。重点抄「句型结构」而非单个单词。' },
    { title: '造句巩固', text: '每个摘抄的句型当天造一个自己的句子，把别人的表达变成自己的。这是从输入到输出的关键一步。' },
  ],
  noon_dictation: [
    { title: '听写四步法', text: '① 完整听 1 遍理解大意；② 逐句听写，每句听 2-3 遍；③ 对照原文标记错误；④ 跟读错误部分 3 遍。' },
    { title: '素材选择', text: '用 1 分钟左右的清晰音频（VOA Special English、雅思听力 Section 2 均可），素材不求多，每篇吃透。' },
    { title: '错误分类', text: '把听写错误分为：连读没听出、弱读没听出、单词不认识、拼写错误。针对最高频的错误类型专项突破。' },
  ],
  evening_retell: [
    { title: '复述法', text: '读完或听完一段材料后，合上材料，用自己的话口头复述主要内容。不追求逐字一致，追求逻辑连贯和表达自然。' },
    { title: '录音回听', text: '一定要录音！回听时关注：是否有过多 um/ah 填充词、时态是否混乱、句子是否完整。每天改进一个小问题。' },
    { title: '升级表达', text: '复述时刻意使用当天摘抄的 3 个好句，把输入的语块在输出中激活，这是口语提分的核心机制。' },
  ],
  evening_translate: [
    { title: '回译法', text: '取一段有中英对照的材料（推荐新概念英语 2-3 册），先看中文译文，口头翻译成英文，再与原文对比。' },
    { title: '对比找差距', text: '重点对比：原文用了什么句型？我用了什么句型？差距在哪里？是词汇量、句型储备还是中式思维？' },
    { title: '刻意模仿', text: '对比后，把原文的表达大声朗读 5 遍，形成肌肉记忆。回译法是公认最高效的口语+写作双提升训练法。' },
  ],
};

// ========== 数据库操作辅助 ==========
function getTaskStatus(taskName, date) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT status FROM progress WHERE task_name = ? AND date = ?`,
      [taskName, date],
      (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.status : 0);
      }
    );
  });
}

function setTaskStatus(taskName, date, status) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM progress WHERE task_name = ? AND date = ?`,
      [taskName, date],
      (err, row) => {
        if (err) { reject(err); return; }
        const now = new Date().toISOString();
        if (row) {
          db.run(
            `UPDATE progress SET status = ?, updated_at = ? WHERE id = ?`,
            [status, now, row.id],
            (err) => (err ? reject(err) : resolve())
          );
        } else {
          db.run(
            `INSERT INTO progress (task_name, date, status, updated_at) VALUES (?, ?, ?, ?)`,
            [taskName, date, status, now],
            (err) => (err ? reject(err) : resolve())
          );
        }
      }
    );
  });
}

function getUserStats() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT streak_days, last_checkin_date FROM user_stats WHERE id = 1`, (err, row) => {
      if (err) reject(err);
      else resolve(row || { streak_days: 0, last_checkin_date: null });
    });
  });
}

function updateUserStats(streak, lastDate) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE user_stats SET streak_days = ?, last_checkin_date = ? WHERE id = 1`,
      [streak, lastDate],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

// 获取当天的10个语块索引（基于日期种子）
function getDailyPhraseIndices() {
  const today = getTodayStr();
  const seed = seededRandom(today);
  const indices = [];
  const used = new Set();
  let current = seed;
  while (indices.length < 10) {
    const idx = current % PHRASE_BANK.length;
    if (!used.has(idx)) {
      used.add(idx);
      indices.push(idx);
    }
    current = (current * 1103515245 + 12345) & 0x7fffffff; // LCG
  }
  return indices;
}

// ========== API 路由 ==========

/**
 * GET /api/tasks
 * 获取今日任务列表（单词、听说读写四项、口语任务），返回当天任务数据和完成状态
 */
router.get('/tasks', async (req, res) => {
  try {
    const today = getTodayStr();
    const tasks = [];

    for (const def of TASK_DEFINITIONS) {
      const status = await getTaskStatus(def.id, today);
      const task = {
        id: def.id,
        name: def.name,
        type: def.type,
        category: def.category,
        status: def.type === 'count' ? status : (status === 1),
        ...(def.target ? { target: def.target } : {}),
        ...(def.time ? { time: def.time } : {}),
        ...(def.duration ? { duration: def.duration } : {}),
        ...(def.timerSec ? { timerSec: def.timerSec } : {}),
        ...(TASK_TIPS[def.id] ? { tips: TASK_TIPS[def.id] } : {}),
      };
      tasks.push(task);
    }

    // 语块掌握状态
    const phraseIndices = getDailyPhraseIndices();
    const phrases = [];
    for (let i = 0; i < phraseIndices.length; i++) {
      const p = PHRASE_BANK[phraseIndices[i]];
      const mastered = await getTaskStatus(`phrase_${i}`, today);
      phrases.push({
        id: i,
        ...p,
        mastered: mastered === 1,
      });
    }

    res.json({
      date: today,
      tasks,
      phrases,
    });
  } catch (err) {
    console.error('[GET /tasks]', err);
    res.status(500).json({ error: '获取任务失败', detail: err.message });
  }
});

/**
 * POST /api/tasks/complete
 * 接收 { taskId: string }，标记某个任务为已完成
 * - 计数型任务（vocab_new / vocab_review）：status +1
 * - 布尔型任务：切换完成状态（0↔1）
 * - 语块任务（phrase_N）：切换掌握状态
 */
router.post('/tasks/complete', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: '缺少 taskId 参数' });
    }

    const today = getTodayStr();
    const def = TASK_DEFINITIONS.find((t) => t.id === taskId);

    // 语块任务
    if (taskId.startsWith('phrase_')) {
      const current = await getTaskStatus(taskId, today);
      const newStatus = current === 1 ? 0 : 1;
      await setTaskStatus(taskId, today, newStatus);
      return res.json({ success: true, taskId, mastered: newStatus === 1 });
    }

    if (!def) {
      return res.status(404).json({ error: '任务不存在', taskId });
    }

    if (def.type === 'count') {
      // 计数型：+1，不超过目标
      const current = await getTaskStatus(taskId, today);
      if (current >= def.target) {
        return res.json({ success: true, taskId, status: current, target: def.target, maxed: true });
      }
      const newStatus = current + 1;
      await setTaskStatus(taskId, today, newStatus);
      return res.json({ success: true, taskId, status: newStatus, target: def.target });
    }

    // 布尔型：切换
    const current = await getTaskStatus(taskId, today);
    const newStatus = current === 1 ? 0 : 1;
    await setTaskStatus(taskId, today, newStatus);

    // 如果是打卡任务，更新连续打卡
    if (taskId === 'checkin' && newStatus === 1) {
      const stats = await getUserStats();
      const yesterday = getDateStr(-1);
      let newStreak = 1;
      if (stats.last_checkin_date === yesterday) {
        newStreak = stats.streak_days + 1;
      } else if (stats.last_checkin_date === today) {
        newStreak = stats.streak_days;
      }
      await updateUserStats(newStreak, today);
      return res.json({ success: true, taskId, done: true, streak: newStreak });
    }

    res.json({ success: true, taskId, done: newStatus === 1 });
  } catch (err) {
    console.error('[POST /tasks/complete]', err);
    res.status(500).json({ error: '更新任务失败', detail: err.message });
  }
});

/**
 * GET /api/phrases
 * 返回当天的 10 个随机万能语块
 */
router.get('/phrases', async (req, res) => {
  try {
    const today = getTodayStr();
    const indices = getDailyPhraseIndices();
    const phrases = [];

    for (let i = 0; i < indices.length; i++) {
      const p = PHRASE_BANK[indices[i]];
      const mastered = await getTaskStatus(`phrase_${i}`, today);
      phrases.push({
        id: i,
        en: p.en,
        zh: p.zh,
        scene: p.scene,
        example: p.example,
        tip: p.tip,
        mastered: mastered === 1,
      });
    }

    res.json({
      date: today,
      total: phrases.length,
      phrases,
    });
  } catch (err) {
    console.error('[GET /phrases]', err);
    res.status(500).json({ error: '获取语块失败', detail: err.message });
  }
});

/**
 * GET /api/stats
 * 返回本周连续打卡天数及总学习进度百分比
 */
router.get('/stats', async (req, res) => {
  try {
    const today = getTodayStr();
    const stats = await getUserStats();

    // 计算本周打卡情况
    const dayOfWeek = new Date().getDay();
    const mondayOffset = -(dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const weekCheckins = [];
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    for (let i = 0; i < 7; i++) {
      const date = getDateStr(mondayOffset + i);
      const checked = await getTaskStatus('checkin', date);
      weekCheckins.push({
        day: labels[i],
        date,
        checked: checked === 1,
        isToday: date === today,
      });
    }

    // 计算总学习进度
    let totalItems = 0;
    let doneItems = 0;

    for (const def of TASK_DEFINITIONS) {
      if (def.id === 'checkin') continue;
      const status = await getTaskStatus(def.id, today);
      if (def.type === 'count') {
        totalItems += def.target;
        doneItems += Math.min(status, def.target);
      } else {
        totalItems += 1;
        doneItems += status === 1 ? 1 : 0;
      }
    }

    // 语块进度
    const phraseIndices = getDailyPhraseIndices();
    for (let i = 0; i < phraseIndices.length; i++) {
      totalItems += 1;
      const mastered = await getTaskStatus(`phrase_${i}`, today);
      doneItems += mastered === 1 ? 1 : 0;
    }

    const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    // 分类进度
    const categories = { vocab: 0, basics: 0, speaking: 0 };
    let vocabTotal = 0, vocabDone = 0;
    let basicsTotal = 0, basicsDone = 0;
    let speakingTotal = 0, speakingDone = 0;

    for (const def of TASK_DEFINITIONS) {
      if (def.id === 'checkin') continue;
      const status = await getTaskStatus(def.id, today);
      if (def.category === 'vocab') {
        vocabTotal += def.target;
        vocabDone += Math.min(status, def.target);
      } else if (def.category === 'basics') {
        basicsTotal += 1;
        basicsDone += status === 1 ? 1 : 0;
      } else if (def.category === 'speaking') {
        speakingTotal += 1;
        speakingDone += status === 1 ? 1 : 0;
      }
    }
    // 语块算入口语
    speakingTotal += phraseIndices.length;
    for (let i = 0; i < phraseIndices.length; i++) {
      const mastered = await getTaskStatus(`phrase_${i}`, today);
      speakingDone += mastered === 1 ? 1 : 0;
    }

    categories.vocab = vocabTotal > 0 ? Math.round((vocabDone / vocabTotal) * 100) : 0;
    categories.basics = basicsTotal > 0 ? Math.round((basicsDone / basicsTotal) * 100) : 0;
    categories.speaking = speakingTotal > 0 ? Math.round((speakingDone / speakingTotal) * 100) : 0;

    res.json({
      date: today,
      streak_days: stats.streak_days,
      last_checkin_date: stats.last_checkin_date,
      week_checkins: weekCheckins,
      total_progress_pct: progressPct,
      categories,
    });
  } catch (err) {
    console.error('[GET /stats]', err);
    res.status(500).json({ error: '获取统计失败', detail: err.message });
  }
});

/**
 * POST /api/reset
 * 重置所有进度（用于测试）
 */
router.post('/reset', (req, res) => {
  db.serialize(() => {
    db.run(`DELETE FROM progress`, (err) => {
      if (err) {
        return res.status(500).json({ error: '重置进度失败', detail: err.message });
      }
      db.run(`UPDATE user_stats SET streak_days = 0, last_checkin_date = NULL WHERE id = 1`, (err2) => {
        if (err2) {
          return res.status(500).json({ error: '重置统计失败', detail: err2.message });
        }
        console.log('[API] 所有进度已重置');
        res.json({ success: true, message: '所有进度已重置' });
      });
    });
  });
});

module.exports = router;
