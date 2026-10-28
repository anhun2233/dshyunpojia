# 破甲提示词：手动切换 + 按模型自动匹配

> 提示词正文（`prompts/`，以及 `rules/` 里的同文副本）来自
> <https://github.com/Alejandros17487/ai-jailbreaks>。
> 该仓库**没有许可证文件**。上游 README 写明仅供研究与教育使用
> （Research and educational use only），并提醒不要用于伤害他人、违法或违反模型服务条款。
> 本目录不对这些正文主张任何许可证。细节见 [prompts/NOTICE.md](prompts/NOTICE.md)。
>
> `prompts/_original-lcs.md`（规则 id `00-original`）是 dsh-purge 原版注入正文的本地副本，用来切回去，不是那个外部仓库里的文件。

<a id="addon-what"></a>

## 这个附加功能是什么

插件本身只会往对话里贴一份提示词。这个目录是加在插件外面的三件事，不改插件仓库里的源码：

1. **多套提示词，可以手动换。** `prompts/` 里按模型放了 30 套正文，`profiles.json` 给每套一个短名字。`switch.ps1 grok` 会把选中的那份写进 `<DSH_HOME>/prompt-inject.md`。换完要重启 DSH。
2. **按当前模型自动换提示词。** DSH 这一轮用的是哪个模型，就到 `<DSH_HOME>/rules/` 里挑对应的规则正文，整段换成那一份。只看模型名前缀，中转站后面加的 `-ts`、`-xxx`、`flash` 不管。规则在下面一节。
3. **插件升级之后把补丁打回去。** 自动匹配要改已经装好的插件文件。升级会把那些改动盖掉，再跑一次 `恢复自动匹配.ps1`。提示词库和 `automatch.json` 不在插件包里，升级不会清掉。

安装步骤：[INSTALL.md](INSTALL.md)。

<a id="prefix-rules"></a>

## 自动匹配规则：只看前缀

配置在 `<DSH_HOME>/dsh-purge/automatch.json`。仓库例子 `examples/dsh-purge/automatch.json` 的 `map` 键和值与你电脑上那份相同：`enabled` 为 true，`routes` 为空，`default` 为空字符串。

先把模型名洗成一串，再拿去比：

1. 转小写。
2. 去掉开头的 `服务商/`（正则 `^[a-z0-9_.-]+/`），例如 `openrouter/deepseek-v4.1-xx` 变成 `deepseek-v4.1-xx`。
3. 去掉方括号标签，例如 `[1m]`。
4. 去掉所有空白。`GLM 5.3 flash` 变成 `glm5.3flash`。

然后按这个顺序决定用哪条规则：

1. **`routes` 精确命中优先。** 清洗后的整串和某条 route 的键完全一样，就用那条，不再看前缀。示例里 `routes` 是空的。
2. **`map` 只看前缀，长的优先。** 键也先转小写、去掉空白。比较的时候，模型和键再去掉 `-`、`_`、`.`。按去掉之后的长度从长到短试，对上开头就停。后面的 `-ts`、`-xxx`、`flash` 留在串的尾部，不单独看。所以 `glm-5.2` 和 `glm5.2flash` 比的是 `glm52` 与 `glm52flash`。
3. **对不上就用 `default`。** 示例里是空字符串，表示不注入这套自动规则，回落到 `prompt-inject.md`。`default` 写成某个规则 id 时，用那一份。

默认不做「字符串里只要包含这个键就算」的匹配。`automatch.json` 里 `"includes": true` 时，开头全部落空之后才再做一次包含匹配。你电脑上现在跑的那份旧 `automatch.js` 没有这个开关，`startsWith` 失败后还会用 `includes` 兜底，和仓库默认不一样。

下面是用仓库里的默认 `map`、`routes` 为空、`includes` 为 false 实际算出来的结果：

| 原始模型名 | 清洗后 | 去掉分隔符 | 命中的键 | 规则 id |
| --- | --- | --- | --- | --- |
| `GLM 5.3 flash` | `glm5.3flash` | `glm53flash` | `glm-5.3` | `glm53f` |
| `GLM 5.2 flash` | `glm5.2flash` | `glm52flash` | `glm-5.2` | `glm52` |
| `glm-5.3-ts` | `glm-5.3-ts` | `glm53ts` | `glm-5.3` | `glm53f` |
| `Kimi K3 xxx` | `kimik3xxx` | `kimik3xxx` | `kimi-k3` | `kimi3` |
| `openrouter/deepseek-v4.1-xx` | `deepseek-v4.1-xx` | `deepseekv41xx` | `deepseek-v4.1` | `dsv4` |
| `claude-sonnet-4.5[1m]` | `claude-sonnet-4.5` | `claudesonnet45` | `claude-sonnet` | `unified` |
| `grok-4.7-fast` | `grok-4.7-fast` | `grok47fast` | `grok-4.7` | `grok` |

