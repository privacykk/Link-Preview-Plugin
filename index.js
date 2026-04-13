// Link Preview Plugin - Content Script
// 设计原则：最小化全局事件监听，按需动态绑定

'use strict';
console.log('LinkPreviewPlugin: 开始加载...');

// ========== 状态变量 ==========
let modalContainer = null;
let modalOverlay = null;
let currentIframe = null;
let isModalActive = false;
let isMinimized = false;
let minimizeIcon = null;

// 弹窗拖拽状态
let modalDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
};

// 链接拖拽状态
let linkDragState = {
    isDragging: false,
    link: null,
    startX: 0,
    startY: 0
};

// ========== 创建弹窗 ==========
function createModal() {
    if (modalContainer) return modalContainer;

    console.log('创建弹窗...');

    // 创建遮罩层
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modal-overlay';
    modalOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483646 !important;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  `;

    // 创建弹窗容器
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-container';
    modalContainer.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 80% !important;
    height: 80% !important;
    max-width: 1200px !important;
    max-height: 800px !important;
    min-width: 400px !important;
    min-height: 300px !important;
    background: #ffffff !important;
    border-radius: 12px !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  `;

    // 工具栏（默认不可拖拽）
    const toolbar = document.createElement('div');
    toolbar.id = 'modal-toolbar';
    toolbar.style.cssText = `
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 12px 16px !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border-bottom: 1px solid #e0e0e0 !important;
    user-select: none !important;
    cursor: default !important;
  `;

    // 标题容器
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    pointer-events: none !important;
  `;

    const title = document.createElement('div');
    title.id = 'modal-title';
    title.textContent = '链接预览';
    title.style.cssText = `
    color: white !important;
    font-weight: 600 !important;
    font-size: 14px !important;
  `;

    const urlDisplay = document.createElement('div');
    urlDisplay.id = 'modal-url';
    urlDisplay.style.cssText = `
    color: rgba(255, 255, 255, 0.7) !important;
    font-size: 12px !important;
    max-width: 300px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  `;

    titleContainer.appendChild(title);
    titleContainer.appendChild(urlDisplay);

    // 按钮区域
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
    display: flex !important;
    gap: 8px !important;
  `;

    // 新标签页按钮
    const openNewTab = document.createElement('button');
    openNewTab.innerHTML = '新标签页';
    openNewTab.style.cssText = `
    border: none !important;
    background: rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    cursor: pointer !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    font-size: 12px !important;
  `;
    openNewTab.onmouseenter = () => openNewTab.style.background = 'rgba(255, 255, 255, 0.3)';
    openNewTab.onmouseleave = () => openNewTab.style.background = 'rgba(255, 255, 255, 0.2)';
    openNewTab.onclick = (e) => {
        e.stopPropagation();
        if (currentIframe?.src) window.open(currentIframe.src, '_blank');
    };

    // 最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.innerHTML = '−';
    minimizeBtn.title = '最小化';
    minimizeBtn.style.cssText = `
    border: none !important;
    background: rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    cursor: pointer !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: bold !important;
  `;
    minimizeBtn.onmouseenter = () => minimizeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    minimizeBtn.onmouseleave = () => minimizeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    minimizeBtn.onclick = (e) => {
        e.stopPropagation();
        minimizeModal();
    };

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.title = '关闭';
    closeBtn.style.cssText = `
    border: none !important;
    background: rgba(255, 255, 255, 0.2) !important;
    color: white !important;
    cursor: pointer !important;
    padding: 6px 12px !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: bold !important;
  `;
    closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255, 0, 0, 0.3)';
    closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
    };

    buttonsContainer.appendChild(openNewTab);
    buttonsContainer.appendChild(minimizeBtn);
    buttonsContainer.appendChild(closeBtn);

    toolbar.appendChild(titleContainer);
    toolbar.appendChild(buttonsContainer);

    // 内容区域
    const content = document.createElement('div');
    content.id = 'modal-content';
    content.style.cssText = `
    flex: 1 !important;
    position: relative !important;
    overflow: hidden !important;
    background: white !important;
  `;

    modalContainer.appendChild(toolbar);
    modalContainer.appendChild(content);
    document.body.appendChild(modalOverlay);
    document.body.appendChild(modalContainer);

    // ========== 局部事件监听（零全局污染）==========
    // 遮罩层点击
    modalOverlay.addEventListener('mousedown', () => {
        modalOverlay.style.opacity = '0';
        modalOverlay.style.pointerEvents = 'none';
    });

    // 工具栏拖拽 - 动态绑定全局事件
    toolbar.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        // 只有加载成功后才允许拖拽
        if (toolbar.style.cursor !== 'move') return;

        const rect = modalContainer.getBoundingClientRect();
        modalDragState.isDragging = true;
        modalDragState.startX = e.clientX;
        modalDragState.startY = e.clientY;
        modalDragState.startLeft = rect.left;
        modalDragState.startTop = rect.top;

        modalContainer.style.transform = 'none';
        modalContainer.style.left = rect.left + 'px';
        modalContainer.style.top = rect.top + 'px';

        // 动态添加全局监听（拖拽期间）
        document.addEventListener('mousemove', handleModalDragMove, true);
        document.addEventListener('mouseup', handleModalDragEnd, true);
        e.preventDefault();
    });

    console.log('弹窗创建完成');
    return modalContainer;
}

