'use strict';

// Runs in Electron's main process. Change labels only; preserve roles and callbacks.
function installMenuTranslation(api, electron, dictionary) {
  const originalSetup = api.setupApplicationMenu;
  const originals = new WeakMap();
  const labels = new Set(['File', 'Edit', 'View', 'Window', 'Help', 'New Window', 'Docs',
    'Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Paste and Match Style', 'Delete', 'Select All',
    'Reload', 'Force Reload', 'Toggle Developer Tools', 'Actual Size', 'Reset Zoom',
    'Zoom In', 'Zoom Out', 'Toggle Full Screen', 'Toggle Fullscreen', 'Minimize', 'Close', 'Close Window',
    'Quit', 'Exit', 'About Antigravity', 'Preferences', 'Preferences...', 'Settings...',
    'Check for Updates...', 'Show All', 'Hide Others', 'Hide Antigravity',
    'Connect to WSL', 'Reopen Locally']);
  function walk(menu, translate) {
    for (const item of menu?.items || []) {
      if (translate) {
        const text = item.label?.replace(/&/g, '');
        if (labels.has(text) && Object.hasOwn(dictionary, text)) {
          originals.set(item, item.label);
          item.label = dictionary[text];
        }
      } else if (originals.has(item)) item.label = originals.get(item);
      if (item.submenu) walk(item.submenu, translate);
    }
  }
  api.setupApplicationMenu = function (...args) {
    walk(electron.Menu.getApplicationMenu(), false);
    const result = originalSetup.apply(this, args);
    const menu = electron.Menu.getApplicationMenu();
    if (menu) { walk(menu, true); electron.Menu.setApplicationMenu(menu); }
    return result;
  };
}

module.exports = installMenuTranslation;
