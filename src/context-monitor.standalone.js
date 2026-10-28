'use strict';

/**
 * Antigravity 顶栏上下文监视器 & 模型额度联动独立插件
 * 功能特性：
 * 1. 嗅探 CSRF Token 与当前会话 ID
 * 2. 通过 Connect-RPC 拉取上下文 token 构成与 Prompt 缓存命中率
 * 3. 通过 Connect-RPC 实时拉取模型用量额度，并与当前选中的模型动态联动：
 *    - Gemini 4 Argon: 展示周额度 (如 G4周额 61% (3d16h))
 *    - Gemini 系列 (Flash/Pro): 展示 5 小时额度 (如 5h额度 96% (4h22m))
 *    - Claude & GPT 系列: 展示 5 小时额度 (如 5h额度 100%)
 * 4. 常驻顶栏精简为：主用量百分比 + 三段式图形进度条 + 缓存命中率 + 模型额度徽章
 * 5. 点击弹出毛玻璃卡片，支持上下文详细拆解与三大模型类别用量大盘
 */
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
  let cachedQuota = null;
  let lastQuotaFetchTime = 0;

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

  const formatResetCountdown = isoStr => {
    if (!isoStr) return '';
    try {
      const diffMs = new Date(isoStr).getTime() - Date.now();
      if (diffMs <= 0) return '即将重置';
      const totalMins = Math.floor(diffMs / 60000);
      const days = Math.floor(totalMins / 1440);
      const hours = Math.floor((totalMins % 1440) / 60);
      const mins = totalMins % 60;
      if (days > 0) return `${days}d${hours}h`;
      if (hours > 0) return `${hours}h${mins}m`;
      return `${mins}m`;
    } catch {
      return '';
    }
  };

  const parseQuotaGroups = groups => {
    if (!Array.isArray(groups)) return null;
    const res = { gemini5h: null, geminiWeekly: null, claude5h: null, claudeWeekly: null, argonWeekly: null };
    for (const g of groups) {
      const dName = (g.displayName || '').toLowerCase();
      for (const b of (g.buckets || [])) {
        const bId = (b.bucketId || '').toLowerCase();
        const pct = Math.round((Number(b.remainingFraction) || 0) * 100);
        const countdown = formatResetCountdown(b.resetTime);
        const item = { name: b.displayName, pct, countdown, rawFraction: b.remainingFraction };
        if (dName.includes('gemini 4') || bId.includes('argon')) {
          res.argonWeekly = item;
        } else if (dName.includes('claude') || dName.includes('gpt') || bId.includes('3p')) {
          if (b.window === '5h' || bId.includes('5h')) res.claude5h = item;
          else res.claudeWeekly = item;
        } else if (dName.includes('gemini')) {
          if (b.window === '5h' || bId.includes('5h')) res.gemini5h = item;
          else res.geminiWeekly = item;
        }
      }
    }
    return res;
  };

  const fetchUserQuotaSummary = async (force = false) => {
    const now = Date.now();
    if (!force && cachedQuota && (now - lastQuotaFetchTime < 15000)) return cachedQuota;
    const token = getCsrfToken();
    if (!token) return cachedQuota;
    try {
      const res = await window.fetch('/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': token
        },
        body: JSON.stringify({})
      });
      if (!res.ok) return cachedQuota;
      const json = await res.json();
      const groups = json?.response?.groups || [];
      cachedQuota = parseQuotaGroups(groups);
      lastQuotaFetchTime = now;
      renderAll();
      return cachedQuota;
    } catch {
      return cachedQuota;
    }
  };

  const getActiveModelCategory = activeInfo => {
    const selectorBtn = document.querySelector('[data-testid="model-selector-trigger"]');
    const selectorText = selectorBtn ? selectorBtn.textContent.trim().toLowerCase() : '';
    const candidate = (selectorText || activeInfo?.modelName || '').toLowerCase();
    if (candidate.includes('argon') || candidate.includes('gemini 4') || candidate.includes('gemini-4') || candidate.includes('g4')) {
      return 'argon';
    }
    if (candidate.includes('claude') || candidate.includes('sonnet') || candidate.includes('opus') || candidate.includes('gpt')) {
      return 'claude';
    }
    return 'gemini';
  };

  const getActiveQuotaBadge = (quota, activeInfo) => {
    if (!quota) return null;
    const cat = getActiveModelCategory(activeInfo);
    let target = null;
    let prefix = '';

    if (cat === 'argon') {
      target = quota.argonWeekly || quota.geminiWeekly;
      prefix = 'G4周额';
    } else if (cat === 'claude') {
      target = quota.claude5h || quota.claudeWeekly;
      prefix = '5h额度';
    } else {
      target = quota.gemini5h || quota.geminiWeekly;
      prefix = '5h额度';
    }

    if (!target) return null;
    const pct = target.pct;
    const color = pct >= 50 ? '#34d399' : (pct >= 20 ? '#fbbf24' : '#f43f5e');
    return { prefix, pct, countdown: target.countdown, color };
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

  const buildPopoverHtml = (info, quota) => {
    if (!info || info.used === 0) return '';
    const max = info.max || 256000;
    const msgColor = info.pct >= 75 ? '#f43f5e' : '#f59e0b';
    const cacheRatio = (info.uncachedIn + info.cachedIn) > 0
      ? Math.round((info.cachedIn / (info.uncachedIn + info.cachedIn)) * 100)
      : 0;

    const qColor = pct => (pct >= 50 ? '#34d399' : (pct >= 20 ? '#fbbf24' : '#f43f5e'));

    const quotaSection = quota ? `
      <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(128,128,128,0.18);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:var(--foreground,#e5e7eb);">模型用量额度概览</span>
          <span style="font-size:10px;color:var(--muted-foreground,#9ca3af);">剩余 (重置倒计时)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;font-size:11px;">
          ${quota.argonWeekly ? `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#c084fc;">Gemini 4 Argon (周额度)</span>
              <span style="font-variant-numeric:tabular-nums;color:${qColor(quota.argonWeekly.pct)};font-weight:600;">
                ${quota.argonWeekly.pct}% ${quota.argonWeekly.countdown ? `<small style="font-size:9.5px;opacity:0.85;font-weight:normal;">(${quota.argonWeekly.countdown})</small>` : ''}
              </span>
            </div>
          ` : ''}
          ${quota.gemini5h ? `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#38bdf8;">Gemini 系列 (5小时)</span>
              <span style="font-variant-numeric:tabular-nums;color:${qColor(quota.gemini5h.pct)};font-weight:600;">
                ${quota.gemini5h.pct}% ${quota.gemini5h.countdown ? `<small style="font-size:9.5px;opacity:0.85;font-weight:normal;">(${quota.gemini5h.countdown})</small>` : ''}
              </span>
            </div>
          ` : ''}
          ${quota.claude5h ? `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#fb923c;">Claude & GPT (5小时)</span>
              <span style="font-variant-numeric:tabular-nums;color:${qColor(quota.claude5h.pct)};font-weight:600;">
                ${quota.claude5h.pct}% ${quota.claude5h.countdown ? `<small style="font-size:9.5px;opacity:0.85;font-weight:normal;">(${quota.claude5h.countdown})</small>` : ''}
              </span>
            </div>
          ` : ''}
        </div>
      </div>
    ` : '';

    return `
      ${quotaSection}
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

  const buildTitlebarHtml = (info, quota) => {
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

    const qb = getActiveQuotaBadge(quota, info);

    return `
      <div data-ag-action="toggle-popover" title="点击展开/收起详细上下文与模型额度" style="display:inline-flex;align-items:center;gap:7px;height:100%;cursor:pointer;">
        <span style="display:inline-flex;align-items:center;gap:4px;font-weight:600;color:${c.fg};font-variant-numeric:tabular-nums;white-space:nowrap;">
          <span style="width:6px;height:6px;border-radius:999px;background:${c.fg};"></span>
          <span>${fmtK(info.used)} / ${fmtK(max)} (${info.pct.toFixed(1)}%)</span>
        </span>
        <div style="width:76px;height:6px;border-radius:999px;background:rgba(128,128,128,0.2);overflow:hidden;display:flex;flex-shrink:0;" title="上下文构成：系统 ${(sysPct).toFixed(1)}% / 工具 ${(toolsPct).toFixed(1)}% / 消息 ${(msgPct).toFixed(1)}%">
          <div style="width:${sysPct.toFixed(2)}%;background:#6366f1;height:100%;"></div>
          <div style="width:${toolsPct.toFixed(2)}%;background:#06b6d4;height:100%;"></div>
          <div style="width:${msgPct.toFixed(2)}%;background:${msgColor};height:100%;"></div>
        </div>
        <span style="width:1px;height:12px;background:rgba(128,128,128,0.22);flex-shrink:0;"></span>
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;">
          <span style="color:#34d399;font-weight:500;">缓存 ${cacheRatio}%</span>
          ${qb ? `
            <span style="width:1px;height:10px;background:rgba(128,128,128,0.18);flex-shrink:0;"></span>
            <span style="display:inline-flex;align-items:center;gap:3px;color:${qb.color};font-weight:500;">
              <span style="width:5px;height:5px;border-radius:999px;background:${qb.color};"></span>
              <span>${qb.prefix} ${qb.pct}%</span>
              ${qb.countdown ? `<span style="font-size:10px;opacity:0.85;">(${qb.countdown})</span>` : ''}
            </span>
          ` : ''}
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
        if (cardExpanded) fetchUserQuotaSummary(true);
        renderAll(true);
      }
    });
  };

  const renderTitlebarWidget = (activeInfo, quota) => {
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

    const qb = getActiveQuotaBadge(quota, activeInfo);
    const qSig = qb ? `${qb.prefix}:${qb.pct}:${qb.countdown}` : 'noq';
    const sig = (activeInfo ? activeInfo.sig : 'none') + ':' + (cardExpanded ? '1' : '0') + ':' + qSig;
    if (bar.getAttribute('data-sig') !== sig) {
      bar.setAttribute('data-sig', sig);
      bar.innerHTML = buildTitlebarHtml(activeInfo, quota);
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
      pop.style.cssText = 'position:fixed;z-index:9999;width:320px;padding:10px 12px;border-radius:8px;border:1px solid var(--border,rgba(128,128,128,0.25));background:var(--card,var(--background,#18181b));box-shadow:0 10px 25px rgba(0,0,0,0.35);user-select:none;app-region:no-drag;-webkit-app-region:no-drag;';
      document.body.appendChild(pop);
      bindEvents(pop);
    }
    const rect = bar.getBoundingClientRect();
    pop.style.display = 'block';
    pop.style.top = `${Math.round(rect.bottom + 6)}px`;
    pop.style.left = `${Math.max(8, Math.round(rect.right - 320))}px`;
    if (pop.getAttribute('data-sig') !== sig) {
      pop.setAttribute('data-sig', sig);
      pop.innerHTML = buildPopoverHtml(activeInfo, quota);
    }
  };

  const renderAll = (force = false) => {
    const activeCid = getActiveCascadeId();
    if (activeCid && !cache.has(activeCid)) {
      fetchCascadeContext(activeCid, true);
    }
    if (!cachedQuota) {
      fetchUserQuotaSummary();
    }
    const activeInfo = activeCid ? cache.get(activeCid) : null;
    if (force) {
      const b = document.getElementById('ag-titlebar-context-bar');
      if (b) b.removeAttribute('data-sig');
      const p = document.getElementById('ag-titlebar-context-popover');
      if (p) p.removeAttribute('data-sig');
    }
    renderTitlebarWidget(activeInfo, cachedQuota);
  };

  renderAll();
  if (window.__AG_CTX_TIMER__) window.clearInterval(window.__AG_CTX_TIMER__);
  window.__AG_CTX_TIMER__ = window.setInterval(() => {
    const activeCid = getActiveCascadeId();
    if (activeCid) fetchCascadeContext(activeCid, true);
    fetchUserQuotaSummary();
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = startContextMonitor;
}
