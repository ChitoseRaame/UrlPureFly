# UrlPureFly - URL净化助手

一款功能强大的油猴脚本，一键净化当前网页的跟踪URL参数，支持多种净化规则，可自定义按钮位置。

## ✨ 功能特性

- **一键净化**：点击按钮即可自动净化当前URL中的跟踪参数
- **智能规则**：支持30+主流网站的URL净化规则
- **自定义位置**：支持四个边角位置和自定义位置设置
- **全屏适配**：全屏状态下自动隐藏，避免干扰
- **实时预览**：自定义位置时可实时预览按钮位置
- **多种净化模式**：支持参数规则（白名单/黑名单）、正则规则、重定向规则

## 📦 安装方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展
2. 点击 [安装脚本](./UrlPureFly.user.js)
3. 确认安装

## 🚀 使用方法

### 基本使用

1. 访问任意网页
2. 点击页面边缘的 🧹 按钮
3. 净化后的URL会自动复制到剪贴板

### 自定义按钮位置

1. 点击油猴图标 → "⚙️ 按钮位置设置"
2. 勾选想要显示的位置（支持多选）
3. 选择"自定义位置"后，可通过滑块调整按钮位置
4. 点击"保存"完成设置

## 🎯 支持的网站

### 视频平台
- 哔哩哔哩 (bilibili.com)
- YouTube (youtube.com, youtu.be)
- 腾讯视频 (v.qq.com)
- TikTok (tiktok.com)

### 社交媒体
- 知乎 (zhihu.com)
- 微博 (weibo.com)
- Twitter/X (twitter.com, x.com)
- Reddit (reddit.com)
- 小红书 (xiaohongshu.com)
- QQ空间 (qzone.qq.com)
- 即刻 (okjike.com)

### 音乐平台
- 网易云音乐 (music.163.com)
- Spotify (open.spotify.com)
- Apple Music (music.apple.com)

### 电商平台
- 淘宝 (tb.cn)
- 京东 (jd.com)
- 拼多多 (yangkeduo.com)
- 闲鱼 (tb.cn)

### 其他
- 微信公众号 (mp.weixin.qq.com)
- 微信读书 (weread.qq.com)
- 百度贴吧 (tieba.baidu.com)
- Google搜索 (google.com)
- Netflix (netflix.com)
- Disney+ (disneyplus.com)
- Amazon日本 (amazon.co.jp)
- Pixiv (pixiv.net)
- 等更多...

## 📋 净化规则说明

### 参数规则
通过白名单或黑名单模式过滤URL参数：
- **白名单模式**：只保留指定的参数
- **黑名单模式**：移除指定的参数

### 正则规则
使用正则表达式匹配并替换URL中的特定模式

### 重定向规则
自动解析短链接，获取最终的真实URL

## 🔧 规则来源

本脚本的净化规则来源于 [Tarnhelm 项目](https://tarnhelm.project.ac.cn/rules.html)，感谢原作者的贡献。

### 规则贡献者
- lz233
- 青墨
- mitian233
- MateChan
- ous50
- TCOTC
- returnL
- Mattis
- PRO-2684
- kirito
- RtYkk
- Mosney
- omg-xtao
- pplulee
- FTReey
- ChellyL
- PianCat
- Zois
- qrqr
- 三泽
- HinataKato
- BingoKingo
- Dreista
- 加藤日向

## 🛠️ 技术细节

- **全屏检测**：支持所有主流浏览器的全屏API
- **防抖处理**：窗口大小变化时防抖300ms
- **油猴权限**：
  - `GM_addStyle`：注入样式
  - `GM_getValue` / `GM_setValue`：存储设置
  - `GM_registerMenuCommand`：注册菜单
  - `GM_xmlhttpRequest`：处理重定向规则

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [Tarnhelm 规则库](https://tarnhelm.project.ac.cn/rules.html)