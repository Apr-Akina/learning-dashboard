/**
 * 雅思7.0+日常口语学习工作台 - 后端服务入口
 * 技术栈: Node.js + Express + SQLite3
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API 路由
app.use('/api', routes);

// 根路径返回前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: '服务器内部错误', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  雅思学习工作台后端已启动`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/api/tasks`);
  console.log(`========================================`);
});

module.exports = app;
