// ==UserScript==
// @name         UrlPureFly - URL净化助手
// @namespace    UrlPureFly
// @version      1.1.0
// @description  一键净化当前网页的跟踪URL参数，支持多种净化规则，可自定义按钮位置
// @author       ChitoseRaame
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    /* =========================================================================
     * 1. JS 主代码 (Main State & Initialization)
     * ========================================================================= */

    // --- 常量配置 ---
    const DEFAULT_SETTINGS = { buttonPositions: ['top-right'] };

    /** 状态缓存：保存已创建的固定按钮 DOM 节点，便于后续统一管理和销毁 */
    let createdButtons = [];

    /**
     * 脚本初始化入口
     * 负责样式的注入、菜单注册、UI生成以及全局事件的监听
     */
    function init() {
        // 1. 注入 CSS 样式表到页面头部
        GM_addStyle(APP_CSS);

        // 2. 注册油猴原生菜单项，点击唤出设置面板
        GM_registerMenuCommand('⚙️ 按钮位置设置', showSettingsPanel);

        // 3. 根据用户配置，生成主净化悬浮按钮
        generateFixedButtons();

        // 4. 监听窗口尺寸变化，使用防抖函数避免频繁触发计算
        window.addEventListener('resize', debounce(generateFixedButtons, 300));

        // 5. 监听浏览器全屏状态变化，全屏时自动隐藏悬浮按钮以防遮挡视野
        setupFullscreenListener();
    }


    /* =========================================================================
     * 2. JS 函数 (Functions)
     * ========================================================================= */

    // ----------------- 工具类函数 (Utilities) -----------------

    /**
     * 防抖函数，限制高频事件的触发频率
     * @param {Function} func - 需要防抖的函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {Function} 包装后的防抖函数
     */
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

    /**
     * 优雅降级的复制到剪贴板功能
     * @param {string} text - 需要复制的文本
     * @returns {Promise<boolean>} 复制是否成功
     */
    async function copyToClipboard(text) {
        try {
            // 优先使用现代 Clipboard API (需 HTTPS 环境支持)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 降级方案：创建隐藏的 textarea 使用 document.execCommand 复制 (兼容 HTTP 环境)
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                textArea.remove();
                return successful;
            }
        } catch (err) {
            console.error('复制到剪贴板失败:', err);
            return false;
        }
    }

    /**
     * 检测当前页面是否处于全屏状态 (兼容多浏览器前缀)
     * @returns {boolean} 是否处于全屏
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
     * 设置全屏状态的全局监听器
     * 全屏时隐藏组件，退出全屏时恢复显示
     */
    function setupFullscreenListener() {
        const handleFullscreenChange = () => {
            const isFull = isFullscreen();
            const toasts = document.querySelectorAll('.UrlPureFly_toast');

            // 批量切换按钮和提示框的隐藏类名
            createdButtons.forEach(btn => btn.classList.toggle('UrlPureFly_fullscreen-hidden', isFull));
            toasts.forEach(toast => toast.classList.toggle('UrlPureFly_fullscreen-hidden', isFull));
        };

        // 监听标准及各类浏览器私有的全屏事件
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    /**
     * 获取用户持久化保存的按钮位置设置
     * @returns {Object} 包含选中位置数组及自定义 X、Y 坐标的对象
     */
    function getButtonPositionSettings() {
        return {
            positions: GM_getValue('buttonPositions', DEFAULT_SETTINGS.buttonPositions),
            customX: parseInt(GM_getValue('customPositionX', 50)),
            customY: parseInt(GM_getValue('customPositionY', 50))
        };
    }

    // ----------------- UI 交互函数 (UI & Interaction) -----------------

    /**
     * 在页面顶部显示自毁式气泡通知
     * @param {string} message - 提示消息内容
     * @param {string} [type='success'] - 提示类型: 'success', 'info', 'warning', 'error'
     */
    function showToast(message, type = 'success') {
        // 1. 清理现存提示框，避免多个提示框在屏幕上堆叠
        const existingToast = document.querySelector('.UrlPureFly_toast');
        if (existingToast) existingToast.remove();

        // 2. 创建新的提示框 DOM
        const toast = document.createElement('div');
        toast.className = `UrlPureFly_toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 3. 使用 requestAnimationFrame 确保 DOM 渲染后再添加 class 触发 CSS 过渡动画
        requestAnimationFrame(() => toast.classList.add('show'));

        // 4. 设定 3 秒后自动隐藏并从 DOM 树中销毁
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // 等待淡出动画结束
        }, 3000);
    }

    /**
     * 生成或重置页面上的固定净化按钮
     */
    function generateFixedButtons() {
        // 1. 销毁旧按钮以避免重复
        createdButtons.forEach(btn => btn.parentNode?.removeChild(btn));
        createdButtons = [];

        const { positions, customX, customY } = getButtonPositionSettings();
        const isCurrentlyFullscreen = isFullscreen();

        // 2. 遍历配置生成对应位置的按钮
        positions.forEach((position, index) => {
            const button = document.createElement('button');
            button.className = 'UrlPureFly_fixed-btn';
            button.id = `UrlPureFly_${index}`;
            button.innerHTML = '🧹';
            button.title = '净化URL';
            button.dataset.positionType = position;

            // 全屏状态处理
            if (isCurrentlyFullscreen) {
                button.classList.add('UrlPureFly_fullscreen-hidden');
            }

            // 3. 样式绑定：区分自定义坐标和预设边角坐标
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

            // 4. 绑定点击净化事件并挂载
            button.addEventListener('click', handlePurifyAndCopy);
            document.body.appendChild(button);
            createdButtons.push(button);
        });
    }

    /**
     * 唤出设置面板（懒加载 DOM）
     */
    function showSettingsPanel() {
        let panel = document.getElementById('UrlPureFly_settingsPanel');
        // 如果面板尚未注入文档，则进行初次渲染和事件绑定
        if (!panel) {
            document.body.insertAdjacentHTML('beforeend', SETTINGS_HTML);
            bindSettingsEvents();
            panel = document.getElementById('UrlPureFly_settingsPanel');
        }

        // 同步用户设置到面板表单，并展现 UI
        loadSettingsToPanel();
        panel.classList.add('show');
        document.getElementById('UrlPureFly_settingsOverlay').classList.add('show');
    }

    /**
     * 隐藏设置面板
     */
    function hideSettingsPanel() {
        document.getElementById('UrlPureFly_settingsPanel')?.classList.remove('show');
        document.getElementById('UrlPureFly_settingsOverlay')?.classList.remove('show');
    }

    /**
     * 将油猴存储中的配置加载到设置面板的表单元素上
     */
    function loadSettingsToPanel() {
        const { positions, customX, customY } = getButtonPositionSettings();

        // 1. 重置所有多选框状态
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]')
                .forEach(cb => cb.checked = false);

        // 2. 勾选持久化的位置选项
        positions.forEach(pos => {
            const checkbox = document.getElementById(`UrlPureFly_pos-${pos}`);
            if (checkbox) checkbox.checked = true;
        });

        // 3. 恢复自定义 X/Y 轴的滑块及输入框数值
        ['X', 'Y'].forEach(axis => {
            const value = axis === 'X' ? customX : customY;
            document.getElementById(`UrlPureFly_slider${axis}`).value = value;
            document.getElementById(`UrlPureFly_slider${axis}Value`).value = value;
        });

        updateCustomPositionVisibility();
    }

    /**
     * 切换自定义坐标滑块区域的显示/隐藏（依据是否勾选"自定义位置"）
     */
    function updateCustomPositionVisibility() {
        const customGroup = document.getElementById('UrlPureFly_customPositionGroup');
        const isCustomChecked = document.getElementById('UrlPureFly_pos-custom').checked;
        customGroup.classList.toggle('show', isCustomChecked);
    }

    /**
     * 保存面板表单设置至持久化存储，并触发按钮重绘
     */
    function saveSettings() {
        // 1. 收集被选中的位置
        const positions = Array.from(document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        let customX = 50, customY = 50;

        // 2. 如果启用了自定义，则校验并抓取输入的 XY 坐标
        if (positions.includes('custom')) {
            const valX = parseInt(document.getElementById('UrlPureFly_sliderXValue').value);
            const valY = parseInt(document.getElementById('UrlPureFly_sliderYValue').value);
            customX = isNaN(valX) ? 50 : Math.max(0, Math.min(100, valX));
            customY = isNaN(valY) ? 50 : Math.max(0, Math.min(100, valY));
        }

        // 3. 持久化存储
        GM_setValue('buttonPositions', positions);
        GM_setValue('customPositionX', customX);
        GM_setValue('customPositionY', customY);

        // 4. 重绘并关闭面板
        generateFixedButtons();
        hideSettingsPanel();
        showToast('✓ 设置已保存，按钮位置已更新', 'success');
    }

    /**
     * 实时预览自定义按钮的移动位置 (拖动滑块时触发)
     */
    function updateRealtimeButtons() {
        const x = parseInt(document.getElementById('UrlPureFly_sliderX').value);
        const y = parseInt(document.getElementById('UrlPureFly_sliderY').value);

        const finalX = isNaN(x) ? 50 : x;
        const finalY = isNaN(y) ? 50 : y;

        // 更新输入框显示
        document.getElementById('UrlPureFly_sliderXValue').value = finalX;
        document.getElementById('UrlPureFly_sliderYValue').value = finalY;

        // 筛选出自定义按钮并实时更改其行内样式
        createdButtons.filter(btn => btn.dataset.positionType === 'custom').forEach(button => {
            button.style.left = `calc(${finalX} / 100 * (100vw - 50px))`;
            button.style.top = `calc(${finalY} / 100 * (100vh - 50px))`;
        });
    }

    /**
     * 绑定坐标滑块与数字输入框的相互联动事件
     * @param {string} axis - 坐标轴 'X' 或 'Y'
     */
    function bindSliderEvents(axis) {
        const slider = document.getElementById(`UrlPureFly_slider${axis}`);
        const input = document.getElementById(`UrlPureFly_slider${axis}Value`);
        if (!slider || !input) return;

        // 同步函数：校验边界并更新两个元素的值
        const syncValues = (val) => {
            let num = parseInt(val);
            if (isNaN(num)) return; // 容错非数字
            num = Math.max(0, Math.min(100, num)); // 限制在 0-100 之间
            slider.value = num;
            input.value = num;
            updateRealtimeButtons();
        };

        slider.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('blur', e => {
            const parsedVal = parseInt(e.target.value);
            // 失焦时如果输入为空或非法，重置为中心值50
            if (e.target.value === '' || isNaN(parsedVal)) {
                slider.value = 50;
                input.value = 50;
                updateRealtimeButtons();
            }
        });
    }

    /**
     * 统一绑定设置面板的所有用户交互事件
     */
    function bindSettingsEvents() {
        // 关闭与取消
        document.getElementById('UrlPureFly_settingsCloseBtn').addEventListener('click', hideSettingsPanel);
        document.getElementById('UrlPureFly_settingsOverlay').addEventListener('click', hideSettingsPanel);
        document.getElementById('UrlPureFly_settingsCancelBtn').addEventListener('click', () => {
            hideSettingsPanel();
            loadSettingsToPanel(); // 恢复取消前的状态
        });

        // 保存
        document.getElementById('UrlPureFly_settingsSaveBtn').addEventListener('click', saveSettings);

        // 阻止点击面板内部时事件冒泡导致触发遮罩层的关闭
        document.getElementById('UrlPureFly_settingsPanel').addEventListener('click', e => e.stopPropagation());

        // 监听位置复选框变化
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                updateCustomPositionVisibility();
                if (cb.value === 'custom' && cb.checked) updateRealtimeButtons();
            });
        });

        // 绑定滑块
        bindSliderEvents('X');
        bindSliderEvents('Y');
    }

    // ----------------- 核心净化逻辑 (URL Purification) -----------------

    /**
     * 统一调度核心的净化与复制流程
     */
    async function handlePurifyAndCopy() {
        const currentUrl = window.location.href;

        try {
            showToast('🔄 正在净化URL...', 'info');

            // 依次经过三种策略的清洗
            const purifiedUrl = await purifyUrl(currentUrl);

            // 写入剪贴板
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
            console.error('净化URL核心流程发生异常:', error);
            showToast('❌ 净化URL失败', 'error');
        }
    }

    /**
     * URL净化中枢控制器：调度重定向、正则、参数三种处理规则
     * @param {string} url - 原始URL
     * @returns {Promise<string>} 净化完成后的URL
     */
    async function purifyUrl(url) {
        let purifiedUrl = url;
        purifiedUrl = await applyRedirectRules(purifiedUrl);
        purifiedUrl = applyRegexRules(purifiedUrl);
        purifiedUrl = applyParamRules(purifiedUrl);
        return purifiedUrl;
    }

    /**
     * 策略一：处理重定向规则（需要跨域发起真实网络请求）
     * 作用：解析类似短链接、跳转链接背后的真实指向
     * @param {string} url - 需要处理的URL
     * @returns {Promise<string>} 解析后的真实URL
     */
    function applyRedirectRules(url) {
        return new Promise((resolve) => {
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname;

                // 命中重定向域名库
                const redirectRule = REDIRECT_RULES.find(rule => hostname.includes(rule.domain));

                if (redirectRule) {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        onload: function(response) {
                            // 从响应对象提取被重定向后的最终URL
                            resolve(response.finalUrl || url);
                        },
                        onerror: () => resolve(url),
                        ontimeout: () => resolve(url),
                        timeout: 5000
                    });
                } else {
                    resolve(url);
                }
            } catch (e) {
                // 处理无效URL等异常
                resolve(url);
            }
        });
    }

    /**
     * 策略二：处理正则规则
     * 作用：处理特定的路径转换或复杂的URL字符串替换
     * @param {string} url - 需要处理的URL
     * @returns {string} 替换后的URL
     */
    function applyRegexRules(url) {
        let result = url;

        for (const rule of REGEX_RULES) {
            // 兼容单个正则替换规则
            if (rule.regex && rule.replacement !== undefined) {
                result = result.replace(rule.regex, rule.replacement);
            }

            // 兼容多步正则替换规则 (如 Pixiv 等)
            if (rule.patterns && rule.patterns.length > 0 && rule.replacements) {
                let tempResult = result;
                for (let i = 0; i < rule.patterns.length; i++) {
                    // 防止越界
                    if (rule.replacements[i] !== undefined) {
                        tempResult = tempResult.replace(rule.patterns[i], rule.replacements[i]);
                    }
                }
                result = tempResult;
            }
        }

        return result;
    }

    /**
     * 策略三：处理URL Search参数规则
     * 作用：通过黑白名单策略剔除 URL 问号后面的跟踪参数（如 ?spm=xxx）
     * @param {string} url - 需要处理的URL
     * @returns {string} 剔除多余参数后的URL
     */
    function applyParamRules(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            const paramRule = PARAM_RULES.find(rule => hostname.includes(rule.domain));

            if (paramRule) {
                if (paramRule.mode === 'whitelist') {
                    // 白名单模式：新建参数列表，仅保留名单内参数
                    const params = urlObj.searchParams;
                    const newParams = new URLSearchParams();
                    paramRule.params.forEach(param => {
                        if (params.has(param)) {
                            newParams.set(param, params.get(param));
                        }
                    });
                    urlObj.search = newParams.toString();

                } else if (paramRule.mode === 'blacklist') {
                    // 黑名单模式：遍历名单逐个剔除特定参数
                    paramRule.params.forEach(param => {
                        urlObj.searchParams.delete(param);
                    });
                }
            }

            return urlObj.toString();
        } catch (e) {
            console.error('参数规则处理失败:', e);
            return url;
        }
    }


    /* =========================================================================
     * 3. HTML 模板 (HTML Templates)
     * ========================================================================= */

    /**
     * 设置面板的 DOM 结构字符串
     * 包含：半透明遮罩层 (Overlay) + 主面板 (Panel)
     * 主面板内分 Header(标题与关闭按钮)、Body(复选框和自定义滑块组)、Footer(取消/保存按钮)
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


    /* =========================================================================
     * 4. CSS 样式 (CSS Styles)
     * ========================================================================= */

    /**
     * 插件全局样式表
     * 为了防止污染原网站样式，均使用 UrlPureFly_ 前缀命名。
     */
    const APP_CSS = `
        /* ----------------------- 1. 消息提示框 (Toast) ----------------------- */
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
     * 5. 净化规则 (URL Purification Rules)
     * ========================================================================= */

    /**
     * URL Query 参数净化规则配置库 (黑白名单策略)
     */
    const PARAM_RULES = [
        { domain: 'music.apple.com', mode: 'whitelist', params: [], author: 'mitian233' },
        { domain: 'tieba.baidu.com', mode: 'whitelist', params: [], author: '青墨' },
        { domain: 't.bilibili.com', mode: 'whitelist', params: [], author: '青墨' },
        { domain: 'mall.bilibili.com', mode: 'whitelist', params: ['noTitleBar', 'itemsId'], author: '青墨' },
        { domain: 'space.bilibili.com', mode: 'whitelist', params: [], author: '青墨' },
        { domain: 'www.bilibili.com', mode: 'blacklist', params: ['i_transfer_match'], author: '青墨' },
        { domain: 'live.bilibili.com', mode: 'whitelist', params: [], author: '青墨' },
        { domain: 'www.disneyplus.com', mode: 'whitelist', params: [], author: 'mitian233' },
        { domain: 'www.dlsite.com', mode: 'whitelist', params: [], author: 'MateChan' },
        { domain: 'www.right.com.cn', mode: 'blacklist', params: ['authorid', 'extra'], author: 'ous50' },
        { domain: 'www.google.com', mode: 'whitelist', params: ['q'], author: 'MateChan' },
        { domain: 'm.okjike.com', mode: 'whitelist', params: [], author: 'TCOTC' },
        { domain: 'www.netflix.com', mode: 'whitelist', params: [], author: 'mitian233' },
        { domain: 'h5.qzone.qq.com', mode: 'whitelist', params: ['sharetag', 'appid'], author: 'PRO-2684' },
        { domain: 'qun.qq.com', mode: 'whitelist', params: ['inviteCode'], author: '青墨' },
        { domain: 'static-play.kg.qq.com', mode: 'whitelist', params: ['s'], author: '青墨' },
        { domain: 'www.reddit.com', mode: 'whitelist', params: [], author: 'Dreista' },
        { domain: 'open.spotify.com', mode: 'whitelist', params: [], author: 'lz233' },
        { domain: 'm.tb.cn', mode: 'whitelist', params: [], author: 'lz233' },
        { domain: 'm.v.qq.com', mode: 'whitelist', params: ['vid'], author: 'returnL、青墨' },
        { domain: 'www.tiktok.com', mode: 'whitelist', params: [], author: 'Mattis' },
        { domain: 'weread.qq.com', mode: 'whitelist', params: ['v'], author: 'lz233' },
        { domain: 'mp.weixin.qq.com', mode: 'whitelist', params: ['__biz', 'mid', 'idx', 'sn'], author: 'PRO-2684' },
        { domain: 'k.youshop10.com', mode: 'whitelist', params: [], author: 'kirito' },
        { domain: 'www.xiaohongshu.com', mode: 'whitelist', params: [], author: 'RtYkk' },
        { domain: 'www.youtube.com', mode: 'whitelist', params: ['v'], author: 'Mosney' },
        { domain: 'youtu.be', mode: 'whitelist', params: [], author: 'Mosney' },
        { domain: 'www.zhihu.com', mode: 'whitelist', params: [], author: 'lz233' },
        { domain: 'zhuanlan.zhihu.com', mode: 'whitelist', params: [], author: 'TCOTC' },
        { domain: 'plat-miniapp.zuoyebang.com', mode: 'whitelist', params: ['cuid', 'ishit'], author: 'omg-xtao' },
        { domain: 'www.flyert.com.cn', mode: 'whitelist', params: [], author: 'pplulee' }
    ];

    /**
     * 正则表达式匹配替换规则库 (包含多步替换和回调函数替换)
     */
    const REGEX_RULES = [
        {
            name: 'Amazon Japan',
            regex: /amazon\.co\.jp\/.*\/dp\/.*ref=.*/,
            replacement: 'amazon.co.jp/dp',
            author: 'MateChan'
        },
        {
            name: '哔哩哔哩视频分享',
            regex: /(http|https):\/\/(m|www)*\.?bilibili\.com\/video\/.*/,
            replacement: (match) => {
                const bvMatch = match.match(/\/video\/(BV[a-zA-Z0-9]+)/);
                return bvMatch ? `https://www.bilibili.com/video/${bvMatch[1]}` : match;
            },
            author: 'lz233'
        },
        {
            name: '哔哩哔哩手机版动态分享',
            regex: /m\.bilibili\.com\/dynamic/,
            replacement: 't.bilibili.com',
            author: 'FTReey'
        },
        {
            name: '豆瓣',
            regex: /_spm_id=.*/,
            replacement: '',
            author: 'ChellyL'
        },
        {
            name: 'E绅士表站',
            regex: /exhentai\.org/,
            replacement: 'e-hentai.org',
            author: 'ous50'
        },
        {
            name: 'Fanbox',
            regex: /.fanbox\.cc\?.*/,
            replacement: '.fanbox.cc',
            author: 'omg-xtao'
        },
        {
            name: '华为应用市场',
            regex: /appgallery\.huawei\.com\/app\/.*/,
            replacement: (match) => {
                const idMatch = match.match(/app\/([^?]+)/);
                return idMatch ? `https://appgallery.cloud.huawei.com/appdl/${idMatch[1]}` : match;
            },
            author: 'PianCat'
        },
        {
            name: 'Instagram/Threads',
            regex: /(\?igshid=.*|\?igsh=.*)/,
            replacement: '',
            author: 'Zois'
        },
        {
            name: '京东',
            regex: /item\.m\.jd\.com\/product\/.*\.html\?.*/,
            replacement: (match) => {
                const idMatch = match.match(/product\/(\d+)\.html/);
                return idMatch ? `https://item.jd.com/${idMatch[1]}.html` : match;
            },
            author: 'lz233'
        },
        {
            name: '酷安',
            regex: /coolapk\.com\/.*\?.*/,
            replacement: (match) => {
                const pathMatch = match.match(/coolapk\.com\/(.*)\?/);
                return pathMatch ? `https://www.coolapk1s.com/${pathMatch[1]}` : match;
            },
            author: 'lz233'
        },
        {
            name: 'Pixiv',
            patterns: [
                /(www\.)?pixiv\.net\/artworks\/(\d+)(#.*)?$/,
                /(\d+)#(.*)/
            ],
            replacements: [
                'pixiv.re/$2.png',
                '$1-$2'
            ],
            author: 'lz233'
        },
        {
            name: 'Pixiv长链接缩短',
            regex: /member_illust\.php\?mode=medium&illust_id=(\d+)/,
            replacement: 'artworks/$1',
            author: 'FTReey'
        },
        {
            name: 'Pixiv跳转',
            regex: /(https?:\/\/)(www\.)?pixiv\.net\/jump\.php\?url=(.+)/,
            replacement: '$3',
            author: 'FTReey'
        },
        {
            name: 'QQ空间外链',
            regex: /https?:\/\/www\.urlshare\.cn\/(.*&)?url=([^&]+).*/,
            replacement: '$2',
            author: 'PRO-2684'
        },
        {
            name: '什么值得买',
            regex: /(https:\/\/test\.smzdm\.com\/p\/\d+)(\?.*)|(https:\/\/.*\.smzdm\.com\/.*\/)(.*)/,
            replacement: '$1$3',
            author: '加藤日向'
        },
        {
            name: 'fxtwitter',
            regex: /https?:\/\/(twitter|x)\.com\/.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/(.*)\?/);
                if (pathMatch) return `https://fxtwitter.com/${pathMatch[1]}`;
                return match.replace(/https?:\/\/(twitter|x)\.com/, 'https://fxtwitter.com').replace(/\?.*/, '');
            },
            author: 'qrqr'
        },
        {
            name: 'fixupx',
            regex: /https?:\/\/(twitter|x)\.com\/.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/(.*)\?/);
                if (pathMatch) return `https://fixupx.com/${pathMatch[1]}`;
                return match.replace(/https?:\/\/(twitter|x)\.com/, 'https://fixupx.com').replace(/\?.*/, '');
            },
            author: 'lz233'
        },
        {
            name: 'Twitter UID链接优化',
            regex: /twitter\.com\/i\/user\//,
            replacement: 'twitter.com/intent/user?user_id=',
            author: 'FTReey'
        },
        {
            name: 'Twitter去跟踪',
            regex: /(http|https):\/\/(www\.)?twitter\.com.*\?.*/,
            replacement: (match) => match.replace(/\?.*/, ''),
            author: 'FTReey'
        },
        {
            name: '微博轻享版',
            regex: /share\.api\.weibo\.cn\/share\/.*weibo_id=/,
            replacement: 'm.weibo.cn/status/',
            author: '三泽'
        },
        {
            name: '移动端微博用户页',
            regex: /m\.weibo\.cn\/profile/,
            replacement: 'weibo.com/u',
            author: 'FTReey'
        },
        {
            name: '移动端微博链接去跟踪',
            regex: /http(s)?:\/\/m\.weibo\.cn\/.*\?.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/status\/(\d+)/);
                return pathMatch ? `https://m.weibo.cn/status/${pathMatch[1]}` : match.replace(/\?.*/, '');
            },
            author: 'FTReey'
        },
        {
            name: '网易云音乐',
            regex: /https?:\/\/.*\.?music\.163\.com\/.*id=(\d+).*/,
            replacement: 'https://music.163.com/song?id=$2',
            author: 'lz233'
        },
        {
            name: '小红书',
            regex: /http:\/\/xhslink\.com\w*/,
            replacement: (match) => match.replace('http://', 'https://'),
            author: 'lz233'
        },
        {
            name: 'YouTube Mobile',
            regex: /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/,
            replacement: 'https://youtube.com/watch?v=$1',
            author: 'ous50'
        },
        {
            name: 'YouTube NormalLink',
            regex: /(https?:\/\/)(www\.)?(youtube\.com)(\/watch\?v=[a-zA-Z0-9_-]+)(\?si=[A-Za-z0-9_-]+)?/,
            replacement: '$1$2$3$4',
            author: 'HinataKato'
        },
        {
            name: 'YouTube ShortLink',
            regex: /(https?:\/\/)(www\.)?(youtu\.be)(\/[A-Za-z0-9_-]+)(\?si=[A-Za-z0-9_-]+)?/,
            replacement: '$1$2$3$4',
            author: 'HinataKato'
        },
        {
            name: '知乎关怀版',
            regex: /www\.zhihu\.com\/question.*\?.*/,
            replacement: (match) => match.replace(/\?.*/, '').replace('www.zhihu.com/question', 'www.zhihu.com/aria/question'),
            author: 'BingoKingo'
        }
    ];

    /**
     * 重定向网络请求探测规则库
     */
    const REDIRECT_RULES = [
        { domain: 'b23.tv', author: 'lz233' },
        { domain: 'bili2233.cn', author: 'Zorroblanco' },
        { domain: 'vm.tiktok.com', author: 'Mattis' },
        { domain: '163cn.tv', author: 'lz233' }
    ];

    // =========================================================================
    // * 启动执行 (Execution)
    // =========================================================================

    // 由于变量提升，init及相关函数能正确访问位于后部的 HTML/CSS 和规则库常量
    init();
})();