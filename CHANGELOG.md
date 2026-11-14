# 更新日志 (Changelog)

本文件记录 Antigravity Windows 本地中文汉化与增强套件各版本的核心变更；标签触发 GitHub Actions 发布流水线时会自动提取对应版本段落写入 Release 说明。

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
