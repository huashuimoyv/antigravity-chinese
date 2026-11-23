'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const runtime = require('../src/runtime');
const dictionary = require('../dict/zh-CN.json');
const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(predicate, { timeout = 2000, interval = 10, message = 'condition timed out' } = {}) {
  const deadline = Date.now() + timeout;
  while (true) {
    const result = predicate();
    if (result) return result;
    if (Date.now() >= deadline) {
      throw new Error(message);
    }
    await delay(interval);
  }
}

async function page(t, html, url = 'https://127.0.0.1:12345/') {
  const dom = new JSDOM(html, { url });
  t.after(() => dom.window.close());
  runtime(dom.window, dictionary);
  await delay();
  return dom.window;
}

test('translates exact UI text and attributes, preserving spacing, values and unrelated text', async t => {
  const w = await page(t, '<button>  Save  </button><input placeholder="Search..." value="Save"><div>Settings</div><button>Save report.txt</button>');
  assert.equal(w.document.querySelector('button').textContent, '  保存  ');
  assert.equal(w.document.querySelector('input').placeholder, '搜索…');
  assert.equal(w.document.querySelector('input').value, 'Save');
  assert.equal(w.document.querySelector('div').textContent, 'Settings');
  assert.equal(w.document.querySelectorAll('button')[1].textContent, 'Save report.txt');
});

test('protects deeply nested editor, terminal, prose, messages and editable regions', async t => {
  const regions = ['<pre>', '<code>', '<div class="monaco-editor">', '<div class="xterm">',
    '<div class="prose">', '<div data-message-id="1">', '<div data-conversation-id="1">',
    '<div contenteditable="true">', '<div role="textbox">', '<div data-local-zh="off">'];
  const html = regions.map(start => `${start}<div><div><div><div><button title="Save">Save</button></div></div></div></div>${start.startsWith('<pre') ? '</pre>' : start.startsWith('<code') ? '</code>' : '</div>'}`).join('');
  const w = await page(t, html);
  for (const button of w.document.querySelectorAll('button')) {
    assert.equal(button.textContent, 'Save');
    assert.equal(button.title, 'Save');
  }
});

