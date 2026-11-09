# Google 反重力 (Antigravity) 本地汉化与功能整合套件 | 深度无损增强版

<div align="center">

**专为 Google 反重力（Antigravity 2.12.2 ~ 2.29.0 及后续微版本）打造的高安全、纯离线、逐字节可还原的 Windows 本地汉化与增强工具套件。**  
*界面深度汉化 · 侧边栏小标题中文守护 · 实时上下文监控 · 模型额度智能联动 · 居中沉浸输入卡片 · 窗口尺寸记忆 · 网络代理注入 · 一键更新启动 · 30 项自动化全测试*

[![Release](https://img.shields.io/github/v/release/huashuimoyv/antigravity-chinese?label=Release&color=blue&logo=github)](https://github.com/huashuimoyv/antigravity-chinese/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows)](https://www.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-30%20Passed-brightgreen)](test/)

[📥 立即下载便携版 (Releases)](https://github.com/huashuimoyv/antigravity-chinese/releases/latest) · [🌟 核心功能一览](#-核心特性全景) · [✨ 方案对比](#-与传统汉化方案的对比) · [🚀 快速上手](#-快速上手) · [🛡️ 安全机制](#️-安全与容灾设计)

</div>

---

## 💡 为什么选择 Antigravity Local ZH？

在体验社区早期汉化方案或官方原生客户端时，开发者与深度用户经常会面临一系列切实痛点：
1. **侧边栏英文标题折磨**：新开会话明明全程用中文提问，后台轻量模型却自动生成生硬冗长的全英文大写标题（如 `Graduation Recommendation Form Awards And Certificates`），每次都得手动右键重命名。
2. **安全与还原风险**：许多方案采用全量解包与重打包方式，导致原生依赖损坏或主程序哈希突变，升级后直接白屏或报错封禁，无法恢复官方原版。
3. **误翻译核心代码**：粗暴的全局文本替换破坏了 Monaco 编辑器里的变量、提示词或终端命令。
4. **缺乏关键监控与配置**：没有直观的 Token 上下文占用进度，多模型额度情况不明，窗口大小与网络代理每次重启都要重新配置。

本项目 (`antigravity-chinese`) 由此诞生，确立了**深度功能整合、安全无损可逆、开箱即用、透明可审阅**的核心标准：

---

## 🌟 核心特性全景

### 1. 🏷️ 侧边栏小标题智能中文守卫 (Sidebar Title Localizer - v1.0.7 重磅新增)
- **痛点根治**：彻底解决官方后台轻量总结模型每次新开会话自动吐出英文单词标题的顽疾。
- **毫秒级全自动巡检**：插件在渲染进程启动异步智能守卫，实时扫描侧边栏会话列表。
- **首轮中文意图提炼**：自动调用底层 `/GetCascadeTrajectorySteps` 读取主人首轮提问的核心语句，提炼出 4~18 字凝练、地道、优雅的中文主题小标题。
- **高精度主题词典兜底**：针对无首轮文本（如直接发送图片/报错日志）的会话，内置覆盖数十种高频场景的主题词典与专有名词映射，精准转译为中文。
- **原生 Connect-RPC 持久化**：直接触发官方 `/UpdateConversationAnnotations` 接口，同步更新底层本地 SQLite 数据库，并驱动界面实时平滑更新，全程静默无感，无需任何手动介入。

### 2. 🌐 全量界面深度汉化与代码/正文安全隔离 (Deep Localization & Protected Tree)
- **精校 650+ 常用文案**：覆盖设置中心、模型选择器、用量面板、扩展与技能管理、全局权限、外观配色以及 Windows 原生应用程序菜单。
- **严密保护隔离树**：构建了覆盖 `Monaco Editor`、`xterm` 终端、Markdown 对话正文区、`[data-message-id]` 消息块、`textarea` 提示词区域的完整免侵入保护树，绝对不触碰用户的代码、变量与输出内容。

### 3. 📊 顶部实时上下文用量监控胶囊 (Context Monitor Topbar)
- **高信息密度状态胶囊**：常驻顶部导航栏，实时显示当前会话的已用 Token、总上限与百分比（如 `20.0k / 256k · 8%`）。
- **三段式彩色进度条**：根据当前 Token 占用比率自动呈现优雅的健康色彩阶梯。
- **Prompt 缓存命中率统计**：精准计算并展示 KV Cache 缓存命中比例（如 `缓存 75%`），帮助用户直观掌握缓存利用效率。
- **一键轨迹调试器直达**：点击监控卡片即可直接呼出 Antigravity 原生全屏轨迹调试面板（Trajectory Debugger）。

### 4. 🤖 多模型配额智能联动面板 (Quota Overview & Model-Aware Limits)
- **多模型额度实时感知**：接入官方实时 Quota RPC，动态感应当前激活的对话模型。
- **针对性用量展示**：Gemini 4 Argon 自动常驻显示周额度比例及精确重置倒计时（如 `G4周额 61% (1d4h)`）；Gemini 2.5/3.8 Flash、Claude、GPT 自动展示 5 小时滚动可用配额。
- **一览式交互弹窗**：点击胶囊卡片即可弹出精美的多模型配额卡片，系统化呈现各大模型组的实时余量与剩余时间。

### 5. 🎨 居中沉浸式输入卡片与视觉美化 (Centered Surface Composer)
- **精简主页排版**：优雅隐藏主页冗余的巨大 Greeting 占位符，消除界面上下滑动撕裂感。
- **现代居中卡片布局**：重构 Surface Composer 为居中大卡片风格，最大宽度自适应收拢，视线更加聚焦舒适。
- **内联代码视觉优化**：增强行内代码块呈现为 Emerald 柔和绿标配色与精致微圆角，与终端整体质感深度契合。
- **层级穿透与交互修复**：彻底修复 `@` 提及下拉菜单在特定状态下被外层容器遮挡截断的布局问题。

### 6. 🪟 窗口尺寸记忆与黄金预设 (Window Bounds Persistence)
- **黄金比例启动**：初次启动自动居中呈现视觉舒适的 `1332 × 784` 黄金预设窗口。
- **位置与状态持久化**：实时监听窗口移动、缩放与最大化状态并写入本地存储，下次启动完美保留，彻底告别打回原形。

### 7. ⚡ 本地网络代理无缝注入 (Local Network Proxy Injection)
- **一键开启代理**：图形界面提供独立代理开关（默认支持主流代理工具端口 `127.0.0.1:7890`）。
- **全链路参数注入**：启动时同步配置 Chromium 启动参数、系统环境变量与 Electron Session 会话层，确保大模型后台通信流畅不超时。

### 8. 🛡️ 非破坏性追加与逐字节精确还原 (Byte-Identical & Reversible ASAR)
- **绝不全量解包**：独创原生 ASAR 尾部追加算法，原数据区零修改，仅重写文件头索引与 4MB SHA-256 分块校验哈希。
- **逐字节还原验证**：执行一键恢复后，`app.asar` 文件的 SHA-256 哈希值与 Google 官方原始包 **100% 逐字节完全一致**。

---

## 📊 与传统汉化方案的对比

| 核心维度 | 传统 / 早期汉化方案 | 本项目 (Antigravity Local ZH v1.0.8) |
| :--- | :--- | :--- |
| **侧边栏小标题** | 频繁生成英文标题，必须每次手动重命名 | **全自动智能中文守卫**：提炼首句中文意图并静默 RPC 写回数据库，永保中文排版 |
| **还原能力** | 通常无法完全恢复，或重打包后哈希突变 | **逐字节精确还原 (Byte-identical)**，恢复后 SHA-256 与官方原包完全一致 |
| **ASAR 操作方式** | 全量解包目录后再重打包，易破坏原生依赖 | **非破坏性追加模式**：原数据区零修改，仅尾部追加并重算 4MB 完整性校验分块 |
| **代码与正文保护** | 粗粒度 DOM 替换，易误翻代码变量与提示词 | **严格的隔离过滤树**：Monaco 代码区、xterm 终端、会话 Markdown 与提示词绝对免触碰 |
| **版本适应性** | 锁定单一哈希，官方升级后立刻报错或闪退 | **结构自适应引擎**：全面支持 2.12.2 ~ 2.29.0+，官方升级微版本后自动识别并安全兼容 |
| **功能整合度** | 仅覆盖常规界面浅层翻译 | **九大核心增强整合**：界面汉化 + 侧边栏中文守卫 + 上下文监控 + 模型额度 + 居中布局 + 窗口记忆 + 网络代理 |
| **日常使用体验** | 升级后补丁被覆盖需要繁琐重新配置 | **一键启动**：内置现代化桌面工具与脚本，点击即可静默补丁并直接拉起客户端 |
| **运行依赖** | 往往需要用户配置复杂环境或联网下载外部脚本 | **零外部依赖**：纯原生无损实现；提供**编译好的独立桌面启动器 EXE**，解压双击直接用 |

---

## 🚀 快速上手

### 环境要求
- **操作系统**：Windows 10 / 11
- **适用版本**：Antigravity 桌面客户端（已测试：**2.12.2 ~ 2.29.0+** 官方全版本自适应兼容）

---

### 方案 A：便携桌面版（推荐所有用户）

1. 前往 [Releases 页面](https://github.com/huashuimoyv/antigravity-chinese/releases/latest) 下载 **`antigravity-chinese-v1.0.7-portable.zip`**；
2. 解压到任意目录；
3. 双击运行 **`启动汉化工具.exe`**（或双击 **`一键启动.cmd`**）；
4. 点击界面的 **“一键启动 Antigravity”**（或 “更新补丁并启动”），工具会自动完成打补丁并拉起客户端。

*(如需恢复官方英文，退出客户端后点击界面的“恢复官方英文”即可秒级还原)*

---

### 方案 B：命令行 CLI（开发者与高级用户）

适合已有 Node.js 22.12+ 环境的用户：

```powershell
# 1. 检查客户端状态与环境兼容性（只读安全检查）
node cli.js check

# 2. 退出客户端后，执行安装或原位更新
node cli.js install

# 3. 随时查看补丁及备份校验状态
node cli.js status

# 4. 恢复安装前官方原始资源包
node cli.js restore
```

若 Antigravity 安装在非默认目录，可通过 `--path` 指定：
```powershell
node cli.js install --path "D:\Apps\Antigravity"
node cli.js restore --path "D:\Apps\Antigravity\resources\app.asar"
```

---

## 🛡️ 安全与容灾设计

1. **SHA-256 指纹与结构自适应引擎**：安装前严格校验 ASAR 结构，既有显式哈希白名单保障，又具备核心结构自适应能力，拒绝写入任何损坏的文件。
2. **原子化临时写入与安全替换**：先在同目录写入临时文件校验完整性，二次确认客户端未运行且原包未变后原子覆盖（Rename），从不直接删除正在运行的原包。
3. **备份隔离与校验机制**：备份隔离保存在 `resources/.antigravity-local-zh/` 中，还原时严格校验哈希，确保逐字节无差错还原。
4. **防并发进程锁**：写入关键期自动加锁 `operation.lock`，防止多进程冲突。

---

## 💻 自动化测试验证

项目内置严谨的自动化测试套件（使用 Node.js 原生 Test Runner）：

```powershell
# 运行全部 30 项自动化测试（涵盖 ASAR 规范互认、自适应兼容、侧边栏中文标题自动转换、现代设置面板与内置浏览器汉化、上下文挂载、模型额度联动、代理注入、DOM 保护及容灾恢复）
npm test
```

---

## 📜 致谢与开源协议

- 本项目为个人维护的辅助工具，与 Google、Electron 官方无任何隶属关系。
- 仓库代码遵守 [MIT License](LICENSE) 开源协议。
