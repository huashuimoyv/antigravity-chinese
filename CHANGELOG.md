# 更新日志 (Changelog)

本文件记录 Antigravity Windows 本地中文汉化与增强套件各版本的核心变更；标签触发 GitHub Actions 发布流水线时会自动提取对应版本段落写入 Release 说明。

## v1.0.16

- **客户端认证扩展**：正式认证适配 Antigravity `2.34.0`（同步登记 `dist/preload.js` 与 `dist/menu.js` 最新 SHA-256 哈希白名单）。
- **2.34.0 新界面与句首大小写设置全覆盖**：新增 `84` 条词条（本版累计新增 `109` 条，精确词库扩充至 `1450` 条）及 `Select Sidebar Item N` 动态规则，涵盖 **Orchestrator 编排器模型配置**、**Thinking effort 思考深度说明**、**自定义侧边栏与筛选排序**（`Customize Sidebar` / `Filter and Sort`）、**内联权限审批与沙盒外警告卡片**，以及 2.34.0 句首小写版设置项（`Queued messages`、`Enter to send`、`Send message`、`Enable terminal sandbox`、`Tool permissions`、`Security preset` 等）。
- **模型菜单与新模型全量覆盖**：补全 `Model` / `Best of N Models` 菜单头部、`New` / `Notice` / `Unavailable` 徽章标签、`Orchestrator (Neon)` 与 `Gemini 4 Neon`、`GPT-OSS 120B / 20B`、Neon 分流提示（`that may offload routine steps to ...`）、`View Usage` 弹窗和配额重置复合文案，并加固 `Gemini 4 Neon` 额度池分组判断。
- **输入框与权限切换补齐**：新增聊天框引导占位文案（`Ask anything, @ to mention, / for actions` 等，严格避开可编辑正文区）与右下角权限预设按钮 `Turbo`（极速）译名，并补充完整回归测试。
- **2.34.0 顶栏上下文/额度与侧边栏标题唤醒修复**：适配 `2.34.0` 全新异步会话认证流，补全从共享 `localStorage`（`agy_session_csrf_token`）与 `csrfToken` Cookie 读取会话凭据的多级回退，支持 `data-sidebar-row-id` 活动会话识别与冷启动异步认证轮询重试，解决顶栏长期停留在 `上下文加载中…` 及侧边栏英文标题守护失灵问题。

## v1.0.15

- **客户端认证扩展**：解析并正式认证适配 Antigravity `2.33.0`（更新 `dist/preload.js` SHA-256 哈希白名单并校验 `dist/menu.js` 一致性）。
- **新模型全覆盖与额度池加固**：新增 **Gemini 4 Carbon**（低/中/高推理）、**Claude Opus 5.5 (Max)**、**Claude Sonnet 5.5 (Max)**、**Gemini 3.8 Flash**（低/中推理）与 **Gemini 3.1 Flash Lite** 译名；同步加固额度分组识别逻辑，确保 Carbon 与 Hydrogen 稳定归属 Gemini 模型 5 小时/周额度池、Claude Max 归属 Claude 额度池。
- **2.33.0 新特性汉化**：新增 `68` 条精确词条（词库扩充至 `1341` 条）与 `6` 组动态规则，覆盖内置浏览器 **浏览数据与按站点 Cookie 管理**、**VS Code / AGY 快捷键方案切换**、**精选插件包 (Bundles) 与审查弹窗**、**副问题插回主对话**、额度重置倒计时及语音听写提示，并补充对应回归单元测试。

## v1.0.14

- **客户端认证扩展**：官方认证支持 Antigravity `2.32.2`（复核 `dist/preload.js` 与 `dist/menu.js` SHA-256 哈希无漂移）。
- **2.32.2 界面词库与动态规则补全**：精确词库扩充至 `1273` 条（新增 194 条词条与 4 组动态匹配规则），覆盖设置项新版说明、快捷键管理、通知与提示音音量、模型用量与 AI 积分超额提示、图像生成模型标签、自定义插件、远程控制以及跨窗口浏览器横幅提示。
- **顶栏模型切换监听与 CI 测试加固**：为顶栏上下文监控补齐模型选择器与侧边栏选中的定向 DOM 监听，修复展开卡片点击外部区域后提前中止刷新的边界问题；将异步回归测试由固定短等待升级为状态轮询等待并修复陈旧按钮引用，消除慢速 CI Runner 下的偶发竞态失败。

## v1.0.13

- **斜杠命令与 `@` 提及菜单全量汉化**：内置精确词库扩充至 `1079` 条（新增 72 条词条与 5 组动态规则），保留 `/goal`、`/compact`、`/schedule`、`/browser`、`/plan`、`/grill-me`、`/teamwork`、`/learn`、`/boost`、`/btw` 原生命令触发标识并全面汉化说明文本。
- **内置与插件技能全覆盖**：补充全部 14 项内置技能及 Chrome DevTools、Gemini API、Gmail、Notion、`docx`/`pptx`/`xlsx` 技能描述，覆盖 `[data-mention-menu]` 与 `[data-testid="side-question-tab-empty"]` 外围控件、分栏标题、`@` 类目与悬停详情卡片，并继续严格保护工作区文件/文件夹名、路径及输入框正文不被误翻。
- **发布自动化与多端一致性升级**：
  - 统一 `package.json`、`src/patcher.js`、`cli.js`、`gui/window.xaml` 与 `启动汉化工具.exe`（动态写入 Win32 `AssemblyVersion`/`AssemblyFileVersion`）的版本及认证范围数据源，消除版本漂移。
  - 引入 `scripts/release.js` 与增强版 `pack.ps1`：支持打包前一致性校验、无 BOM UTF-8 `checksums-sha256.txt` 生成、打包后独立解包校验（ZIP CRC-32、必需清单、零 `node_modules`/`dist`/`.local`/`test` 泄漏、PE 头验证、独立目录运行 `cli.js --help`）。
  - 新增标签驱动的 GitHub Actions 自动发布流水线（`.github/workflows/release.yml`），自动运行测试、构建校验并幂等发布 Release 说明与便携压缩包资产。

## v1.0.12

- **客户端认证扩展**：认证适配 Antigravity `2.32.1`，扩充模型、设置面板与交互词库并补充回归测试。

## v1.0.11

- **额度监控修复**：修复 Gemini 4 Hydrogen 额度池误判为 Argon 专属周额度的问题并完善对应单元测试。