test('observes dynamic text, attributes, inserted controls and bursts without loops', async t => {
  const w = await page(t, '<button title="Save">Save</button>');
  const button = w.document.querySelector('button');
  button.firstChild.nodeValue = 'Cancel';
  button.title = 'Close';
  for (let i = 0; i < 550; i++) {
    const item = w.document.createElement('button'); item.textContent = 'Settings'; w.document.body.append(item);
  }
  await waitFor(
    () => button.textContent === '取消' && button.title === '关闭' && w.document.body.lastChild.textContent === '设置',
    { message: 'dynamic mutations should translate' }
  );
  let mutations = 0;
  const observer = new w.MutationObserver(records => { mutations += records.length; });
  observer.observe(w.document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  runtime(w, dictionary);
  await delay();
  assert.equal(mutations, 0);
  observer.disconnect();
});

test('does not run on websites or non-HTTPS origins', async t => {
  for (const url of ['https://example.com/', 'http://127.0.0.1/', 'https://127.0.0.1.example.com/']) {
    const w = await page(t, '<button>Save</button>', url);
    assert.equal(w.document.querySelector('button').textContent, 'Save');
  }
});

test('dictionary is exact-only, with unique raw keys and no executable rules', () => {
  const raw = require('node:fs').readFileSync(require.resolve('../dict/zh-CN.json'), 'utf8');
  const keys = [...raw.matchAll(/^  "([^"]+)":/gm)].map(match => match[1]);
  assert.equal(new Set(keys).size, keys.length);
  for (const [key, value] of Object.entries(dictionary)) {
    assert.equal(typeof value, 'string');
    assert.equal(key, key.trim());
    assert.match(value, /[\u4e00-\u9fff]/);
  }
});

test('translates extended controls and auxiliary navigation items', async t => {
  const w = await page(t, '<a>Documentation</a><div role="switch">Allow</div><summary>Details</summary><div>Subagents</div><textarea placeholder="Describe the bug you encountered...">Custom code</textarea>');
  assert.equal(w.document.querySelector('a').textContent, '文档');
  assert.equal(w.document.querySelector('[role="switch"]').textContent, '允许');
  assert.equal(w.document.querySelector('summary').textContent, '详情');
  assert.equal(w.document.querySelector('div:not([role])').textContent, '子智能体');
  assert.equal(w.document.querySelector('textarea').placeholder, '描述你遇到的问题…');
  assert.equal(w.document.querySelector('textarea').value, 'Custom code');
});

test('mounts titlebar context monitor widget and renders token breakdown and cache ratio', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="test-cid-101"></div>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.__APP_CONFIG__ = { csrfToken: '12345678-1234-1234-1234-123456789abc' };
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({
      generatorMetadata: [{
        plannerConfig: { modelName: 'gemini-2.0-pro' },
        chatModel: {
          usage: { inputTokens: 5000, cacheReadTokens: 15000, outputTokens: 1200, thinkingOutputTokens: 300 },
          chatStartMetadata: {
            contextWindowMetadata: {
              maxContextTokens: 256000,
              estimatedTokensUsed: 20000,
              tokenBreakdown: {
                groups: [
                  { name: 'System Prompt', type: 'TOKEN_TYPE_SYSTEM_PROMPT', numTokens: 8000 },
                  { name: 'Tools', type: 'TOKEN_TYPE_TOOLS', numTokens: 4000 },
                  { name: 'Messages', type: 'TOKEN_TYPE_MESSAGES', numTokens: 8000 }
                ]
              }
            }
          }
        }
      }]
    })
  });

  runtime(dom.window, dictionary);

  const bar = await waitFor(
    () => {
      const el = dom.window.document.getElementById('ag-titlebar-context-bar');
      return el && /20\.0k \/ 256k/.test(el.textContent) ? el : null;
    },
    { message: 'context monitor widget should mount and render token breakdown' }
  );
  assert.ok(bar, 'context monitor widget should be mounted');
  assert.match(bar.textContent, /20\.0k \/ 256k/);
  assert.match(bar.textContent, /缓存 75%/);
  // Verify that redundant textual tokens (系统 xx, 工具 xx, 消息 xx) are eliminated
  assert.doesNotMatch(bar.textContent, /系统 \d/);
  assert.doesNotMatch(bar.textContent, /工具 \d/);
  assert.doesNotMatch(bar.textContent, /消息 \d/);
});

test('renders model quota limits in titlebar and popover, preferring 5h quota for models and weekly for Gemini 4', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="test-cid-102"></div>
        <button data-testid="model-selector-trigger">Gemini 3.8 Flash 高</button>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.__APP_CONFIG__ = { csrfToken: '12345678-1234-1234-1234-123456789abc' };
  dom.window.fetch = async (url) => {
    if (url.includes('RetrieveUserQuotaSummary')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            groups: [
              {
                displayName: 'Gemini Models',
                buckets: [
                  { bucketId: 'gemini-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 0.94, resetTime: new Date(Date.now() + 86400000).toISOString() },
                  { bucketId: 'gemini-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.96, resetTime: new Date(Date.now() + 14400000).toISOString() }
                ]
              },
              {
                displayName: 'Gemini 4 Argon',
                buckets: [
                  { bucketId: 'gemini-argon-wtu-weekly', displayName: 'Gemini 4 Argon Weekly Limit', window: 'weekly', remainingFraction: 0.61, resetTime: new Date(Date.now() + 172800000).toISOString() }
                ]
              }
            ]
          }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        generatorMetadata: [{
          plannerConfig: { modelName: 'gemini-3.8-flash' },
          chatModel: {
            usage: { inputTokens: 1000, cacheReadTokens: 9000, outputTokens: 200 },
            chatStartMetadata: {
              contextWindowMetadata: {
                maxContextTokens: 256000,
                estimatedTokensUsed: 10000,
                tokenBreakdown: { groups: [{ name: 'Messages', type: 'TOKEN_TYPE_MESSAGES', numTokens: 10000 }] }
              }
            }
          }
        }]
      })
    };
  };

  runtime(dom.window, dictionary);

  const bar = await waitFor(
    () => {
      const el = dom.window.document.getElementById('ag-titlebar-context-bar');
      return el && /5h额度 96%/.test(el.textContent) && /缓存 90%/.test(el.textContent) ? el : null;
    },
    { message: 'context monitor widget should mount and render initial 5h quota' }
  );
  assert.ok(bar, 'context monitor widget should be mounted');
  assert.match(bar.textContent, /5h额度 96%/, 'should render 5h limit for normal Gemini model');
  assert.match(bar.textContent, /缓存 90%/, 'should retain cache hit ratio');

  // Switch to Gemini 4 Argon
  const trigger = dom.window.document.querySelector('[data-testid="model-selector-trigger"]');
  trigger.textContent = 'Gemini 4 Argon 中';

  // Click widget to open popover and force refresh
  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  const pop = await waitFor(
    () => {
      const p = dom.window.document.getElementById('ag-titlebar-context-popover');
      return /G4周额 61%/.test(bar.textContent) && p && p.style.display !== 'none' ? p : null;
    },
    { message: 'should switch to weekly limit for Gemini 4 Argon and show popover' }
  );

  assert.match(bar.textContent, /G4周额 61%/, 'should switch to weekly limit for Gemini 4 Argon');
  assert.ok(pop && pop.style.display !== 'none', 'popover should be visible');
  assert.match(pop.textContent, /模型用量额度概览/);
  assert.match(pop.textContent, /Gemini 4 Argon/);
  assert.match(pop.textContent, /61%/);
});

