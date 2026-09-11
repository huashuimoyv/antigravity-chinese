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
    '[data-local-zh="off"]'
  ].join(',');
  // Deliberately exclude generic div/span/body text: it may be a conversation or filename.
  const controls = 'button,[role="button"],[role="menuitem"],[role="tab"],[role="tooltip"],label,option';
  const attributes = ['title', 'aria-label', 'aria-description', 'placeholder'];
  const eligible = element => element && !element.closest(protectedSelector);
  function translate(value) {
    const key = value.trim().replace(/\s+/g, ' ');
    return Object.hasOwn(dictionary, key) ? value.replace(/\S[\s\S]*\S|\S/, dictionary[key]) : value;
  }
  function visit(node) {
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (eligible(parent) && parent.closest(controls)) {
        const next = translate(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1 || !eligible(node)) return;
    // Input values and application data attributes are never modified.
    for (const name of attributes) {
      if (!node.hasAttribute(name)) continue;
      const value = node.getAttribute(name);
      const next = translate(value);
      if (next !== value) node.setAttribute(name, next);
    }
    for (const child of node.childNodes) visit(child);
  }
  function start() {
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
          for (const node of pending) if (node.isConnected) visit(node);
        } finally {
          pending.clear();
          observer.observe(document.documentElement, options);
        }
      }, 32);
    });
    observer.observe(document.documentElement, options);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

module.exports = localize;
