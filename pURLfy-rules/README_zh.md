# pURLfy-rules

[English](README.md) | 简体中文

[![jsDelivr hits](https://data.jsdelivr.com/v1/package/gh/PRO-2684/pURLfy-rules/badge?style=rounded)](https://www.jsdelivr.com/package/gh/PRO-2684/pURLfy-rules?tab=stats)

[pURLfy](https://github.com/PRO-2684/pURLfy) 的规则集。有关规则集结构的描述，请参阅 [pURLfy 的 README](https://github.com/PRO-2684/pURLfy/blob/main/README_zh.md#-%E8%A7%84%E5%88%99%E9%9B%86)；格式的形式化定义可以参考 [`ruleset.schema.json`](ruleset.schema.json)。

## 📃 文件

- [ruleset.schema.json](ruleset.schema.json): 规则集格式的形式化定义。
- [list.json](list.json): 所有规则集的列表。
- [tracking.json](tracking.json): 净化跟踪链接的规则。
- [outgoing.json](outgoing.json): 净化外链的规则。
- [shortener.json](shortener.json): 恢复短链接的规则。
- [alternative.json](alternative.json): 将您从一些网站重定向到它们更好的替代品。
    - 将您从 [Fandom](https://www.fandom.com/) 重定向到 [antifandom](https://antifandom.com/)。
    - 将您从 [Wikipedia](https://www.wikipedia.org/) 重定向到 [Wikiwand](https://www.wikiwand.com/)。
    - 将您从 [Reddit](https://www.reddit.com/) 重定向到 [Safe Reddit](https://safereddit.com/)。
    - 将您从 [Imgur](https://imgur.com/) 重定向到 [Rimgo](https://rimgo.privacyredirect.com/)。
- [other.json](other.json): 净化其他链接的规则。
    - 缩短 Spigotmc 链接。

## 🤔 使用

对于 pURLfy v0.2.x，请使用分支 `core-0.2.x`（不再维护）；对于 pURLfy v0.3.x，请使用分支 `core-0.3.x`。您可以通过 jsDelivr CDN 访问规则文件：

```plaintext
https://cdn.jsdelivr.net/gh/PRO-2684/pURLfy-rules@<branch>/<ruleset>.min.json
```

## 💖 贡献

如果您想更新规则文件，您可以创建一个包含对 `*.json` 文件的 PR。请勿更改 `*.min.json` 文件，因为它们会通过压缩对应的 `*.json` 文件自动生成。

如果您想添加新的规则文件，除了创建一个新的 `*.json` 文件，您还需要更新 `list.json` 文件以包含新的规则文件，并在 `README.md` 中简要介绍您的规则。在您的 PR 合并后，新规则文件的压缩版本将自动生成。

## 🎉 致谢

- 感谢 [Tarnhelm](https://tarnhelm.project.ac.cn/) 提供的一些规则。
- 感谢 GreasyFork 上的这些脚本提供的一些规则。
    - [412612](https://greasyfork.org/scripts/412612)
    - [483475](https://greasyfork.org/scripts/483475)
    - [483597](https://greasyfork.org/scripts/483597)
- 感谢 [LinkHelper](https://github.com/oneNorth7/LinkHelper) 提供的一些规则。
- 感谢 [SearXNG](https://github.com/searxng/searxng/blob/f1a148f53e9fbd10e95baa442b40327732259f25/searx/engines/bing.py#L148) 提供的 Bing 的净化规则。
