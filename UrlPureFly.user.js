// ==UserScript==
// @name         UrlPureFly - URL净化助手
// @namespace    https://github.com/ChitoseRaame/UrlPureFly
// @version      2.0.0
// @description  一键净化当前网页的跟踪URL参数，支持pURLfy规则格式，可自定义按钮位置
// @author       ChitoseRaame
// @icon         https://github.com/ChitoseRaame/UrlPureFly/raw/refs/heads/master/favicon.ico
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// @downloadURL  https://github.com/ChitoseRaame/UrlPureFly/raw/refs/heads/master/UrlPureFly.user.js
// @updateURL    https://github.com/ChitoseRaame/UrlPureFly/raw/refs/heads/master/UrlPureFly.user.js
// ==/UserScript==

(function () {
    'use strict';

    /** * 全局状态与默认配置
     * 保存已创建的固定按钮 DOM 节点，默认启动时悬浮窗在右上角
     */
    let createdButtons = [];
    const DEFAULT_SETTINGS = { buttonPositions: ['top-right'] };

    /* =========================================================================
     * 1. 油猴层 - 核心逻辑 (Tampermonkey Logic)
     * 负责脚本的生命周期管理，注入样式、注册菜单并初始化事件。
     * ========================================================================= */

    /**
     * 脚本初始化入口
     * 涵盖样式注入、原生菜单注册、UI组件生成以及窗口状态监听
     */
    function init() {
        // 注入包含 UI 控件和通知气泡的 CSS 样式表
        GM_addStyle(APP_CSS);

        // 注册油猴原生菜单项，供用户在不显示按钮时也能唤起设置面板
        GM_registerMenuCommand('⚙️ 按钮位置设置', showSettingsPanel);

        // 根据本地缓存的配置，在页面上生成净化悬浮按钮
        generateFixedButtons();

        // 监听窗口尺寸变化，以防自定义位置的按钮溢出可视区域
        window.addEventListener('resize', debounce(generateFixedButtons, 300));

        // 监听全屏状态，视频或网页全屏时自动隐去悬浮按钮以保证视觉沉浸感
        setupFullscreenListener();
    }

    /* =========================================================================
     * 2. 油猴层 - 数据交互 (Tampermonkey JS)
     * 负责与油猴提供的存储 API 进行持久化数据读写。
     * ========================================================================= */

    /**
     * 获取用户持久化保存的按钮位置设置
     * @returns {Object} 包含所选位置列表及自定义 X、Y 坐标值的对象
     */
    function getButtonPositionSettings() {
        return {
            positions: GM_getValue('buttonPositions', DEFAULT_SETTINGS.buttonPositions),
            customX: parseInt(GM_getValue('customPositionX', 50)),
            customY: parseInt(GM_getValue('customPositionY', 50))
        };
    }

    /**
     * 保存面板中的设置到持久化存储，并触发 UI 重绘
     */
    function saveSettings() {
        /*
        const positions = Array.from(document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        */
        // 优化：使用 ES6 展开语法 [...] 替代 Array.from，代码可读性更佳
        const positions = [...document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]:checked')].map(cb => cb.value);

        let customX = 50, customY = 50;

        // 若用户启用了“自定义位置”，则抓取并验证 XY 坐标数值
        if (positions.includes('custom')) {
            const valX = parseInt(document.getElementById('UrlPureFly_sliderXValue').value);
            const valY = parseInt(document.getElementById('UrlPureFly_sliderYValue').value);

            // 确保坐标在 0% 到 100% 之间，防止越界
            customX = isNaN(valX) ? 50 : Math.max(0, Math.min(100, valX));
            customY = isNaN(valY) ? 50 : Math.max(0, Math.min(100, valY));
        }

        // 写入本地存储
        GM_setValue('buttonPositions', positions);
        GM_setValue('customPositionX', customX);
        GM_setValue('customPositionY', customY);

        // 重新渲染按钮应用最新设置，并关闭面板给予反馈
        generateFixedButtons();
        hideSettingsPanel();
        showToast('✓ 设置已保存，按钮位置已更新', 'success');
    }

    /**
     * 将油猴存储中的配置加载到设置面板的表单 DOM 上
     */
    function loadSettingsToPanel() {
        const { positions, customX, customY } = getButtonPositionSettings();

        // 重置多选框状态，防止状态残留
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]')
                .forEach(cb => cb.checked = false);

        // 恢复被选中的方位选项
        positions.forEach(pos => {
            const checkbox = document.getElementById(`UrlPureFly_pos-${pos}`);
            if (checkbox) checkbox.checked = true;
        });

        // 恢复自定义 X/Y 坐标轴滑块与输入框的数值
        ['X', 'Y'].forEach(axis => {
            const value = axis === 'X' ? customX : customY;
            document.getElementById(`UrlPureFly_slider${axis}`).value = value;
            document.getElementById(`UrlPureFly_slider${axis}Value`).value = value;
        });

        updateCustomPositionVisibility();
    }

    /* =========================================================================
     * 3. 油猴层 - 设置界面交互 (Tampermonkey UI)
     * 负责用户自定义设置面板的展示、隐藏以及内部表单联动。
     * ========================================================================= */

    /**
     * 唤出设置面板（包含懒加载 DOM 的逻辑）
     */
    function showSettingsPanel() {
        let panel = document.getElementById('UrlPureFly_settingsPanel');

        // 若面板 DOM 未初始化，则注入文档并绑定事件
        if (!panel) {
            document.body.insertAdjacentHTML('beforeend', SETTINGS_HTML);
            bindSettingsEvents();
            panel = document.getElementById('UrlPureFly_settingsPanel');
        }

        loadSettingsToPanel();
        panel.classList.add('show');
        document.getElementById('UrlPureFly_settingsOverlay').classList.add('show');
    }

    /**
     * 隐藏设置面板及其遮罩层
     */
    function hideSettingsPanel() {
        document.getElementById('UrlPureFly_settingsPanel')?.classList.remove('show');
        document.getElementById('UrlPureFly_settingsOverlay')?.classList.remove('show');
    }

    /**
     * 统一绑定设置面板的所有用户交互事件
     */
    function bindSettingsEvents() {
        // 关闭及取消逻辑
        document.getElementById('UrlPureFly_settingsCloseBtn').addEventListener('click', hideSettingsPanel);
        document.getElementById('UrlPureFly_settingsOverlay').addEventListener('click', hideSettingsPanel);
        document.getElementById('UrlPureFly_settingsCancelBtn').addEventListener('click', () => {
            hideSettingsPanel();
            loadSettingsToPanel(); // 还原至保存前的配置
        });

        // 保存逻辑
        document.getElementById('UrlPureFly_settingsSaveBtn').addEventListener('click', saveSettings);

        // 防止点击面板主体时，事件冒泡至遮罩层导致误关面板
        document.getElementById('UrlPureFly_settingsPanel').addEventListener('click', e => e.stopPropagation());

        // 监听位置复选框的勾选行为，以决定是否展示“自定义坐标”模块
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                updateCustomPositionVisibility();
                if (cb.value === 'custom' && cb.checked) updateRealtimeButtons();
            });
        });

        bindSliderEvents('X');
        bindSliderEvents('Y');
    }

    /**
     * 根据“自定义位置”的勾选状态，切换坐标设置区域的可视化
     */
    function updateCustomPositionVisibility() {
        const customGroup = document.getElementById('UrlPureFly_customPositionGroup');
        const isCustomChecked = document.getElementById('UrlPureFly_pos-custom').checked;
        customGroup.classList.toggle('show', isCustomChecked);
    }

    /**
     * 当用户拖拽坐标滑块时，使页面上的悬浮按钮实时移动以提供预览反馈
     */
    function updateRealtimeButtons() {
        const x = parseInt(document.getElementById('UrlPureFly_sliderX').value);
        const y = parseInt(document.getElementById('UrlPureFly_sliderY').value);

        const finalX = isNaN(x) ? 50 : x;
        const finalY = isNaN(y) ? 50 : y;

        // 同步反馈到输入框
        document.getElementById('UrlPureFly_sliderXValue').value = finalX;
        document.getElementById('UrlPureFly_sliderYValue').value = finalY;

        // 过滤出自定义位置类型的按钮，并实时更新其 style 位置
        createdButtons.filter(btn => btn.dataset.positionType === 'custom').forEach(button => {
            button.style.left = `calc(${finalX} / 100 * (100vw - 50px))`;
            button.style.top = `calc(${finalY} / 100 * (100vh - 50px))`;
        });
    }

    /**
     * 绑定坐标轴范围滑块 (Range) 和 数字输入框 (Number) 的双向同步事件
     * @param {string} axis - 指定轴向，'X' 或 'Y'
     */
    function bindSliderEvents(axis) {
        const slider = document.getElementById(`UrlPureFly_slider${axis}`);
        const input = document.getElementById(`UrlPureFly_slider${axis}Value`);
        if (!slider || !input) return;

        // 值验证与双向同步中枢
        const syncValues = (val) => {
            let num = parseInt(val);
            if (isNaN(num)) return;
            num = Math.max(0, Math.min(100, num)); // 限定区间
            slider.value = num;
            input.value = num;
            updateRealtimeButtons();
        };

        slider.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('blur', e => {
            // 输入框失去焦点时，若内容非法，强制恢复至中心坐标 50
            const parsedVal = parseInt(e.target.value);
            if (e.target.value === '' || isNaN(parsedVal)) {
                slider.value = 50;
                input.value = 50;
                updateRealtimeButtons();
            }
        });
    }

    /* =========================================================================
     * 4. 网页层 - 核心功能脚本 (Webpage JS)
     * 负责 URL 解析、规则路由、请求拦截、剪贴板操作等纯网页级别的逻辑处理。
     * ========================================================================= */

    /**
     * 执行核心净化逻辑：串联重定向探测与参数剥离，最终写入剪贴板
     */
    async function handlePurifyAndCopy() {
        const currentUrl = window.location.href;

        try {
            showToast('🔄 正在净化URL...', 'info');

            // 依据预设的 RULESETS 进行多重清洗
            const purifiedUrl = await purifyUrl(currentUrl);

            // 将纯净链接输出至剪贴板
            const copySuccess = await copyToClipboard(purifiedUrl);

            if (copySuccess) {
                if (purifiedUrl !== currentUrl) {
                    showToast('✅ URL已净化并复制到剪贴板', 'success');
                } else {
                    showToast('ℹ️ URL无需净化，已复制原链接', 'info');
                }
            } else {
                showToast('❌ 复制失败，请手动复制浏览器地址栏', 'error');
            }
        } catch (error) {
            console.error('UrlPureFly: 净化核心流程异常', error);
            showToast('❌ 净化URL失败', 'error');
        }
    }

    /**
     * 净化中枢调度器：按序处理重定向及路径参数规则
     * @param {string} url - 需要清洗的原始链接
     * @returns {Promise<string>} 净化完成后的目标链接
     */
    async function purifyUrl(url) {
        let purifiedUrl = url;
        purifiedUrl = await applyRedirectRules(purifiedUrl);
        purifiedUrl = await applyParamRules(purifiedUrl);
        return purifiedUrl;
    }

    /**
     * 在 RULESETS 字典树中寻址，深度匹配符合当前 URL 结构的路由规则
     * @param {URL} urlObj - 待处理链接的 URL 实例
     * @param {Object} ruleset - 规则集合
     * @returns {Object|null} 匹配到的规则块，未匹配则返回 null 或是通用 fallback 规则
     */
    function findMatchingRule(urlObj, ruleset) {
        const hostname = urlObj.hostname;
        let pathname = urlObj.pathname;
        const search = urlObj.search;
        const hash = urlObj.hash;

        let currentRules = ruleset;

        // ----- 第一层级：匹配 Hostname (域名) -----
        let matched = false;
        if (currentRules[hostname]) {
            currentRules = currentRules[hostname];
            matched = true;
        } else if (currentRules[hostname + '/']) {
            currentRules = currentRules[hostname + '/'];
            matched = true;
        } else {
            // 尝试触发正则匹配域名的规则键
            for (const key in currentRules) {
                if (key.startsWith('/') && key.endsWith('/')) {
                    const regex = new RegExp(key.slice(1, -1));
                    if (regex.test(hostname)) {
                        currentRules = currentRules[key];
                        matched = true;
                        break;
                    }
                }
            }
        }

        // 域名未匹配时，回退检测是否有通用 fallback ('') 规则
        if (!matched && currentRules[''] && currentRules[''].mode) {
            return currentRules[''];
        }
        if (!matched) return null;

        // 若当前层级已是最终规则端点，直接抛出
        if (currentRules.mode) return currentRules;

        // ----- 第二层级：匹配 Pathname (路径参数) -----
        const pathSegments = pathname.split('/').filter(seg => seg.length > 0);

        for (const segment of pathSegments) {
            let segmentMatched = false;

            if (currentRules[segment]) {
                currentRules = currentRules[segment];
                segmentMatched = true;
            } else if (currentRules[segment + '/']) {
                currentRules = currentRules[segment + '/'];
                segmentMatched = true;
            } else {
                for (const key in currentRules) {
                    if (key.startsWith('/') && key.endsWith('/')) {
                        const regex = new RegExp(key.slice(1, -1));
                        if (regex.test(segment)) {
                            currentRules = currentRules[key];
                            segmentMatched = true;
                            break;
                        }
                    }
                }
            }

            if (!segmentMatched) {
                if (currentRules[''] && currentRules[''].mode) {
                    return currentRules[''];
                }
                continue; // 忽略不重要的路径分段
            }

            if (currentRules.mode) return currentRules;
        }

        // ----- 第三层级：匹配 Search (Query 参数标识) -----
        if (search && currentRules[search]) {
            currentRules = currentRules[search];
            if (currentRules.mode) return currentRules;
        }

        // ----- 第四层级：匹配 Hash (锚点) -----
        if (hash && currentRules[hash]) {
            currentRules = currentRules[hash];
            if (currentRules.mode) return currentRules;
        }

        // 最终检查是否定义了空字符串回退规则
        if (currentRules[''] && currentRules[''].mode) {
            return currentRules[''];
        }

        return null;
    }

    /**
     * 【策略一】处理跨域请求重定向解析 (短链展开等)
     * 利用 GM_xmlhttpRequest 预检 URL 的真实 301/302 目标地点
     * @param {string} url - 待测链接
     * @returns {Promise<string>} 解析所得真实链接，解析失败则退回原链接
     */
    function applyRedirectRules(url) {
        return new Promise((resolve) => {
            try {
                const urlObj = new URL(url);
                const rule = findMatchingRule(urlObj, RULESETS);

                if (!rule || !(rule.mode === 'redirect' || rule.mode === 'visit')) {
                    return resolve(url);
                }

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    onload: response => resolve(response.finalUrl || url),
                    onerror: () => resolve(url),
                    ontimeout: () => resolve(url),
                    timeout: 5000
                });
            } catch (e) {
                resolve(url);
            }
        });
    }

    /**
     * 【策略二】执行本地 URL 参数清洗与重组
     * 负责解析黑白名单、Base64解码提取、自定义 Lambda 和正则替换等模式
     * @param {string} url - 原始长链接
     * @returns {string} 处理完成的纯净链接
     */
    async function applyParamRules(url) {
        try {
            const urlObj = new URL(url);
            const rule = findMatchingRule(urlObj, RULESETS);

            if (!rule) return url;

            const { mode, params = [], acts = [], lambda, regex: regexList = [], replace: replaceList = [] } = rule;

            switch (mode) {
                case 'white':
                    // 白名单：抛弃一切，仅保留规则允许的 query
                    const newParams = new URLSearchParams();
                    params.forEach(param => {
                        if (urlObj.searchParams.has(param)) {
                            newParams.set(param, urlObj.searchParams.get(param));
                        }
                    });
                    urlObj.search = newParams.toString();
                    return urlObj.toString();

                case 'black':
                    // 黑名单：遍历命中名单，逐一击破移除
                    params.forEach(param => urlObj.searchParams.delete(param));
                    return urlObj.toString();

                case 'param':
                    // 参数提取：适用于套壳跳转链接（提取目标链接）
                    const extractedParams = {};
                    params.forEach(param => {
                        if (urlObj.searchParams.has(param)) extractedParams[param] = urlObj.searchParams.get(param);
                    });

                    let finalUrl = '';
                    if (acts.includes('base64')) {
                        const base64Value = extractedParams[params[0]];
                        let decodedValue = base64Value;
                        if (acts.includes('slice:2')) decodedValue = base64Value.slice(2);
                        try {
                            finalUrl = atob(decodedValue);
                        } catch (e) {
                            console.warn('UrlPureFly: Base64解码目标失败', e);
                            return url;
                        }
                    } else {
                        finalUrl = extractedParams[params[0]] || '';
                    }
                    return finalUrl;

                case 'lambda':
                    // 函数执行：赋予最高自由度，通过内置 JS 运行时改写对象
                    try {
                        const lambdaFn = new Function('url', lambda);
                        const result = lambdaFn(urlObj);
                        if (result instanceof URL) return result.toString();
                        if (typeof result === 'string') return result;
                    } catch (e) {
                        console.error('UrlPureFly: Lambda动态脚本执行失败', e);
                    }
                    break;

                case 'regex':
                    // 正则修改：应对非标准 URL 的暴力字符串层面查找与替换
                    let resultStr = urlObj.toString();
                    for (let i = 0; i < regexList.length; i++) {
                        resultStr = resultStr.replace(new RegExp(regexList[i]), replaceList[i] || '');
                    }
                    return resultStr;
            }

            return urlObj.toString();
        } catch (e) {
            console.error('UrlPureFly: 本地参数清洗流程出错', e);
            return url;
        }
    }

    /**
     * 浏览器剪贴板写入工具封装，提供降级兼容
     * @param {string} text - 待复制文本
     * @returns {Promise<boolean>} 复制成功与否标志
     */
    async function copyToClipboard(text) {
        try {
            // 现代化方案：尝试 navigator.clipboard (要求 HTTPS 环境)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            // 降级方案：创建不可见选区供旧版 API 调用
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            textArea.remove();
            return successful;
        } catch (err) {
            console.error('UrlPureFly: 剪贴板注入失败', err);
            return false;
        }
    }

    /**
     * 包装器：防抖函数，稀释高频事件的回调触发 (如 Resize)
     * @param {Function} func - 待执行回调
     * @param {number} delay - 冷却时间(ms)
     */
    /*
    function debounce(func, delay) {
        let timer = null;
        return function(...args) {
            if (timer) clearTimeout(timer); // 如果在延迟时间内再次触发，则清空上一次的定时器
            timer = setTimeout(() => {
                func.apply(this, args);
                timer = null;
            }, delay);
        };
    }
    */
    function debounce(func, delay) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer); // 优化：无需判空直接清除，代码更精简
            timer = setTimeout(() => func.apply(this, args), delay); // 优化：依靠闭包，回调执行后不必手动置空 timer
        };
    }

    /**
     * 检测页面是否开启了全屏沉浸模式 (含浏览器内核兼容)
     * @returns {boolean} 当前全屏状态布尔值
     */
    function isFullscreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    }

    /**
     * 绑定全局全屏事件监听：防止脚本组件遮挡视线，全屏时隐形处理
     */
    function setupFullscreenListener() {
        const handleFullscreenChange = () => {
            const isFull = isFullscreen();
            const toasts = document.querySelectorAll('.UrlPureFly_toast');

            createdButtons.forEach(btn => btn.classList.toggle('UrlPureFly_fullscreen-hidden', isFull));
            toasts.forEach(toast => toast.classList.toggle('UrlPureFly_fullscreen-hidden', isFull));
        };

        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(
            evt => document.addEventListener(evt, handleFullscreenChange)
        );
    }


    /* =========================================================================
     * 5. 网页层 - 页面元素渲染 (Webpage UI)
     * 负责向当前网页 DOM 中注入或修改可视化的 UI 组件。
     * ========================================================================= */

    /**
     * 在页面顶端生成一个自动消失的气泡通知 (Toast)
     * @param {string} message - 通知内容
     * @param {string} [type='success'] - 表现层类型：info/success/warning/error
     */
    function showToast(message, type = 'success') {
        /*
        const existingToast = document.querySelector('.UrlPureFly_toast');
        if (existingToast) existingToast.remove();
        */
        // 优化：一次性清理所有可能遗留的 toast 碎片（防止短时间内多次触发产生堆叠问题）
        document.querySelectorAll('.UrlPureFly_toast').forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `UrlPureFly_toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 确保浏览器重排后应用过渡动画
        requestAnimationFrame(() => toast.classList.add('show'));

        // 计时退出
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // 留出 CSS 过渡时间后销毁 DOM
        }, 3000);
    }

    /**
     * 基于配置向网页内组装和派发“扫帚”悬浮按钮
     */
    function generateFixedButtons() {
        /*
        createdButtons.forEach(btn => btn.parentNode?.removeChild(btn));
        */
        // 优化：利用现代 API 直接要求节点自毁，免去追溯父级的开销
        createdButtons.forEach(btn => btn.remove());
        createdButtons = [];

        const { positions, customX, customY } = getButtonPositionSettings();
        const isCurrentlyFullscreen = isFullscreen();

        // 遍历选中的屏幕位置并生成 DOM
        positions.forEach((position, index) => {
            const button = document.createElement('button');
            button.className = 'UrlPureFly_fixed-btn';
            button.id = `UrlPureFly_${index}`;
            button.innerHTML = '🧹';
            button.title = '净化URL';
            button.dataset.positionType = position;

            if (isCurrentlyFullscreen) {
                button.classList.add('UrlPureFly_fullscreen-hidden');
            }

            // 内联样式分配：定制化与预设方位的分别处理
            if (position === 'custom') {
                button.style.left = `calc(${customX} / 100 * (100vw - 50px))`;
                button.style.top = `calc(${customY} / 100 * (100vh - 50px))`;
                button.style.borderRadius = '25px';
            } else {
                const styles = {
                    'top-left': { top: '100px', left: '0px', borderRadius: '0 25px 25px 0' },
                    'top-right': { top: '100px', right: '0px', borderRadius: '25px 0 0 25px' },
                    'bottom-left': { bottom: '20px', left: '0px', borderRadius: '0 25px 25px 0' },
                    'bottom-right': { bottom: '20px', right: '0px', borderRadius: '25px 0 0 25px' }
                };
                Object.assign(button.style, styles[position] || styles['top-right']);
            }

            button.addEventListener('click', handlePurifyAndCopy);
            document.body.appendChild(button);
            createdButtons.push(button);
        });
    }

    /* =========================================================================
     * 6. 网页层 - 静态资源 (Webpage HTML & CSS)
     * 存储注入到网页中的 CSS 样式表和用于唤出的 HTML 模板结构。
     * ========================================================================= */

    /**
     * 【设置面板 DOM 结构】
     * 包含 Overlay 背景幕、控制滑块及各位置的选框
     */
    const SETTINGS_HTML = `
        <div id="UrlPureFly_settingsOverlay" class="UrlPureFly_settings-overlay"></div>
        <div id="UrlPureFly_settingsPanel" class="UrlPureFly_settings-panel">
            <div class="UrlPureFly_settings-header">
                <h2>🧹 URL净化按钮设置</h2>
                <button class="UrlPureFly_close-btn" id="UrlPureFly_settingsCloseBtn">×</button>
            </div>
            <div class="UrlPureFly_settings-body">
                <div class="UrlPureFly_settings-section">
                    <h3>选择按钮显示位置</h3>
                    <div class="UrlPureFly_checkbox-group">
                        <div class="UrlPureFly_checkbox-item"><input type="checkbox" id="UrlPureFly_pos-top-left" value="top-left"><label for="UrlPureFly_pos-top-left">左上角</label></div>
                        <div class="UrlPureFly_checkbox-item"><input type="checkbox" id="UrlPureFly_pos-top-right" value="top-right"><label for="UrlPureFly_pos-top-right">右上角</label></div>
                        <div class="UrlPureFly_checkbox-item"><input type="checkbox" id="UrlPureFly_pos-bottom-left" value="bottom-left"><label for="UrlPureFly_pos-bottom-left">左下角</label></div>
                        <div class="UrlPureFly_checkbox-item"><input type="checkbox" id="UrlPureFly_pos-bottom-right" value="bottom-right"><label for="UrlPureFly_pos-bottom-right">右下角</label></div>
                        <div class="UrlPureFly_checkbox-item"><input type="checkbox" id="UrlPureFly_pos-custom" value="custom"><label for="UrlPureFly_pos-custom">自定义位置</label></div>
                    </div>
                    <div class="UrlPureFly_custom-position-group" id="UrlPureFly_customPositionGroup">
                        <div class="UrlPureFly_slider-row">
                            <div class="UrlPureFly_slider-label">
                                <span>水平位置 (0-100%)</span>
                                <input type="number" class="UrlPureFly_value-input" id="UrlPureFly_sliderXValue" min="0" max="100" value="50">
                            </div>
                            <div class="UrlPureFly_slider-container">
                                <input type="range" id="UrlPureFly_sliderX" min="0" max="100" value="50">
                            </div>
                        </div>
                        <div class="UrlPureFly_slider-row">
                            <div class="UrlPureFly_slider-label">
                                <span>垂直位置 (0-100%)</span>
                                <input type="number" class="UrlPureFly_value-input" id="UrlPureFly_sliderYValue" min="0" max="100" value="50">
                            </div>
                            <div class="UrlPureFly_slider-container">
                                <input type="range" id="UrlPureFly_sliderY" min="0" max="100" value="50">
                            </div>
                        </div>
                        <div class="UrlPureFly_position-tips">💡 提示：拖动滑块或输入数字，按钮会实时在页面上移动</div>
                    </div>
                </div>
            </div>
            <div class="UrlPureFly_settings-footer">
                <button class="UrlPureFly_btn UrlPureFly_btn-cancel" id="UrlPureFly_settingsCancelBtn">取消</button>
                <button class="UrlPureFly_btn UrlPureFly_btn-save" id="UrlPureFly_settingsSaveBtn">保存</button>
            </div>
        </div>
    `;

    /**
     * 【插件全局独立 CSS】
     * 为避免污染宿主页面，强制添加 UrlPureFly_ 前缀，并用 !important 压制网页默认权重
     */
    const APP_CSS = `
        /* ----------------------- 1. 消息提示框  ----------------------- */
        .UrlPureFly_toast {
            position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%);
            min-width: 250px; max-width: 400px; padding: 16px 24px;
            background-color: #00aeec; color: #fff; text-align: center; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); opacity: 0;
            transition: all 0.4s ease; z-index: 9999; font-size: 14px; font-weight: 500;
        }
        .UrlPureFly_toast.show { bottom: 30px; opacity: 1; }
        .UrlPureFly_toast.info { background-color: #00aeec; }
        .UrlPureFly_toast.success { background-color: #52c41a; }
        .UrlPureFly_toast.warning { background-color: #faad14; }
        .UrlPureFly_toast.error { background-color: #f5222d; }
        .UrlPureFly_toast.UrlPureFly_fullscreen-hidden { display: none !important; }

        /* ----------------------- 2. 悬浮净化主按钮 ----------------------- */
        .UrlPureFly_fixed-btn {
            position: fixed !important; z-index: 9999 !important;
            width: 50px !important; height: 50px !important;
            color: rgb(255, 255, 255) !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border: none !important; font-size: 24px !important; cursor: pointer !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
            text-align: center !important; line-height: 1 !important; padding: 0 !important;
            transition: all 0.3s ease !important; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
        }
        .UrlPureFly_fixed-btn:hover {
            transform: scale(1.1) !important; box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6) !important;
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%) !important;
        }
        .UrlPureFly_fixed-btn:active { transform: scale(0.95) !important; }

        /* 全屏隐藏通用类 */
        .UrlPureFly_fullscreen-hidden { display: none !important; }

        /* ----------------------- 3. 设置面板与遮罩 ----------------------- */
        #UrlPureFly_settingsOverlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); z-index: 99999; display: none;
        }
        #UrlPureFly_settingsOverlay.show { display: block; }

        #UrlPureFly_settingsPanel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 450px; max-width: 90vw; background: white; border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; display: none;
        }
        #UrlPureFly_settingsPanel.show { display: block; }

        /* 面板头部 */
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header {
            padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header h2 { margin: 0; font-size: 20px; color: #333; font-weight: 600; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header .UrlPureFly_close-btn {
            background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0;
            width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header .UrlPureFly_close-btn:hover { background: #f0f0f0; color: #333; }

        /* 面板内容与选项 */
        #UrlPureFly_settingsPanel .UrlPureFly_settings-body { padding: 20px; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section { margin-bottom: 20px; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section:last-child { margin-bottom: 0; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section h3 { margin: 0 0 12px 0; font-size: 16px; color: #333; font-weight: 500; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-group { display: flex; flex-direction: column; gap: 8px; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item {
            display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border-radius: 6px; transition: background 0.2s;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item:hover { background: #f5f5f5; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #667eea; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item label { cursor: pointer; font-size: 14px; color: #333; flex: 1; }

        /* ----------------------- 4. 自定义坐标滑块组件 ----------------------- */
        #UrlPureFly_settingsPanel .UrlPureFly_custom-position-group { margin-top: 12px; padding: 16px; background: #f9f9f9; border-radius: 8px; display: none; }
        #UrlPureFly_settingsPanel .UrlPureFly_custom-position-group.show { display: block; }
        .UrlPureFly_slider-row { margin-bottom: 16px; }
        .UrlPureFly_slider-row:last-child { margin-bottom: 0; }
        .UrlPureFly_slider-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; color: #666; }
        .UrlPureFly_slider-label .UrlPureFly_value-input {
            font-weight: 600; color: #667eea; width: 55px; text-align: right;
            padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;
        }
        .UrlPureFly_slider-label .UrlPureFly_value-input:focus { outline: none; border-color: #667eea; }
        .UrlPureFly_slider-container { display: flex; align-items: center; gap: 12px; }
        .UrlPureFly_slider-container input[type="range"] {
            flex: 1; width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0; outline: none; -webkit-appearance: none; cursor: pointer;
        }
        .UrlPureFly_slider-container input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 18px; height: 18px;
            border-radius: 50%; background: #667eea; cursor: pointer; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); transition: all 0.2s;
        }
        .UrlPureFly_slider-container input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3); }
        .UrlPureFly_position-tips { margin-top: 12px; font-size: 12px; color: #999; text-align: center; }

        /* 面板底部按钮 */
        #UrlPureFly_settingsPanel .UrlPureFly_settings-footer {
            padding: 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; gap: 12px;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s; border: none; font-weight: 500; }
        #UrlPureFly_settingsPanel .UrlPureFly_btn-cancel { background: #f0f0f0; color: #333; }
        #UrlPureFly_settingsPanel .UrlPureFly_btn-cancel:hover { background: #e0e0e0; }
        #UrlPureFly_settingsPanel .UrlPureFly_btn-save { background: #667eea; color: white; }
        #UrlPureFly_settingsPanel .UrlPureFly_btn-save:hover { background: #5568d3; }
    `;

    /* =========================================================================
     * 7. 规则层 - 净化配置 (Rules)
     * 涵盖各大平台的追踪后缀规则。模式含：white(白名单保留), black(黑名单剔除), redirect(网络解析重定向), param(深度提取), lambda(代码片段执行), regex(正则替换)
     * ========================================================================= */
    const RULESETS = {
        "": {
            "description": "Fallback 全局兜底：去除常见通用追踪标记",
            "mode": "black",
            "params": ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "mc_cid", "mc_eid"],
            "author": "PRO-2684"
        },
        "baike.baidu.com/": {
            "item": {
                "description": "百度百科",
                "mode": "white",
                "params": [],
                "author": "PRO-2684"
            },
            "reference": {
                "description": "百度百科参考文献",
                "mode": "white",
                "params": [],
                "author": "PRO-2684"
            }
        },
        "chatglm.cn/": {
            "glmsShare": {
                "description": "智谱清言对话分享",
                "mode": "white",
                "params": ["share_conversation_id", "lang"],
                "author": "PRO-2684"
            },
            "video/": {
                "share": {
                    "description": "智谱清言视频分享",
                    "mode": "white",
                    "params": ["share_chat_id", "lang"],
                    "author": "PRO-2684"
                }
            }
        },
        "cn.bing.com/": {
            "search": {
                "description": "必应搜索",
                "mode": "white",
                "params": ["q", "filters", "ensearch", "first", "ubiroff", "format"],
                "author": "PRO-2684"
            },
            "": {
                "description": "必应 FallBack",
                "mode": "black",
                "params": ["FORM"],
                "author": "PRO-2684"
            }
        },
        "h5.qzone.qq.com/": {
            "ugc/": {
                "share": {
                    "description": "h5 QQ 空间",
                    "mode": "white",
                    "params": ["sharetag", "appid"],
                    "author": "PRO-2684"
                }
            }
        },
        "item.taobao.com/": {
            "item.htm": {
                "description": "淘宝商品",
                "mode": "white",
                "params": ["id"],
                "author": "PRO-2684"
            }
        },
        "k.youshop10.com": {
            "description": "微店",
            "mode": "white",
            "params": [],
            "author": "kirito"
        },
        "kandianshare.html5.qq.com/": {
            "v2/": {
                "news": {
                    "description": "QQ 看点分享",
                    "mode": "white",
                    "params": [],
                    "author": "PRO-2684"
                }
            }
        },
        "live.bilibili.com/": {
            "/^\\d+$": {
                "description": "哔哩哔哩直播间",
                "mode": "white",
                "params": [],
                "author": "青墨"
            }
        },
        "m.tb.cn": {
            "description": "淘宝/闲鱼",
            "mode": "white",
            "params": [],
            "author": "lz233"
        },
        "m.v.qq.com": {
            "description": "腾讯视频",
            "mode": "white",
            "params": ["vid"],
            "author": "returnL、青墨"
        },
        "mailchi.mp": {
            "description": "Mailchimp",
            "mode": "black",
            "params": ["e", "u", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"],
            "author": "PRO-2684"
        },
        "mall.bilibili.com/": {
            "detail.html": {
                "description": "会员购分享",
                "mode": "white",
                "params": ["noTitleBar", "itemsId"],
                "author": "青墨"
            }
        },
        "mp.weixin.qq.com/": {
            "s": {
                "description": "微信公众号文章",
                "mode": "white",
                "params": ["__biz", "mid", "idx", "sn", "tempkey", "previewkey", "poc_token"],
                "author": "PRO-2684"
            },
            "mp/": {
                "appmsgalbum": {
                    "description": "微信公众号专辑",
                    "mode": "white",
                    "params": ["action", "album_id"],
                    "author": "PRO-2684"
                }
            }
        },
        "music.163.com/": {
            "song": {
                "description": "网易云音乐新链接格式",
                "mode": "white",
                "params": ["id"],
                "author": "lz233, Cloudy"
            },
            "": {
                "description": "网易云音乐",
                "mode": "lambda",
                "lambda": "if (url.hash.startsWith('#/song?')) { const p = new URLSearchParams(url.hash.slice(7)); const c = new URLSearchParams(); c.set('id', p.get('id')); url.hash = '#/song?' + c.toString(); } return url;",
                "author": "lz233",
                "continue": false
            }
        },
        "music.apple.com/": {
            "jp/": {
                "album": {
                    "description": "Apple Music",
                    "mode": "white",
                    "params": [],
                    "author": "mitian233"
                }
            }
        },
        "open.spotify.com/": {
            "track": {
                "description": "Spotify",
                "mode": "white",
                "params": [],
                "author": "lz233"
            }
        },
        "plat-miniapp.zuoyebang.com": {
            "description": "作业帮",
            "mode": "white",
            "params": ["cuid", "ishit"],
            "author": "omg-xtao"
        },
        "qun.qq.com/": {
            "qqweb/": {
                "qunpro/": {
                    "share": {
                        "description": "QQ 频道",
                        "mode": "white",
                        "params": ["inviteCode"],
                        "author": "青墨"
                    }
                }
            }
        },
        "search.bilibili.com": {
            "description": "哔哩哔哩搜索",
            "mode": "white",
            "params": ["keyword"],
            "author": "PRO-2684"
        },
        "space.bilibili.com/": {
            "/^\\d+$": {
                "description": "个人界面分享",
                "mode": "white",
                "params": [],
                "author": "青墨"
            }
        },
        "static-play.kg.qq.com/": {
            "node": {
                "description": "全民k歌",
                "mode": "white",
                "params": ["s"],
                "author": "青墨"
            }
        },
        "t.bilibili.com/": {
            "/^\\d+$": {
                "description": "哔哩哔哩动态分享",
                "mode": "white",
                "params": [],
                "author": "青墨"
            }
        },
        "tieba.baidu.com/": {
            "p/": {
                "/^\\d+$": {
                    "description": "百度贴吧",
                    "mode": "white",
                    "params": ["pn", "see_lz"],
                    "author": "PRO-2684"
                }
            }
        },
        "weread.qq.com/": {
            "book-detail": {
                "description": "微信读书",
                "mode": "white",
                "params": ["v"],
                "author": "lz233"
            }
        },
        "www.bilibili.com/": {
            "h5/": {
                "lottery/": {
                    "result": {
                        "description": "哔哩哔哩预约分享",
                        "mode": "black",
                        "params": ["i_transfer_match"],
                        "author": "青墨"
                    }
                }
            },
            "video": {
                "description": "哔哩哔哩视频",
                "mode": "white",
                "params": ["t", "p"],
                "author": "PRO-2684"
            },
            "read/": {
                "mobile": {
                    "description": "哔哩哔哩专栏 (移动端)",
                    "mode": "white",
                    "params": ["id"],
                    "author": "PRO-2684"
                },
                "/cv\\d+": {
                    "description": "哔哩哔哩专栏 (桌面端)",
                    "mode": "white",
                    "params": ["opus_fallback"],
                    "author": "PRO-2684"
                }
            },
            "opus": {
                "description": "哔哩哔哩动态",
                "mode": "white",
                "params": [],
                "author": "PRO-2684"
            }
        },
        "www.bing.com/": {
            "search": {
                "description": "Bing 搜索",
                "mode": "white",
                "params": ["q", "filters", "first"],
                "author": "PRO-2684"
            },
            "ck/": {
                "a": {
                    "description": "Bing 搜索结果",
                    "mode": "param",
                    "params": ["u"],
                    "acts": ["slice:2", "base64"],
                    "author": "PRO-2684"
                }
            },
            "": {
                "description": "Bing FallBack",
                "mode": "black",
                "params": ["FORM"],
                "author": "PRO-2684"
            }
        },
        "www.disneyplus.com": {
            "description": "Disney+",
            "mode": "white",
            "params": [],
            "author": "mitian233"
        },
        "www.dlsite.com": {
            "description": "DLsite",
            "mode": "white",
            "params": [],
            "author": "MateChan"
        },
        "www.douban.com/": {
            "group/": {
                "topic/": {
                    "/^\\d+$": {
                        "description": "豆瓣小组",
                        "mode": "white",
                        "params": [],
                        "author": "ChellyL"
                    }
                }
            }
        },
        "www.google.com/": {
            "search": {
                "description": "Google Search",
                "mode": "white",
                "params": ["q", "start", "lr", "tbs", "udm", "tbm", "as_q", "as_epq", "as_oq", "as_eq", "as_nlo", "as_nhi", "lr", "cr", "as_qdr", "as_sitesearch", "as_occt", "as_filetype", "nfpr", "vsrid", "vsdim", "vsint", "lns_mode", "udm", "lns_vfs"],
                "author": "Matechan, PRO-2684"
            }
        },
        "www.netflix.com": {
            "description": "Netflix",
            "mode": "white",
            "params": [],
            "author": "mitian233"
        },
        "www.right.com.cn/": {
            "forum/": {
                "forum.php": {
                    "description": "恩山无线论坛",
                    "mode": "black",
                    "params": ["authorid", "extra"],
                    "author": "ous50"
                }
            }
        },
        "www.xiaohongshu.com/": {
            "discovery/": {
                "item": {
                    "description": "小红书",
                    "mode": "white",
                    "params": [],
                    "author": "RtYkk"
                }
            }
        },
        "www.youtube.com/": {
            "watch": {
                "description": "YouTube 一般链接",
                "mode": "white",
                "params": ["v"],
                "author": "Mosney"
            }
        },
        "www.zhihu.com/": {
            "search": {
                "description": "知乎搜索",
                "mode": "white",
                "params": ["q", "type", "vertical", "sort", "time_interval"],
                "author": "PRO-2684"
            },
            "equation": {
                "description": "知乎公式图片",
                "mode": "white",
                "params": ["tex"],
                "author": "PRO-2684"
            },
            "": {
                "description": "知乎",
                "mode": "white",
                "params": [],
                "author": "lz233"
            }
        },
        "y.music.163.com/": {
            "m/": {
                "song": {
                    "description": "网易云音乐",
                    "mode": "white",
                    "params": ["id"],
                    "author": "lz233"
                }
            }
        },
        "zhuanlan.zhihu.com": {
            "description": "知乎文章",
            "mode": "white",
            "params": [],
            "author": "TCOTC"
        },

        // 短链展开层配置
        "3.cn/": {
            "/[\\w-]+": {
                "description": "3.cn 短链",
                "mode": "visit",
                "author": "PRO-2684"
            }
        },
        "b23.tv": {
            "description": "哔哩哔哩短链",
            "mode": "redirect",
            "author": "PRO-2684"
        },
        "bili22.cn/": {
            "/\\w+": {
                "description": "哔哩哔哩短链",
                "mode": "redirect",
                "author": "PRO-2684"
            }
        },
        "bili2233.cn/": {
            "/\\w+": {
                "description": "哔哩哔哩短链",
                "mode": "redirect",
                "author": "PRO-2684"
            }
        },
        "bit.ly": {
            "description": "Bitly",
            "mode": "redirect",
            "author": "PRO-2684"
        },
        "163cn.tv": {
            "description": "网易云音乐短链",
            "mode": "redirect",
            "author": "lz233"
        },
        "vm.tiktok.com": {
            "description": "TikTok短链",
            "mode": "redirect",
            "author": "Mattis"
        },
        "xhslink.com": {
            "description": "小红书短链",
            "mode": "redirect",
            "author": "lz233"
        },
        "t.cn": {
            "description": "新浪短链",
            "mode": "redirect",
            "author": "PRO-2684"
        },

        // 套壳外链劫持配置
        "outgoing.prod.mozaws.net/": {
            "/v\\d/": {
                "/\\w+": {
                    "description": "Mozilla 外链",
                    "mode": "regex",
                    "regex": ["^https?://outgoing\\.prod\\.mozaws\\.net/v\\d/\\w+/(.+)"],
                    "replace": ["$1"],
                    "acts": ["url"],
                    "author": "Meriel Varen"
                }
            }
        },
        "afdian.com/": {
            "link": {
                "description": "爱发电外链",
                "mode": "param",
                "params": ["target"],
                "author": "OldPanda"
            }
        },
        "afdian.net/": {
            "link": {
                "description": "爱发电外链",
                "mode": "param",
                "params": ["target"],
                "author": "OldPanda"
            }
        },
        "targurl.clewm.net/": {
            "jump": {
                "description": "草料二维码",
                "mode": "param",
                "params": ["targurl"],
                "acts": ["base64"],
                "author": "PRO-2684"
            }
        }
    };

    // 执行系统级挂载初始化
    init();
})();