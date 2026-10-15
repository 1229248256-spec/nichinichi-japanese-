# 资源许可与署名

本仓库将程序与内容分开许可。根目录 MIT 许可证只覆盖原创程序代码、样式、图标、开发脚本、测试代码及原创文档，不覆盖下面列出的学习数据、测试数据和录音。

## 词库与教学内容 — CC BY-SA 4.0

适用文件：`dist/content.js`、`dist/vocabulary-data.json`、`dist/lesson-data.js`、`tests/fixtures/openjlpt-identities.json`。其中本站原创教学内容及整理贡献也按 CC BY-SA 4.0 提供。

- [OpenJLPT](https://github.com/evanclan/OpenJLPT)，固定版本 `0d1d3410bec90bd4098a7c72de820543cb4f707c`，CC BY-SA 4.0。
- [Jonathan Waller's JLPT Resources](https://www.tanos.co.uk/jlpt/)，通过 OpenJLPT 使用的社区 JLPT 等级与词表来源；保留其 CC BY 署名。
- [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)，© Electronic Dictionary Research and Development Group (EDRDG)，按其[许可说明](https://www.edrdg.org/edrdg/licence.html)使用，CC BY-SA 4.0。
- Tomoshi 开放数据层，© Y1Z，快照 `v2026-10-13`。使用了 JMdict 关联词条和由 Y1Z 提供的机器辅助中文释义与义项注释，CC BY-SA 4.0；见保留的 [Tomoshi LICENSE](dist/Tomoshi-LICENSE.md) 与 [NOTICE](dist/Tomoshi-NOTICE.md)。
- 日日 / Nichinichi contributors：原创例句、搭配、课程、练习、人工释义修正、分类与界面使用的数据结构。

整理方式：选取 N5—N2 词表；按 JMdict ID 联结中文释义并核验词形和读音；按英文释义相似度重排义项；对不匹配的少数条目人工修正；保留 320 张详解卡；合并同词形同读音条目，并添加学习阶段和主题标签。中文释义含上游机器辅助内容，欢迎纠错。完整许可证文本见 [vocabulary-LICENSE.txt](dist/vocabulary-LICENSE.txt)。

`tests/fixtures/openjlpt-identities.json` 只从固定版本上游数据提取 ID、词形、别名与级别，用于覆盖检查；并非从本项目生成词库反推的答案。原始文件的 SHA-256 见 [vocabulary-source-hashes.json](docs/vocabulary-source-hashes.json)。

保留的 [OpenJLPT NOTICE](dist/OpenJLPT-NOTICE.md) 与 Tomoshi NOTICE 描述其完整上游项目。本站没有导入 OpenJLPT 的 Tatoeba 例句、KanjiVG 笔顺资源、Tomoshi 品牌素材或完整数据库；这些上游声明不能被理解为本仓库包含所有上游素材。

N5—N1 难度属于社区参考，不是官方完整词汇清单。更新词库时应核对上游新版本、继续保留署名，并以相同许可发布派生数据。

## 真人录音 — 分来源许可

适用文件：`dist/audio-data.js` 中的录音与来源元数据，以及 `docs/audio-sources.json` 中的来源记录。

| 来源 | 数量 | 许可 | 版本 |
| --- | ---: | --- | --- |
| [Tofugu / WaniKani](https://github.com/tofugu/japanese-vocabulary-pronunciation-audio) | 219 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | `9725e0e7d628ab616e8b14e126d3daa33eba8d36` |
| [Kanji alive](https://github.com/kanjialive/kanji-data-media) | 1 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 逐条固定来源链接见清单 |

录音只按词条选取和打包为 Base64，未裁剪或修改声音。Tofugu 原库混合东京男声和关西女声，逐条说话人信息不完整。每条录音的词形、假名、来源 URL、署名、字节数和 SHA-256 见 [audio-sources.json](docs/audio-sources.json)。

保留的许可文件：[Tofugu CC BY-SA 4.0 全文](dist/audio-LICENSE.txt)、[Kanji alive 许可与署名](dist/audio-Kanji-alive-LICENSE.md)。Kanji alive 原声明中提到的字体未随本仓库分发。

设备合成语音由浏览器和操作系统提供，不是上述真人录音；用户导入的音频只保存在自己的浏览器里，不进入仓库。

## 只有链接的资源

IRODORI、JLPT 官方练习、OJAD、ASK、MOJi、红宝书和蓝宝书等外部资源遵循各自的使用条款。本站不转载这些教材的完整正文、官方练习套题或整套配套音频，也不声称获得相关机构背书。
