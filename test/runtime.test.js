'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const runtime = require('../src/runtime');
const dictionary = require('../dict/zh-CN.json');
const delay = () => new Promise(resolve => setTimeout(resolve, 100));

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
  await delay();
  assert.equal(button.textContent, '取消');
  assert.equal(button.title, '关闭');
  assert.equal(w.document.body.lastChild.textContent, '设置');
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

test('mounts Codex wave turn scrubber and summary popover on conversation turns', async t => {
  const chatHtml = `
    <div style="overflow-y:auto;">
      <div class="scroll-mt-4">
        <div role="article" aria-label="User message">
          <div data-testid="user-input-step"><div data-quotable="true">继续直到5小时额度用完</div></div>
        </div>
        <div role="article" aria-label="Agent response">
          <div data-testid="planner-response-text">
            <p>5 小时额度已达 100%，已停止全部开发任务。</p>
            <p>本轮补了缓存状态与到期刷新逻辑，其他并入下轮。</p>
          </div>
        </div>
      </div>
    </div>
  `;
  const w = await page(t, chatHtml);
  const track = w.document.getElementById('ag-codex-wave-scrubber');
  const pop = w.document.getElementById('ag-codex-wave-popover');
  assert.ok(track, 'wave scrubber track should be mounted');
  assert.ok(pop, 'wave summary popover should be mounted');
  assert.equal(pop.querySelector('[data-wave-role="title"]').textContent, '继续直到5小时额度用完');
  assert.match(pop.querySelector('[data-wave-role="line1"]').innerHTML, /<strong[^>]*>100%<\/strong>/);
  assert.match(pop.querySelector('[data-wave-role="line2"]').textContent, /本轮补了缓存状态与到期刷新逻辑/);
  const bmBtn = pop.querySelector('[data-wave-action="bookmark"]');
  bmBtn.click();
  assert.equal(pop.querySelector('[data-wave-role="bm-svg"]').getAttribute('fill'), 'currentColor');
  track.dispatchEvent(new w.MouseEvent('mouseenter', { clientY: 120, bubbles: true }));
  assert.equal(pop.style.display, 'block');
  assert.equal(pop.style.opacity, '1');
});

test('auto-backfills earlier conversation turns and updates wave scrubber ticks when older messages button exists', async t => {
  const chatHtml = `
    <html><body>
    <div id="container" style="overflow-y:auto;height:500px;">
      <button type="button" aria-label="Load older messages, showing 2 of 10">Load older messages</button>
      <div class="scroll-mt-4">
        <div role="article" aria-label="User message">
          <div data-testid="user-input-step"><div data-quotable="true">第二轮输入</div></div>
        </div>
        <div role="article" aria-label="Agent response">
          <div data-testid="planner-response-text"><p>第二轮响应完毕</p></div>
        </div>
      </div>
    </div>
    </body></html>
  `;
  const dom = new JSDOM(chatHtml, { url: 'https://127.0.0.1:12345/' });
  t.after(() => dom.window.close());
  const btn = dom.window.document.querySelector('button[aria-label*="Load older messages"]');
  let clicked = false;
  btn.addEventListener('click', () => {
    clicked = true;
    const earlierTurn = dom.window.document.createElement('div');
    earlierTurn.className = 'scroll-mt-4';
    earlierTurn.innerHTML = `
      <div role="article" aria-label="User message">
        <div data-testid="user-input-step"><div data-quotable="true">第一轮历史输入</div></div>
      </div>
      <div role="article" aria-label="Agent response">
        <div data-testid="planner-response-text"><p>第一轮响应完毕</p></div>
      </div>
    `;
    btn.parentNode.insertBefore(earlierTurn, btn.nextSibling);
    btn.remove();
  });

  runtime(dom.window, dictionary);
  await delay();
  await new Promise(r => setTimeout(r, 200));

  const track = dom.window.document.getElementById('ag-codex-wave-scrubber');
  assert.ok(track, 'wave scrubber should be mounted');
  const rows = track.querySelectorAll('[data-wave-role="list"] > div');
  assert.ok(clicked, 'load older messages button should be auto-clicked by backfill');
  assert.equal(rows.length, 2, 'wave scrubber should update to display 2 turns after backfill');
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
  await delay();
  await delay();

  const bar = dom.window.document.getElementById('ag-titlebar-context-bar');
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
  await delay();
  await delay();

  const bar = dom.window.document.getElementById('ag-titlebar-context-bar');
  assert.ok(bar, 'context monitor widget should be mounted');
  assert.match(bar.textContent, /5h额度 96%/, 'should render 5h limit for normal Gemini model');
  assert.match(bar.textContent, /缓存 90%/, 'should retain cache hit ratio');

  // Switch to Gemini 4 Argon
  const trigger = dom.window.document.querySelector('[data-testid="model-selector-trigger"]');
  trigger.textContent = 'Gemini 4 Argon 中';

  // Click widget to open popover and force refresh
  const toggleBtn = bar.querySelector('[data-ag-action="toggle-popover"]');
  toggleBtn.click();
  await delay();

  assert.match(bar.textContent, /G4周额 61%/, 'should switch to weekly limit for Gemini 4 Argon');

  const pop = dom.window.document.getElementById('ag-titlebar-context-popover');
  assert.ok(pop && pop.style.display !== 'none', 'popover should be visible');
  assert.match(pop.textContent, /模型用量额度概览/);
  assert.match(pop.textContent, /Gemini 4 Argon/);
  assert.match(pop.textContent, /61%/);
});

test('persists session turn history when earlier turns are virtualized out of DOM', async t => {
  const html = `
    <html>
      <head></head>
      <body>
        <div data-testid="conversation-row-sidebar" data-selected="true" data-cascade-id="test-cid-202"></div>
        <div class="scroll-mt-4" id="turn-1">
          <div role="article" aria-label="User message">
            <div data-testid="user-input-step"><div data-quotable="true">用户问题一</div></div>
          </div>
          <div role="article" aria-label="Agent response">
            <div data-testid="planner-response-text"><p>回复一</p></div>
          </div>
        </div>
        <div class="scroll-mt-4" id="turn-2">
          <div role="article" aria-label="User message">
            <div data-testid="user-input-step"><div data-quotable="true">用户问题二</div></div>
          </div>
          <div role="article" aria-label="Agent response">
            <div data-testid="planner-response-text"><p>回复二</p></div>
          </div>
        </div>
      </body>
    </html>
  `;
  const dom = new JSDOM(html, { url: 'https://127.0.0.1:12345/c/test-cid-202' });
  t.after(() => dom.window.close());

  runtime(dom.window, dictionary);
  await delay();

  const track = dom.window.document.getElementById('ag-codex-wave-scrubber');
  assert.ok(track, 'scrubber should be mounted');
  let rows = track.querySelectorAll('[data-wave-role="list"] > div');
  assert.equal(rows.length, 2, 'should initially display 2 turns');

  // Simulate virtualization: remove turn-1 from DOM (e.g. scrolled out of view)
  const turn1 = dom.window.document.getElementById('turn-1');
  turn1.remove();

  // Trigger DOM mutation / resync
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  await delay();

  rows = track.querySelectorAll('[data-wave-role="list"] > div');
  assert.equal(rows.length, 2, 'should keep both turns in scrubber even when turn-1 is virtualized out of DOM');
});