`not-a-known-model` 清洗后仍是它自己，没有任何键是它的前缀，`default` 又是空的，所以不注入自动规则。

只去空白、不去 `-` 时，`GLM 5.2 flash` 会变成 `glm5.2flash`，不以 `glm-5.2` 开头，最后命中更短的 `glm`，规则错成 `glm53f`。现在两边都去掉分隔符，所以落到 `glm52`。

## 路径从哪来

- DSH 数据目录：环境变量 `DSH_HOME`，或参数 `-DshHome`。不要把某台电脑上的绝对路径写回脚本。
- 档案、补丁、提示词：相对本目录（脚本里的 `$PSScriptRoot`）。`恢复自动匹配.ps1` 和 `patch/` 必须放在一起。

## 手动切换

双击前，先在用户环境里设好 `DSH_HOME`。两个 bat 有 `pwsh` 就用它；没有就先提示安装 PowerShell 7（`winget install Microsoft.PowerShell`），再退回 Windows PowerShell 5.1。`.ps1` 带 UTF-8 BOM，5.1 才能正确读里面的中文。写进插件的 js 和 `current.json` 仍然无 BOM。

```text
切换.bat            交互菜单，输入序号切换
查看档案.bat        只看列表（不需要 DSH_HOME，也不建 backup\）
```

```powershell
$env:DSH_HOME = '你的 DSH 数据目录'
.\switch.ps1 -List
.\switch.ps1 grok
.\switch.ps1 -Current
.\switch.ps1 -Restore      # 没有备份时只提示，不报错
.\switch.ps1 -DshHome $env:DSH_HOME grok
```

它改的文件是：

```text
<DSH_HOME>/prompt-inject.md
```

也就是 Purge 面板「提示词」槽位里那份全局注入。真正切换时，旧文写到本目录 `backup/`，当前档案名写到 `current.json`（无 BOM 的 UTF-8）。`-List` 不创建 `backup/`。文件还不存在时，`-Current` 只说明路径，不报错退出；切换本身仍会停下来，等这份文件出现。这两样运行时状态都不进 git。

切换器写完会提示：**重启 DeepSeek Harness 后再确认**。自动匹配开着并且命中了规则时，注入用的是规则正文，不是这一份文件。想让手动切换生效，先在面板里关掉自动匹配，或保证当前模型没有命中任何规则。见 [INSTALL.md](INSTALL.md)。

面板上红队演练台的角色提示词是另一批文件（`redteam/engagements/<靶标>/agents/<角色>.md`），这个切换器不动它们。

`gemma` 和 `gptoss` 是 Ollama Modelfile（`FROM` … `SYSTEM` …），不是纯系统提示词。切进 DSH 可能格式不符，脚本会提醒。

## 自动匹配

规则、清洗步骤和例子见上面的[自动匹配规则：只看前缀](#prefix-rules)。引擎读的是 `<DSH_HOME>/rules/<id>.md`。

`map` 里的每个规则 id 都要有 `rules/<id>.md` 和同名 `.json`。仓库里用 `node check-rules.mjs` 检查默认映射和示例配置。面板保存配置时会留下文件里已有的 `_说明` 一类字段，以及 `includes`。

示例映射：`examples/dsh-purge/automatch.json`。拷到 `<DSH_HOME>/dsh-purge/automatch.json` 之后再改。面板上的「自动匹配」开关写的是这份文件里的 `enabled`。注入路径还要 `tuning.json` 的 `autoMatch` 不为 false；恢复脚本会在插件默认值里加上 `autoMatch: true`。

## 目录

```text
local/automatch/
├── INSTALL.md                 ← agent 安装步骤
├── README.md
├── switch.ps1                 ← 手动切换
├── 切换.bat / 查看档案.bat
├── 恢复自动匹配.ps1           ← 升级后重打补丁
├── profiles.json              ← 档案键 → 文件名
├── check-rules.mjs            ← 映射 id 是否都有规则文件
├── patch/                     ← 打进已安装插件的引擎和面板片段
├── prompts/                   ← 30 个提示词文件 + NOTICE.md
├── rules/                     ← 自动匹配规则库示例 + NOTICE.md
├── examples/dsh-purge/automatch.json
└── skills/jailbreak-prompt-sync/SKILL.md
```

`current.json` 和 `backup/` 在真正切换之后才出现。`-List` 不会建 `backup/`。
