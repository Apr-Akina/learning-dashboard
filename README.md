# 雅思 7.0+ 日常口语学习工作台

一个面向在职党的雅思口语学习全栈应用，前后端分离架构，帮助你利用每天约 1 小时碎片时间系统性提升英语口语。

## 技术栈

- **后端**: Node.js + Express + SQLite3
- **前端**: 原生 HTML / CSS / JavaScript（无框架依赖）
- **数据库**: SQLite（文件型，无需额外安装数据库服务）

## 项目结构

```
/learning-dashboard
  /backend
    /database          # SQLite 数据库文件（运行时自动生成）
    app.js             # Express 主入口
    routes.js          # API 路由 + 数据库逻辑
    package.json
  /frontend
    index.html         # 页面结构
    style.css          # 莫兰迪色系样式
    app.js             # 前端逻辑（fetch API 与后端交互）
  .gitignore
  README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问：**http://localhost:3000**

后端会自动：
- 创建 SQLite 数据库和数据表
- 托管前端静态文件
- 提供 RESTful API

### 3. 打开应用

在浏览器中打开 `http://localhost:3000` 即可使用。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 获取今日任务列表（单词、听说读写、口语）及完成状态 |
| POST | `/api/tasks/complete` | 标记任务完成，Body: `{ "taskId": "morning_listen" }` |
| GET | `/api/phrases` | 获取当天 10 个随机万能语块（后端维护 32 个语块库，按日期轮换） |
| GET | `/api/stats` | 获取连续打卡天数、本周打卡情况、总学习进度及分类进度 |
| POST | `/api/reset` | 重置所有进度（用于测试） |

## 功能模块

1. **今日总览看板** — 60 分钟倒计时 + 单词/基础/口语三大进度条
2. **单词微习惯** — 每日 25 新词 + 75 复习目标，5 分钟通勤背词计时器
3. **基础四维计划** — 早通勤/午休/晚上时间轴，5 项任务带详细操作 Tips（跟读模仿法、听写四步法、复述法、回译法）和独立倒计时
4. **日常口语三斧头** — 每日 10 个高频万能语块（点餐/问路/寒暄等），影子跟读 30s + 浴室独白 5min
5. **打卡与数据反馈** — 连续打卡天数、本周打卡热力图、全部完成后激励语彩蛋

## 数据库设计

### progress 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| task_name | TEXT | 任务标识 |
| date | TEXT | 日期（YYYY-MM-DD） |
| status | INTEGER | 状态（0/1，计数型任务存当前数量） |
| updated_at | TEXT | 更新时间 |

### user_stats 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| streak_days | INTEGER | 连续打卡天数 |
| last_checkin_date | TEXT | 上次打卡日期 |

## 设计特点

- **莫兰迪色系**：低饱和度蓝灰/豆沙绿/豆沙粉，护眼柔和
- **响应式布局**：手机和电脑自适应
- **数据持久化**：所有进度存储在 SQLite 数据库，刷新不丢失
- **离线友好提示**：后端未启动时显示"连接服务器中..."及重试引导
