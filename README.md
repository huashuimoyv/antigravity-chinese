# Antigravity Local ZH | 深度汉化与无损补丁

<div align="center">

**为开发者打造的高安全、纯离线、逐字节可还原的 Antigravity (2.12.2) 桌面汉化解决方案。**  
*零外部依赖 · 非破坏性 ASAR 追加 · 代码编辑绝对防误伤 · 原生无黑框 GUI · 650+ 精细词条*

[![Release](https://img.shields.io/github/v/release/huashuimoyv/antigravity-chinese-local?label=Release&color=blue&logo=github)](https://github.com/huashuimoyv/antigravity-chinese-local/releases)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows)](https://www.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-21%20Passed-brightgreen)](test/)

[📥 立即下载便携版 (Releases)](https://github.com/huashuimoyv/antigravity-chinese-local/releases/latest) · [✨ 方案对比](#-与传统汉化方案的对比) · [🚀 快速上手](#-快速上手) · [🛡️ 安全机制](#️-安全与容灾设计)

</div>

---

## 💡 为什么选择 Local ZH？

在体验社区早期汉化方案时，开发者通常会面临一些顾虑：**“需要额外安装未知环境”、“解包重打包损坏原生模块”、“误翻译了代码编辑器里的变量”、“官方更新后无法干净还原为原装文件”**。

本项目 (`antigravity-chinese-local`) 由此诞生，并确立了**安全无损、透明可审阅**的核心原则：

### 📊 与传统汉化方案的对比

| 核心维度 | 传统 / 早期汉化方案 | 本项目 (Antigravity Local ZH) |
| :--- | :--- | :--- |
| **还原能力** | 通常无法完全恢复，或重打包后哈希突变 | **逐字节精确还原 (Byte-identical)**，恢复后 SHA-256 与官方原包完全一致 |
| **ASAR 操作方式** | 全量解包目录后再重打包，易破坏原生依赖 | **非破坏性追加模式**：原数据区零修改，仅尾部追加并重算 4MB 完整性校验分块 |
| **代码与正文保护** | 粗粒度 DOM 替换，易误翻代码变量与提示词 | **严格的隔离过滤树**：Monaco 代码区、xterm 终端、会话 Markdown 与提示词绝对免触碰 |
| **运行依赖** | 往往需要用户配置复杂环境或联网下载外部脚本 | **零生产依赖**：纯 Node 原生模块；提供**内置 Node 的独立便携版**，解压双击直接用 |
| **词库覆盖深度** | 仅覆盖常规菜单与少量设置 | **650+ 精准词条**：深度覆盖 2.12.2 最新模型用量、外观拾色器、防休眠、托盘运行、反馈等 |
| **交互体验** | 闪烁的黑框命令行脚本 | **原生 Windows WPF 现代化窗口**（无控制台黑框、状态指示灯、防误关保护）+ CLI |
| **透明性与审计** | 部分工具打包了黑盒 exe/脚本 | **全部代码公开透明**，核心逻辑仅 180 行，便于随时逐行审查 |

---

## 🌟 核心特性

- 🛡️ **纯离线与高安全性**：不发起任何网络请求、不上传任何数据、不调用在线翻译 API；仅在本地进行纯文本精确匹配。
- 🔄 **原子级备份与逐字节还原**：写入前自动在隔离目录保存原包与指纹备份；一键恢复后完美恢复官方原装状态。
- 🎯 **深度代码隔离保护**：内置 DOM 保护机制，严格隔离 Monaco 代码编辑区、xterm 终端、Markdown 对话内容与提示词输入，绝不误伤代码、文件路径与用户对话正文。
- 📦 **开箱即用便携版**：无需电脑配置任何开发环境，下载便携版解压后直接双击使用。
- 📖 **精心打磨的精确词库**：收录 650+ 条常用界面文案，深度覆盖设置中心、模型与用量、自定义扩展、外观配色、辅助侧边栏及原生菜单。

---

## 🚀 快速上手

### 环境要求
- **操作系统**：Windows 10 / 11
- **适用版本**：Antigravity 桌面客户端（当前审核版本：**2.12.2**）

---

### 方案 A：独立便携版（推荐所有用户）

**电脑无需安装 Node.js，真正开箱即用：**

1. 前往 [Releases 页面](https://github.com/huashuimoyv/antigravity-chinese-local/releases/latest) 下载 **`antigravity-chinese-local-v0.2.0-standalone.zip`**；
2. 完全退出 Antigravity 客户端后，解压该压缩包；
3. 双击运行 **`启动汉化工具.vbs`**（原生窗口，无命令行黑框）；
4. 窗口识别客户端状态后，点击 **“安装汉化”**（旧版用户点击 **“更新汉化”**）；
5. 操作完成后启动 Antigravity 即可。

*(如需恢复官方英文，退出客户端后点击“恢复英文”即可秒级还原)*

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

## 🎨 界面汉化覆盖一览

词库维护在 [`dict/zh-CN.json`](dict/zh-CN.json)，采用**纯文本精确匹配**，杜绝模糊误翻：

| 交互模块 | 覆盖功能与区域 |
| :--- | :--- |
| **应用与常规偏好** | 防止休眠、在系统托盘/菜单栏后台运行、远程控制、系统通知设置等 |
| **模型与用量指标** | 方案说明 (Google AI Pro/Ultra)、AI 额度超额开关、每周与 5 小时用量指标、Claude / GPT 限额等 |
| **自定义规则与技能** | Skills、Rules、MCP 服务器、令牌用量分析、作用域徽标 (`Global`/`Workspace`) 等 |
| **外观与调色盘** | 视觉主题预设、详细思考过程开关、对话栏宽度调节、前景色/背景色/强调色拾色器 |
| **辅助侧栏面板** | 子智能体 (Subagents)、后台任务、产出物工件 (Artifacts)、已修改文件、终端列表及运行状态 |
| **审批与执行卡片** | 提议更改 (Proposed Changes)、实施计划 (Plan)、演练说明、沙盒执行、接受/放弃卡片 |
| **问题反馈与引导** | 反馈类型选择、重现步骤指导列表、文本框占位提示语及浏览器设置迁移引导 |
| **原生系统菜单** | 文件、编辑、视图、窗口、关于、偏好设置等一级与二级原生桌面菜单项 |

---

## 🛡️ 安全与容灾设计

1. **SHA-256 指纹白名单拦截**：安装前严格校验 `preload.js` 与 `menu.js` 散列值，未知版本或已损坏的客户端一律拒绝写入，杜绝破坏官方程序。
2. **原子化临时写入与安全替换**：先在同目录写临时文件校验完整性，二次确认客户端未运行且原包未变后原子覆盖（Rename），从不直接删除正在运行的原包。
3. **备份隔离与校验机制**：备份隔离保存在 `resources/.antigravity-local-zh/` 中，还原时严格校验哈希，确保逐字节无差错还原。
4. **防并发进程锁**：写入关键期自动加锁 `operation.lock`，防止多操作冲突。

---

## 💻 开发者与单元测试

项目内置完整的自动化测试套件（使用 Node.js 原生 Test Runner）：

```powershell
# 运行全部 21+ 项测试（涵盖 ASAR 规范互认、容灾恢复、DOM 保护隔离及词库规范）
node --test
```

---

## 🤝 贡献词条

如果您在使用过程中发现了尚未汉化的界面或按钮：
1. 打开 [`dict/zh-CN.json`](dict/zh-CN.json)，在末尾按相同格式加入新的键值对；
2. 运行 `node --test` 确保格式与测试通过；
3. 执行 `node cli.js install` 即可立即更新生效；
4. 欢迎向本仓库提交 Pull Request，一起完善开发体验！

---

## 📜 致谢与免责声明

- 本项目设计思路受社区早期探索 [yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese) 启发，并重新编写了原生轻量运行时、零依赖 ASAR 尾部追加器、WPF 启动界面与精校词库。
- 本项目为个人维护的辅助工具，与 Google、Electron 官方无任何隶属关系。
- 仓库代码遵守 [MIT License](LICENSE) 开源协议。
