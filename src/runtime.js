'use strict';

// Serialized into the isolated preload world. Keep this function self-contained.
function localize(window, dictionary) {
  if (window.top !== window || window.__AG_LOCAL_ZH__) return;
  if (window.location.protocol !== 'https:' || window.location.hostname !== '127.0.0.1') return;
  window.__AG_LOCAL_ZH__ = true;
  const document = window.document;
  const protectedSelector = [
    'script', 'style', 'noscript', 'pre', 'code', 'svg', 'canvas', 'iframe',
    'textarea', '[contenteditable]:not([contenteditable="false"])', '[role="textbox"]',
    '.monaco-editor', '.xterm', '.terminal', '.view-lines', '.hljs',
    '.markdown', '.markdown-body', '.prose', '[data-message-id]', '[data-message-author-role]',
    '[data-conversation-id]', '[data-session-id]', '[data-thread-id]',
    '[data-project-id]', '[data-workspace-id]', '[data-local-zh="off"]'
  ].join(',');
  // Deliberately exclude generic div/span/body text: it may be a conversation or filename.
  const controls = 'button,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="tab"],[role="tooltip"],label,option,[role="option"],h1,h2,h3,h4,h5,h6,[role="heading"],a,[role="radio"],[role="checkbox"],[role="switch"],summary';
  const panels = new WeakSet();
  let settingsPanel = null;
  const navigation = new Set([
    'New Conversation', 'Conversation History', 'Scheduled Tasks', 'Install IDE', 'Provide Feedback',
    'Subagents', 'Background Tasks', 'Artifacts', 'Files Changed', 'Terminals',
    'Skills & Customizations', 'Active Workspace'
  ]);
  // A settings modal may be built entirely from divs, without ARIA roles.
  // Recognize a concrete combination of settings navigation and content, never body.
  function discoverPanels() {
    if (settingsPanel?.isConnected) return;
    const walker = document.createTreeWalker(document.body || document.documentElement, 4);
    const anchors = [
      'Configure agent execution, queued message delivery, and permissions.',
      '配置智能体执行、排队消息发送和权限。'
    ];
    let text;
    while ((text = walker.nextNode())) {
      const value = text.nodeValue.trim();
      const navigationAnchor = value === 'Settings' || value === dictionary.Settings;
      if ((!anchors.includes(value) && !navigationAnchor) || !eligible(text.parentElement)) continue;
      for (let parent = text.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const content = parent.textContent;
        if (['Application', 'Customizations', 'Browser'].every(key =>
          content.includes(key) || content.includes(dictionary[key]))) {
          const panel = navigationAnchor ? parent.parentElement : parent;
          if (panel && panel !== document.body && panel !== document.documentElement) {
            panels.add(panel);
            settingsPanel = panel;
            return;
          }
          break;
        }
      }
    }
  }
  function inPanel(element) {
    for (let parent = element; parent; parent = parent.parentElement) {
      if (panels.has(parent)) return true;
      if (parent.matches('dialog,[role="dialog"],[aria-modal="true"]')) return true;
    }
    return false;
  }
  const attributes = ['title', 'aria-label', 'aria-description', 'placeholder'];
  const eligible = element => element && !element.closest(protectedSelector);
  function translate(value) {
    const key = value.trim().replace(/\s+/g, ' ');
    return Object.hasOwn(dictionary, key) ? value.replace(/\S[\s\S]*\S|\S/, dictionary[key]) : value;
  }
  function visit(node) {
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      const key = node.nodeValue.trim().replace(/\s+/g, ' ');
      if (eligible(parent) && (parent.closest(controls) || inPanel(parent) || navigation.has(key))) {
        const next = translate(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    if (eligible(node) || (node.tagName === 'TEXTAREA' && !node.closest('.monaco-editor,.terminal,.xterm'))) {
      // Input values and application data attributes are never modified.
      for (const name of attributes) {
        if (!node.hasAttribute(name)) continue;
        const value = node.getAttribute(name);
        const next = translate(value);
        if (next !== value) node.setAttribute(name, next);
      }
    }
    if (!eligible(node)) return;
    for (const child of node.childNodes) visit(child);
  }
  function start() {
    discoverPanels();
    visit(document.documentElement);
    const pending = new Set();
    let timer = null;
    const options = { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: attributes };
    const observer = new window.MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) pending.add(node);
        } else pending.add(record.target);
      }
      // Coalesce oversized batches instead of silently losing changes.
      if (pending.size > 500) { pending.clear(); pending.add(document.documentElement); }
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        observer.disconnect();
        try {
          discoverPanels();
          // A newly inserted settings panel can also contain previously mounted nodes.
          const roots = new Set();
          for (const node of pending) if (node.isConnected) {
            let root = node.nodeType === 1 ? node : node.parentElement;
            for (let parent = root; parent; parent = parent.parentElement) {
              if (panels.has(parent)) { root = parent; break; }
            }
            roots.add(root || node);
          }
          for (const root of roots) visit(root);
        } finally {
          pending.clear();
          observer.observe(document.documentElement, options);
        }
      }, 32);
    });
    observer.observe(document.documentElement, options);
    startContextMonitor(window, document);
    startWaveTurnScrubber(window, document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  function startContextMonitor(window, document) {
    if (window.__AG_CTX_MONITOR__) return;
    if (typeof window.fetch !== 'function') return;
    window.__AG_CTX_MONITOR__ = true;

    const getCsrfToken = () => {
      if (window.__APP_CONFIG__ && window.__APP_CONFIG__.csrfToken) return window.__APP_CONFIG__.csrfToken;
      const scripts = document.scripts ? Array.from(document.scripts).map(s => s.textContent || '').join('\n') : (document.documentElement ? document.documentElement.innerHTML : '');
      const match = scripts.match(/csrfToken\W+([0-9a-f-]{36})/i);
      return match ? match[1] : null;
    };

    const cache = new Map();
    const inflight = new Set();
    let cardExpanded = false;

    const fmtK = n => {
      const num = Number(n) || 0;
      if (num >= 100000) return (num / 1000).toFixed(0) + 'k';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
      return String(num);
    };

    const getActiveCascadeId = () => {
      try {
        const sp = new window.URLSearchParams(window.location.search);
        const focused = sp.get('focused') || sp.get('cascadeId');
        if (focused && focused !== '_new') return focused.split('+')[0];
        const m = window.location.pathname.match(/^\/c\/([^/?#]+)/);
        if (m) {
          const decoded = decodeURIComponent(m[1]).split('+').filter(Boolean);
          const first = decoded.find(id => id !== '_new');
          if (first) return first;
        }
      } catch {}
      const selectedRow = document.querySelector('[data-testid="conversation-row-sidebar"][data-selected="true"]');
      return selectedRow ? selectedRow.getAttribute('data-cascade-id') : null;
    };

    const openTrajectoryDebugger = e => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      try {
        const url = new window.URL(window.location.href);
        url.searchParams.set('trajectoryDebugOpen', 'true');
        window.history.replaceState(window.history.state, '', url.toString());
        window.dispatchEvent(new window.PopStateEvent('popstate'));
      } catch (err) {
        console.error('[ag-ctx]', err);
      }
    };

    const parseGeneratorMetadata = (list, prev) => {
      if (!Array.isArray(list) || list.length === 0) return prev || null;
      let latestMeta = null;
      let latestModel = prev?.modelName || '';
      let latestUsage = prev?.usage || null;
      let checkpointIdx = prev?.checkpointIdx ?? -1;
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        if (!latestModel && item?.plannerConfig?.modelName) latestModel = item.plannerConfig.modelName;
        const cm = item?.chatModel;
        if (cm) {
          if (!latestUsage && cm.usage) latestUsage = cm.usage;
          const csm = cm.chatStartMetadata;
          if (csm && typeof csm.checkpointIndex === 'number') checkpointIdx = csm.checkpointIndex;
          if (csm?.contextWindowMetadata && !latestMeta) {
            latestMeta = csm.contextWindowMetadata;
          }
        }
        if (latestMeta && latestModel && latestUsage) break;
      }
      const max = Number(latestMeta?.maxContextTokens) || prev?.max || 256000;
      const uncachedIn = Number(latestUsage?.inputTokens) || 0;
      const cachedIn = Number(latestUsage?.cacheReadTokens) || 0;
      const outTokens = Number(latestUsage?.outputTokens) || 0;
      const thinkTokens = Number(latestUsage?.thinkingOutputTokens) || 0;
      const usedFromUsage = uncachedIn + cachedIn;
      const used = Number(latestMeta?.estimatedTokensUsed) || usedFromUsage || prev?.used || 0;
      const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;

      let sysTokens = prev?.sysTokens || 0;
      let toolsTokens = prev?.toolsTokens || 0;
      let msgTokens = prev?.msgTokens || 0;
      let topChildren = prev?.topChildren || [];

      const groups = latestMeta?.tokenBreakdown?.groups;
      if (Array.isArray(groups) && groups.length > 0) {
        sysTokens = 0; toolsTokens = 0; msgTokens = 0;
        const childItems = [];
        for (const g of groups) {
          const gt = Number(g.numTokens) || 0;
          if (g.type === 'TOKEN_TYPE_SYSTEM_PROMPT' || g.name === 'System Prompt') {
            sysTokens += gt;
            if (Array.isArray(g.children)) {
              for (const c of g.children) childItems.push({ group: '系统', name: c.name, tokens: Number(c.numTokens) || 0 });
            }
          } else if (g.type === 'TOKEN_TYPE_TOOLS' || g.name === 'Tools') {
            toolsTokens += gt;
            if (Array.isArray(g.children)) {
              for (const c of g.children) childItems.push({ group: '工具', name: c.name, tokens: Number(c.numTokens) || 0 });
            }
          } else {
            msgTokens += gt;
          }
        }
        childItems.sort((a, b) => b.tokens - a.tokens);
        topChildren = childItems.slice(0, 5);
      } else if (used > 0 && sysTokens === 0 && msgTokens === 0) {
        msgTokens = used;
      }

      return {
        used,
        max,
        pct,
        sysTokens,
        toolsTokens,
        msgTokens,
        uncachedIn,
        cachedIn,
        outTokens,
        thinkTokens,
        modelName: latestModel || 'gemini',
        checkpointIdx,
        topChildren,
        sig: `${used}:${max}:${sysTokens}:${toolsTokens}:${msgTokens}:${cachedIn}:${outTokens}:${latestModel}`
      };
    };

    const fetchCascadeContext = async (cid, isRefresh = false) => {
      if (!cid || cid === '_new' || inflight.has(cid)) return;
      const token = getCsrfToken();
      if (!token) return;
      const existing = cache.get(cid);
      if (existing && !isRefresh && Date.now() - existing.updatedAt < 15000) return;
      inflight.add(cid);
      try {
        const offset = existing && existing.totalTurns > 1 ? existing.totalTurns - 1 : 0;
        const body = offset > 0 ? { cascadeId: cid, generatorMetadataOffset: offset } : { cascadeId: cid };
        const res = await window.fetch('/exa.language_server_pb.LanguageServerService/GetCascadeTrajectoryGeneratorMetadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            'x-codeium-csrf-token': token
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = data?.generatorMetadata || [];
        const totalTurns = offset > 0 ? offset + list.length : list.length;
        const parsed = parseGeneratorMetadata(list, existing);
        if (parsed) {
          parsed.totalTurns = totalTurns;
          parsed.updatedAt = Date.now();
          cache.set(cid, parsed);
          renderAll();
        }
      } catch {} finally {
        inflight.delete(cid);
      }
    };

    const getBadgeColors = pct => {
      if (pct >= 75) return { bg: 'rgba(244, 63, 94, 0.16)', fg: '#fb7185', border: 'rgba(244, 63, 94, 0.35)' };
      if (pct >= 50) return { bg: 'rgba(245, 158, 11, 0.15)', fg: '#fbbf24', border: 'rgba(245, 158, 11, 0.32)' };
      return { bg: 'rgba(56, 189, 248, 0.12)', fg: '#38bdf8', border: 'rgba(56, 189, 248, 0.25)' };
    };

    const buildPopoverHtml = info => {
      if (!info || info.used === 0) return '';
      const max = info.max || 256000;
      const msgColor = info.pct >= 75 ? '#f43f5e' : '#f59e0b';
      const cacheRatio = (info.uncachedIn + info.cachedIn) > 0
        ? Math.round((info.cachedIn / (info.uncachedIn + info.cachedIn)) * 100)
        : 0;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(128,128,128,0.18);">
          <span style="font-size:12px;font-weight:600;color:var(--foreground,#e5e7eb);">当前对话上下文拆解</span>
          <span style="font-size:11px;font-family:monospace;color:var(--muted-foreground,#9ca3af);">${info.modelName}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--muted-foreground,#9ca3af);">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>总上下文占用</span>
            <span style="color:var(--foreground,#e5e7eb);font-weight:600;font-variant-numeric:tabular-nums;">${info.used.toLocaleString()} / ${max.toLocaleString()} (${info.pct.toFixed(2)}%)</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:#6366f1;margin-right:4px;"></i>系统提示词 (Rules / Skills)</span>
            <span style="color:#818cf8;font-variant-numeric:tabular-nums;">${info.sysTokens.toLocaleString()} (${((info.sysTokens / max) * 100).toFixed(1)}%)</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:#06b6d4;margin-right:4px;"></i>工具定义 (Tools)</span>
            <span style="color:#22d3ee;font-variant-numeric:tabular-nums;">${info.toolsTokens.toLocaleString()} (${((info.toolsTokens / max) * 100).toFixed(1)}%)</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span><i style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${msgColor};margin-right:4px;"></i>对话历史与工具输出</span>
            <span style="color:${msgColor};font-variant-numeric:tabular-nums;">${info.msgTokens.toLocaleString()} (${((info.msgTokens / max) * 100).toFixed(1)}%)</span>
          </div>
          ${(info.cachedIn > 0 || info.uncachedIn > 0) ? `
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>本轮 Prompt 缓存命中</span>
            <span style="color:#34d399;font-variant-numeric:tabular-nums;">${info.cachedIn.toLocaleString()} / ${(info.cachedIn + info.uncachedIn).toLocaleString()} (${cacheRatio}%)</span>
          </div>` : ''}
          ${info.outTokens > 0 ? `
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>本轮输出 (思考 / 回复)</span>
            <span style="color:var(--foreground,#e5e7eb);font-variant-numeric:tabular-nums;">${info.thinkTokens.toLocaleString()} / ${(info.outTokens - info.thinkTokens).toLocaleString()} tokens</span>
          </div>` : ''}
          ${info.checkpointIdx >= 0 ? `
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span>长对话自动压缩 (Checkpoint)</span>
            <span style="color:#34d399;">已启用 (#${info.checkpointIdx})</span>
          </div>` : ''}
          ${info.topChildren.length > 0 ? `
          <div style="margin-top:4px;padding-top:5px;border-top:1px dashed rgba(128,128,128,0.2);">
            <div style="margin-bottom:3px;font-size:10px;opacity:0.8;">高占用子项 Top 5:</div>
            ${info.topChildren.slice(0, 5).map(ch => `
              <div style="display:flex;justify-content:space-between;font-size:10px;opacity:0.92;padding:1px 0;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px;">[${ch.group}] ${ch.name}</span>
                <span style="font-variant-numeric:tabular-nums;">${ch.tokens.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>` : ''}
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(128,128,128,0.18);display:flex;justify-content:flex-end;">
            <button type="button" data-ag-action="open-debug" style="font-size:11px;padding:3px 8px;border-radius:5px;border:1px solid rgba(128,128,128,0.3);background:rgba(99,102,241,0.15);color:#818cf8;cursor:pointer;font-weight:500;">
              打开官方全屏轨迹分析器
            </button>
          </div>
        </div>
      `;
    };

    const buildTitlebarHtml = info => {
      if (!info || info.used === 0) {
        return `<span style="font-size:11px;color:var(--muted-foreground,#9ca3af);">上下文加载中…</span>`;
      }
      const max = info.max || 256000;
      const sysPct = Math.min(100, (info.sysTokens / max) * 100);
      const toolsPct = Math.min(100, (info.toolsTokens / max) * 100);
      const msgPct = Math.min(100 - sysPct - toolsPct, (info.msgTokens / max) * 100);
      const c = getBadgeColors(info.pct);
      const msgColor = info.pct >= 75 ? '#f43f5e' : '#f59e0b';
      const cacheRatio = (info.uncachedIn + info.cachedIn) > 0
        ? Math.round((info.cachedIn / (info.uncachedIn + info.cachedIn)) * 100)
        : 0;

      return `
        <div data-ag-action="toggle-popover" title="点击展开/收起详细上下文拆解" style="display:inline-flex;align-items:center;gap:7px;height:100%;cursor:pointer;">
          <span style="display:inline-flex;align-items:center;gap:4px;font-weight:600;color:${c.fg};font-variant-numeric:tabular-nums;white-space:nowrap;">
            <span style="width:6px;height:6px;border-radius:999px;background:${c.fg};"></span>
            <span>${fmtK(info.used)} / ${fmtK(max)} (${info.pct.toFixed(1)}%)</span>
          </span>
          <div style="width:76px;height:6px;border-radius:999px;background:rgba(128,128,128,0.2);overflow:hidden;display:flex;flex-shrink:0;">
            <div style="width:${sysPct.toFixed(2)}%;background:#6366f1;height:100%;"></div>
            <div style="width:${toolsPct.toFixed(2)}%;background:#06b6d4;height:100%;"></div>
            <div style="width:${msgPct.toFixed(2)}%;background:${msgColor};height:100%;"></div>
          </div>
          <span style="width:1px;height:12px;background:rgba(128,128,128,0.22);flex-shrink:0;"></span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted-foreground,#9ca3af);font-variant-numeric:tabular-nums;white-space:nowrap;">
            <span><i style="display:inline-block;width:5px;height:5px;border-radius:1px;background:#6366f1;margin-right:2px;vertical-align:middle;"></i>系统 ${fmtK(info.sysTokens)}</span>
            <span><i style="display:inline-block;width:5px;height:5px;border-radius:1px;background:#06b6d4;margin-right:2px;vertical-align:middle;"></i>工具 ${fmtK(info.toolsTokens)}</span>
            <span><i style="display:inline-block;width:5px;height:5px;border-radius:1px;background:${msgColor};margin-right:2px;vertical-align:middle;"></i>消息 ${fmtK(info.msgTokens)}</span>
            ${cacheRatio > 0 ? `<span style="color:#34d399;">缓存 ${cacheRatio}%</span>` : ''}
          </span>
          <span style="font-size:10px;color:var(--muted-foreground,#9ca3af);">${cardExpanded ? '▴' : '▾'}</span>
        </div>
        <span style="width:1px;height:12px;background:rgba(128,128,128,0.22);flex-shrink:0;"></span>
        <button type="button" data-ag-action="open-debug" title="打开官方全屏上下文与轨迹分析器 (Trajectory Debug View)" style="font-size:11px;line-height:16px;padding:1px 5px;border-radius:4px;border:none;background:rgba(99,102,241,0.14);color:#818cf8;cursor:pointer;font-weight:500;white-space:nowrap;">
          轨迹分析
        </button>
      `;
    };

    const bindEvents = container => {
      if (container.getAttribute('data-bound') === '1') return;
      container.setAttribute('data-bound', '1');
      container.addEventListener('click', e => {
        const target = e.target.closest('[data-ag-action]');
        if (!target) return;
        const action = target.getAttribute('data-ag-action');
        if (action === 'open-debug') {
          cardExpanded = false;
          openTrajectoryDebugger(e);
          renderAll(true);
        } else if (action === 'toggle-popover') {
          e.preventDefault();
          e.stopPropagation();
          cardExpanded = !cardExpanded;
          renderAll(true);
        }
      });
    };

    const renderTitlebarWidget = activeInfo => {
      const anchor = document.querySelector('[data-testid="titlebar-more-actions"]') ||
                     document.querySelector('[data-testid="install-editor"]') ||
                     document.querySelector('[data-testid="feedback-button"]') ||
                     document.querySelector('header [data-testid="user-profile-button"]') ||
                     document.querySelector('header div[class*="flex"] > button:last-child');
      if (!anchor || !anchor.parentElement) return;
      const host = anchor.parentElement;

      let bar = document.getElementById('ag-titlebar-context-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'ag-titlebar-context-bar';
        bar.setAttribute('data-local-zh', 'off');
        bar.setAttribute('data-no-drag', '');
        bar.style.cssText = 'display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;margin-right:4px;border-radius:6px;border:1px solid var(--border,rgba(128,128,128,0.22));background:rgba(128,128,128,0.06);font-size:12px;line-height:1;user-select:none;app-region:no-drag;-webkit-app-region:no-drag;flex-shrink:0;';
        host.insertBefore(bar, anchor);
        bindEvents(bar);
      } else if (bar.nextElementSibling !== anchor && host.contains(anchor)) {
        host.insertBefore(bar, anchor);
      }

      const sig = (activeInfo ? activeInfo.sig : 'none') + ':' + (cardExpanded ? '1' : '0');
      if (bar.getAttribute('data-sig') !== sig) {
        bar.setAttribute('data-sig', sig);
        bar.innerHTML = buildTitlebarHtml(activeInfo);
      }

      let pop = document.getElementById('ag-titlebar-context-popover');
      if (!cardExpanded || !activeInfo) {
        if (pop) pop.style.display = 'none';
        return;
      }
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'ag-titlebar-context-popover';
        pop.setAttribute('data-local-zh', 'off');
        pop.style.cssText = 'position:fixed;z-index:9999;width:310px;padding:10px 12px;border-radius:8px;border:1px solid var(--border,rgba(128,128,128,0.25));background:var(--card,var(--background,#18181b));box-shadow:0 10px 25px rgba(0,0,0,0.35);user-select:none;app-region:no-drag;-webkit-app-region:no-drag;';
        document.body.appendChild(pop);
        bindEvents(pop);
      }
      const rect = bar.getBoundingClientRect();
      pop.style.display = 'block';
      pop.style.top = `${Math.round(rect.bottom + 6)}px`;
      pop.style.left = `${Math.max(8, Math.round(rect.right - 310))}px`;
      if (pop.getAttribute('data-sig') !== sig) {
        pop.setAttribute('data-sig', sig);
        pop.innerHTML = buildPopoverHtml(activeInfo);
      }
    };

    const renderAll = (force = false) => {
      const activeCid = getActiveCascadeId();
      if (activeCid && !cache.has(activeCid)) {
        fetchCascadeContext(activeCid, true);
      }
      const activeInfo = activeCid ? cache.get(activeCid) : null;
      if (force) {
        const b = document.getElementById('ag-titlebar-context-bar');
        if (b) b.removeAttribute('data-sig');
        const p = document.getElementById('ag-titlebar-context-popover');
        if (p) p.removeAttribute('data-sig');
      }
      renderTitlebarWidget(activeInfo);
    };

    renderAll();
    if (window.__AG_CTX_TIMER__) window.clearInterval(window.__AG_CTX_TIMER__);
    window.__AG_CTX_TIMER__ = window.setInterval(() => {
      const activeCid = getActiveCascadeId();
      if (activeCid) fetchCascadeContext(activeCid, true);
      renderAll();
    }, 3000);
    window.addEventListener('popstate', () => renderAll());
    document.addEventListener('click', e => {
      if (cardExpanded) {
        const bar = document.getElementById('ag-titlebar-context-bar');
        const pop = document.getElementById('ag-titlebar-context-popover');
        if (bar && !bar.contains(e.target) && (!pop || !pop.contains(e.target))) {
          cardExpanded = false;
          renderAll(true);
          return;
        }
      }
      window.setTimeout(() => renderAll(), 120);
    }, true);
  }

  function startWaveTurnScrubber(window, document) {
    if (window.__AG_WAVE_SCRUBBER__) return;
    window.__AG_WAVE_SCRUBBER__ = true;

    const BASE_W = 6;
    const MAX_W = 22;
    const RADIUS = 46;
    const LERP = 0.28;

    let items = [];
    let tickRows = [];
    let tickBars = [];
    let curW = [];
    let targetW = [];
    let curOp = [];
    let targetOp = [];

    let isHoverTrack = false;
    let isHoverCard = false;
    let mouseY = null;
    let activeIdx = 0;
    let viewportActiveIdx = 0;
    let cardCurY = 140;
    let cardTargetY = 140;
    let hideTimer = null;
    let rafId = null;
    let lastSig = '';
    let scrollBoundHost = null;
    const bookmarks = new Set();

    const escHtml = str => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const highlightMetrics = str => escHtml(str).replace(
      /(\d+(?:\.\d+)?(?:\s*(?:%|秒|ms|s|k|KB|MB|GB|小时|分钟|轮|个|项|tokens?))?)/gi,
      '<strong style="color:var(--foreground,#18181b);font-weight:600;">$1</strong>'
    );

    const cleanText = str => String(str || '')
      .replace(/<USER_REQUEST>|<\/USER_REQUEST>/gi, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[#*>\-\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const truncate = (str, len) => {
      const s = cleanText(str);
      return s.length > len ? s.slice(0, len - 1).trimEnd() + '…' : s;
    };

    const findScrollParent = el => {
      for (let p = el ? el.parentElement : null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
        if (p.style && (p.style.overflowY === 'auto' || p.style.overflowY === 'scroll')) return p;
        const st = window.getComputedStyle ? window.getComputedStyle(p) : null;
        if (st && (st.overflowY === 'auto' || st.overflowY === 'scroll' || st.overflowY === 'overlay')) {
          return p;
        }
      }
      return null;
    };

    const getLoadOlderButton = () => {
      return Array.from(document.querySelectorAll('button')).find(b => {
        const txt = ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
        return (txt.includes('load older messages') || txt.includes('加载更早') || txt.includes('load more'))
          && b.getAttribute('aria-disabled') !== 'true';
      });
    };

    let isBackfilling = false;

    const backfillIfShort = () => {
      if (isBackfilling) return;
      const btn = getLoadOlderButton();
      if (!btn) return;
      const turnEls = document.querySelectorAll('.scroll-mt-4');
      // Only backfill when entry view has fewer than 2 turns loaded
      if (turnEls.length > 1) return;
      isBackfilling = true;
      try {
        btn.click();
      } catch {}
      window.setTimeout(() => {
        isBackfilling = false;
        syncWaveScrubber();
      }, 300);
    };

    const extractTurnSummary = (turnEl, fallbackTitle) => {
      const userQuote = turnEl.querySelector('[data-testid="user-input-step"] [data-quotable="true"]')
        || turnEl.querySelector('[data-testid="user-input-step"]')
        || turnEl.querySelector('[role="article"][aria-label="User message"]');
      const rawUser = userQuote ? (userQuote.textContent || '') : '';
      const firstUserLine = rawUser.split(/\r?\n/).map(cleanText).find(Boolean) || fallbackTitle;
      const title = truncate(firstUserLine, 26) || fallbackTitle;

      const agentRoot = turnEl.querySelector('[role="article"][aria-label="Agent response"]') || turnEl;
      const respBlocks = Array.from(agentRoot.querySelectorAll('[data-testid="planner-response-text"]'));
      const lines = [];
      for (const b of respBlocks) {
        const nodes = b.querySelectorAll('p, li, h2, h3, h4');
        if (nodes.length > 0) {
          for (const n of nodes) {
            const t = cleanText(n.textContent);
            if (t && t.length >= 4 && !lines.includes(t)) lines.push(t);
          }
        } else {
          const t = cleanText(b.textContent);
          if (t && !lines.includes(t)) lines.push(t);
        }
      }

      if (lines.length === 0) {
        const rawAgent = cleanText(agentRoot.textContent || '');
        if (rawAgent) lines.push(rawAgent);
      }

      const line1 = truncate(lines[0] || '已完成该轮对话处理与响应。', 54);
      const line2 = lines.length > 1
        ? truncate(lines[lines.length - 1], 42)
        : truncate(lines[0] && lines[0].length > 54 ? lines[0].slice(50) : '点击卡片或波浪刻度可平滑定位至此轮对话。', 42);

      return { title, line1, line2, respBlocks };
    };

    const sessionCache = new Map();

    const getScrubberCascadeId = () => {
      try {
        const sp = new window.URLSearchParams(window.location.search);
        const focused = sp.get('focused') || sp.get('cascadeId');
        if (focused && focused !== '_new') return focused.split('+')[0];
        const m = window.location.pathname.match(/^\/c\/([^/?#]+)/);
        if (m) {
          const decoded = decodeURIComponent(m[1]).split('+').filter(Boolean);
          const first = decoded.find(id => id !== '_new');
          if (first) return first;
        }
      } catch {}
      const selectedRow = document.querySelector('[data-testid="conversation-row-sidebar"][data-selected="true"]');
      return selectedRow ? selectedRow.getAttribute('data-cascade-id') : 'default';
    };

    const collectTurnItems = () => {
      const userSteps = Array.from(document.querySelectorAll('[data-testid="user-input-step"], [role="article"][aria-label="User message"]'));
      const cid = getScrubberCascadeId();
      let cachedList = sessionCache.get(cid) || [];

      if (userSteps.length === 0) return cachedList.slice(-120);

      const seenTurns = new Set();
      const domTurnNodes = [];
      for (const node of userSteps) {
        const turnEl = node.closest('.scroll-mt-4')
          || (node.matches('[role="article"][aria-label="User message"]') ? node.parentElement : null)
          || node;
        if (!turnEl || seenTurns.has(turnEl)) continue;
        seenTurns.add(turnEl);
        domTurnNodes.push(turnEl);
      }

      const domItems = [];
      const expandMilestones = domTurnNodes.length <= 5;

      domTurnNodes.forEach((turnEl, idx) => {
        const info = extractTurnSummary(turnEl, `对话第 ${idx + 1} 轮`);
        const itemKey = `turn-${info.title.slice(0, 20)}`;
        domItems.push({
          key: itemKey,
          title: info.title,
          line1: info.line1,
          line2: info.line2,
          targetEl: turnEl
        });

        if (expandMilestones && info.respBlocks.length > 1) {
          info.respBlocks.slice(1).forEach((block, sIdx) => {
            const heading = block.querySelector('h1, h2, h3, h4, strong');
            const paras = Array.from(block.querySelectorAll('p, li')).map(p => cleanText(p.textContent)).filter(Boolean);
            const subTitle = truncate(heading ? heading.textContent : (paras[0] || `${info.title} · 阶段 ${sIdx + 2}`), 26);
            const subLine1 = truncate(paras[0] || block.textContent || info.line1, 54);
            const subLine2 = truncate(paras[1] || paras[paras.length - 1] || info.line2, 42);
            if (subLine1 && subLine1 !== info.line1) {
              domItems.push({
                key: `${itemKey}-sub-${sIdx}`,
                title: subTitle,
                line1: subLine1,
                line2: subLine2,
                targetEl: block
              });
            }
          });
        }
      });

      if (cachedList.length === 0) {
        cachedList = domItems;
      } else {
        const keyMap = new Map();
        for (const item of cachedList) keyMap.set(item.key, item);

        for (const domIt of domItems) {
          if (keyMap.has(domIt.key)) {
            const existing = keyMap.get(domIt.key);
            existing.targetEl = domIt.targetEl;
            existing.title = domIt.title;
            existing.line1 = domIt.line1;
            existing.line2 = domIt.line2;
          } else {
            let inserted = false;
            for (let j = 0; j < cachedList.length; j++) {
              const c = cachedList[j];
              if (c.targetEl?.isConnected && domIt.targetEl?.isConnected) {
                if (typeof domIt.targetEl.compareDocumentPosition === 'function') {
                  const pos = domIt.targetEl.compareDocumentPosition(c.targetEl);
                  if (pos & 4) {
                    cachedList.splice(j, 0, domIt);
                    keyMap.set(domIt.key, domIt);
                    inserted = true;
                    break;
                  }
                }
              }
            }
            if (!inserted) {
              cachedList.push(domIt);
              keyMap.set(domIt.key, domIt);
            }
          }
        }
      }

      sessionCache.set(cid, cachedList);
      return cachedList.slice(-120);
    };

    const updateViewportActiveTurn = () => {
      if (items.length === 0) return;
      const scrollHost = findScrollParent(items[0].targetEl);
      const refTop = scrollHost ? scrollHost.getBoundingClientRect().top : 60;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < items.length; i++) {
        const el = items[i].targetEl;
        if (!el || !el.isConnected) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top - refTop - 36);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      viewportActiveIdx = best;
    };

    const updatePopoverDom = () => {
      const pop = document.getElementById('ag-codex-wave-popover');
      const item = items[activeIdx];
      if (!pop || !item) return;
      const isBm = bookmarks.has(item.key);
      const titleEl = pop.querySelector('[data-wave-role="title"]');
      const line1El = pop.querySelector('[data-wave-role="line1"]');
      const line2El = pop.querySelector('[data-wave-role="line2"]');
      const bmBtn = pop.querySelector('[data-wave-action="bookmark"]');
      const bmSvg = pop.querySelector('[data-wave-role="bm-svg"]');
      if (titleEl) titleEl.textContent = item.title;
      if (line1El) line1El.innerHTML = highlightMetrics(item.line1);
      if (line2El) {
        if (activeIdx === 0 && getLoadOlderButton()) {
          line2El.textContent = '↑ 上方有更早历史，点击刻度可平滑加载';
        } else {
          line2El.textContent = item.line2;
        }
      }
      if (bmSvg) bmSvg.setAttribute('fill', isBm ? 'currentColor' : 'none');
      if (bmBtn) bmBtn.style.color = isBm ? '#f59e0b' : 'var(--muted-foreground,#9ca3af)';
    };

    const scrollToItem = idx => {
      const item = items[idx];
      if (!item) return;
      if (item.targetEl && item.targetEl.isConnected && typeof item.targetEl.scrollIntoView === 'function') {
        viewportActiveIdx = idx;
        item.targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const btn = getLoadOlderButton();
      if (btn) {
        btn.click();
        window.setTimeout(() => {
          syncWaveScrubber();
          const target = items[idx]?.targetEl;
          if (target && target.isConnected && typeof target.scrollIntoView === 'function') {
            viewportActiveIdx = idx;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 280);
      }
    };

    const showPopover = () => {
      const pop = document.getElementById('ag-codex-wave-popover');
      if (!pop || items.length === 0) return;
      pop.style.display = 'block';
      pop.style.opacity = '1';
      pop.style.pointerEvents = 'auto';
      pop.style.transform = 'scale(1)';
    };

    const scheduleHide = () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!isHoverTrack && !isHoverCard) {
          const pop = document.getElementById('ag-codex-wave-popover');
          if (pop) {
            pop.style.opacity = '0';
            pop.style.pointerEvents = 'none';
            pop.style.transform = 'scale(0.96)';
          }
          mouseY = null;
        }
      }, 95);
    };

    const handleTrackPointer = e => {
      if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
      isHoverTrack = true;
      if (typeof e.clientY === 'number') mouseY = e.clientY;
      updatePopoverDom();
      showPopover();
      startAnimLoop();
    };

    const ensureMounted = () => {
      let track = document.getElementById('ag-codex-wave-scrubber');
      let pop = document.getElementById('ag-codex-wave-popover');
      if (!track) {
        track = document.createElement('div');
        track.id = 'ag-codex-wave-scrubber';
        track.setAttribute('data-local-zh', 'off');
        track.setAttribute('data-no-drag', '');
        track.style.cssText = 'position:fixed;z-index:99998;display:flex;flex-direction:column;justify-content:center;padding:14px 16px 14px 6px;cursor:pointer;user-select:none;app-region:no-drag;-webkit-app-region:no-drag;';
        const list = document.createElement('div');
        list.setAttribute('data-wave-role', 'list');
        list.style.cssText = 'display:flex;flex-direction:column;gap:5px;align-items:flex-start;';
        track.appendChild(list);

        track.addEventListener('pointerenter', handleTrackPointer);
        track.addEventListener('pointermove', handleTrackPointer);
        track.addEventListener('mouseenter', handleTrackPointer);
        track.addEventListener('mousemove', handleTrackPointer);
        track.addEventListener('pointerleave', () => {
          isHoverTrack = false;
          scheduleHide();
        });
        track.addEventListener('mouseleave', () => {
          isHoverTrack = false;
          scheduleHide();
        });
        document.body.appendChild(track);
      }

      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'ag-codex-wave-popover';
        pop.setAttribute('data-local-zh', 'off');
        pop.setAttribute('data-no-drag', '');
        pop.style.cssText = 'position:fixed;z-index:99999;display:block;width:292px;padding:12px 14px;border-radius:12px;border:1px solid var(--border,rgba(128,128,128,0.22));background:var(--card,var(--background,#ffffff));box-shadow:0 10px 30px -5px rgba(0,0,0,0.18),0 4px 12px -2px rgba(0,0,0,0.08);backdrop-filter:blur(16px);opacity:0;pointer-events:none;transform:scale(0.96);transform-origin:left center;transition:opacity 130ms ease,transform 130ms ease;cursor:pointer;user-select:none;app-region:no-drag;-webkit-app-region:no-drag;';
        pop.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div data-wave-role="title" style="font-size:13px;font-weight:600;color:var(--foreground,#18181b);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;"></div>
            <button type="button" data-wave-action="bookmark" title="标记/收藏此轮对话" style="padding:2px;border:none;background:transparent;color:var(--muted-foreground,#71717a);cursor:pointer;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg data-wave-role="bm-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
              </svg>
            </button>
          </div>
          <div data-wave-role="line1" style="margin-top:6px;font-size:12.5px;line-height:1.45;color:var(--muted-foreground,#52525b);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;"></div>
          <div data-wave-role="line2" style="margin-top:6px;font-size:12px;line-height:1.4;color:var(--muted-foreground,#71717a);opacity:0.88;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
        `;
        const keepCardOpen = () => {
          if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
          isHoverCard = true;
          showPopover();
          startAnimLoop();
        };
        pop.addEventListener('pointerenter', keepCardOpen);
        pop.addEventListener('mouseenter', keepCardOpen);
        pop.addEventListener('pointerleave', () => {
          isHoverCard = false;
          scheduleHide();
        });
        pop.addEventListener('mouseleave', () => {
          isHoverCard = false;
          scheduleHide();
        });
        pop.addEventListener('click', e => {
          const bm = e.target.closest('[data-wave-action="bookmark"]');
          if (bm) {
            e.preventDefault();
            e.stopPropagation();
            const item = items[activeIdx];
            if (item) {
              if (bookmarks.has(item.key)) bookmarks.delete(item.key);
              else bookmarks.add(item.key);
              updatePopoverDom();
              startAnimLoop();
            }
            return;
          }
          scrollToItem(activeIdx);
        });
        document.body.appendChild(pop);
      }
      return { track, pop };
    };

    const positionTrackAndCard = (track, pop) => {
      const winH = window.innerHeight || 800;
      if (items.length === 0 || !items[0].targetEl) {
        return { top: 48, height: winH - 96, bottom: winH - 48, left: 240 };
      }
      const connectedItem = items.find(it => it.targetEl && it.targetEl.isConnected) || items[0];
      const scrollHost = findScrollParent(connectedItem.targetEl);
      if (scrollHost && scrollHost !== scrollBoundHost) {
        scrollBoundHost = scrollHost;
        scrollHost.addEventListener('scroll', () => {
          updateViewportActiveTurn();
          startAnimLoop();
        }, { passive: true });
      }
      const rawRect = scrollHost
        ? scrollHost.getBoundingClientRect()
        : connectedItem.targetEl.getBoundingClientRect();
      const topPx = Math.max(40, Math.min(winH - 120, rawRect.top > 0 ? rawRect.top : 48));
      const bottomPx = Math.max(topPx + 120, Math.min(winH - 16, rawRect.bottom > topPx + 80 ? rawRect.bottom : winH - 40));
      const leftPx = Math.max(4, Math.round(rawRect.left + 4));
      const midY = Math.round((topPx + bottomPx) / 2);
      track.style.left = `${leftPx}px`;
      track.style.top = `${midY}px`;
      track.style.transform = 'translateY(-50%)';
      pop.style.left = `${leftPx + 36}px`;
      return { top: topPx, bottom: bottomPx, height: bottomPx - topPx, left: leftPx };
    };

    const stepAnimation = () => {
      rafId = null;
      const track = document.getElementById('ag-codex-wave-scrubber');
      const pop = document.getElementById('ag-codex-wave-popover');
      if (!track || !pop || items.length === 0) return;

      const vpRect = positionTrackAndCard(track, pop);
      const activeWave = isHoverTrack || isHoverCard;

      if (activeWave && tickRows.length > 0) {
        showPopover();
        let closest = activeIdx;
        let minDist = Infinity;
        const centers = tickRows.map((row, i) => {
          const r = row.getBoundingClientRect();
          const cy = r.top + r.height / 2;
          if (mouseY !== null) {
            const d = Math.abs(cy - mouseY);
            if (d < minDist) {
              minDist = d;
              closest = i;
            }
          }
          return cy;
        });

        if (isHoverTrack && mouseY !== null && closest !== activeIdx) {
          activeIdx = closest;
          updatePopoverDom();
        }

        const anchorY = (isHoverTrack && mouseY !== null) ? mouseY : (centers[activeIdx] || vpRect.top + vpRect.height / 2);
        for (let i = 0; i < items.length; i++) {
          const d = Math.abs(centers[i] - anchorY);
          if (d < RADIUS) {
            const t = 1 - d / RADIUS;
            const wave = 0.5 * (1 - Math.cos(Math.PI * t));
            targetW[i] = BASE_W + (MAX_W - BASE_W) * wave;
            targetOp[i] = i === activeIdx ? 0.96 : (0.32 + 0.52 * wave);
          } else {
            const isBm = bookmarks.has(items[i].key);
            targetW[i] = isBm ? 8.5 : BASE_W;
            targetOp[i] = isBm ? 0.68 : 0.28;
          }
        }

        const popH = pop.offsetHeight || 108;
        const rawTop = (centers[activeIdx] || anchorY) - popH / 2;
        cardTargetY = Math.max(vpRect.top + 8, Math.min(vpRect.bottom - popH - 8, rawTop));
      } else {
        for (let i = 0; i < items.length; i++) {
          const isCur = i === viewportActiveIdx;
          const isBm = bookmarks.has(items[i].key);
          targetW[i] = isCur ? 10 : (isBm ? 8.5 : BASE_W);
          targetOp[i] = isCur ? 0.72 : (isBm ? 0.65 : 0.28);
        }
      }

      let moving = false;
      for (let i = 0; i < items.length; i++) {
        const dw = targetW[i] - curW[i];
        const dop = targetOp[i] - curOp[i];
        if (Math.abs(dw) > 0.04 || Math.abs(dop) > 0.004) moving = true;
        curW[i] += dw * LERP;
        curOp[i] += dop * LERP;
        const bar = tickBars[i];
        if (bar) {
          const isPeak = activeWave && i === activeIdx;
          const isBm = bookmarks.has(items[i].key);
          bar.style.width = `${curW[i].toFixed(2)}px`;
          bar.style.opacity = curOp[i].toFixed(3);
          bar.style.height = isPeak ? '2.2px' : '1.75px';
          bar.style.background = (isBm && !isPeak) ? '#f59e0b' : 'var(--foreground,#18181b)';
        }
      }

      const dCard = cardTargetY - cardCurY;
      if (Math.abs(dCard) > 0.2) moving = true;
      cardCurY += dCard * 0.26;
      pop.style.top = `${cardCurY.toFixed(1)}px`;

      if (moving || activeWave) {
        startAnimLoop();
      }
    };

    const startAnimLoop = () => {
      if (rafId !== null || typeof window.requestAnimationFrame !== 'function') return;
      rafId = window.requestAnimationFrame(stepAnimation);
    };

    const syncWaveScrubber = () => {
      const nextItems = collectTurnItems();
      if (nextItems.length === 0) {
        const existingTrack = document.getElementById('ag-codex-wave-scrubber');
        const existingPop = document.getElementById('ag-codex-wave-popover');
        if (existingTrack) existingTrack.style.display = 'none';
        if (existingPop) existingPop.style.display = 'none';
        return;
      }

      const { track, pop } = ensureMounted();
      track.style.display = 'flex';
      pop.style.display = 'block';
      const sig = nextItems.map(it => `${it.key}:${it.title}:${it.line1}:${it.line2}`).join('|');

      const totalItems = nextItems.length;
      const rowHeight = totalItems > 45 ? 6 : (totalItems > 25 ? 8 : 10);
      const gap = totalItems > 45 ? '2px' : (totalItems > 25 ? '3px' : (totalItems > 14 ? '4px' : '6px'));

      if (sig !== lastSig) {
        lastSig = sig;
        items = nextItems;
        const list = track.querySelector('[data-wave-role="list"]');
        list.style.gap = gap;

        while (tickRows.length > items.length) {
          const oldRow = tickRows.pop();
          tickBars.pop();
          curW.pop();
          targetW.pop();
          curOp.pop();
          targetOp.pop();
          if (oldRow && oldRow.parentNode) oldRow.parentNode.removeChild(oldRow);
        }

        while (tickRows.length < items.length) {
          const idx = tickRows.length;
          const row = document.createElement('div');
          row.style.cssText = `display:flex;align-items:center;height:${rowHeight}px;width:30px;`;
          const bar = document.createElement('div');
          bar.style.cssText = `width:${BASE_W}px;height:1.75px;border-radius:999px;background:var(--foreground,#18181b);opacity:0.3;will-change:width,opacity;`;
          row.appendChild(bar);
          row.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            scrollToItem(idx);
          });
          list.appendChild(row);
          tickRows.push(row);
          tickBars.push(bar);
          curW.push(BASE_W);
          targetW.push(BASE_W);
          curOp.push(0.3);
          targetOp.push(0.3);
        }

        for (let i = 0; i < tickRows.length; i++) {
          tickRows[i].style.height = `${rowHeight}px`;
        }

        if (activeIdx >= items.length) activeIdx = items.length - 1;
        updateViewportActiveTurn();
        updatePopoverDom();
      } else {
        items = nextItems;
        updateViewportActiveTurn();
      }

      positionTrackAndCard(track, pop);
      startAnimLoop();
    };

    syncWaveScrubber();
    backfillIfShort();
    if (window.__AG_WAVE_TIMER__) window.clearInterval(window.__AG_WAVE_TIMER__);
    window.__AG_WAVE_TIMER__ = window.setInterval(syncWaveScrubber, 1500);
    if (window.__AG_WAVE_TIMER__ && typeof window.__AG_WAVE_TIMER__.unref === 'function') {
      window.__AG_WAVE_TIMER__.unref();
    }
    window.addEventListener('resize', syncWaveScrubber);
    window.addEventListener('popstate', () => {
      window.setTimeout(() => {
        syncWaveScrubber();
        backfillIfShort();
      }, 120);
    });
  }
}

module.exports = localize;



