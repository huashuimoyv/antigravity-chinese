'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const runtime = require('../src/runtime');
const dictionary = require('../dict/zh-CN.json');
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
// Reproduces the text/layout classes of the supplied screenshot, not a captured DOM.
const labels = ['General','Execution','Queued Messages','Queue','Send Immediately','Keyboard shortcuts',
  'Agent Settings','Security Preset','Default','Tool Permissions','Open','Agent Behavior','Artifact Review Policy',
  'Always Proceed','Network Permissions','Network Access Rules'];
const descriptions = ['Configure agent execution, queued message delivery, and permissions.',
  'Configure when follow-up messages are sent.', 'Controls the actions the agent can take.',
  'Modify permissions for file, terminal, and MCP tools.', 'Whether the agent asks you to review its documents.',
  'Configure allowed and denied URLs for reading.'];
const settings = `<section id="settings"><aside>${['Settings','General','Application','Appearance','Models','Customizations','Browser','Projects','Not in Project','Conversation','Shortcuts','Provide Feedback'].map(x => `<div>${x}</div>`).join('')}<div data-project-id="p">General</div></aside>
  <main>${[...labels, ...descriptions].map(x => `<div data-ui-label>${x}</div>`).join('')}<div>Learn more about <b>Default</b></div>
  <div class="prose">Security Preset</div><input value="Default"><pre>Queued Messages</pre></main></section>`;

test('screenshot settings headings, descriptions and split text translate in a div-only panel', async t => {
  const dom = new JSDOM(`<div>Settings</div><div>New Conversation</div>${settings}`, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary); await pause();
  const doc = dom.window.document;
  const nodes = [...doc.querySelectorAll('[data-ui-label]')];
  assert.deepEqual(nodes.map(x => x.textContent), [...labels,...descriptions].map(x => dictionary[x]));
  assert.equal(doc.querySelector('aside').firstChild.textContent, '设置');
  assert.equal(doc.querySelector('b').parentElement.textContent, '了解更多： 默认');
  assert.equal(doc.querySelector('[data-project-id]').textContent, 'General');
  assert.equal(doc.querySelector('.prose').textContent, 'Security Preset');
  assert.equal(doc.querySelector('input').value, 'Default');
  assert.equal(doc.querySelector('pre').textContent, 'Queued Messages');
  assert.equal(doc.body.firstChild.textContent, 'Settings');
  assert.equal(doc.body.children[1].textContent, '新建对话');
});

test('dynamically mounted settings and subsequent tabs remain covered', async t => {
  const dom = new JSDOM('<div id="mount"></div>', { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary); await pause();
  const doc = dom.window.document;
  doc.querySelector('#mount').innerHTML = settings;
  await pause();
  assert.equal(doc.querySelector('[data-ui-label]').textContent, '常规');
  doc.querySelector('main').innerHTML = '<div>Application Settings</div><div>Start on Login</div><div>Default Browser</div>';
  await pause();
  assert.equal(doc.querySelector('main').textContent, '应用设置登录时启动默认浏览器');
});

test('settings reopened directly on another tab is recognized by its navigation', async t => {
  const html = settings.replace(/<main>[\s\S]*<\/main>/, '<main><div>Application Settings</div><div>Start on Login</div></main>');
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary); await pause();
  assert.equal(dom.window.document.querySelector('main').textContent, '应用设置登录时启动');
});

