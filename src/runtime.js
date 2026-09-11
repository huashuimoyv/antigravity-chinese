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
  const controls = 'button,[role="button"],[role="menuitem"],[role="tab"],[role="tooltip"],label,option,h1,h2,h3,h4,h5,h6,[role="heading"]';
  const panels = new WeakSet();
  let settingsPanel = null;
  const navigation = new Set(['New Conversation', 'Conversation History', 'Scheduled Tasks', 'Install IDE', 'Provide Feedback']);
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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

module.exports = localize;