// ========== 弹窗拖拽处理 ==========
function handleModalDragMove(e) {
    if (!modalDragState.isDragging) return;
    e.preventDefault();

    const newLeft = modalDragState.startLeft + (e.clientX - modalDragState.startX);
    const newTop = modalDragState.startTop + (e.clientY - modalDragState.startY);

    // 边界限制
    const maxLeft = window.innerWidth - 100;
    const maxTop = window.innerHeight - 100;

    if (newLeft >= 0 && newLeft <= maxLeft && newTop >= 0 && newTop <= maxTop) {
        modalContainer.style.left = newLeft + 'px';
        modalContainer.style.top = newTop + 'px';
    }
}

function handleModalDragEnd(e) {
    if (!modalDragState.isDragging) return;
    modalDragState.isDragging = false;

    // 移除动态监听（拖拽结束）
    document.removeEventListener('mousemove', handleModalDragMove, true);
    document.removeEventListener('mouseup', handleModalDragEnd, true);
}

// ========== 链接拖拽处理 ==========
function handleLinkDragStart(e) {
    const link = e.target.closest('a');
    if (!link || !isValidLink(link)) return;
    if (modalContainer?.contains(e.target)) return;

    linkDragState.link = link;
    linkDragState.startX = e.clientX;
    linkDragState.startY = e.clientY;

    // 动态添加全局监听（拖拽链接期间）
    document.addEventListener('mouseup', handleLinkDragEnd, true);
}

function handleLinkDragEnd(e) {
    document.removeEventListener('mouseup', handleLinkDragEnd, true);

    if (!linkDragState.link) return;

    const deltaX = Math.abs(e.clientX - linkDragState.startX);
    const deltaY = Math.abs(e.clientY - linkDragState.startY);

    if (deltaX > 5 || deltaY > 5) {
        // 是拖拽，阻止后续事件
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openLinkInModal(linkDragState.link.href, linkDragState.link.textContent.trim());

        // 短暂标记，防止click触发
        linkDragState.isDragging = true;
        setTimeout(() => {
            linkDragState.isDragging = false;
            linkDragState.link = null;
        }, 50);
    } else {
        linkDragState.link = null;
    }
}

// ========== 打开链接 ==========
function openLinkInModal(url, linkText = '链接预览') {
    if (!modalContainer) createModal();

    const content = document.getElementById('modal-content');
    const titleEl = document.getElementById('modal-title');
    const urlEl = document.getElementById('modal-url');

    if (!content) return;

    if (titleEl) titleEl.textContent = linkText || '链接预览';
    if (urlEl) {
        urlEl.textContent = url;
        urlEl.title = url;
    }

    currentIframe?.remove();
    currentIframe = document.createElement('iframe');
    currentIframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: white !important;
  `;
    currentIframe.src = url;
    currentIframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation';

    const loader = document.createElement('div');
    loader.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="width: 40px; height: 40px; border: 3px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
    loader.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: white !important;
  `;

    content.appendChild(loader);
    content.appendChild(currentIframe);

    currentIframe.onload = () => {
        loader.remove();
        // 加载成功后允许拖拽
        const toolbar = document.getElementById('modal-toolbar');
        if (toolbar) toolbar.style.cursor = 'move';
    };

    currentIframe.onerror = () => {
        loader.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">加载失败</div>';
        // 加载失败也允许拖拽（用户可以关闭）
        const toolbar = document.getElementById('modal-toolbar');
        if (toolbar) toolbar.style.cursor = 'move';
    };

    showModal();
}