test('translates global permissions section and popup dropdown options', async t => {
  const dom = new JSDOM(`<div>Settings</div><div>New Conversation</div>
    <div role="dialog"><main>
      <div data-ui-label>Global Permissions</div>
      <div data-ui-label>Security Preset</div>
      <button>Turbo Mode</button>
    </main></div>
    <div role="listbox">
      <div role="option">
        <div>Default</div>
        <div>Requires manual review for all terminal commands and file accesses outside of the working folders.</div>
      </div>
      <div role="option">
        <div>Full machine</div>
        <div>All terminal commands require review. The agent can read or write to any file in the machine.</div>
      </div>
      <div role="option">
        <div>Turbo mode</div>
        <div>Disables all safety barriers for maximal iteration velocity.</div>
      </div>
      <div role="option">
        <div>Custom</div>
        <div>Manually customize individual settings.</div>
      </div>
    </div>`, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary); await pause();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-ui-label]').textContent, '全局权限');
  assert.equal(doc.querySelector('button').textContent, '极速模式');
  const options = doc.querySelectorAll('[role="option"]');
  assert.equal(options[0].children[0].textContent, '默认');
  assert.equal(options[0].children[1].textContent, '所有终端命令以及工作区文件夹之外的文件访问都需要手动审核。');
  assert.equal(options[1].children[0].textContent, '全机访问');
  assert.equal(options[1].children[1].textContent, '所有终端命令都需要审核。智能体可以读取或写入本机的任意文件。');
  assert.equal(options[2].children[0].textContent, '极速模式');
  assert.equal(options[2].children[1].textContent, '禁用所有安全屏障，以实现最高迭代速度。');
  assert.equal(options[3].children[0].textContent, '自定义');
  assert.equal(options[3].children[1].textContent, '手动自定义各个单独设置。');
});

