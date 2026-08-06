// ==UserScript==
// @name         Quick switching of AWS regions (Tokyo | N.Virginia)
// @namespace    aws-region-quick-switch
// @version      8.0
// @description  Add a quick switch button in the AWS top area (Tokyo | N.Virginia)
// @match        *://console.aws.amazon.com/*
// @match        *://*.console.aws.amazon.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TARGETS = [
    { code: 'ap-northeast-1', label: 'Tokyo' },
    { code: 'us-east-1', label: 'N.Virginia' }
  ];

  const MORE_MENU_BUTTON_SELECTOR = '[data-testid="awsc-nav-more-menu"]';
  // 区域(Regions)下拉触发按钮的 testid：折叠在"更多"面板里时是 more-menu__ 前缀，
  // 宽屏未折叠时可能是不带前缀的版本，两个都兼容一下
  const REGIONS_BUTTON_SELECTORS = [
    '[data-testid="more-menu__awsc-nav-regions-menu-button"]',
    '[data-testid="awsc-nav-regions-menu-button"]'
  ];
  // 设置齿轮触发按钮的 testid，同样两种前缀都兼容
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
    // 优先从 URL 的 region 参数判断当前区域，这个在页面刚加载完就有，
    // 不需要等区域下拉列表异步渲染/打勾，反应速度比读 --selected class 快得多
    try {
      const href = window.top.location.href;
      const match = href.match(/[?&#]region=([a-z0-9-]+)/i);
      if (match) return match[1];
    } catch (e) {
      // 跨域访问 window.top 失败时退回当前 frame 的 location
      const match = window.location.href.match(/[?&#]region=([a-z0-9-]+)/i);
      if (match) return match[1];
    }
    return null;
  }

  function isSelected(code, link) {
    const current = getCurrentRegionCode();
    if (current) return current === code;
    // 兜底：URL 里没有 region 参数时，才退回读列表里的 --selected class
    return !!link && /--selected/.test(link.className);
  }

  function goToRegion(code, tries = 0) {
    const link = getRegionLink(code);
    if (link && link.href) {
      window.top.location.href = link.href;
      return;
    }

    // 区域链接只有在"更多"面板 -> 区域(Regions)下拉都展开后才会渲染到 DOM 里，
    // 所以先后把这两层依次点开，再重试查找链接
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

    TARGETS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t.label;
      btn.title = t.code;
      btn.dataset.region = t.code;
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
      btn.addEventListener('click', () => goToRegion(t.code));
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function refreshActiveState(wrap) {
    if (!wrap) return;
    wrap.querySelectorAll('button[data-region]').forEach((btn) => {
      const active = isSelected(btn.dataset.region, getRegionLink(btn.dataset.region));
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

    // settingsBtn 的直接父级是包住"齿轮按钮 + 下拉面板"的 _nav-dropdown_ 容器，
    // 再往上一层的 <li> 就是设置齿轮自己独占的那个盒子，宽度只够放它一个图标按钮，
    // 不能往里面塞别的东西（会被挤到下一行）。所以改成新建一个同级 <li>，插在它后面。
    const settingsDropdownWrap = settingsBtn.closest('div[class*="_nav-dropdown_"]');
    const settingsLi = settingsDropdownWrap && settingsDropdownWrap.closest('li');

    if (settingsLi && settingsLi.dataset.arqPlaced !== '1') {
      settingsLi.dataset.arqPlaced = '1';

      const oldLi = document.getElementById(WIDGET_LI_ID);
      if (oldLi) oldLi.remove();

      const widget = buildWidget();
      const li = document.createElement('li');
      li.id = WIDGET_LI_ID;
      // 复用设置齿轮 <li> 的 class，保证跟"更多"面板里其它项的高度/间距行为一致，
      // 再额外加一层 flex 居中，避免这个盒子内部对齐基准跟原来装图标按钮时不一样
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

  // 轮询只是兜底，防止个别场景下 class 变化没能触发 MutationObserver
  setInterval(() => refreshActiveState(document.getElementById(WIDGET_ID)), 500);
})();
