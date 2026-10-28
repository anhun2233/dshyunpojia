# 规则库来源说明

本目录的 `.md` 与 `prompts/` 中对应文件是同一份正文，只是改成了自动匹配使用的规则 id。对照关系：

| 规则 id | 提示词文件 |
| --- | --- |
| `00-original` | `prompts/_original-lcs.md` |
| `bunny` | `prompts/spacebunny-agents.md` |
| `ds41` | `prompts/deepseek-4-1.md` |
| `dsv3` | `prompts/deepseek-v3.md` |
| `dsv4` | `prompts/deepseek-v4.md` |
| `gemini` | `prompts/gemini-4-argon.md` |
| `glm52` | `prompts/glm-5.2.md` |
| `glm53f` | `prompts/glm-5-3-flash.md` |
| `glm53oc` | `prompts/glm5-3-opencode.md` |
| `grok` | `prompts/grok-config.txt`（规则文件名是 `grok.md`，正文与 txt 相同） |
| `grok47` | `prompts/grok-4.7.md` |
| `grokbuild` | `prompts/grok-build.md` |
| `kimi3` | `prompts/kimi-k3-agents.md` |
| `mimo` | `prompts/mimo-2.6-agents.md` |
| `muse` | `prompts/muse-ai-agents.md` |
| `opus2` | `prompts/opus-v2.md` |
| `qwen` | `prompts/qwen-3.7.md` |
| `sonnet1` | `prompts/sonnet-v1.md` |
| `sonnet2` | `prompts/sonnet-v2.md` |
| `unified` | `prompts/unified.md` |

来源、没有许可证这件事，以及研究/教育用途的边界，见 [../prompts/NOTICE.md](../prompts/NOTICE.md)。`00-original.md` 是插件原版注入正文的副本，不是外部仓库的文件。

同名 `.json` 是规则面板的元数据（显示名、`target`、可选 `tier`）。`state.json` 只记录面板当前选中的规则 id（字段 `active`）。示例里的值是 `grok47`。拷进 DSH 数据目录之前，先问用户要不要覆盖已经存在的 `state.json`。
