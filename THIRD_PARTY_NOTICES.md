# 第三方素材与依赖

## 游戏数据与图标

- 英雄、装备、强化、阵容和携带者样本：<https://www.dataj.cc/>。
- 主导图快照核对日：2026-09-21；特殊装备组合快照核对日：2026-09-23；补丁：18.2a。
- 补丁公告参考：<https://news.17173.com/content/09162026/220018011.shtml>。
- 图鉴图片源于腾讯游戏公开静态资源 `https://game.gtimg.cn/images/lol/act/jkzlk/`，保存在 `public/assets/`。

游戏名称、商标、图像及原始数据归各自权利人。本项目用于玩家攻略研究，与腾讯或 Riot Games 无官方关联，也不对第三方素材授予额外使用许可。

## Tesseract.js

- 版本：6.0.1。
- 文件：`public/vendor/tesseract.min.js`、`public/vendor/worker.min.js`。
- 项目：<https://github.com/naptha/tesseract.js>。
- 许可证：Apache-2.0，全文见 `public/vendor/LICENSE-tesseract.txt`。

## Tesseract.js-core

- 版本：6.0.0，LSTM 与 SIMD LSTM 构建。
- 文件：`public/vendor/core/`。
- 项目：<https://github.com/naptha/tesseract.js-core>。
- 许可证：Apache-2.0，全文见 `public/vendor/LICENSE-core.txt`。

## OCR 语言文件

- 包：`@tesseract.js-data/chi_sim@1.0.0`、`@tesseract.js-data/eng@1.0.0`。
- 分发路径：`4.0.0_best_int/chi_sim.traineddata.gz` 和 `4.0.0_best_int/eng.traineddata.gz`。
- 保存在 `public/vendor/lang/`。
- 许可证：Apache-2.0，许可证副本见 `public/vendor/LICENSE-language.txt`。

以上组件已随仓库保存，运行时不从 CDN 下载 OCR 代码或语言文件。
