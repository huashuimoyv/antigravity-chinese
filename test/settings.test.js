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

test('translates Antigravity 2.32.2 settings sections, shortcuts, notifications, models/credits, remote control and cross-window banner', async t => {
  const html = `
    <div>Settings</div>
    <div class="settings-modal-container">
      <aside>
        <button data-testid="settings-nav-item-Account"><span>Account</span></button>
        <div>General</div>
        <div>Application</div>
        <div>Appearance</div>
        <div>Shortcuts</div>
        <div>Notifications</div>
        <div>Models</div>
        <div>Customizations</div>
        <div>Browser</div>
      </aside>
      <main>
        <h2>Application</h2>
        <div>Manage Antigravity app settings.</div>
        <h3>Updater</h3>
        <div>Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.</div>
        <h3>Models &amp; Usage</h3>
        <div>Manage your model quota and credits.</div>
        <div>Your Plan: Google AI Pro</div>
        <div>Your Plan: Enterprise</div>
        <div>Available AI Credits: 250</div>
        <button>See Activity</button>
        <button>Get More AI Credits</button>
        <button title="Refresh quota and credits data" aria-label="Refresh quota and credits data">Refresh</button>
        <div role="option">Gemini 3.1 Flash Image</div>
        <div role="option">Gemini 3 Pro Image</div>
        <div role="option">Gemini 2.5 Flash Image</div>
        <div title="Custom models are only supported on Linux machines.">Add Model</div>
        <h3>Notifications</h3>
        <div>Manage your notification preferences.</div>
        <h3>Sound</h3>
        <div>Set the volume of agent sounds.</div>
        <input type="range" aria-label="Chime volume" value="80">
        <h3>Shortcuts</h3>
        <div>Keyboard shortcuts for quick navigation and control.</div>
        <input placeholder="Search shortcuts">
        <button aria-label="Reset all shortcuts to defaults">Reset All to Defaults</button>
        <div>Edit Shortcut</div>
        <div>Enter always submits. This adds a second shortcut.</div>
        <h3>Remote Control</h3>
        <div>Enable Remote Control</div>
        <div>Manage your conversations from the companion website.</div>
        <input placeholder="Enter device name...">
        <div>Controls whether terminal commands require your approval before running. Note: A change to this setting will only apply to new messages sent to the agent. In-progress responses will use the previous setting value.</div>
        <div>Block all browser JavaScript execution.</div>
        <div class="monaco-editor"><code>Available AI Credits: 250</code></div>
      </main>
    </div>
    <div data-testid="agent-browser-cross-window-banner" role="status">
      <span>Browser is currently being operated by this conversation in another Hub window</span>
    </div>
    <button data-testid="webview-url-bar-draft-reopen" aria-label="Resume 2 comment drafts" title="Resume comment draft">Open</button>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  const mainText = doc.querySelector('main').textContent;
  assert.match(mainText, /管理 Antigravity 应用设置。/);
  assert.match(mainText, /更新器/);
  assert.match(mainText, /检测到新版本更新时自动提示重启应用。/);
  assert.match(mainText, /模型与用量/);
  assert.match(mainText, /当前方案：Google AI Pro/);
  assert.match(mainText, /当前方案：Enterprise/);
  assert.match(mainText, /可用 AI 积分：250/);
  assert.match(mainText, /查看明细/);
  assert.match(mainText, /获取更多 AI 积分/);
  assert.match(mainText, /Gemini 3\.1 Flash（图像）/);
  assert.match(mainText, /Gemini 3 Pro（图像）/);
  assert.match(mainText, /Gemini 2\.5 Flash（图像）/);
  assert.match(mainText, /提示音/);
  assert.match(mainText, /调整智能体提示音的音量。/);
  assert.match(mainText, /用于快速导航与控制的键盘快捷键。/);
  assert.match(mainText, /全部恢复默认/);
  assert.match(mainText, /编辑快捷键/);
  assert.match(mainText, /通过配套网页端远程管理你的对话。/);
  assert.match(mainText, /正在进行中的回复将继续沿用原有设置。/);
  assert.match(mainText, /阻止所有浏览器 JavaScript 脚本执行。/);
  assert.equal(doc.querySelector('input[type="range"]').getAttribute('aria-label'), '提示音音量');
  assert.equal(doc.querySelector('input[placeholder]').placeholder, '搜索快捷键');
  assert.equal(doc.querySelectorAll('input')[2].placeholder, '输入设备名称…');
  assert.equal(doc.querySelector('[data-testid="agent-browser-cross-window-banner"] span').textContent, '当前对话正在另一个 Hub 窗口中操作浏览器');
  const draftBtn = doc.querySelector('[data-testid="webview-url-bar-draft-reopen"]');
  assert.equal(draftBtn.getAttribute('aria-label'), '恢复 2 条评论草稿');
  assert.equal(draftBtn.getAttribute('title'), '恢复评论草稿');
  assert.equal(doc.querySelector('.monaco-editor code').textContent, 'Available AI Credits: 250');
});

test('translates Antigravity 2.33.0 new models, browsing data, keybinding schemes, bundles and side question controls', async t => {
  const html = `
    <div>Settings</div>
    <div class="settings-modal-container">
      <aside>
        <button data-testid="settings-nav-item-Account"><span>Account</span></button>
        <div>General</div>
        <div>Application</div>
        <div>Appearance</div>
        <div>Shortcuts</div>
        <div>Models</div>
        <div>Customizations</div>
        <div>Browser</div>
      </aside>
      <main>
        <h2>Browser</h2>
        <div>Enable Browser Agent</div>
        <div>Browsing Data</div>
        <div>Clear history, cookies and site data from the built-in browser, or manage cookies for each site.</div>
        <button>Manage</button>
        <button>Clear</button>
        <div>Cookies by Site</div>
        <input placeholder="Search sites...">
        <div>No sites have cookies in the built-in browser.</div>
        <h2>Shortcuts</h2>
        <div>Manage your keybinding scheme and customize shortcuts in VS Code.</div>
        <div>Keybinding Scheme</div>
        <div>Choose between non-colliding VS Code defaults or standalone Antigravity chords.</div>
        <div>VS Code Default</div>
        <div>Honors standard VS Code shortcuts without collisions (e.g. Ctrl+L Focus Input, Ctrl+Shift+L New Conversation, Ctrl+Shift+A Picker, Ctrl+Shift+, Settings).</div>
        <div>Antigravity (AGY) Style</div>
        <button>Customize Shortcuts</button>
        <h2>Customizations</h2>
        <div>Bundles</div>
        <div>Curated sets of plugins for common workflows and roles.</div>
        <button>Add bundle dev-pack</button>
        <div>This plugin in dev-pack may have looser code review. Review its contents before adding the bundle.</div>
        <button>Review contents</button>
        <button>Add anyway</button>
        <div>Resets in 2d 3h</div>
        <div>Resets in &lt;1m</div>
        <div role="option"><span>Gemini 4 Carbon (High)</span><span>91% left</span></div>
        <div role="option"><span>Claude Opus 5.5 (Max)</span><span>64% left</span></div>
        <div role="option"><span>Claude Sonnet 5.5 (Max)</span></div>
        <div role="option"><span>Gemini 3.8 Flash (Low)</span></div>
        <div role="option"><span>Gemini 3.1 Flash Lite</span></div>
        <div class="monaco-editor"><code>Gemini 4 Carbon (High)</code></div>
      </main>
    </div>
    <button data-testid="model-selector-trigger">3 models selected</button>
    <button data-testid="side-question-insert-to-main" aria-label="Insert into main conversation" title="Unarchive the main conversation to insert">Insert</button>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  const mainText = doc.querySelector('main').textContent;
  assert.match(mainText, /启用浏览器智能体/);
  assert.match(mainText, /浏览数据/);
  assert.match(mainText, /清除内置浏览器的历史记录、Cookie 与站点数据/);
  assert.match(mainText, /按站点管理 Cookie/);
  assert.match(mainText, /内置浏览器中暂无保存 Cookie 的站点。/);
  assert.match(mainText, /管理你的快捷键方案并在 VS Code 中自定义快捷键。/);
  assert.match(mainText, /快捷键方案/);
  assert.match(mainText, /VS Code 默认/);
  assert.match(mainText, /Antigravity \(AGY\) 风格/);
  assert.match(mainText, /自定义快捷键/);
  assert.match(mainText, /精选插件包/);
  assert.match(mainText, /添加插件包 dev-pack/);
  assert.match(mainText, /dev-pack 中的此插件代码审查可能较宽松/);
  assert.match(mainText, /查看内容/);
  assert.match(mainText, /仍然添加/);
  assert.match(mainText, /2d 3h后重置/);
  assert.match(mainText, /不足 1 分钟后重置/);
  assert.match(mainText, /Gemini 4 Carbon（高推理）/);
  assert.match(mainText, /Claude Opus 5\.5（最高）/);
  assert.match(mainText, /Claude Sonnet 5\.5（最高）/);
  assert.match(mainText, /Gemini 3\.8 Flash（低推理）/);
  assert.match(mainText, /Gemini 3\.1 Flash Lite（轻量版）/);
  assert.equal(doc.querySelector('input[placeholder]').placeholder, '搜索站点…');
  assert.equal(doc.querySelector('[data-testid="model-selector-trigger"]').textContent, '已选择 3 个模型');
  const insertBtn = doc.querySelector('[data-testid="side-question-insert-to-main"]');
  assert.equal(insertBtn.getAttribute('aria-label'), '插入到主对话');
  assert.equal(insertBtn.getAttribute('title'), '请先取消归档主对话后再插入');
  assert.equal(doc.querySelector('.monaco-editor code').textContent, 'Gemini 4 Carbon (High)');
});