test('automatically localizes English sidebar conversation titles to Chinese via RPC', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-cascade-id="test-cid-888">
          <span>Graduation Recommendation Form Awards And Certificates</span>
          <time>2d</time>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.__APP_CONFIG__ = { csrfToken: 'test-csrf-token-12345' };

  let updatedTitle = '';
  dom.window.fetch = async (url, options) => {
    if (url.includes('GetCascadeTrajectorySteps')) {
      return {
        ok: true,
        json: async () => ({
          steps: [{
            userInput: {
              userResponse: '<USER_REQUEST>\n毕业生推荐表里的奖项和证书可以写什么\n</USER_REQUEST>'
            }
          }]
        })
      };
    }
    if (url.includes('UpdateConversationAnnotations')) {
      const payload = JSON.parse(options.body);
      updatedTitle = payload?.annotations?.title || '';
      return {
        ok: true,
        json: async () => ({})
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  runtime(dom.window, dictionary);
  await waitFor(() => updatedTitle.length > 0, { message: 'should extract and push Chinese title via RPC' });

  assert.equal(updatedTitle, '毕业生推荐表里的奖项和证书可以写什么', 'should extract and push Chinese title from user prompt');
});

test('treats Gemini 4 Hydrogen as Gemini Models quota pool rather than Argon weekly pool and supports empty conversations', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="test-cid-hydrogen"></div>
        <button data-testid="model-selector-trigger" aria-label="Select model, current: Gemini 4 Hydrogen Extra">Gemini 4 Hydrogen Extra</button>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.__APP_CONFIG__ = { csrfToken: '12345678-1234-1234-1234-123456789abc' };

  let emptyMetadata = false;
  dom.window.fetch = async (url) => {
    if (url.includes('RetrieveUserQuotaSummary')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            groups: [
              {
                displayName: 'Gemini Models',
                buckets: [
                  { bucketId: 'gemini-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 0.57, resetTime: new Date(Date.now() + 86400000).toISOString() },
                  { bucketId: 'gemini-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.89, resetTime: new Date(Date.now() + 7200000).toISOString() }
                ]
              },
              {
                displayName: 'Gemini 4 Argon',
                buckets: [
                  { bucketId: 'gemini-argon-wtu-weekly', displayName: 'Gemini 4 Argon Weekly Limit', window: 'weekly', remainingFraction: 0.20, resetTime: new Date(Date.now() + 172800000).toISOString() }
                ]
              }
            ]
          }
        })
      };
    }
    if (emptyMetadata) {
      return { ok: true, json: async () => ({ generatorMetadata: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        generatorMetadata: [{
          chatModel: {
            usage: { model: 'MODEL_PLACEHOLDER_M528', inputTokens: 2000, cacheReadTokens: 8000, outputTokens: 150 },
            chatStartMetadata: {
              contextWindowMetadata: {
                maxContextTokens: 256000,
                estimatedTokensUsed: 10000
              }
            }
          }
        }]
      })
    };
  };

  runtime(dom.window, dictionary);

  const bar = await waitFor(
    () => {
      const el = dom.window.document.getElementById('ag-titlebar-context-bar');
      return el && /5h额度 89%/.test(el.textContent) ? el : null;
    },
    { message: 'context monitor widget should mount with Hydrogen 5h quota' }
  );
  assert.ok(bar, 'context monitor widget should be mounted');
  assert.match(bar.textContent, /5h额度 89%/, 'Gemini 4 Hydrogen must use Gemini 5h quota instead of Argon 20%');
  assert.doesNotMatch(bar.textContent, /G4周额/, 'Gemini 4 Hydrogen must not show G4周额');

  // Switch to Argon: DOM observer should update quota badge deterministically without fixed sleeps
  const trigger = dom.window.document.querySelector('[data-testid="model-selector-trigger"]');
  trigger.textContent = 'Gemini 4 Argon High';
  await waitFor(
    () => /G4周额 20%/.test(bar.textContent),
    { message: 'Gemini 4 Argon should update bar to Argon weekly quota' }
  );
  assert.match(bar.textContent, /G4周额 20%/, 'Gemini 4 Argon should show Argon weekly quota');

  // Open popover while on Argon, then switch back to Hydrogen Extra via outside click + model change
  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  await waitFor(
    () => {
      const p = dom.window.document.getElementById('ag-titlebar-context-popover');
      return p && p.style.display !== 'none' && /Gemini 4 Argon/.test(p.textContent);
    },
    { message: 'clicking toggle button should open popover for Argon' }
  );

  trigger.click();
  trigger.textContent = 'Gemini 4 Hydrogen Extra';
  await waitFor(
    () => {
      const p = dom.window.document.getElementById('ag-titlebar-context-popover');
      return /5h额度 89%/.test(bar.textContent) && p && p.style.display === 'none';
    },
    { message: 'switching back to Hydrogen Extra should close popover on outside click and restore 5h quota' }
  );
  assert.match(bar.textContent, /5h额度 89%/, 'switching back to Hydrogen Extra should restore 5h quota');
  assert.doesNotMatch(bar.textContent, /G4周额/, 'switching back to Hydrogen Extra must clear G4周额');

  // Re-query toggle button because bar.innerHTML re-renders replace child nodes; toggle open & closed
  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  const pop = await waitFor(
    () => {
      const p = dom.window.document.getElementById('ag-titlebar-context-popover');
      return p && p.style.display !== 'none' && /Gemini 系列 · Hydrogen\/Flash \(5小时\)/.test(p.textContent) ? p : null;
    },
    { message: 'clicking fresh toggle button should open popover with Hydrogen quota details' }
  );
  assert.match(pop.textContent, /Gemini 系列 · Hydrogen\/Flash \(5小时\)/);
  assert.match(pop.textContent, /Gemini 系列 · Hydrogen\/Flash \(周额度\)/);
  assert.match(pop.textContent, /57%/);
  assert.match(pop.textContent, /gemini-4-hydrogen/);

  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  await waitFor(
    () => pop.style.display === 'none',
    { message: 'clicking fresh toggle button again should close popover' }
  );

  // Switch to an empty conversation and re-open popover to verify empty-conversation support
  emptyMetadata = true;
  const row = dom.window.document.querySelector('[data-testid="conversation-row-sidebar"]');
  row.setAttribute('data-cascade-id', 'test-cid-empty');
  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  await waitFor(
    () => /新对话/.test(bar.textContent) && /5h额度 89%/.test(bar.textContent) && pop.style.display !== 'none',
    { message: 'empty conversation should still render 新对话, active 5h quota, and quota popover' }
  );
  assert.match(pop.textContent, /模型用量额度概览/);
});

