// 导航功能模块

import { elements } from './constants.js';

const ACTIVE_SECTION_STORAGE_KEY = 'activeSection';

function saveActiveSection(sectionId) {
    if (!sectionId) return;
    try {
        localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, sectionId);
    } catch (error) {
        console.warn('保存页面状态失败:', error);
    }
}

function getSavedActiveSection() {
    try {
        return localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

function getHashSection() {
    if (!window.location.hash) return '';
    return decodeURIComponent(window.location.hash.slice(1)).trim();
}

function isSectionAvailable(sectionId) {
    if (!sectionId) return false;

    const section = document.getElementById(sectionId);
    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);

    if (!section || !navItem) return false;
    return window.getComputedStyle(navItem).display !== 'none';
}

function getFirstAvailableSection() {
    const navItems = Array.from(elements.navItems || []);
    const firstVisible = navItems.find((item) => window.getComputedStyle(item).display !== 'none');
    return firstVisible?.dataset.section || 'dashboard';
}

/**
 * 初始化导航功能
 */
function initNavigation() {
    if (!elements.navItems || !elements.sections) {
        console.warn('导航元素未找到');
        return;
    }

    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;
            switchToSection(sectionId);
        });
    });

    const currentHashSection = getHashSection();
    const savedSection = getSavedActiveSection();
    const defaultSection = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
    const fallbackSection = getFirstAvailableSection();

    const initialSection = [currentHashSection, savedSection, defaultSection, fallbackSection]
        .find(isSectionAvailable) || fallbackSection;

    switchToSection(initialSection, { save: false, updateHash: false });
}

/**
 * 切换到指定章节
 * @param {string} sectionId - 章节ID
 */
function switchToSection(sectionId, options = {}) {
    const { save = true, updateHash = true } = options;

    if (!isSectionAvailable(sectionId)) {
        return;
    }

    // 更新导航状态
    elements.navItems.forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.section === sectionId) {
            nav.classList.add('active');
        }
    });

    // 显示对应章节
    elements.sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
            
            // 如果是日志页面，默认滚动到底部
            if (sectionId === 'logs') {
                setTimeout(() => {
                    const logsContainer = document.getElementById('logsContainer');
                    if (logsContainer) {
                        logsContainer.scrollTop = logsContainer.scrollHeight;
                    }
                }, 100);
            }
        }
    });

    if (save) {
        saveActiveSection(sectionId);
    }

    if (updateHash) {
        history.replaceState(null, '', `#${encodeURIComponent(sectionId)}`);
    }

    // 滚动到顶部
    scrollToTop();
}

/**
 * 滚动到页面顶部
 */
function scrollToTop() {
    // 尝试滚动内容区域
    const contentContainer = document.getElementById('content-container');
    if (contentContainer) {
        contentContainer.scrollTop = 0;
    }
    
    // 同时滚动窗口到顶部
    window.scrollTo(0, 0);
}

/**
 * 切换到仪表盘页面
 */
function switchToDashboard() {
    switchToSection('dashboard');
}

/**
 * 切换到提供商页面
 */
function switchToProviders() {
    switchToSection('providers');
}

export {
    initNavigation,
    switchToSection,
    switchToDashboard,
    switchToProviders
};
