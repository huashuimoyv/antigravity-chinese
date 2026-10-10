'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const install = require('../src/menu');
const dictionary = require('../dict/zh-CN.json');

test('native labels translate while callbacks, roles and repeated menu setup remain intact', () => {
  const click = () => 'clicked';
  const file = { label: '&File', submenu: { items: [{ label: 'New Window', click, accelerator: 'Ctrl+Shift+N' }] } };
  const view = { label: 'View', submenu: { items: [{ label: 'Reload', role: 'reload', enabled: true }] } };
  const menu = { items: [file, view, { label: 'Ameath' }] };
  let setups = 0, applied = 0;
  const electron = { Menu: { getApplicationMenu: () => menu, setApplicationMenu: value => { assert.equal(value, menu); applied++; } } };
  const api = { setupApplicationMenu: () => { assert.equal(file.label, '&File'); setups++; } };
  install(api, electron, dictionary);
  api.setupApplicationMenu();
  api.setupApplicationMenu();
  assert.equal(file.label, '文件');
  assert.equal(view.label, '视图');
  assert.equal(menu.items[2].label, 'Ameath');
  assert.equal(file.submenu.items[0].click, click);
  assert.equal(file.submenu.items[0].accelerator, 'Ctrl+Shift+N');
  assert.equal(view.submenu.items[0].role, 'reload');
  assert.equal(view.submenu.items[0].enabled, true);
  assert.equal(setups, 2);
  assert.equal(applied, 2);
});

test('restores default 1332x784 window bounds and persists user resize on close', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-bounds-'));
  try {
    let createdHandler = null;
    const electron = {
      Menu: { getApplicationMenu: () => null, setApplicationMenu: () => {} },
      app: {
        getPath: () => userData,
        on: (event, fn) => { if (event === 'browser-window-created') createdHandler = fn; }
      }
    };
    install({ setupApplicationMenu: () => {} }, electron, dictionary);
    assert.equal(typeof createdHandler, 'function');
    let bounds = { x: 100, y: 100, width: 1400, height: 900 };
    const listeners = {};
    const win = {
      getBounds: () => ({ ...bounds }),
      setBounds: (b) => { bounds = { ...b }; },
      isDestroyed: () => false,
      isMaximized: () => false,
      isMinimized: () => false,
      isFullScreen: () => false,
      on: (ev, fn) => { listeners[ev] = fn; }
    };
    createdHandler({}, win);
    assert.deepEqual(bounds, { x: 244, y: 83, width: 1332, height: 784 });
    bounds = { x: 260, y: 90, width: 1332, height: 784 };
    listeners.close();
    const saved = JSON.parse(fs.readFileSync(path.join(userData, 'window-bounds.json'), 'utf8'));
    assert.deepEqual(saved, { x: 260, y: 90, width: 1332, height: 784, maximized: false });
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('applies proxy settings to env and session when enabled in proxy-config.json', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-proxy-'));
  const originalEnv = { ...process.env };
  try {
    const proxyConfig = { enabled: true, proxyUrl: 'http://127.0.0.1:7890' };
    fs.writeFileSync(path.join(userData, 'proxy-config.json'), JSON.stringify(proxyConfig));
    let appliedRules = null;
    const session = {
      defaultSession: {
        setProxy: async (options) => { appliedRules = options.proxyRules; }
      }
    };
    const electron = {
      Menu: { getApplicationMenu: () => null, setApplicationMenu: () => {} },
      app: {
        getPath: () => userData,
        on: () => {},
        whenReady: async () => {}
      },
      session
    };
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    install({ setupApplicationMenu: () => {} }, electron, dictionary);
    assert.equal(process.env.HTTP_PROXY, 'http://127.0.0.1:7890');
    assert.equal(process.env.HTTPS_PROXY, 'http://127.0.0.1:7890');
    assert.equal(appliedRules, 'http://127.0.0.1:7890');
  } finally {
    process.env = originalEnv;
    fs.rmSync(userData, { recursive: true, force: true });
  }
});


