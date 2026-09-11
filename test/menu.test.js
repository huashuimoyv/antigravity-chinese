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