test('routes Gemini 4 Carbon and Claude Opus 5.5 Max to their proper quota pools', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="test-cid-carbon"></div>
        <button data-testid="model-selector-trigger">Gemini 4 Carbon High</button>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.__APP_CONFIG__ = { csrfToken: '12345678-1234-1234-1234-123456789abc' };
  dom.window.fetch = async (url) => {
    if (url.includes('RetrieveUserQuotaSummary')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            groups: [
              {
                displayName: 'Gemini Models',
                buckets: [
                  { bucketId: 'gemini-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 0.72, resetTime: new Date(Date.now() + 86400000).toISOString() },
                  { bucketId: 'gemini-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.91, resetTime: new Date(Date.now() + 7200000).toISOString() }
                ]
              },
              {
                displayName: 'Gemini 4 Argon',
                buckets: [
                  { bucketId: 'gemini-argon-wtu-weekly', displayName: 'Gemini 4 Argon Weekly Limit', window: 'weekly', remainingFraction: 0.15, resetTime: new Date(Date.now() + 172800000).toISOString() }
                ]
              },
              {
                displayName: 'Claude and GPT models',
                buckets: [
                  { bucketId: 'claude-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.64, resetTime: new Date(Date.now() + 7200000).toISOString() }
                ]
              }
            ]
          }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        generatorMetadata: [{
          chatModel: {
            usage: { model: 'MODEL_PLACEHOLDER_M670', inputTokens: 1500, cacheReadTokens: 8500, outputTokens: 120 },
            chatStartMetadata: {
              contextWindowMetadata: { maxContextTokens: 256000, estimatedTokensUsed: 10000 }
            }
          }
        }]
      })
    };
  };

  runtime(dom.window, dictionary);
  const bar = await waitFor(
    () => {
      const el = dom.window.document.getElementById('ag-titlebar-context-bar');
      return el && /5h额度 91%/.test(el.textContent) ? el : null;
    },
    { message: 'Gemini 4 Carbon should use Gemini Models 5h quota pool' }
  );
  assert.doesNotMatch(bar.textContent, /G4周额/);

  const trigger = dom.window.document.querySelector('[data-testid="model-selector-trigger"]');
  trigger.textContent = 'Claude Opus 5.5 Max';
  await waitFor(
    () => /5h额度 64%/.test(bar.textContent),
    { message: 'Claude Opus 5.5 Max should use Claude 5h quota pool' }
  );

  bar.querySelector('[data-ag-action="toggle-popover"]').click();
  const pop = await waitFor(
    () => {
      const p = dom.window.document.getElementById('ag-titlebar-context-popover');
      return p && p.style.display !== 'none' && /gemini-4-carbon/.test(p.textContent) ? p : null;
    },
    { message: 'popover should resolve M670 to gemini-4-carbon' }
  );
  assert.match(pop.textContent, /64%/);

  trigger.textContent = '编排协调员 (Neon)';
  await waitFor(
    () => /5h额度 91%/.test(bar.textContent),
    { message: 'Orchestrator (Neon) should use Gemini Models 5h quota pool' }
  );

  trigger.textContent = '编排协调员 (Argon)';
  await waitFor(
    () => /G4周额 15%/.test(bar.textContent),
    { message: 'Orchestrator (Argon) should use Argon weekly quota pool' }
  );
});

