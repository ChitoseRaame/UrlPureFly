# UrlPureFly - URL净化助手

一款基于原生 JavaScript 开发的轻量化油猴脚本，一键净化当前网页的跟踪URL参数。支持 pURLfy 规则格式，提供深度嵌套链接解析，并允许高度自定义按钮位置。

## ✨ 功能特性

- **一键净化并复制**：点击悬浮的 🧹 按钮，脚本按规则清洗 URL 后自动存入剪贴板，并弹出实时状态反馈。
- **pURLfy 规则引擎**：支持 7 种净化模式，能够处理从简单的参数剔除到复杂的 Base64 加密提取。
- **高度自定义 UI**：
  - **多位置预设**：支持页面四个边角的一键锚定。
  - **像素级微调**：内置 X/Y 轴双向同步滑块，支持按钮位置的实时预览与自定义坐标。
  - **智能避让**：全屏状态（如看视频、演示）下自动隐藏 UI 元素，拒绝视觉干扰。
- **性能优化**：采用防抖（Debounce）处理窗口缩放事件，极致节省系统资源。

## 📦 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展。
2. 点击 [安装脚本](https://github.com/ChitoseRaame/UrlPureFly/raw/refs/heads/master/UrlPureFly.user.js)。
3. 在弹出界面确认安装。

## 🚀 使用方法

### 基本操作
- 访问网页后，点击页面边缘的 🧹 按钮。
- 点击页面边缘的 🧹 按钮。
- 净化后的URL会自动复制到剪贴板。

### 按钮位置设置
- 点击油猴插件图标，在菜单中选择 **“⚙️ 按钮位置设置”**。
- 在弹出的面板中勾选您喜欢的位置，或开启“自定义位置”手动拖动滑块。
- 点击“保存”即可立即生效。

## 🎯 实际内置规则支持

脚本针对以下平台进行了精细化适配，其余网站将触发 **Fallback 模式**（自动清除通用 utm 跟踪参数）：

- **视频娱乐**：哔哩哔哩 (主站、直播、动态、短链解析)、YouTube、腾讯视频、网易云音乐、全民K歌。
- **搜索工具**：Google 搜索、Bing 搜索 (含嵌套链接提取)、智谱清言、作业帮。
- **社交资讯**：知乎 (搜索、专栏、公式)、微信 (公众号文章、专辑)、小红书 (详情页、短链解析)、豆瓣小组、百度 (贴吧、百科)、QQ空间、QQ频道。
- **电商购物**：淘宝、微店、DLsite。
- **海外服务**：Netflix、Disney+、Spotify、Apple Music。
- **外链解析**：爱发电、草料二维码、Mozilla 外链等。

## 📋 规则模式说明

脚本通过 `RULESETS` 字典树进行精准匹配，支持以下模式：

1. **白名单 (white)**：仅保留指定参数，其余全部删除。
2. **黑名单 (black)**：移除指定参数，保留其他。
3. **参数提取 (param)**：从 URL 参数中提取目标链接，支持 `base64` 解码及 `slice` 切片。
4. **正则替换 (regex)**：使用正则表达式对 URL 字符串进行暴力改写。
5. **重定向 (redirect/visit)**：通过网络请求解析短链接的真实目标。
6. **自定义函数 (lambda)**：执行 JavaScript 代码片段处理极其特殊的 URL 结构。

## 🛠️ 技术细节

- **权限调用**：
  - `GM_xmlhttpRequest`：用于跨域解析重定向链接。
  - `GM_setValue/getValue`：实现 UI 配置的持久化存储。
- **剪贴板兼容**：优先调用 `navigator.clipboard`，并在旧版浏览器或非安全环境下自动降级至 `execCommand`。
- **样式隔离**：所有 UI 组件均使用 `UrlPureFly_` 前缀，避免干扰原网页样式。

## 🔧 规则来源

核心规则逻辑参考并集成了 [pURLfy-rules](https://github.com/PRO-2684/pURLfy-rules) 和 [Tarnhelm](https://tarnhelm.project.ac.cn/rules.html) 项目，向原作者及社区贡献者致谢。

## ⚖️ 开源协议

基于 MIT License 协议开源。

## 🔗 相关链接

- [pURLfy 主项目](https://github.com/PRO-2684/pURLfy)
- [Tarnhelm 规则库](https://tarnhelm.project.ac.cn/rules.html)