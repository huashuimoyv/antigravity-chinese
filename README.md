# Antigravity 本地中文补丁

<div align="center">

**一个轻量、纯离线、支持逐字节精确还原的 Google Antigravity 桌面客户端 Windows 本地汉化工具。**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows)](https://www.microsoft.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Client](https://img.shields.io/badge/Supported%20Client-Antigravity%202.12.2-4285F4)](https://antigravity.google)
[![Tests](https://img.shields.io/badge/Tests-21%20Passed-brightgreen)](test/)

</div>

---

## 🌟 核心特性

- ⚡ **零第三方运行时依赖**：生产运行仅基于 Node.js 内置核心模块，无需执行 `npm install`，不安装额外守护服务或插件。
- 🛡️ **纯离线与高安全性**：不发起任何网络请求、不上传任何数据、不调用在线翻译 API；仅在本地进行纯文本精确匹配。
- 📦 **非破坏性 ASAR 补丁**：不解包重打包整个应用，原 ASAR 数据区保持不变，新入口追加于包末尾并重算 SHA-256 完整性分块，保留所有外置 unpacked 文件。
- 🔄 **原子级备份与逐字节还原**：写入前自动备份原始资源包及哈希指纹；恢复（Restore）时可逐字节还原为安装前原始状态，支持无损更新与审计。
- 🎯 **深度代码隔离保护**：内置 DOM 保护机制，严格隔离 Monaco 代码编辑区、xterm 终端、Markdown 对话内容与提示词输入，绝不误伤代码、文件路径与用户对话正文。
- 🪟 **双模极简操作**：提供无黑框的原生 Windows WPF 图形窗口与全功能命令行 CLI，支持一键安装、平滑更新与轻松还原。
- 📖 **精心打磨的精确词库**：收录 650+ 条常用界面文案，深度覆盖设置中心、模型与用量、自定义扩展、外观配色、辅助侧边栏及原生菜单。

---

## 🚀 快速上手

### 环境要求
- **操作系统**：Windows 10 / 11
- **运行环境**：[Node.js](https://nodejs.org/) 22.12.0 或更高版本
- **客户端**：已安装 Antigravity 桌面客户端（当前严格审核版本：**2.12.2**）

> [!NOTE]
> 本工具仅适用于 Antigravity 官方桌面客户端，不适用于独立 Antigravity IDE。

---

### 方式一：图形界面（推荐）

双击项目根目录下的 **`启动汉化工具.vbs`** 即可打开原生 Windows 窗口（无命令行黑框）：

1. **保存工作并完全退出 Antigravity**；
2. 窗口会自动探测客户端路径并检查状态，显示“准备就绪，可以汉化”；
3. 点击 **“安装汉化”**（若已有旧补丁则显示 **“更新汉化”**）；
4. 操作完成后，重新手动启动 Antigravity 即可。需要还原英文时，退出客户端点击 **“恢复英文”** 即可一键恢复。

*(若系统策略禁用了 VBScript，亦可双击 `gui.cmd` 启动)*

---

### 方式二：命令行 CLI

在仓库目录下打开终端（PowerShell 或 CMD）：

```powershell
# 1. 检查客户端状态与环境兼容性（只读）
node cli.js check

# 2. 退出 Antigravity 后，执行安装或更新
node cli.js install

# 3. 随时查看补丁及备份状态
node cli.js status

# 4. 退出客户端后，随时还原回官方英文原包
node cli.js restore
```

自定义安装路径（支持指定客户端安装根目录或 `app.asar` 文件）：
```powershell
node cli.js install --path "D:\Apps\Antigravity"
node cli.js restore --path "D:\Apps\Antigravity\resources\app.asar"
```

---

## 🎨 汉化覆盖范围

词库位于 [`dict/zh-CN.json`](dict/zh-CN.json)，坚持**完全匹配原则**，不使用任何正则模糊匹配，覆盖以下区域：

| 模块 | 覆盖内容说明 |
| :--- | :--- |
| **设置面板 (Settings)** | 常规、应用偏好、防止休眠、托盘运行、远程控制、系统通知设置等 |
| **模型与用量 (Models & Usage)** | 模型方案说明、AI 额度超额开关、每周与5小时用量指标、Claude / GPT 限额等 |
| **自定义扩展 (Customizations)** | 技能 (Skills)、规则 (Rules)、MCP 服务器、令牌用量明细、作用域徽标等 |
| **外观与配色 (Appearance)** | 视觉主题、详细智能体对话开关、对话栏宽度微调、预设浅色/深色及前景色/背景色调节 |
| **辅助侧栏 (Auxiliary Pane)** | 子智能体 (Subagents)、后台任务、产出物 (Artifacts)、已修改文件、终端列表及状态 |
| **审批与交互 (Canvas & Review)** | 提议更改 (Proposed Changes)、实施计划、演练说明、沙盒执行、重置/接受更改卡片 |
| **问题反馈 (Provide Feedback)** | 反馈类型（缺陷报告/功能建议/账单等）、指引列表与占位提示语 |
| **原生系统菜单 (Native Menu)** | 文件、编辑、视图、窗口及偏好设置等顶级与二级桌面菜单 |

---

## 🛡️ 安全与容灾机制

1. **严格的 SHA-256 指纹白名单**：
   安装前严格核对 `dist/preload.js` 与 `dist/menu.js` 的 SHA-256 散列值。遇到未知版本、已被篡改或其他工具修改的客户端一律拒绝写入，杜绝破坏官方客户端。
2. **原子化临时写入与安全替换**：
   修改时先在同目录下生成独占临时文件并全量哈希校验，二次确认客户端未运行且原文件未被篡改后，执行原子替换（Rename），绝不直接删除或覆盖正在使用的资源包。
3. **备份隔离与校验**：
   原始资源包和补丁指纹保存在 `resources/.antigravity-local-zh/` 下。恢复时必须通过 SHA-256 完整性核验方可还原，确保还原结果与官方原包逐字节一致。
4. **并发与异常锁保护**：
   关键写入期设置目录锁 `operation.lock`，防止多进程并发冲突；异常中断时原文件保持完整。

---

## 💻 本地开发与测试

开发与测试环境使用 Node.js 原生 Test Runner（测试依赖包含官方 `@electron/asar` 用于格式互认，以及 `jsdom` 用于 DOM 模拟测试）：

```powershell
# 运行全部自动化单元测试（涵盖 ASAR 解析、事务容灾、动态 DOM 隔离与词库校验）
node --test
```

若要在真实客户端资源包的**临时副本**上运行端到端验证测试：
```powershell
$env:AG_TEST_ASAR = "$env:LOCALAPPDATA\Programs\antigravity\resources\app.asar"
node --test
Remove-Item Env:\AG_TEST_ASAR
```

详细测试与环境验证记录请参阅 [VALIDATION.md](VALIDATION.md)。

---

## 🤝 扩充词库与参与贡献

如果您在使用过程中发现了尚未汉化的界面文案：
1. 编辑 [`dict/zh-CN.json`](dict/zh-CN.json)，在末尾添加对应的英文原文与中文翻译（遵循严格去除首尾空格、纯文本精确对应的原则）；
2. 运行 `node --test` 确认词库唯一性与格式测试通过；
3. 执行 `node cli.js install` 或在图形界面中点击“更新汉化”，新词库即可立即生效；
4. 欢迎提交 Pull Request 分享您的词条补充！

---

## 📜 来源与免责声明

- 本项目设计思路受 [yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese) 启发，由本项目独立编写原生运行时、零依赖 ASAR 处理器、WPF 图形界面与扩充词库，未打包或复制该项目的二进制文件或整份运行时。
- ASAR 编码实现严格依据 [Electron 官方 ASAR 规范](https://github.com/electron/asar#format)。
- 本项目为个人维护的开源辅助工具，与 Google、Electron 官方无任何商业或从属关系。
- 本仓库仅包含工具源码、文档、词库与测试，不分发任何受版权保护的 Antigravity 二进制程序或资源文件。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
