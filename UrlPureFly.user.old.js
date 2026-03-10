// ==UserScript==
// @name         UrlPureFly - URL净化助手
// @namespace    UrlPureFly
// @version      1.0.0
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

    // 状态缓存
    let createdButtons = [];

    // --- 初始化入口 ---
    function init() {
        // 1. 注入 CSS 样式
        GM_addStyle(APP_CSS);

        // 2. 注册油猴菜单
        GM_registerMenuCommand('⚙️ 按钮位置设置', showSettingsPanel);

        // 3. 生成主净化按钮
        generateFixedButtons();

        // 4. 监听窗口大小变化以更新自定义按钮位置
        window.addEventListener('resize', debounce(generateFixedButtons, 300));

        // 5. 监听全屏状态变化
        setupFullscreenListener();
    }

    /* =========================================================================
     * 2. JS 函数 (Functions)
     * ========================================================================= */

    /**
     * 防抖函数，限制高频事件的触发频率
     * @param {Function} func - 需要防抖的函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {Function} 包装后的防抖函数
     */
    function debounce(func, delay) {
        let timer = null;
        return function(...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                func.apply(this, args);
                timer = null;
            }, delay);
        };
    }

    /**
     * 检测是否处于全屏状态
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
     * 设置全屏状态监听
     */
    function setupFullscreenListener() {
        const handleFullscreenChange = () => {
            const toasts = document.querySelectorAll('.UrlPureFly_toast');

            if (isFullscreen()) {
                // 进入全屏，隐藏按钮和提示框
                createdButtons.forEach(btn => {
                    btn.classList.add('UrlPureFly_fullscreen-hidden');
                });
                toasts.forEach(toast => {
                    toast.classList.add('UrlPureFly_fullscreen-hidden');
                });
            } else {
                // 退出全屏，显示按钮和提示框
                createdButtons.forEach(btn => {
                    btn.classList.remove('UrlPureFly_fullscreen-hidden');
                });
                toasts.forEach(toast => {
                    toast.classList.remove('UrlPureFly_fullscreen-hidden');
                });
            }
        };

        // 监听各种全屏事件
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    /**
     * 获取用户设置的按钮位置状态
     * @returns {Object} 包含选中位置数组及自定义 X、Y 坐标的对象
     */
    function getButtonPositionSettings() {
        return {
            positions: GM_getValue('buttonPositions', DEFAULT_SETTINGS.buttonPositions),
            customX: parseInt(GM_getValue('customPositionX', 50)),
            customY: parseInt(GM_getValue('customPositionY', 50))
        };
    }

    /**
     * 在页面中显示自毁式通知气泡
     * @param {string} message - 提示消息
     * @param {string} [type='success'] - 提示类型: 'success', 'info', 'warning', 'error'
     */
    function showToast(message, type = 'success') {
        // 清理现存提示框避免堆叠
        const existingToast = document.querySelector('.UrlPureFly_toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = `UrlPureFly_toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 使用帧动画触发过渡效果
        requestAnimationFrame(() => toast.classList.add('show'));

        // 3秒后自动隐藏并销毁
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    /**
     * URL净化核心函数
     * @param {string} url - 需要净化的URL
     * @returns {Promise<string>} 净化后的URL
     */
    async function purifyUrl(url) {
        let purifiedUrl = url;

        // 1. 处理重定向规则
        purifiedUrl = await applyRedirectRules(purifiedUrl);

        // 2. 处理正则规则
        purifiedUrl = applyRegexRules(purifiedUrl);

        // 3. 处理参数规则
        purifiedUrl = applyParamRules(purifiedUrl);

        return purifiedUrl;
    }

    /**
     * 处理重定向规则（需要网络请求）
     * @param {string} url - 需要处理的URL
     * @returns {Promise<string>} 处理后的URL
     */
    function applyRedirectRules(url) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            // 查找匹配的重定向规则
            const redirectRule = REDIRECT_RULES.find(rule => hostname.includes(rule.domain));

            if (redirectRule) {
                // 发起网络请求获取重定向后的真实URL
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    onload: function(response) {
                        // 从响应头中获取重定向URL
                        const finalUrl = response.finalUrl || url;
                        resolve(finalUrl);
                    },
                    onerror: function() {
                        resolve(url);
                    },
                    ontimeout: function() {
                        resolve(url);
                    },
                    timeout: 5000
                });
            } else {
                resolve(url);
            }
        });
    }

    /**
     * 处理正则规则
     * @param {string} url - 需要处理的URL
     * @returns {string} 处理后的URL
     */
    function applyRegexRules(url) {
        let result = url;

        // 应用所有正则规则
        for (const rule of REGEX_RULES) {
            if (rule.patterns.length === 0) {
                // 单个正则替换
                result = result.replace(rule.regex, rule.replacement);
            } else {
                // 多步正则替换（如Pixiv等复杂规则）
                let tempResult = result;
                for (let i = 0; i < rule.patterns.length; i++) {
                    tempResult = tempResult.replace(rule.patterns[i], rule.replacements[i]);
                }
                if (tempResult !== result) {
                    result = tempResult;
                }
            }
        }

        return result;
    }

    /**
     * 处理参数规则
     * @param {string} url - 需要处理的URL
     * @returns {string} 处理后的URL
     */
    function applyParamRules(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            // 查找匹配的参数规则
            const paramRule = PARAM_RULES.find(rule => hostname.includes(rule.domain));

            if (paramRule) {
                if (paramRule.mode === 'whitelist') {
                    // 白名单模式：只保留指定参数
                    const params = urlObj.searchParams;
                    const newParams = new URLSearchParams();

                    paramRule.params.forEach(param => {
                        if (params.has(param)) {
                            newParams.set(param, params.get(param));
                        }
                    });

                    urlObj.search = newParams.toString();
                } else if (paramRule.mode === 'blacklist') {
                    // 黑名单模式：移除指定参数
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

    /**
     * 统一处理净化URL并复制到剪贴板的逻辑
     */
    async function handlePurifyAndCopy() {
        const currentUrl = window.location.href;

        try {
            showToast('🔄 正在净化URL...', 'info');

            const purifiedUrl = await purifyUrl(currentUrl);

            navigator.clipboard.writeText(purifiedUrl).then(() => {
                if (purifiedUrl !== currentUrl) {
                    showToast('✅ URL已净化并复制到剪贴板', 'success');
                } else {
                    showToast('ℹ️ URL无需净化', 'info');
                }
            }).catch(err => {
                console.error('复制到剪贴板失败:', err);
                showToast('❌ 复制失败，请手动复制', 'error');
            });
        } catch (error) {
            console.error('净化URL失败:', error);
            showToast('❌ 净化URL失败', 'error');
        }
    }

    /**
     * 初始化/重置固定净化按钮
     */
    function generateFixedButtons() {
        // 先清理可能存在的旧按钮
        createdButtons.forEach(btn => btn.parentNode?.removeChild(btn));
        createdButtons = [];

        const { positions, customX, customY } = getButtonPositionSettings();
        const isCurrentlyFullscreen = isFullscreen();

        // 遍历设置中的位置并生成按钮
        positions.forEach((position, index) => {
            const button = document.createElement('button');
            button.className = 'UrlPureFly_fixed-btn';
            button.id = `UrlPureFly_${index}`;
            button.innerHTML = '🧹';
            button.title = '净化URL';
            button.dataset.positionType = position;

            // 如果当前处于全屏状态，添加隐藏类
            if (isCurrentlyFullscreen) {
                button.classList.add('UrlPureFly_fullscreen-hidden');
            }

            // 根据类型绑定样式
            if (position === 'custom') {
                button.style.left = `calc(${customX} / 100 * (100vw - 50px))`;
                button.style.top = `calc(${customY} / 100 * (100vh - 50px))`;
                button.style.borderRadius = '25px'; // 胶囊形状
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

    /**
     * 显示设置面板，如果未创建则先创建
     */
    function showSettingsPanel() {
        let panel = document.getElementById('UrlPureFly_settingsPanel');
        if (!panel) {
            // 注入模板 HTML
            document.body.insertAdjacentHTML('beforeend', SETTINGS_HTML);
            bindSettingsEvents();
            panel = document.getElementById('UrlPureFly_settingsPanel');
        }

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
     * 加载保存的设置参数到面板的交互元素中
     */
    function loadSettingsToPanel() {
        const { positions, customX, customY } = getButtonPositionSettings();

        // 重置所有复选框
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]').forEach(cb => cb.checked = false);

        // 勾选用户已保存的位置
        positions.forEach(pos => {
            const checkbox = document.getElementById(`UrlPureFly_pos-${pos}`);
            if (checkbox) checkbox.checked = true;
        });

        // 恢复自定义滑块/输入框的值
        ['X', 'Y'].forEach(axis => {
            const value = axis === 'X' ? customX : customY;
            document.getElementById(`UrlPureFly_slider${axis}`).value = value;
            document.getElementById(`UrlPureFly_slider${axis}Value`).value = value;
        });

        updateCustomPositionVisibility();
    }

    /**
     * 切换自定义坐标设置容器的可见性
     */
    function updateCustomPositionVisibility() {
        const customGroup = document.getElementById('UrlPureFly_customPositionGroup');
        const isCustomChecked = document.getElementById('UrlPureFly_pos-custom').checked;
        customGroup.classList.toggle('show', isCustomChecked);
    }

    /**
     * 保存面板设置并重新渲染按钮
     */
    function saveSettings() {
        const positions = Array.from(document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        let customX = 50, customY = 50;

        if (positions.includes('custom')) {
            const valX = parseInt(document.getElementById('UrlPureFly_sliderXValue').value);
            const valY = parseInt(document.getElementById('UrlPureFly_sliderYValue').value);
            customX = isNaN(valX) ? 50 : Math.max(0, Math.min(100, valX));
            customY = isNaN(valY) ? 50 : Math.max(0, Math.min(100, valY));
        }

        GM_setValue('buttonPositions', positions);
        GM_setValue('customPositionX', customX);
        GM_setValue('customPositionY', customY);

        generateFixedButtons();
        hideSettingsPanel();
        showToast('✓ 设置已保存，按钮位置已更新', 'success');
    }

    /**
     * 实时更新自定义位置的按钮位置 (拖动滑块时)
     */
    function updateRealtimeButtons() {
        const x = parseInt(document.getElementById('UrlPureFly_sliderX').value);
        const y = parseInt(document.getElementById('UrlPureFly_sliderY').value);

        document.getElementById('UrlPureFly_sliderXValue').value = isNaN(x) ? 50 : x;
        document.getElementById('UrlPureFly_sliderYValue').value = isNaN(y) ? 50 : y;

        const finalX = isNaN(x) ? 50 : x;
        const finalY = isNaN(y) ? 50 : y;

        createdButtons.filter(btn => btn.dataset.positionType === 'custom').forEach(button => {
            button.style.left = `calc(${finalX} / 100 * (100vw - 50px))`;
            button.style.top = `calc(${finalY} / 100 * (100vh - 50px))`;
        });
    }

    /**
     * 绑定滑块与输入框的联动事件
     * @param {string} axis - 坐标轴 'X' 或 'Y'
     */
    function bindSliderEvents(axis) {
        const slider = document.getElementById(`UrlPureFly_slider${axis}`);
        const input = document.getElementById(`UrlPureFly_slider${axis}Value`);
        if (!slider || !input) return;

        const syncValues = (val) => {
            let num = parseInt(val);
            // 只有当值不是数字时才返回，0是有效值
            if (isNaN(num)) return;
            num = Math.max(0, Math.min(100, num));
            slider.value = num;
            input.value = num;
            updateRealtimeButtons();
        };

        slider.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('input', e => syncValues(e.target.value));
        input.addEventListener('blur', e => {
            const parsedVal = parseInt(e.target.value);
            // 只有当输入为空或不是数字时才重置为50，0是有效值
            if (e.target.value === '' || isNaN(parsedVal)) {
                slider.value = 50;
                input.value = 50;
                updateRealtimeButtons();
            }
        });
    }

    /**
     * 统一绑定设置面板的所有交互事件
     */
    function bindSettingsEvents() {
        document.getElementById('UrlPureFly_settingsCloseBtn').addEventListener('click', hideSettingsPanel);
        document.getElementById('UrlPureFly_settingsOverlay').addEventListener('click', hideSettingsPanel);

        document.getElementById('UrlPureFly_settingsCancelBtn').addEventListener('click', () => {
            hideSettingsPanel();
            loadSettingsToPanel();
        });

        document.getElementById('UrlPureFly_settingsSaveBtn').addEventListener('click', saveSettings);

        // 阻止点击面板内部时冒泡关闭
        document.getElementById('UrlPureFly_settingsPanel').addEventListener('click', e => e.stopPropagation());

        // 监听位置复选框变化
        document.querySelectorAll('#UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                updateCustomPositionVisibility();
                if (cb.value === 'custom' && cb.checked) updateRealtimeButtons();
            });
        });

        // 绑定滑块与输入框联动
        bindSliderEvents('X');
        bindSliderEvents('Y');
    }

    /* =========================================================================
     * 3. HTML 模板 (HTML Templates)
     * ========================================================================= */

    // 设置面板与遮罩层的 DOM 结构
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

    const APP_CSS = `
        /* ----------------------- 通用消息提示框 ----------------------- */
        .UrlPureFly_toast {
            position: fixed;
            bottom: -100px;
            left: 50%;
            transform: translateX(-50%);
            min-width: 250px;
            max-width: 400px;
            padding: 16px 24px;
            background-color: #00aeec;
            color: #fff;
            text-align: center;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            opacity: 0;
            transition: all 0.4s ease;
            z-index: 9999;
            font-size: 14px;
            font-weight: 500;
        }
        .UrlPureFly_toast.show { bottom: 30px; opacity: 1; }
        .UrlPureFly_toast.info { background-color: #00aeec; }
        .UrlPureFly_toast.success { background-color: #52c41a; }
        .UrlPureFly_toast.warning { background-color: #faad14; }
        .UrlPureFly_toast.error { background-color: #f5222d; }
        /* 全屏状态下隐藏提示框 */
        .UrlPureFly_toast.UrlPureFly_fullscreen-hidden {
            display: none !important;
        }

        /* ----------------------- 全局悬浮主按钮 ----------------------- */
        .UrlPureFly_fixed-btn {
            position: fixed !important;
            z-index: 9999 !important;
            width: 50px !important;
            height: 50px !important;
            color: rgb(255, 255, 255) !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border: none !important;
            font-size: 24px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            line-height: 1 !important;
            padding: 0 !important;
            transition: all 0.3s ease !important;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
        }
        .UrlPureFly_fixed-btn:hover {
            transform: scale(1.1) !important;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6) !important;
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%) !important;
        }
        .UrlPureFly_fixed-btn:active {
            transform: scale(0.95) !important;
        }
        /* 全屏状态下隐藏按钮 */
        .UrlPureFly_fixed-btn.UrlPureFly_fullscreen-hidden {
            display: none !important;
        }

        /* ----------------------- 设置面板及元素 ----------------------- */
        #UrlPureFly_settingsOverlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5); z-index: 99999; display: none;
        }
        #UrlPureFly_settingsOverlay.show { display: block; }

        #UrlPureFly_settingsPanel {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 450px; max-width: 90vw; background: white; border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            display: none;
        }
        #UrlPureFly_settingsPanel.show { display: block; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header {
            padding: 20px; border-bottom: 1px solid #e0e0e0;
            display: flex; justify-content: space-between; align-items: center;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header h2 { margin: 0; font-size: 20px; color: #333; font-weight: 600; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header .UrlPureFly_close-btn {
            background: none; border: none; font-size: 24px; cursor: pointer;
            color: #999; padding: 0; width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-header .UrlPureFly_close-btn:hover { background: #f0f0f0; color: #333; }

        #UrlPureFly_settingsPanel .UrlPureFly_settings-body { padding: 20px; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section { margin-bottom: 20px; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section:last-child { margin-bottom: 0; }
        #UrlPureFly_settingsPanel .UrlPureFly_settings-section h3 { margin: 0 0 12px 0; font-size: 16px; color: #333; font-weight: 500; }

        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-group { display: flex; flex-direction: column; gap: 8px; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item {
            display: flex; align-items: center; gap: 8px; cursor: pointer;
            padding: 8px 12px; border-radius: 6px; transition: background 0.2s;
        }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item:hover { background: #f5f5f5; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: #667eea; }
        #UrlPureFly_settingsPanel .UrlPureFly_checkbox-item label { cursor: pointer; font-size: 14px; color: #333; flex: 1; }

        /* 滑块位置调整区域 */
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
            flex: 1; width: 100%; height: 6px; border-radius: 3px; background: #e0e0e0;
            outline: none; -webkit-appearance: none; cursor: pointer;
        }
        .UrlPureFly_slider-container input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 18px; height: 18px;
            border-radius: 50%; background: #667eea; cursor: pointer;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); transition: all 0.2s;
        }
        .UrlPureFly_slider-container input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3); }
        .UrlPureFly_position-tips { margin-top: 12px; font-size: 12px; color: #999; text-align: center; }

        /* 底部操作按钮 */
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

    // 参数规则
    const PARAM_RULES = [
        {
            domain: 'music.apple.com',
            mode: 'whitelist',
            params: [],
            author: 'mitian233'
        },
        {
            domain: 'tieba.baidu.com',
            mode: 'whitelist',
            params: [],
            author: '青墨'
        },
        {
            domain: 't.bilibili.com',
            mode: 'whitelist',
            params: [],
            author: '青墨'
        },
        {
            domain: 'mall.bilibili.com',
            mode: 'whitelist',
            params: ['noTitleBar', 'itemsId'],
            author: '青墨'
        },
        {
            domain: 'space.bilibili.com',
            mode: 'whitelist',
            params: [],
            author: '青墨'
        },
        {
            domain: 'www.bilibili.com',
            mode: 'blacklist',
            params: ['i_transfer_match'],
            author: '青墨'
        },
        {
            domain: 'live.bilibili.com',
            mode: 'whitelist',
            params: [],
            author: '青墨'
        },
        {
            domain: 'www.disneyplus.com',
            mode: 'whitelist',
            params: [],
            author: 'mitian233'
        },
        {
            domain: 'www.dlsite.com',
            mode: 'whitelist',
            params: [],
            author: 'MateChan'
        },
        {
            domain: 'www.right.com.cn',
            mode: 'blacklist',
            params: ['authorid', 'extra'],
            author: 'ous50'
        },
        {
            domain: 'www.google.com',
            mode: 'whitelist',
            params: ['q'],
            author: 'MateChan'
        },
        {
            domain: 'm.okjike.com',
            mode: 'whitelist',
            params: [],
            author: 'TCOTC'
        },
        {
            domain: 'www.netflix.com',
            mode: 'whitelist',
            params: [],
            author: 'mitian233'
        },
        {
            domain: 'h5.qzone.qq.com',
            mode: 'whitelist',
            params: ['sharetag', 'appid'],
            author: 'PRO-2684'
        },
        {
            domain: 'qun.qq.com',
            mode: 'whitelist',
            params: ['inviteCode'],
            author: '青墨'
        },
        {
            domain: 'static-play.kg.qq.com',
            mode: 'whitelist',
            params: ['s'],
            author: '青墨'
        },
        {
            domain: 'www.reddit.com',
            mode: 'whitelist',
            params: [],
            author: 'Dreista'
        },
        {
            domain: 'open.spotify.com',
            mode: 'whitelist',
            params: [],
            author: 'lz233'
        },
        {
            domain: 'm.tb.cn',
            mode: 'whitelist',
            params: [],
            author: 'lz233'
        },
        {
            domain: 'm.v.qq.com',
            mode: 'whitelist',
            params: ['vid'],
            author: 'returnL、青墨'
        },
        {
            domain: 'www.tiktok.com',
            mode: 'whitelist',
            params: [],
            author: 'Mattis'
        },
        {
            domain: 'weread.qq.com',
            mode: 'whitelist',
            params: ['v'],
            author: 'lz233'
        },
        {
            domain: 'mp.weixin.qq.com',
            mode: 'whitelist',
            params: ['__biz', 'mid', 'idx', 'sn'],
            author: 'PRO-2684'
        },
        {
            domain: 'k.youshop10.com',
            mode: 'whitelist',
            params: [],
            author: 'kirito'
        },
        {
            domain: 'www.xiaohongshu.com',
            mode: 'whitelist',
            params: [],
            author: 'RtYkk'
        },
        {
            domain: 'www.youtube.com',
            mode: 'whitelist',
            params: ['v'],
            author: 'Mosney'
        },
        {
            domain: 'youtu.be',
            mode: 'whitelist',
            params: [],
            author: 'Mosney'
        },
        {
            domain: 'www.zhihu.com',
            mode: 'whitelist',
            params: [],
            author: 'lz233'
        },
        {
            domain: 'zhuanlan.zhihu.com',
            mode: 'whitelist',
            params: [],
            author: 'TCOTC'
        },
        {
            domain: 'plat-miniapp.zuoyebang.com',
            mode: 'whitelist',
            params: ['cuid', 'ishit'],
            author: 'omg-xtao'
        },
        {
            domain: 'www.flyert.com.cn',
            mode: 'whitelist',
            params: [],
            author: 'pplulee'
        }
    ];

    // 正则规则
    const REGEX_RULES = [
        {
            name: 'Amazon Japan',
            patterns: [],
            regex: /amazon\.co\.jp\/.*\/dp\/.*ref=.*/,
            replacement: 'amazon.co.jp/dp',
            author: 'MateChan'
        },
        {
            name: '哔哩哔哩视频分享',
            patterns: [],
            regex: /(http|https):\/\/(m|www)*\.?bilibili\.com\/video\/.*/,
            replacement: (match) => {
                const bvMatch = match.match(/\/video\/(BV[a-zA-Z0-9]+)/);
                if (bvMatch) {
                    return `https://www.bilibili.com/video/${bvMatch[1]}`;
                }
                return match;
            },
            author: 'lz233'
        },
        {
            name: '哔哩哔哩手机版动态分享',
            patterns: [],
            regex: /m\.bilibili\.com\/dynamic/,
            replacement: 't.bilibili.com',
            author: 'FTReey'
        },
        {
            name: '豆瓣',
            patterns: [],
            regex: /_spm_id=.*/,
            replacement: '',
            author: 'ChellyL'
        },
        {
            name: 'E绅士表站',
            patterns: [],
            regex: /exhentai\.org/,
            replacement: 'e-hentai.org',
            author: 'ous50'
        },
        {
            name: 'Fanbox',
            patterns: [],
            regex: /.fanbox\.cc\?.*/,
            replacement: '.fanbox.cc',
            author: 'omg-xtao'
        },
        {
            name: '华为应用市场',
            patterns: [],
            regex: /appgallery\.huawei\.com\/app\/.*/,
            replacement: (match) => {
                const idMatch = match.match(/app\/([^?]+)/);
                if (idMatch) {
                    return `https://appgallery.cloud.huawei.com/appdl/${idMatch[1]}`;
                }
                return match;
            },
            author: 'PianCat'
        },
        {
            name: 'Instagram/Threads',
            patterns: [],
            regex: /(\?igshid=.*|\?igsh=.*)/,
            replacement: '',
            author: 'Zois'
        },
        {
            name: '京东',
            patterns: [],
            regex: /item\.m\.jd\.com\/product\/.*\.html\?.*/,
            replacement: (match) => {
                const idMatch = match.match(/product\/(\d+)\.html/);
                if (idMatch) {
                    return `https://item.jd.com/${idMatch[1]}.html`;
                }
                return match;
            },
            author: 'lz233'
        },
        {
            name: '酷安',
            patterns: [],
            regex: /coolapk\.com\/.*\?.*/,
            replacement: (match) => {
                const pathMatch = match.match(/coolapk\.com\/(.*)\?/);
                if (pathMatch) {
                    return `https://www.coolapk1s.com/${pathMatch[1]}`;
                }
                return match;
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
            patterns: [],
            regex: /member_illust\.php\?mode=medium&illust_id=(\d+)/,
            replacement: 'artworks/$1',
            author: 'FTReey'
        },
        {
            name: 'Pixiv跳转',
            patterns: [],
            regex: /(https?:\/\/)(www\.)?pixiv\.net\/jump\.php\?url=(.+)/,
            replacement: '$3',
            author: 'FTReey'
        },
        {
            name: 'QQ空间外链',
            patterns: [],
            regex: /https?:\/\/www\.urlshare\.cn\/(.*&)?url=([^&]+).*/,
            replacement: '$2',
            author: 'PRO-2684'
        },
        {
            name: '什么值得买',
            patterns: [],
            regex: /(https:\/\/test\.smzdm\.com\/p\/\d+)(\?.*)|(https:\/\/.*\.smzdm\.com\/.*\/)(.*)/,
            replacement: '$1$3',
            author: '加藤日向'
        },
        {
            name: 'fxtwitter',
            patterns: [],
            regex: /https?:\/\/(twitter|x)\.com\/.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/(.*)\?/);
                if (pathMatch) {
                    return `https://fxtwitter.com/${pathMatch[1]}`;
                }
                return match.replace(/https?:\/\/(twitter|x)\.com/, 'https://fxtwitter.com').replace(/\?.*/, '');
            },
            author: 'qrqr'
        },
        {
            name: 'fixupx',
            patterns: [],
            regex: /https?:\/\/(twitter|x)\.com\/.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/(.*)\?/);
                if (pathMatch) {
                    return `https://fixupx.com/${pathMatch[1]}`;
                }
                return match.replace(/https?:\/\/(twitter|x)\.com/, 'https://fixupx.com').replace(/\?.*/, '');
            },
            author: 'lz233'
        },
        {
            name: 'Twitter UID链接优化',
            patterns: [],
            regex: /twitter\.com\/i\/user\//,
            replacement: 'twitter.com/intent/user?user_id=',
            author: 'FTReey'
        },
        {
            name: 'Twitter去跟踪',
            patterns: [],
            regex: /(http|https):\/\/(www\.)?twitter\.com.*\?.*/,
            replacement: (match) => {
                return match.replace(/\?.*/, '');
            },
            author: 'FTReey'
        },
        {
            name: '微博轻享版',
            patterns: [],
            regex: /share\.api\.weibo\.cn\/share\/.*weibo_id=/,
            replacement: 'm.weibo.cn/status/',
            author: '三泽'
        },
        {
            name: '移动端微博用户页',
            patterns: [],
            regex: /m\.weibo\.cn\/profile/,
            replacement: 'weibo.com/u',
            author: 'FTReey'
        },
        {
            name: '移动端微博链接去跟踪',
            patterns: [],
            regex: /http(s)?:\/\/m\.weibo\.cn\/.*\?.*/,
            replacement: (match) => {
                const pathMatch = match.match(/\/status\/(\d+)/);
                if (pathMatch) {
                    return `https://m.weibo.cn/status/${pathMatch[1]}`;
                }
                return match.replace(/\?.*/, '');
            },
            author: 'FTReey'
        },
        {
            name: '网易云音乐',
            patterns: [],
            regex: /https?:\/\/.*\.?music\.163\.com\/.*id=(\d+).*/,
            replacement: 'https://music.163.com/song?id=$2',
            author: 'lz233'
        },
        {
            name: '小红书',
            patterns: [],
            regex: /http:\/\/xhslink\.com\w*/,
            replacement: (match) => {
                return match.replace('http://', 'https://');
            },
            author: 'lz233'
        },
        {
            name: 'YouTube Mobile',
            patterns: [],
            regex: /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/,
            replacement: 'https://youtube.com/watch?v=$1',
            author: 'ous50'
        },
        {
            name: 'YouTube NormalLink',
            patterns: [],
            regex: /(https?:\/\/)(www\.)?(youtube\.com)(\/watch\?v=[a-zA-Z0-9_-]+)(\?si=[A-Za-z0-9_-]+)?/,
            replacement: '$1$2$3$4',
            author: 'HinataKato'
        },
        {
            name: 'YouTube ShortLink',
            patterns: [],
            regex: /(https?:\/\/)(www\.)?(youtu\.be)(\/[A-Za-z0-9_-]+)(\?si=[A-Za-z0-9_-]+)?/,
            replacement: '$1$2$3$4',
            author: 'HinataKato'
        },
        {
            name: '知乎关怀版',
            patterns: [],
            regex: /www\.zhihu\.com\/question.*\?.*/,
            replacement: (match) => {
                return match.replace(/\?.*/, '').replace('www.zhihu.com/question', 'www.zhihu.com/aria/question');
            },
            author: 'BingoKingo'
        }
    ];

    // 重定向规则
    const REDIRECT_RULES = [
        { domain: 'b23.tv', author: 'lz233' },
        { domain: 'bili2233.cn', author: 'Zorroblanco' },
        { domain: 'vm.tiktok.com', author: 'Mattis' },
        { domain: '163cn.tv', author: 'lz233' }
    ];

    // 执行初始化
    init();
})();