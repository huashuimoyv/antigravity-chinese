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
  if (electron?.app) {
    const fs = require('node:fs');
    const path = require('node:path');

    // 1. 网络代理配置注入 (Proxy Configuration)
    try {
      const getProxyConfigFile = () => {
        try {
          if (typeof electron.app.getPath === 'function') {
            return path.join(electron.app.getPath('userData'), 'proxy-config.json');
          }
        } catch {}
        const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
        return path.join(appData, 'Antigravity', 'proxy-config.json');
      };

      const loadProxyConfig = () => {
        try {
          const cfgPath = getProxyConfigFile();
          if (fs.existsSync(cfgPath)) {
            const data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (data && typeof data === 'object') return data;
          }
        } catch {}
        return null;
      };

      const proxyConfig = loadProxyConfig();
      const proxyUrl = (proxyConfig?.enabled && typeof proxyConfig?.proxyUrl === 'string')
        ? proxyConfig.proxyUrl.trim()
        : (process.env.AG_PROXY_URL || null);

      if (proxyUrl) {
        process.env.HTTP_PROXY = proxyUrl;
        process.env.HTTPS_PROXY = proxyUrl;
        process.env.ALL_PROXY = proxyUrl;
        process.env.http_proxy = proxyUrl;
        process.env.https_proxy = proxyUrl;
        process.env.all_proxy = proxyUrl;

        const setSessionProxy = (ses) => {
          if (ses?.setProxy) {
            ses.setProxy({ proxyRules: proxyUrl }).catch(() => {});
          }
        };

        if (electron.session?.defaultSession) {
          setSessionProxy(electron.session.defaultSession);
        }
        if (typeof electron.app.whenReady === 'function') {
          electron.app.whenReady().then(() => {
            if (electron.session?.defaultSession) {
              setSessionProxy(electron.session.defaultSession);
            }
          }).catch(() => {});
        }
      }
    } catch {}

    // 2. 窗口尺寸记忆与还原
    const DEFAULT_BOUNDS = { width: 1332, height: 784, x: 244, y: 83, maximized: false };
    const getBoundsFile = () => {
      try {
        if (typeof electron.app.getPath === 'function') {
          return path.join(electron.app.getPath('userData'), 'window-bounds.json');
        }
      } catch {}
      const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
      return path.join(appData, 'Antigravity', 'window-bounds.json');
    };
    const loadBounds = () => {
      try {
        const data = JSON.parse(fs.readFileSync(getBoundsFile(), 'utf8'));
        if (data && Number.isFinite(data.width) && Number.isFinite(data.height) && data.width >= 500 && data.height >= 400) {
          return data;
        }
      } catch {}
      return { ...DEFAULT_BOUNDS };
    };
    const isVisibleOnScreen = (b) => {
      try {
        const displays = electron.screen?.getAllDisplays?.() || [];
        if (!displays.length || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return Number.isFinite(b.x) && Number.isFinite(b.y);
        return displays.some(({ workArea }) =>
          b.x + b.width > workArea.x + 80 &&
          b.x < workArea.x + workArea.width - 80 &&
          b.y >= workArea.y - 20 &&
          b.y < workArea.y + workArea.height - 60
        );
      } catch {
        return Number.isFinite(b.x) && Number.isFinite(b.y);
      }
    };
    electron.app.on('browser-window-created', (_event, win) => {
      try {
        const current = win.getBounds?.();
        if (!current || (current.width < 500 && current.height < 400)) return;
        const saved = loadBounds();
        if (isVisibleOnScreen(saved)) {
          win.setBounds({ x: Math.round(saved.x), y: Math.round(saved.y), width: Math.round(saved.width), height: Math.round(saved.height) });
        } else {
          win.setSize?.(Math.round(saved.width), Math.round(saved.height));
          win.center?.();
        }
        if (saved.maximized) win.maximize?.();
        let lastNormal = {
          width: Math.round(saved.width),
          height: Math.round(saved.height),
          x: Number.isFinite(saved.x) ? Math.round(saved.x) : current.x,
          y: Number.isFinite(saved.y) ? Math.round(saved.y) : current.y
        };
        let timer = null;
        const persist = () => {
          try {
            if (win.isDestroyed?.()) return;
            const isMax = Boolean(win.isMaximized?.());
            const isMin = Boolean(win.isMinimized?.());
            const isFull = Boolean(win.isFullScreen?.());
            if (!isMax && !isMin && !isFull) {
              const b = win.getBounds();
              if (b.width >= 500 && b.height >= 400) {
                lastNormal = { width: b.width, height: b.height, x: b.x, y: b.y };
              }
            }
            fs.writeFileSync(getBoundsFile(), JSON.stringify({ ...lastNormal, maximized: isMax }, null, 2));
          } catch {}
        };
        const schedulePersist = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(persist, 200);
        };
        win.on?.('resize', schedulePersist);
        win.on?.('move', schedulePersist);
        win.on?.('close', () => {
          if (timer) clearTimeout(timer);
          persist();
        });
      } catch {}
    });
  }
}

module.exports = installMenuTranslation;
