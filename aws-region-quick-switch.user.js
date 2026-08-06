// ==UserScript==
// @name         Quick switching of AWS regions (Tokyo | N.Virginia)
// @namespace    aws-region-quick-switch
// @version      9.2
// @description  Add a quick switch button in the AWS top area (Tokyo | N.Virginia)
// @match        *://console.aws.amazon.com/*
// @match        *://*.console.aws.amazon.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/amaoo/monkeyScript/main/aws-region-quick-switch.user.js
// @downloadURL  https://raw.githubusercontent.com/amaoo/monkeyScript/main/aws-region-quick-switch.user.js
// ==/UserScript==

(function () {
  'use strict';

  const TARGET_CODES = ['ap-northeast-1', 'us-east-1'];

  // 全球服务的 URL 路径关键词（不区分大小写）
  const GLOBAL_SERVICE_PATTERNS = [
    'cloudfront',
    'route53',
    'iam',
    'waf',
    'shield',
    'budgets',
    'organizations',
    'route53domains',
    'globalaccelerator'
  ];

  // 按 AWS 控制台当前界面语言显示对应文案，默认英文
  const LABELS = {
    en: { 'ap-northeast-1': 'Tokyo', 'us-east-1': 'N. Virginia', 'global': 'Global' },
    zh: { 'ap-northeast-1': '东京', 'us-east-1': '弗吉尼亚北部', 'global': '全球' },
    ja: { 'ap-northeast-1': '東京', 'us-east-1': 'バージニア北部', 'global': 'グローバル' }
  };

  function detectLangKey() {
    let lang = '';
    try {
      lang = (document.documentElement.lang || navigator.language || '').toLowerCase();
    } catch (e) {
      lang = (navigator.language || '').toLowerCase();
    }
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ja')) return 'ja';
    return 'en';
  }

  function getLabel(code) {
    const key = detectLangKey();
    return (LABELS[key] && LABELS[key][code]) || LABELS.en[code] || code;
  }

  function isGlobalService() {
    try {
      const href = window.location.href.toLowerCase();
      return GLOBAL_SERVICE_PATTERNS.some(pattern => href.includes(pattern));
    } catch (e) {
      return false;
    }
  }

  const MORE_MENU_BUTTON_SELECTOR = '[data-testid="awsc-nav-more-menu"]';
  const REGIONS_BUTTON_SELECTORS = [
    '[data-testid="more-menu__awsc-nav-regions-menu-button"]',
    '[data-testid="awsc-nav-regions-menu-button"]'
  ];
  const SETTINGS_BUTTON_SELECTORS = [
    '[data-testid="more-menu__awsc-nav-quick-settings-button"]',
    '[data-testid="awsc-nav-quick-settings-button"]'
  ];
  const WIDGET_ID = 'arq-inline-switch';
  const WIDGET_LI_ID = 'arq-inline-switch-li';

  function getRegionsButton() {
    for (const sel of REGIONS_BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getSettingsButton() {
    for (const sel of SETTINGS_BUTTON_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function getRegionLink(code) {
    return document.querySelector(`a[data-region-id="${code}"]`);
  }

  function getCurrentRegionCode() {
    try {
      const href = window.top.location.href;
      const match = href.match(/[?&#]region=([a-z0-9-]+)/i);
      if (match) return match[1];
    } catch (e) {
      const match = window.location.href.match(/[?&#]region=([a-z0-9-]+)/i);
      if (match) return match[1];
    }
    return null;
  }

  function isSelected(code, link) {
    // 全球服务特殊处理
    if (code === 'global') return isGlobalService();

    const current = getCurrentRegionCode();
    if (current) return current === code;
    return !!link && /--selected/.test(link.className);
  }

  function goToRegion(code, tries = 0) {
    // 全球服务不跳转
    if (code === 'global') return;

    const link = getRegionLink(code);
    if (link && link.href) {
      window.top.location.href = link.href;
      return;
    }

    if (tries === 0) {
      const moreBtn = document.querySelector(MORE_MENU_BUTTON_SELECTOR);
      if (moreBtn && moreBtn.getAttribute('aria-expanded') !== 'true') moreBtn.click();
    }
    if (tries === 1) {
      const regionsBtn = getRegionsButton();
      if (regionsBtn && regionsBtn.getAttribute('aria-expanded') !== 'true') regionsBtn.click();
    }

    if (tries < 8) {
      setTimeout(() => goToRegion(code, tries + 1), 150);
    } else {
      console.warn('[AWS Region Quick Switch] Region link not found：', code);
    }
  }

  function buildWidget() {
    const wrap = document.createElement('div');
    wrap.id = WIDGET_ID;
    wrap.style.cssText = `
      display:inline-flex;
      align-items:center;
      flex:0 0 auto;
      margin:0 2px;
      height:20px;
      border:1px solid rgba(255,255,255,0.28);
      border-radius:11px;
      overflow:hidden;
      vertical-align:middle;
    `;

    if (isGlobalService()) {
      // 全球服务：显示单个按钮
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = getLabel('global');
      btn.title = 'Global Service';
      btn.dataset.region = 'global';
      btn.style.cssText = `
        border:none;
        background:transparent;
        color:#d5dde8;
        font-size:11px;
        line-height:18px;
        height:18px;
        padding:0 7px;
        cursor:default;
        white-space:nowrap;
        font-family:inherit;
        flex:0 0 auto;
        transition:background .12s;
      `;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // 全球服务点击无动作
      });
      wrap.appendChild(btn);
    } else {
      // 区域服务：显示两个区域按钮
      TARGET_CODES.forEach((code, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = getLabel(code);
        btn.title = code;
        btn.dataset.region = code;
        btn.style.cssText = `
          border:none;
          ${i === 0 ? 'border-right:1px solid rgba(255,255,255,0.22);' : ''}
          background:transparent;
          color:#d5dde8;
          font-size:11px;
          line-height:18px;
          height:18px;
          padding:0 7px;
          cursor:pointer;
          white-space:nowrap;
          font-family:inherit;
          flex:0 0 auto;
          transition:background .12s;
        `;
        btn.addEventListener('mouseenter', () => {
          if (btn.dataset.active !== '1') btn.style.background = 'rgba(255,255,255,0.14)';
        });
        btn.addEventListener('mouseleave', () => {
          if (btn.dataset.active !== '1') btn.style.background = 'transparent';
        });
        btn.addEventListener('click', () => goToRegion(code));
        wrap.appendChild(btn);
      });
    }

    return wrap;
  }

  function refreshActiveState(wrap) {
    if (!wrap) return;
    const globalService = isGlobalService();

    wrap.querySelectorAll('button[data-region]').forEach((btn) => {
      const code = btn.dataset.region;
      let active;

      if (globalService) {
        // 全球服务时只有全球按钮高亮
        active = (code === 'global');
      } else {
        // 区域服务时按正常逻辑判断
        active = isSelected(code, getRegionLink(code));
      }

      btn.dataset.active = active ? '1' : '0';
      btn.style.background = active ? '#ec7211' : 'transparent';
      btn.style.color = active ? '#fff' : '#d5dde8';
      btn.style.fontWeight = active ? '600' : '400';
    });
  }

  function process() {
    const settingsBtn = getSettingsButton();
    if (!settingsBtn) {
      refreshActiveState(document.getElementById(WIDGET_ID));
      return;
    }

    const settingsDropdownWrap = settingsBtn.closest('div[class*="_nav-dropdown_"]');
    const settingsLi = settingsDropdownWrap && settingsDropdownWrap.closest('li');

    if (settingsLi && settingsLi.dataset.arqPlaced !== '1') {
      settingsLi.dataset.arqPlaced = '1';

      const oldLi = document.getElementById(WIDGET_LI_ID);
      if (oldLi) oldLi.remove();

      const widget = buildWidget();
      const li = document.createElement('li');
      li.id = WIDGET_LI_ID;
      li.className = settingsLi.className;
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.appendChild(widget);

      settingsLi.insertAdjacentElement('afterend', li);
    }

    refreshActiveState(document.getElementById(WIDGET_ID));
  }

  process();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      process();
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // 轮询更新高亮状态，同时检测服务类型变化（用户可能在不同服务间切换）
  setInterval(() => {
    refreshActiveState(document.getElementById(WIDGET_ID));
  }, 500);
})();
