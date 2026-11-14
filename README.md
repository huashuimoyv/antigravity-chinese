# Antigravity 本地汉化与增强套件 (Windows 专属)

**专为 Google Antigravity (2.12.2 ~ 2.32.1+) 打造的高安全、纯离线、逐字节可还原的 Windows 本地汉化与功能增强工具。**

<div align="center">

[![Release](https://img.shields.io/github/v/release/huashuimoyv/antigravity-chinese?label=Release&color=blue&logo=github)](https://github.com/huashuimoyv/antigravity-chinese/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%20Only-red?logo=windows)](https://www.microsoft.com/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12-339933?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-34%20Passed-brightgreen)](test/)

</div>

---

> [!IMPORTANT]
> **平台兼容性特别说明（仅支持 Windows，不兼容 macOS / Linux）**  
> 本工具专为 **Windows 10 / 11** 平台深度定制，内部依赖 Windows 原生启动架构、WPF 桌面工具与 Win32 图标/窗口底层接口，仅适配 Windows 版 Antigravity 目录与架构。**目前完全不支持 macOS 与 Linux 系统**，请勿在 macOS 环境下运行。

---

## 核心特性

- **界面全量精校汉化**：全面覆盖设置面板、原生菜单、模型选择、语音模式与桌面麦克风权限、内置浏览器与自动化权限、计划审阅策略，以及 2.31.x 双界面布局与 2.32.x 原生 SSH 远程开发工作流；Monaco 代码区、xterm 终端与会话正文严格隔离保护，绝不误翻代码。
- **侧边栏小标题中文守护**：自动拦截后台英文大写单词标题，根据首轮提问提炼凝练的中文标题并写入本地数据库，保持会话列表整洁地道。
- **顶栏用量与上下文实时监控**：直观展示当前对话的 Token 占用比例、三段式彩色图形进度条、Prompt 缓存命中率及多模型额度状态。
- **本地网络代理与窗口记忆**：支持一键注入本地网络代理（默认 127.0.0.1:7890）；自动记忆窗口尺寸与最大化状态，避免重启后打回原形。
- **专属透明图标与任务栏联动**：内置标准 Windows 多尺寸透明猫耳图标，主进程自动注入窗口与任务栏，彻底消除任务栏白底方块。
- **非破坏性追加与逐字节还原**：采用独创原生 ASAR 尾部追加算法，原文件数据零破坏；点击恢复后，`app.asar` 的 SHA-256 哈希值与 Google 官方原包 100% 逐字节完全一致。

---

## 快速上手

### 环境要求
- **操作系统**：Windows 10 / Windows 11（**不支持 macOS**）
- **客户端**：Antigravity 桌面客户端（官方认证支持 2.12.2 ~ 2.32.1 及后续微版本）

---

### 方法一：便携桌面版（推荐）

1. 前往 [Releases 页面](https://github.com/huashuimoyv/antigravity-chinese/releases/latest) 下载最新版 `antigravity-chinese-v1.0.12-portable.zip`；
2. 解压到任意目录，双击运行 **`启动汉化工具.exe`**；
3. 点击界面的 **“一键启动 Antigravity”**（或 “更新补丁并启动”），工具会自动完成打补丁并拉起客户端。

*(如需恢复官方英文，退出客户端后在工具界面中点击“恢复官方英文”即可秒级还原)*

---

### 方法二：命令行 CLI（开发者使用）

在项目根目录下执行（需 Node.js 22.12+）：

```powershell
# 1. 检查客户端版本与补丁状态
node cli.js check

# 2. 退出客户端后安装补丁
node cli.js install

# 3. 恢复官方原始英文包
node cli.js restore
```

若客户端安装在自定义路径，可添加 `--path`：
```powershell
node cli.js install --path "D:\Apps\Antigravity"
```

---

## 自动化测试验证

项目内置 35 项自动化测试套件（其中 34 项离线单元测试全部通过，1 项本机实包验证在 CI/未指定实包路径时默认跳过；覆盖 ASAR 规范互认、自适应兼容、中文标题守卫、代理注入、图标注入、DOM 保护及容灾恢复）：

```powershell
npm test
```

---

## 开源协议

本项目遵守 [MIT License](LICENSE) 开源协议。仅供个人学习与交流使用，与 Google、Electron 官方无任何隶属关系。
