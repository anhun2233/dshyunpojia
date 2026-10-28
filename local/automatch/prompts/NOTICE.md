# 提示词来源说明

除 `_original-lcs.md` 以外，本目录里的提示词正文来自：

https://github.com/Alejandros17487/ai-jailbreaks

该仓库**没有许可证文件**。上游 README 写明这些材料仅供研究与教育使用（Research and educational use only），并提醒不要用于伤害他人、违法，或违反模型提供方的服务条款。

本仓库只保留来源链接和上述使用边界，**不对这些正文主张任何许可证**，也不表示已经获得再分发授权。使用前请自己阅读上游说明。

`_original-lcs.md` 是 dsh-purge 插件原版注入正文的本地副本，用来切回原来的那一份。它不是上面那个外部仓库里的文件。

上游仓库里的 `qwen-preferences.md` 在带进来时是空文件，这里没有收录。

`rules/` 里的 `.md` 是其中一部分正文按规则 id 另存的副本，来源与本说明相同。见 [../rules/NOTICE.md](../rules/NOTICE.md)。

换 `prompt-inject.md` 不用为了缓存重启：插件每次组装都会看这份文件的修改时间，缓存只有 200ms。本进程若已把旧正文钉进提示词框，外部改写会被压住，那时才退出重开。首次打上自动路由补丁、以及插件升级后重跑恢复脚本，仍然要重启。

## 实际适用 / 备注

第三方提示词正文没有改。下面只记录文件名、正文自称和当前规则的差别。不确定官方全名的，没有往 `map` 里加键。

| 文件 | 备注 |
| --- | --- |
| `deepseek-v4.md` | 正文写的是 DeepSeek-V3（`Current model version: DeepSeek-V3`）。文件名是 v4。现有键 `deepseek-v4`、`deepseek-v4.1`、`deepseek` 都指向规则 `dsv4`，用的就是这份正文。键没有改。 |
| `grok-4.7.md` | 正文自称 “Grok Build”，不是 Grok 4.7。它对应规则 `grok47`，目前不在 `map` 里。键 `grok-4.7` 指向的是 `grok`（`grok-config.txt`），不是这份文件。键没有改。 |
| `deepseek-4-1.md` | 正文没有写型号。文件名和档案名是 DeepSeek 4.1。现有键 `deepseek-4-1` → `ds41` 用的就是它。没有再加 flash/pro 之类的键。 |
| `gemini-4-argon.md` | 正文没有自报型号。只有文件名里有 gemini-4-argon。现有短键 `gemini` → `gemini` 用的就是它。没有另加 `gemini-4-argon` 键。 |
| `glm5-3-opencode.md` | 正文没有写 GLM 5.3。opencode 看起来像宿主，不是型号后缀。对应规则 `glm53oc`，不在 `map` 里。没有加键。 |

已按正文补上、并写入 `map` 的两条：`prompts/kimi-k2.md` → 规则 `kimi2`，键 `kimi-k2`（短键 `kimi` 仍是 `kimi3`）；`prompts/mistral-large-4.md` → 规则 `mistral-large`，键 `mistral-large`（短键 `mistral` 仍是 `unified`）。