test('reads 2.34.0 session CSRF token asynchronously from localStorage for context monitor and sidebar title localizer', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-sidebar-row-id="cid-2340">
          <span>Repository Overview</span>
          <time>now</time>
        </div>
        <button data-testid="model-selector-trigger">编排协调员 Gemini 4 Neon Extra High</button>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());

  const seenTokens = [];
  let updatedTitle = '';
  let updatedCid = '';
  dom.window.fetch = async (url, options = {}) => {
    const hdrs = options.headers || {};
    const tok = typeof hdrs.get === 'function' ? hdrs.get('x-codeium-csrf-token') : hdrs['x-codeium-csrf-token'];
    seenTokens.push({ url, tok });
    if (url.includes('RetrieveUserQuotaSummary')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            groups: [
              {
                displayName: 'Gemini Models',
                buckets: [
                  { bucketId: 'gemini-weekly', displayName: 'Weekly Limit Remaining', window: 'weekly', remainingFraction: 0.60, resetTime: new Date(Date.now() + 86400000).toISOString() },
                  { bucketId: 'gemini-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.88, resetTime: new Date(Date.now() + 7200000).toISOString() }
                ]
              },
              {
                displayName: 'Gemini 4 Argon',
                buckets: [
                  { bucketId: 'gemini-argon-wtu-weekly', displayName: 'Gemini 4 Argon Weekly Limit', window: 'weekly', remainingFraction: 0.20, resetTime: new Date(Date.now() + 172800000).toISOString() }
                ]
              }
            ]
          }
        })
      };
    }
    if (url.includes('GetCascadeTrajectoryGeneratorMetadata')) {
      return {
        ok: true,
        json: async () => ({
          generatorMetadata: [{
            chatModel: {
              usage: { model: 'MODEL_PLACEHOLDER_M528', inputTokens: 2000, cacheReadTokens: 8000, outputTokens: 150 },
              chatStartMetadata: {
                contextWindowMetadata: { maxContextTokens: 256000, estimatedTokensUsed: 10000 }
              }
            }
          }]
        })
      };
    }
    if (url.includes('GetCascadeTrajectorySteps')) {
      return { ok: true, json: async () => ({ steps: [] }) };
    }
    if (url.includes('UpdateConversationAnnotations')) {
      const payload = JSON.parse(options.body || '{}');
      updatedCid = payload.cascadeId || '';
      updatedTitle = payload?.annotations?.title || '';
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({}) };
  };

  runtime(dom.window, dictionary);

  const bar = await waitFor(
    () => dom.window.document.getElementById('ag-titlebar-context-bar'),
    { message: 'titlebar widget should mount even before CSRF token arrives' }
  );
  assert.match(bar.textContent, /上下文加载中…/);
  assert.equal(seenTokens.length, 0, 'no RPC requests should fire while CSRF token is unavailable');

  setTimeout(() => {
    dom.window.localStorage.setItem('agy_session_csrf_token', 'agy_sess_2340_opaque_token_xyz');
  }, 100);

  await waitFor(
    () => /10\.0k \/ 256k/.test(bar.textContent) && /5h额度 88%/.test(bar.textContent) && updatedTitle.length > 0,
    { timeout: 2000, message: 'bootstrap timer should detect async localStorage token and load context, quota, and sidebar title' }
  );
  assert.match(bar.textContent, /缓存 80%/);
  assert.doesNotMatch(bar.textContent, /G4周额/);
  assert.equal(updatedCid, 'cid-2340');
  assert.equal(updatedTitle, '仓库概览');
  assert.ok(seenTokens.length >= 4, 'all 4 RPC endpoints should have been invoked');
  for (const item of seenTokens) {
    assert.equal(item.tok, 'agy_sess_2340_opaque_token_xyz');
  }
});

