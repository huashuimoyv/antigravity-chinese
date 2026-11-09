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


