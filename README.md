# Antigravity 本地中文补丁

一个自己维护、便于逐行审阅的 Windows 汉化工具。运行时只有 Node.js 内置模块，没有第三方运行依赖。采用“在 Electron preload 中追加本地词库和 DOM 翻译函数”的方式。

**首版是有限范围的界面汉化，不是完整中文语言包。** 仅接受 Antigravity **2.12.2** 且 `dist/preload.js` SHA-256 与已检查样本一致的客户端。未知版本、其他汉化工具修改过的入口都拒绝安装；版本号和哈希匹配不代表验证了整个安装包的官方来源。

## 使用

要求 Windows 10/11、Node.js 22.12 或更高版本、已安装 Antigravity 桌面客户端。此工具不适用于独立 Antigravity IDE。

下载或克隆本仓库，在仓库目录打开终端：

```powershell
node cli.js check
node cli.js install
```

安装前请保存工作并完全退出 Antigravity。安装完成后，手动启动客户端。也可双击 `install.cmd`，它只调用同目录的本地脚本。

**日常使用不需要执行 `npm install`。** 工具不会下载脚本、安装插件、配置后台守护、创建计划任务、结束客户端进程、上传文件或修改网络设置。安装后翻译不调用翻译服务；Antigravity 自身的联网行为不受影响。

查看状态或恢复：

```powershell
node cli.js status
node cli.js restore
```

也可双击 `restore.cmd`。自定义安装位置：

```powershell
node cli.js check --path "D:\Apps\Antigravity"
node cli.js install --path "D:\Apps\Antigravity"
node cli.js restore --path "D:\Apps\Antigravity\resources\app.asar"
```

`check` 是只读检查；进程运行、版本不匹配或备份损坏时返回非零退出码。`status` 返回状态，即使当前客户端正在运行也可使用。工具不会自动提权；目录不可写时会报告错误。

## 修改范围与备份

- 仅更新 `resources/app.asar` 内的 `dist/preload.js` 文件索引和内容；原有 preload 保留为前缀。
- 原 ASAR 数据区保持不变，新内容追加在末尾。其他文件的目录记录、偏移、内容和 `app.asar.unpacked` 外置文件均保留，不解包重打包原生模块。
- 重算修改文件的 SHA-256 完整性信息。不会禁用 Electron 完整性检查、修改可执行程序或签名。
- 写入前，在 `resources/.antigravity-local-zh/` 保存以原资源包 SHA-256 命名的备份和以补丁包 SHA-256 命名的记录。备份已有且内容不一致时拒绝覆盖。
- 先写同目录临时文件并校验，再检查进程及原文件是否变化，最后重命名替换；不会先删除正在使用的资源包。
- 恢复必须匹配当前补丁包指纹，并校验备份内容。恢复后保留备份，便于审计。官方更新覆盖后不会用旧备份自动降级，也不会自动重新注入。

断电、磁盘故障、杀毒软件拦截和最后一次进程检查之后的并发启动仍可能干扰操作；这些检查不等于操作系统级事务。请在安装与恢复期间保持客户端关闭。若操作异常退出留下 `operation.lock` 空目录，确认所有本工具进程均已退出后，手动删除该空目录再运行 `status`；不要删除 `.asar` 备份或 `.json` 记录。

## 翻译范围

词库位于 `dict/zh-CN.json`，只做完整文本精确匹配，不使用通配替换、正则词库或在线翻译。

文字节点仅在按钮、菜单项、选项卡、提示气泡、标签和选项内翻译。另处理未受保护元素上的 `title`、`aria-label`、`aria-description`、`placeholder`。输入值和应用数据属性保持原样。

跳过代码、终端、编辑区域、常见 Markdown/消息/会话容器及它们的任意深度后代。普通 `div`/`span` 的正文不翻译。运行范围限制在顶层 `https://127.0.0.1` 页面，与检查过的客户端窗口来源一致。

这些 DOM 规则无法保证识别所有未来布局：若用户自定义标题恰好与词条相同且位于未识别的按钮或提示属性中，仍可能显示为中文；它不会改写磁盘上的会话内容。初版不翻译原生系统菜单、普通段落和未知控件。未知英文原样保留。自行扩词后需先恢复再安装，补丁才会带上新词库。

## 开发验证

第三方包只用于开发测试：`@electron/asar` 作为独立格式读取器，`jsdom` 用于 DOM 测试。版本锁定在 `package-lock.json`；安装时禁用生命周期脚本。

```powershell
npm ci --ignore-scripts
npm test
```

验证真实安装包的**副本**（不会修改来源文件）：

```powershell
$env:AG_TEST_ASAR = "$env:LOCALAPPDATA\Programs\antigravity\resources\app.asar"
npm test
Remove-Item Env:\AG_TEST_ASAR
```

测试覆盖 ASAR 兼容性、保留外置文件记录、安装幂等性、精确恢复、损坏备份、缺失记录、未知入口、操作锁、写入失败、并发变化，以及动态 DOM 翻译与受保护区域。普通事务测试使用合成资源包并只在测试中模拟其允许指纹，不上传 Google 客户端代码。CI 没有客户端安装包，会明确跳过真实副本测试。

当前验证记录见 [VALIDATION.md](VALIDATION.md)。资源包副本测试通过不代表已完成真实桌面启动和视觉验收。

## 来源与维护

设计思路参考 [yiheng8023/antigravity-chinese](https://github.com/yiheng8023/antigravity-chinese) 的 preload/DOM 方案，检查时提交为 `6f21fe4ecd8a842858347d0b302859954f817413`。本项目重新编写实现和小型词库，没有运行、复制或打包该项目的安装器、运行时代码及整份词库。

ASAR 编码依据 [Electron ASAR 官方格式说明](https://github.com/electron/asar#format)。本项目与 Google、Electron 及参考项目没有官方隶属关系。补丁不承诺上游更新兼容性；适配新版本前，应检查其 preload、窗口来源与资源结构，并完成副本测试和桌面验收后更新允许指纹。

本仓库只包含工具源码、词库、文档及测试，不包含客户端资源包、备份、可执行程序或账号数据。