test('translates newly added built-in browser and plan review policy settings in modern modal layout', async t => {
  const html = `
    <div>Settings</div>
    <div class="settings-modal-container">
      <aside>
        <button data-testid="settings-nav-item-General"><span>General</span></button>
        <button data-testid="settings-nav-item-App"><span>Application</span></button>
        <button data-testid="settings-nav-item-Appearance"><span>Appearance</span></button>
        <button data-testid="settings-nav-item-Shortcuts"><span>Shortcuts</span></button>
        <button data-testid="settings-nav-item-Notifications"><span>Notifications</span></button>
        <button data-testid="settings-nav-item-Models"><span>Models</span></button>
      </aside>
      <main>
        <h3>Agent Behavior</h3>
        <div data-testid="plan-review-policy-row">
          <span>Plan Review Policy</span>
          <div data-testid="plan-command-fyi-alert">
            <span>Type <code>/</code> and select <code>plan</code> to have the agent generate a plan.</span>
          </div>
        </div>
        <div id="defaultLinkOpenTarget">
          <h3>Built-in Browser</h3>
          <div>Configure link opening and built-in browser preferences.</div>
          <div>Open Links In</div>
          <span>Choose where links open by default when clicked.</span>
          <button>External Browser</button>
          <button>Built-in Browser</button>
        </div>
        <div id="builtinBrowserDownloadDir">
          <div>Download Location</div>
          <span>Folder where files downloaded in the built-in browser are saved.</span>
          <button>Change…</button>
        </div>
        <div>
          <div>Browsing History</div>
          <span>Clear visited URLs and autocomplete suggestions from the built-in browser.</span>
          <button>Clear</button>
        </div>
      </main>
    </div>
    <nav>
      <a>Give Feedback</a>
    </nav>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="plan-review-policy-row"] > span').textContent, '计划审阅策略');
  assert.equal(doc.querySelector('[data-testid="plan-command-fyi-alert"] span').textContent, '输入 / 并选择 plan 以让智能体生成计划。');
  assert.equal(doc.querySelector('#defaultLinkOpenTarget h3').textContent, '内置浏览器');
  assert.equal(doc.querySelector('#defaultLinkOpenTarget > div:nth-of-type(1)').textContent, '配置链接打开方式与内置浏览器偏好设置。');
  assert.equal(doc.querySelector('#defaultLinkOpenTarget > div:nth-of-type(2)').textContent, '链接打开位置');
  assert.equal(doc.querySelector('#defaultLinkOpenTarget > span').textContent, '选择点击链接时的默认打开位置。');
  assert.equal(doc.querySelector('#defaultLinkOpenTarget button:first-of-type').textContent, '外部浏览器');
  assert.equal(doc.querySelector('#builtinBrowserDownloadDir div').textContent, '下载位置');
  assert.equal(doc.querySelector('#builtinBrowserDownloadDir span').textContent, '内置浏览器中下载文件的保存目录。');
  assert.equal(doc.querySelector('#builtinBrowserDownloadDir button').textContent, '更改…');
  assert.equal(doc.querySelector('nav a').textContent, '提供反馈');
});

test('translates voice mode settings, token usage breakdowns, outside project header and pinned conversations', async t => {
  const html = `
    <div class="agy-dialog">
      <div id="voice">
        <h3>Voice mode</h3>
        <div>
          <span>Voice</span>
          <span>The voice used in Voice mode. Powered by Gemini Live.</span>
          <button>Change</button>
        </div>
        <div>
          <span>Microphone</span>
          <span>Input device for voice mode and dictation.</span>
          <span>System default</span>
        </div>
        <div>
          <span>Volume</span>
          <span>How loud Antigravity's voice is.</span>
        </div>
      </div>
      <div id="customizations-breakdown">
        <h3>Conversations</h3>
        <p>Settings for conversations outside of projects.</p>
        <p>The breakdown below shows token usage from customizations like rules, skills, and MCP. If a budget is exceeded, large rules are demoted to path pointers and large customizations are excluded automatically.</p>
        <div>
          <span>Other Customizations</span>
          <span>Mcp Tools</span>
          <button>Show 3 breakdowns</button>
          <button>Show 71 breakdowns</button>
          <button>Hide breakdown</button>
        </div>
      </div>
    </div>
    <div data-testid="section-header">
      <h2><button><span>Pinned Conversations</span></button></h2>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  assert.equal(doc.querySelector('#voice h3').textContent, '语音模式');
  assert.equal(doc.querySelector('#voice div:nth-of-type(1) span:first-of-type').textContent, '音色');
  assert.equal(doc.querySelector('#voice div:nth-of-type(1) span:nth-of-type(2)').textContent, '语音模式中使用的音色。由 Gemini Live 提供技术支持。');
  assert.equal(doc.querySelector('#voice div:nth-of-type(1) button').textContent, '更改');
  assert.equal(doc.querySelector('#voice div:nth-of-type(2) span:first-of-type').textContent, '麦克风');
  assert.equal(doc.querySelector('#voice div:nth-of-type(2) span:nth-of-type(2)').textContent, '语音模式和语音听写所使用的输入设备。');
  assert.equal(doc.querySelector('#voice div:nth-of-type(2) span:nth-of-type(3)').textContent, '系统默认');
  assert.equal(doc.querySelector('#voice div:nth-of-type(3) span:first-of-type').textContent, '音量');
  assert.equal(doc.querySelector('#voice div:nth-of-type(3) span:nth-of-type(2)').textContent, 'Antigravity 朗读与播放声音的大小。');

  assert.equal(doc.querySelector('#customizations-breakdown p:first-of-type').textContent, '项目外部会话的设置。');
  assert.equal(doc.querySelector('#customizations-breakdown p:nth-of-type(2)').textContent, '下方的用量明细展示了来自规则、技能和 MCP 等自定义项的 Token 占用情况。如果超出预算配额，大型规则将降级为路径指针，大型自定义项将自动被排除。');
  assert.equal(doc.querySelector('#customizations-breakdown div span:first-of-type').textContent, '其他自定义项');
  assert.equal(doc.querySelector('#customizations-breakdown div span:nth-of-type(2)').textContent, 'MCP 工具');
  assert.equal(doc.querySelector('#customizations-breakdown div button:nth-of-type(1)').textContent, '查看 3 项明细');
  assert.equal(doc.querySelector('#customizations-breakdown div button:nth-of-type(2)').textContent, '查看 71 项明细');
  assert.equal(doc.querySelector('#customizations-breakdown div button:nth-of-type(3)').textContent, '收起明细');

  assert.equal(doc.querySelector('[data-testid="section-header"] span').textContent, '置顶对话');
});

