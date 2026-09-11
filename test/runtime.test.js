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