test('translates model selector popup, Neon/GPT-OSS/badge tags, tooltips, View Usage popover, Turbo trigger and input placeholder', async t => {
  const html = `
    <div data-testid="model-selector-panel">
      <div data-testid="model-selector-header">Model</div>
      <div role="menuitem">
        <span>Gemini 4 Neon</span><span>Medium</span>
        <div><span>New</span></div>
      </div>
      <div role="menuitem" data-testid="model-selector-item">
        <span>Orchestrator (Neon)</span>
        <div><span>New</span></div>
      </div>
      <div role="menuitem" data-testid="model-selector-item">
        <span>Orchestrator (Argon)</span>
        <div><span>New</span></div>
      </div>
      <div role="menuitem" data-testid="model-selector-item">
        <span>GPT-OSS 120B (Medium)</span>
        <div><span>Notice</span></div>
      </div>
      <div role="menuitem" data-testid="model-selector-item">
        <span>Gemini 4 Carbon</span>
        <div><span>Unavailable</span></div>
      </div>
      <div role="menuitem">
        <span>View Usage</span>
      </div>
    </div>
    <div role="tooltip">
      <div>Neon that may offload routine steps to Hydrogen. Same Neon-level quality, fewer tokens used.</div>
    </div>
    <div role="menu">
      <div class="select-none">
        <div><span>Usage</span><span>Refreshing...</span></div>
        <div>
          <span>Gemini Models</span>
          <span>93% left</span>
          <span>Five Hour Limit Remaining, resets in 4h 33m</span>
        </div>
      </div>
    </div>
    <div data-testid="agent-input-box">
      <p class="pointer-events-none">Ask anything, @ to mention, / for actions</p>
      <div role="textbox" contenteditable="true">Ask anything, @ to mention, / for actions</div>
      <button data-testid="model-selector-trigger"><span>Orchestrator (Neon)</span></button>
      <button data-testid="permissions-selector-trigger"><span>Turbo</span></button>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  const panelText = doc.querySelector('[data-testid="model-selector-panel"]').textContent;
  assert.match(panelText, /模型/);
  assert.match(panelText, /Gemini 4 Neon中\s*新/);
  assert.match(panelText, /编排协调员 \(Neon\)\s*新/);
  assert.match(panelText, /编排协调员 \(Argon\)\s*新/);
  assert.match(panelText, /GPT-OSS 120B（中推理）\s*提示/);
  assert.match(panelText, /Gemini 4 Carbon\s*不可用/);
  assert.match(panelText, /查看用量/);

  assert.equal(
    doc.querySelector('[role="tooltip"] div').textContent,
    '可将常规步骤分流给 Hydrogen 处理的 Neon 编排器，兼顾同级质量与更低 Token 消耗。'
  );
  const usageMenuText = doc.querySelector('[role="menu"]').textContent;
  assert.match(usageMenuText, /用量正在刷新…/);
  assert.match(usageMenuText, /93% 剩余/);
  assert.match(usageMenuText, /5 小时剩余限额，4h 33m后重置/);

  assert.equal(
    doc.querySelector('[data-testid="agent-input-box"] p.pointer-events-none').textContent,
    '随便问点什么，@ 提及，/ 执行操作'
  );
  assert.equal(
    doc.querySelector('[data-testid="agent-input-box"] [role="textbox"]').textContent,
    'Ask anything, @ to mention, / for actions'
  );
  assert.equal(doc.querySelector('[data-testid="model-selector-trigger"]').textContent, '编排协调员 (Neon)');
  assert.equal(doc.querySelector('[data-testid="permissions-selector-trigger"]').textContent, '极速');
});

test('translates Antigravity 2.34.0 orchestrator settings, thinking effort, sentence-case settings, sidebar customization and inline permission cards', async t => {
  const html = `
    <div>Settings</div>
    <div class="settings-modal-container">
      <aside>
        <button data-testid="settings-nav-item-Account"><span>Account</span></button>
        <div>General</div>
        <div>Application</div>
        <div>Appearance</div>
        <div>Shortcuts</div>
        <div>Models</div>
        <div>Customizations</div>
        <div>Browser</div>
      </aside>
      <main>
        <h2>Input Box</h2>
        <div>Queued messages</div>
        <div>Send message</div>
        <div>Choose which key sends a message in the chat composer.</div>
        <div>Press Ctrl+Enter to send, Enter for a new line.</div>
        <div>Enable terminal sandbox</div>
        <div>Tool permissions</div>
        <div>Security preset</div>
        <h2>Orchestrator Settings</h2>
        <div>Orchestrator Model</div>
        <div>Executor Model</div>
        <div>Select Sidebar Item 3</div>
        <div class="monaco-editor"><code>Orchestrator Settings</code></div>
      </main>
    </div>
    <div data-testid="model-selector-panel">
      <div role="menuitem" data-testid="model-selector-orchestrator">
        <span>Orchestrator</span>
        <span data-testid="model-selector-orchestrator-model">The Orchestrator's own planner</span>
      </div>
    </div>
    <div role="menu">
      <div class="select-none">
        <div data-testid="model-selector-effort-header">
          <span>Thinking effort</span>
          <span data-testid="model-selector-effort-info" role="img" aria-label="Controls how much time and quota the model spends reasoning before responding. Higher effort improves accuracy on hard problems, at the cost of slower responses and higher quota use.">i</span>
        </div>
      </div>
    </div>
    <div data-testid="customize-sidebar-modal">
      <div>Group By</div>
      <label>Auto Pin</label>
      <div>Idle Conversations</div>
      <label>Show Automation Conversations</label>
      <div>Last Activity</div>
      <div>Any time</div>
      <div>7 days</div>
    </div>
    <div data-testid="inline-permission-card">
      <div data-testid="inline-permission-unsandboxed-warning">
        <span>Confirm the command is safe to run outside of the sandbox with full network and disk access.</span>
      </div>
      <button>Deny with note</button>
    </div>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:1234/' });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await pause();

  const doc = dom.window.document;
  const mainText = doc.querySelector('main').textContent;
  assert.match(mainText, /输入框/);
  assert.match(mainText, /排队消息/);
  assert.match(mainText, /发送消息/);
  assert.match(mainText, /选择在对话输入框中用于发送消息的按键。/);
  assert.match(mainText, /按 Ctrl\+Enter 发送，按 Enter 换行。/);
  assert.match(mainText, /启用终端沙盒/);
  assert.match(mainText, /工具权限/);
  assert.match(mainText, /安全预设/);
  assert.match(mainText, /编排协调员设置/);
  assert.match(mainText, /编排规划模型/);
  assert.match(mainText, /执行模型/);
  assert.match(mainText, /选择侧边栏第 3 项/);
  assert.equal(doc.querySelector('.monaco-editor code').textContent, 'Orchestrator Settings');

  const orchRow = doc.querySelector('[data-testid="model-selector-orchestrator"]');
  assert.match(orchRow.textContent, /编排协调员/);
  assert.match(orchRow.textContent, /编排器默认规划模型/);

  const effortHeader = doc.querySelector('[data-testid="model-selector-effort-header"]');
  assert.match(effortHeader.textContent, /思考深度/);
  assert.equal(
    doc.querySelector('[data-testid="model-selector-effort-info"]').getAttribute('aria-label'),
    '控制模型在回复前用于深度推理的时间与配额。更高深度可提升难题准确率，但会增加响应耗时和配额消耗。'
  );

  const sidebarModalText = doc.querySelector('[data-testid="customize-sidebar-modal"]').textContent;
  assert.match(sidebarModalText, /分组方式/);
  assert.match(sidebarModalText, /自动置顶/);
  assert.match(sidebarModalText, /空闲对话/);
  assert.match(sidebarModalText, /显示自动化任务对话/);
  assert.match(sidebarModalText, /最近活跃/);
  assert.match(sidebarModalText, /不限时间/);
  assert.match(sidebarModalText, /最近 7 天/);

  assert.equal(
    doc.querySelector('[data-testid="inline-permission-unsandboxed-warning"] span').textContent,
    '请确认该命令可安全地在沙盒外运行（将拥有完整网络与磁盘访问权限）。'
  );
  assert.equal(
    doc.querySelector('[data-testid="inline-permission-card"] button').textContent,
    '拒绝并附注'
  );
});