test('translates Antigravity 2.31.0 coordinator agents, side questions, browser actions and interface layout', async t => {
  const html = `
    <div id="v231-test" role="dialog">
      <div id="coordinators">
        <h2>Coordinators</h2>
        <button>New Coordinator</button>
        <p>Build with one agent or a team</p>
        <p>Describe what you want. Your agent plans and builds it, and brings in other agents when needed.</p>
        <p>Review plans and walkthroughs</p>
        <p>Comment on the plan before your agent starts, and get a walkthrough when it finishes.</p>
      </div>
      <div id="side-questions">
        <span id="sq-count">3 Side Questions</span>
        <button id="view-sq">View 3 side questions</button>
        <button id="view-help-sq">View 2 help items and 3 side questions</button>
        <button id="del-sq">Delete Side Question</button>
      </div>
      <div id="browser-actions">
        <button title="Mention Page">Mention Page</button>
        <button title="Capture Screenshot">Capture Screenshot</button>
        <button title="Capture Console Logs">Capture Console Logs</button>
      </div>
      <div id="interface-layout">
        <h3>Interface Layout</h3>
        <div>
          <h4>Knowledge Work</h4>
          <p>Simplified interface for research, writing, and everyday tasks.</p>
        </div>
        <div>
          <h4>Software Engineering</h4>
          <p>Full interface for coding, developer tools, and managing agents.</p>
        </div>
      </div>
      <div id="permissions-inline">
        <span>Configure what the agent can do in local and remote conversations.</span>
        <span>Controls permissions for remote conversations.</span>
      </div>
      <div id="plan-inline">
        <span>Type</span> <code>/</code> <span>and select</span> <code>plan</code> <span>to have the agent generate a plan.</span>
      </div>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  assert.equal(doc.querySelector('#coordinators h2').textContent, '协调员智能体');
  assert.equal(doc.querySelector('#coordinators button').textContent, '新建协调员');
  assert.equal(doc.querySelector('#coordinators p:nth-of-type(1)').textContent, '单智能体或团队协同构建');
  assert.equal(doc.querySelector('#coordinators p:nth-of-type(2)').textContent, '描述你的需求。你的主智能体将规划并构建它，并在需要时引入其他智能体协同工作。');
  assert.equal(doc.querySelector('#coordinators p:nth-of-type(3)').textContent, '审阅计划与演练讲解');
  assert.equal(doc.querySelector('#coordinators p:nth-of-type(4)').textContent, '在智能体开始执行前对计划发表批注，并在完成后获得全流程演练讲解。');

  assert.equal(doc.querySelector('#sq-count').textContent, '3 个副问题');
  assert.equal(doc.querySelector('#view-sq').textContent, '查看 3 个副问题');
  assert.equal(doc.querySelector('#view-help-sq').textContent, '查看 2 项求助与 3 个副问题');
  assert.equal(doc.querySelector('#del-sq').textContent, '删除副问题');

  assert.equal(doc.querySelector('#browser-actions button:nth-of-type(1)').getAttribute('title'), '在对话中提及网页');
  assert.equal(doc.querySelector('#browser-actions button:nth-of-type(2)').getAttribute('title'), '捕获网页截图');
  assert.equal(doc.querySelector('#browser-actions button:nth-of-type(3)').getAttribute('title'), '捕获控制台日志');

  assert.equal(doc.querySelector('#interface-layout h3').textContent, '界面布局');
  assert.equal(doc.querySelector('#interface-layout div:nth-of-type(1) h4').textContent, '知识工作');
  assert.equal(doc.querySelector('#interface-layout div:nth-of-type(1) p').textContent, '专为研究、写作和日常任务打造的极简界面。');
  assert.equal(doc.querySelector('#interface-layout div:nth-of-type(2) h4').textContent, '软件工程');
  assert.equal(doc.querySelector('#interface-layout div:nth-of-type(2) p').textContent, '面向编程、开发者工具和智能体管理的完整专业界面。');

  assert.equal(doc.querySelector('#permissions-inline span:nth-of-type(1)').textContent, '配置智能体在本地与远程对话中可以执行的操作。');
  assert.equal(doc.querySelector('#permissions-inline span:nth-of-type(2)').textContent, '控制远程会话的执行权限。');

  assert.equal(doc.querySelector('#plan-inline span:nth-of-type(1)').textContent, '输入');
  assert.equal(doc.querySelector('#plan-inline span:nth-of-type(2)').textContent, '并选择');
  assert.equal(doc.querySelector('#plan-inline span:nth-of-type(3)').textContent, '以让智能体生成计划。');
});

test('translates Antigravity 2.32.1 SSH Remote, Desktop Mic, Browser Actuation and new command labels', async t => {
  const html = `
    <div id="commands">
      <button>Download Diagnostics</button>
      <button>Toggle Between Light/Dark Themes</button>
      <button>Connect to SSH Host…</button>
      <button>Stop SSH Server…</button>
      <button>Switch to This Computer</button>
      <button>Previous Side Panel Tab</button>
      <button>Next Side Panel Tab</button>
      <div data-testid="ssh-machine-switcher-status">Connected to dev-box</div>
    </div>
    <div id="ssh-dialog" role="dialog" data-testid="ssh-connect-dialog">
      <h2>Connect to SSH Host</h2>
      <p id="ssh-desc">Enter [user@]host[:port], or pick a host from your SSH config.<span> Then create the project in its window.</span></p>
      <input data-testid="ssh-connect-host-input" aria-label="SSH host" placeholder="user@host:port" />
      <button id="ssh-connect-btn">Connecting…</button>
      <div id="ssh-progress">Connecting to dev-box…</div>
      <div id="ssh-config-row">
        <span>SSH config: </span>
        <span id="ssh-default-cfg">~/.ssh/config (default)</span>
        <button>Choose File…</button>
        <button>Use Default</button>
      </div>
      <div id="ssh-cfg-group">SSH Config (work_config)</div>
      <button id="ssh-hidden-toggle">3 hidden hosts</button>
      <button id="ssh-forget-btn" aria-label="Remove dev-box from Recent">Remove</button>
      <button id="ssh-hide-btn" aria-label="Hide dev-box from this list">Hide</button>
      <div id="ssh-notice">This window's agents, files, and terminals are on dev-box.</div>
      <div id="ssh-err"><span>Couldn't connect to </span><span>dev-box</span></div>
    </div>
    <div id="mic-and-settings" role="dialog">
      <p id="mic-denied-host">Microphone access for dev-box was denied. Quit and reopen the app to be asked again.</p>
      <p id="mic-off-win">Microphone off in Settings &gt; Privacy &amp; security &gt; Microphone.</p>
      <p id="settings-err">Failed to parse settings. Fix and restart.</p>
      <button id="copy-err" title="Copy error messages">Copy</button>
      <h3>Browser Actuation Permissions</h3>
      <div>Execute URLs</div>
      <div>Allow/deny agent browser actuation access to specific URLs.</div>
      <div>Download files</div>
      <div>Allow/deny agent browser file downloads from specific sites.</div>
      <pre class="monaco-editor"><code>Connect to SSH Host</code></pre>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  const cmds = doc.querySelectorAll('#commands > button');
  assert.equal(cmds[0].textContent, '下载诊断信息');
  assert.equal(cmds[1].textContent, '切换浅色/深色主题');
  assert.equal(cmds[2].textContent, '连接到 SSH 主机…');
  assert.equal(cmds[3].textContent, '停止 SSH 服务器…');
  assert.equal(cmds[4].textContent, '切换到本机电脑');
  assert.equal(cmds[5].textContent, '上一个侧边栏标签页');
  assert.equal(cmds[6].textContent, '下一个侧边栏标签页');
  assert.equal(doc.querySelector('[data-testid="ssh-machine-switcher-status"]').textContent, '已连接到 dev-box');

  assert.equal(doc.querySelector('#ssh-dialog h2').textContent, '连接到 SSH 主机');
  assert.equal(doc.querySelector('#ssh-connect-btn').textContent, '连接中…');
  assert.equal(doc.querySelector('[data-testid="ssh-connect-host-input"]').getAttribute('aria-label'), 'SSH 主机');
  assert.equal(doc.querySelector('#ssh-progress').textContent, '正在连接到 dev-box…');
  assert.equal(doc.querySelector('#ssh-config-row span:nth-of-type(1)').textContent, 'SSH 配置： ');
  assert.equal(doc.querySelector('#ssh-default-cfg').textContent, '~/.ssh/config（默认）');
  assert.equal(doc.querySelector('#ssh-config-row button:nth-of-type(1)').textContent, '选择文件…');
  assert.equal(doc.querySelector('#ssh-config-row button:nth-of-type(2)').textContent, '使用默认');
  assert.equal(doc.querySelector('#ssh-cfg-group').textContent, 'SSH 配置 (work_config)');
  assert.equal(doc.querySelector('#ssh-hidden-toggle').textContent, '3 个已隐藏主机');
  assert.equal(doc.querySelector('#ssh-forget-btn').getAttribute('aria-label'), '从最近记录中移除 dev-box');
  assert.equal(doc.querySelector('#ssh-hide-btn').getAttribute('aria-label'), '从此列表中隐藏 dev-box');
  assert.equal(doc.querySelector('#ssh-notice').textContent, '此窗口的智能体、文件和终端均位于 dev-box。');
  assert.equal(doc.querySelector('#ssh-err span:first-child').textContent, '无法连接到 ');

  assert.equal(doc.querySelector('#mic-denied-host').textContent, '对 dev-box 的麦克风访问已被拒绝。请退出并重新打开应用以重新请求授权。');
  assert.equal(doc.querySelector('#mic-off-win').textContent, '麦克风已在 Windows 设置 > 隐私和安全性 > 麦克风中关闭。');
  assert.equal(doc.querySelector('#settings-err').textContent, '设置解析失败，请修复后重启。');
  assert.equal(doc.querySelector('#copy-err').getAttribute('title'), '复制错误信息');
  assert.equal(doc.querySelector('#mic-and-settings h3').textContent, '浏览器自动化权限');
  assert.equal(doc.querySelector('.monaco-editor code').textContent, 'Connect to SSH Host');
});

