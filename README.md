# Google 反重力 (Antigravity) 本地汉化与功能整合套件 | 深度无损便携版

<div align="center">

**专为 Google 反重力（Antigravity 2.12.2 ~ 2.27.0 及后续微版本）打造的高安全、纯离线、逐字节可还原的 Windows 本地汉化与增强工具套件。**  
*界面汉化 · 实时上下文监控 · Codex 风格波浪游标 · 窗口尺寸记忆 · 网络代理注入 · 一键更新启动 · 30 项全自动化测试*

[![Release](https://img.shields.io/github/v/release/huashuimoyv/antigravity-chinese?label=Release&color=blue&logo=github)](https://github.com/huashuimoyv/antigravity-chinese/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows)](https://www.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-30%20Passed-brightgreen)](test/)

[📥 立即下载便携版 (Releases)](https://github.com/huashuimoyv/antigravity-chinese/releases/latest) · [✨ 方案对比](#-与传统汉化方案的对比) · [🚀 快速上手](#-快速上手) · [🛡️ 安全机制](#️-安全与容灾设计)

</div>

---

## 💡 为什么选择 Local ZH？

在体验社区早期汉化方案时，开发者通常会面临一些顾虑：**“需要额外安装未知环境”、“解包重打包损坏原生模块”、“误翻译了代码编辑器里的变量”、“官方频繁微版本更新后补丁报错被封禁”、“网络代理和窗口尺寸每次启动都要重新配置”**。

本项目 (`antigravity-chinese`) 由此诞生，并确立了**安全无损、功能整合、开箱即用、透明可审阅**的核心原则：

### 📊 与传统汉化方案的对比

| 核心维度 | 传统 / 早期汉化方案 | 本项目 (Antigravity Local ZH v1.0.0) |
| :--- | :--- | :--- |
| **还原能力** | 通常无法完全恢复，或重打包后哈希突变 | **逐字节精确还原 (Byte-identical)**，恢复后 SHA-256 与官方原包完全一致 |
| **ASAR 操作方式** | 全量解包目录后再重打包，易破坏原生依赖 | **非破坏性追加模式**：原数据区零修改，仅尾部追加并重算 4MB 完整性校验分块 |
| **代码与正文保护** | 粗粒度 DOM 替换，易误翻代码变量与提示词 | **严格的隔离过滤树**：Monaco 代码区、xterm 终端、会话 Markdown 与提示词绝对免触碰 |
| **版本适应性** | 锁定单一哈希，官方升级后立刻无法启动 | **结构自适应引擎**：支持 2.12.2 ~ 2.22.0，官方更新微版本后自动识别并安全兼容 |
| **功能整合度** | 仅覆盖常规界面翻译 | **全套增强整合**：界面汉化 + 实时上下文监控 + Codex 波浪游标 + 窗口记忆 + 网络代理 |
| **日常使用体验** | 升级后补丁被覆盖需要繁琐重新配置 | **一键启动**：内置现代化 WPF 图标工具与脚本，点击即可静默补丁并拉起客户端 |
| **运行依赖** | 往往需要用户配置复杂环境或联网下载外部脚本 | **零外部依赖**：纯原生无损实现；提供**编译好的独立桌面启动器 EXE**，解压双击直接用 |

---

## 🌟 核心特性整合

- 🌐 **全量界面深度汉化**：精校 650+ 条常用界面文案，深度覆盖设置中心、模型与用量、自定义扩展、外观配色、辅助侧边栏及原生菜单，同时严格隔离 Monaco 代码编辑区与会话正文。
- 📊 **顶部实时上下文用量监控**：实时展示当前会话 Token 占用及百分比胶囊、系统提示词/工具/消息三色进度条、Prompt 缓存命中率统计，并可一键呼出官方全屏轨迹分析器。
- 🌊 **Codex 风格侧边波浪历史游标**：平滑插值动画的侧边波浪游标，鼠标悬浮即时显示当轮思考与回复概要，支持关键节点一键书签标记。
- 🪟 **窗口尺寸记忆与黄金预设**：初次启动自动居中呈现舒适的 `1332 × 784` 窗口，日常拖拽或最大化自动持久化记忆，重启不再被打回原形。
- ⚡ **本地网络代理无缝注入**：图形界面提供代理开关（默认支持 `127.0.0.1:7890`），启动时注入 Chromium 网络参数、环境变量与 Electron 会话，确保大模型后台通信流畅稳定。
- 🚀 **官方升级自适应与一键拉起**：即使官方静默升级覆盖了 `app.asar`，点击「一键启动 Antigravity」即可全自动静默补丁并直接启动客户端。

---

## 🚀 快速上手

### 环境要求
- **操作系统**：Windows 10 / 11
- **适用版本**：Antigravity 桌面客户端（已测试：**2.12.2 ~ 2.27.0** 官方全版本自适应兼容）

---

### 方案 A：便携桌面版（推荐所有用户）

1. 前往 [Releases 页面](https://github.com/huashuimoyv/antigravity-chinese/releases/latest) 下载 **`antigravity-chinese-v1.0.0-portable.zip`**；
2. 解压到任意目录；
3. 双击运行 **`启动汉化工具.exe`**（或双击 **`一键启动.cmd`**）；
4. 点击界面的 **“一键启动 Antigravity”**（或 “更新补丁并启动”），工具会自动完成打补丁并拉起客户端。

*(如需恢复官方英文，退出客户端后点击“恢复官方英文”即可秒级还原)*

---

### 方案 B：命令行 CLI（开发者）

适合已有 Node.js 22.12+ 环境的用户：

```powershell
# 1. 检查客户端状态与环境兼容性（只读安全检查）
node cli.js check

# 2. 退出客户端后，执行安装或就地更新
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

项目内置完整的自动化测试套件（使用 Node.js 原生 Test Runner）：

```powershell
# 运行全部 28 项自动化测试（涵盖 ASAR 规范互认、自适应兼容、上下文挂载、波浪游标、代理注入、DOM 保护及容灾恢复）
node --test
```

---

## 📜 致谢与开源协议

- 本项目为个人维护的辅助工具，与 Google、Electron 官方无任何隶属关系。
- 仓库代码遵守 [MIT License](LICENSE) 开源协议。