test('falls back to csrfToken cookie when __APP_CONFIG__ and localStorage are unavailable', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="cid-cookie-2340"></div>
        <button data-testid="model-selector-trigger">Gemini 4 Hydrogen Extra</button>
        <header>
          <div>
            <button data-testid="titlebar-more-actions">More</button>
          </div>
        </header>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  dom.window.document.cookie = 'theme=dark';
  dom.window.document.cookie = 'csrfToken=cookie_session_2340_tok';

  const seenTokens = [];
  dom.window.fetch = async (url, options = {}) => {
    const hdrs = options.headers || {};
    const tok = typeof hdrs.get === 'function' ? hdrs.get('x-codeium-csrf-token') : hdrs['x-codeium-csrf-token'];
    seenTokens.push({ url, tok });
    if (url.includes('RetrieveUserQuotaSummary')) {
      return {
        ok: true,
        json: async () => ({
          response: {
            groups: [
              {
                displayName: 'Gemini Models',
                buckets: [
                  { bucketId: 'gemini-5h', displayName: 'Five Hour Limit Remaining', window: '5h', remainingFraction: 0.77, resetTime: new Date(Date.now() + 7200000).toISOString() }
                ]
              }
            ]
          }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        generatorMetadata: [{
          chatModel: {
            usage: { model: 'MODEL_PLACEHOLDER_M528', inputTokens: 1200, cacheReadTokens: 4800, outputTokens: 80 },
            chatStartMetadata: {
              contextWindowMetadata: { maxContextTokens: 256000, estimatedTokensUsed: 6000 }
            }
          }
        }]
      })
    };
  };

  runtime(dom.window, dictionary);

  const bar = await waitFor(
    () => {
      const el = dom.window.document.getElementById('ag-titlebar-context-bar');
      return el && /6\.0k \/ 256k/.test(el.textContent) && /5h额度 77%/.test(el.textContent) ? el : null;
    },
    { message: 'cookie fallback CSRF token should load context and quota' }
  );
  assert.match(bar.textContent, /缓存 80%/);
  assert.ok(seenTokens.some(x => x.url.includes('GetCascadeTrajectoryGeneratorMetadata') && x.tok === 'cookie_session_2340_tok'));
  assert.ok(seenTokens.some(x => x.url.includes('RetrieveUserQuotaSummary') && x.tok === 'cookie_session_2340_tok'));
});