test('translates slash command menu, mention menu chrome, hover cards, and protects filenames/paths', async t => {
  const html = `
    <div id="composer" contenteditable="true" role="textbox">Compact the conversation now (summarize history to free up the context window).</div>
    <div data-testid="side-question-tab-empty">
      <span>Ask a side question without interrupting the main conversation</span>
    </div>
    <div id="slash-menu" role="listbox" aria-label="Mentions" data-mention-menu="">
      <div>
        <div id="typeahead-item-0" role="option" aria-selected="true">
          <div>
            <span data-testid="menu-option-label"><span>compact</span></span>
            <span data-testid="menu-option-description" dir="auto"><span>Compact the conversation now (summarize history to free up the context window).</span></span>
          </div>
        </div>
        <div id="typeahead-item-1" role="option" aria-selected="false">
          <div>
            <span data-testid="menu-option-label"><span>btw</span></span>
            <span data-testid="menu-option-description" dir="auto"><span>Ask a quick question without interrupting the main conversation.</span></span>
          </div>
        </div>
        <div id="typeahead-item-2" role="option" aria-selected="false">
          <div data-testid="menu-section-header">Recently opened</div>
          <div>
            <span data-testid="menu-option-label"><span>README.md</span></span>
            <span data-testid="menu-option-description" dir="rtl"><span>src/Settings</span></span>
          </div>
        </div>
        <div id="typeahead-item-3" role="option" aria-selected="false">
          <div data-testid="menu-section-header">Browse</div>
          <div data-testid="menu-category-row">
            <span data-testid="menu-option-label"><span>Directories</span></span>
            <span data-testid="menu-option-description" dir="auto"><span>Search workspace folders</span></span>
          </div>
        </div>
        <div id="typeahead-item-4" role="option" aria-selected="false">
          <div>
            <span data-testid="menu-option-label"><span>Searching as user@example.com</span></span>
            <span data-testid="menu-option-description" dir="auto"><span>@drive is currently unavailable</span></span>
            <span data-testid="menu-option-trailing-label">from CLI</span>
          </div>
        </div>
        <div id="empty-row"><span>No matching results</span></div>
      </div>
      <div role="status" aria-label="Searching" data-testid="mention-menu-searching-row">
        <span>Searching…</span>
      </div>
      <div data-testid="mention-menu-footer">
        <kbd>esc</kbd><span>to exit</span>
      </div>
    </div>
    <div data-hover-card-popup="">
      <div data-mention-menu="">
        <div data-testid="hover-card-title"><span>chrome-devtools</span></div>
        <div data-testid="hover-card-subtitle">Chrome DevTools</div>
        <div data-testid="hover-card-description">Uses Chrome DevTools via MCP for efficient debugging, troubleshooting and browser automation. Use when debugging web pages, automating browser interactions, analyzing performance, or inspecting network requests. This skill does not apply to \`--slim\` mode (MCP configuration).</div>
      </div>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  assert.equal(doc.querySelector('#composer').textContent, 'Compact the conversation now (summarize history to free up the context window).');
  assert.equal(doc.querySelector('[data-testid="side-question-tab-empty"] span').textContent, '在不打断主对话的情况下提出副问题');

  const menu = doc.querySelector('#slash-menu');
  assert.equal(menu.getAttribute('aria-label'), '提及菜单');
  assert.equal(doc.querySelector('#typeahead-item-0 [data-testid="menu-option-label"]').textContent, 'compact');
  assert.equal(doc.querySelector('#typeahead-item-0 [data-testid="menu-option-description"]').textContent, '立即压缩当前对话（总结历史记录以释放上下文窗口）。');
  assert.equal(doc.querySelector('#typeahead-item-1 [data-testid="menu-option-description"]').textContent, '在不打断主对话的情况下快速提问。');

  assert.equal(doc.querySelector('#typeahead-item-2 [data-testid="menu-section-header"]').textContent, '最近打开');
  assert.equal(doc.querySelector('#typeahead-item-2 [data-testid="menu-option-label"]').textContent, 'README.md');
  assert.equal(doc.querySelector('#typeahead-item-2 [data-testid="menu-option-description"]').textContent, 'src/Settings');

  assert.equal(doc.querySelector('#typeahead-item-3 [data-testid="menu-section-header"]').textContent, '浏览');
  assert.equal(doc.querySelector('#typeahead-item-3 [data-testid="menu-option-label"]').textContent, '目录');
  assert.equal(doc.querySelector('#typeahead-item-3 [data-testid="menu-option-description"]').textContent, '搜索工作区文件夹');

  assert.equal(doc.querySelector('#typeahead-item-4 [data-testid="menu-option-label"]').textContent, '正在以 user@example.com 身份搜索');
  assert.equal(doc.querySelector('#typeahead-item-4 [data-testid="menu-option-description"]').textContent, '@drive 当前不可用');
  assert.equal(doc.querySelector('#typeahead-item-4 [data-testid="menu-option-trailing-label"]').textContent, '来自 CLI');

  assert.equal(doc.querySelector('#empty-row span').textContent, '无匹配结果');
  const searchingRow = doc.querySelector('[data-testid="mention-menu-searching-row"]');
  assert.equal(searchingRow.getAttribute('aria-label'), '正在搜索');
  assert.equal(searchingRow.querySelector('span').textContent, '正在搜索…');
  assert.equal(doc.querySelector('[data-testid="mention-menu-footer"] kbd').textContent, 'esc');
  assert.equal(doc.querySelector('[data-testid="mention-menu-footer"] span').textContent, '退出');

  assert.equal(doc.querySelector('[data-testid="hover-card-title"] span').textContent, 'chrome-devtools');
  assert.equal(
    doc.querySelector('[data-testid="hover-card-description"]').textContent,
    '通过 Chrome DevTools MCP 高效调试网页、自动化浏览器交互、分析性能与排查网络请求（不适用于 --slim 模式）。'
  );
});