// ========== 显示/关闭弹窗 ==========
function showModal() {
    if (isModalActive) return;
    isModalActive = true;

    if (modalContainer) {
        modalContainer.style.opacity = '1';
        modalContainer.style.pointerEvents = 'auto';
    }
}

function closeModal() {
    if (!isModalActive && !isMinimized) return;
    isModalActive = false;
    isMinimized = false;

    modalOverlay.style.opacity = '0';
    modalOverlay.style.pointerEvents = 'none';
    modalContainer.style.opacity = '0';
    modalContainer.style.pointerEvents = 'none';
    modalContainer.style.transform = 'translate(-50%, -50%)';
    modalContainer.style.left = '50%';
    modalContainer.style.top = '50%';

    // 移除最小化图标
    if (minimizeIcon) {
        minimizeIcon.remove();
        minimizeIcon = null;
    }

    // 重置工具栏状态（禁止拖拽）
    const toolbar = document.getElementById('modal-toolbar');
    if (toolbar) toolbar.style.cursor = 'default';
}

// ========== 最小化/恢复 ==========
function minimizeModal() {
    if (!isModalActive || isMinimized) return;
    isMinimized = true;
    isModalActive = false;

    // 隐藏弹窗
    modalContainer.style.opacity = '0';
    modalContainer.style.pointerEvents = 'none';
    modalOverlay.style.opacity = '0';
    modalOverlay.style.pointerEvents = 'none';

    // 创建最小化图标
    if (!minimizeIcon) {
        minimizeIcon = document.createElement('div');
        minimizeIcon.id = 'modal-minimize-icon';
        minimizeIcon.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 56px !important;
      height: 56px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      border-radius: 50% !important;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      font-size: 24px !important;
      color: white !important;
      transition: transform 0.2s ease, box-shadow 0.2s ease !important;
    `;
        minimizeIcon.innerHTML = '◀';
        minimizeIcon.title = '点击恢复预览窗口';
        minimizeIcon.onmouseenter = () => {
            minimizeIcon.style.transform = 'scale(1.1)';
            minimizeIcon.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
        };
        minimizeIcon.onmouseleave = () => {
            minimizeIcon.style.transform = 'scale(1)';
            minimizeIcon.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        };
        minimizeIcon.onclick = () => restoreModal();
        document.body.appendChild(minimizeIcon);
    }
}

function restoreModal() {
    if (!isMinimized || isModalActive) return;
    isMinimized = false;
    isModalActive = true;

    // 显示弹窗
    modalContainer.style.opacity = '1';
    modalContainer.style.pointerEvents = 'auto';
    modalOverlay.style.opacity = '0';
    modalOverlay.style.pointerEvents = 'none';
}

// ========== 辅助函数 ==========
function isValidLink(link) {
    if (!link) return false;
    const href = link.getAttribute('href');
    return href &&
        !href.startsWith('#') &&
        !href.startsWith('javascript:') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:');
}

// ========== 全局事件处理 ==========
function handleClick(e) {
    // 阻止拖拽后的点击
    if (linkDragState.isDragging) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
    }

    // 弹窗激活时拦截
    if (isModalActive) {
        const link = e.target.closest('a');
        if (link && isValidLink(link) && !modalContainer?.contains(e.target)) {
            e.preventDefault();
            e.stopPropagation();
            openLinkInModal(link.href, link.textContent.trim());
        }
    }
}

// ========== 初始化 ==========
function init() {
    // 仅3个必要的全局监听
    document.addEventListener('mousedown', handleLinkDragStart, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isModalActive) closeModal();
    });

    console.log('插件初始化完成（最小化全局监听）');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
