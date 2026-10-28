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
2. **按当前模型自动换提示词。** DSH 这一轮用的是哪个模型，就到 `<DSH_HOME>/rules/` 里挑对应的规则正文，整段换成那一份。键写官方全名（`flash` 这类厂商后缀算名字），中转站加在官方名后面的 `-ts`、`-x2` 不管。规则在下面一节。
3. **插件升级之后把补丁打回去。** 自动匹配要改已经装好的插件文件。升级会把那些改动盖掉，再跑一次 `恢复自动匹配.ps1`。提示词库和 `automatch.json` 不在插件包里，升级不会清掉。

安装步骤：[INSTALL.md](INSTALL.md)。

<a id="prefix-rules"></a>

## 自动匹配规则：只看前缀

匹配看的是**官方模型全名**。`flash`、`pro`、`turbo` 这类厂商自己的型号后缀是名字的一部分，要写进键里。中转站在官方名后面再加的东西（`-x2`、`-ts`、一串中转代号）不用管。

键就填官方全名。程序把键从长到短排，只比开头。所以：

- `glm-5.3-flash-x2` 先对上更长的 `glm-5.3-flash`，不会停在短的 `glm-5.3`。
- `glm-5.3-ts` 对不上 `glm-5.3-flash`（`flash` 是官方后缀，不是可以丢掉的尾巴），于是落到 `glm-5.3`。
- `glm`、`kimi` 这种短键只是兜底，前面有更长的键时用不上。

配置在 `<DSH_HOME>/dsh-purge/automatch.json`。例子是 `examples/dsh-purge/automatch.json`。你原来的键和值都还在；另外补了能从提示词文件确认的官方全名（见下）。`enabled` 为 true，`routes` 为空，`default` 为空字符串。

先把模型名洗成一串：

1. 转小写。
2. 去掉开头的 `服务商/`（正则 `^[a-z0-9_.-]+/`）。`openrouter/glm-5.3-flash-ts` 变成 `glm-5.3-flash-ts`。
3. 去掉方括号标签，例如 `[1m]`。
4. 去掉所有空白。`GLM 5.3 Flash` 变成 `glm5.3flash`。

然后：

1. **`routes` 精确命中优先。** 清洗后的整串和某条 route 完全一样才用。示例里是空的。
2. **`map` 最长键优先，只比开头。** 键同样转小写、去空白。比较时模型和键再去掉 `-`、`_`、`.`，只为了让空格写法和连字符写法对上，不是为了删掉 `flash`。对上开头就停。中转站加在后面的字符留在尾部。
3. **对不上就用 `default`。** 示例是空字符串：不注入自动规则，回落到 `prompt-inject.md`。写成某个规则 id 时才用那一份。

默认不做「只要字符串里包含这个键就算」。`"includes": true` 时，开头全部落空才再做包含匹配。你电脑上的旧 `automatch.js` 没有这个开关，`startsWith` 失败后还会用 `includes` 兜底，和仓库默认不一样。

下面是用现在的默认 `map` 实际算出来的：

| 原始模型名 | 清洗后 | 去掉分隔符 | 命中的键 | 规则 id |
| --- | --- | --- | --- | --- |
| `glm-5.3-flash` | `glm-5.3-flash` | `glm53flash` | `glm-5.3-flash` | `glm53f` |
| `glm-5.3-flash-x2` | `glm-5.3-flash-x2` | `glm53flashx2` | `glm-5.3-flash` | `glm53f` |
| `GLM 5.3 Flash` | `glm5.3flash` | `glm53flash` | `glm-5.3-flash` | `glm53f` |
| `openrouter/glm-5.3-flash-ts` | `glm-5.3-flash-ts` | `glm53flashts` | `glm-5.3-flash` | `glm53f` |
| `glm-5.3-ts` | `glm-5.3-ts` | `glm53ts` | `glm-5.3` | `glm53f` |
| `kimi-k3` | `kimi-k3` | `kimik3` | `kimi-k3` | `kimi3` |
| `kimi-k3-xxx` | `kimi-k3-xxx` | `kimik3xxx` | `kimi-k3` | `kimi3` |
| `qwen-3.7-xx` | `qwen-3.7-xx` | `qwen37xx` | `qwen-3.7` | `qwen` |

`GLM 5.2 flash` 命中 `glm-5.2` → `glm52`。提示词里写的是 GLM-5.2，没有 flash 这个官方后缀，所以不会配到 `glm-5.3-flash`。

对不上任何键、`default` 又是空的（例如 `not-a-known-model`）时，不注入自动规则。

### 怎么给新模型加一条

键填**官方全名**，值填已有的规则 id。官方名里的 `flash`、`pro`、`turbo` 要写上。中转站自己加的尾巴不要写进键。

1. 在 `prompts/` 或 `rules/<id>.md` 里确认正文或文件名写了这个官方全名。对不上就先别加。
2. 在 `<DSH_HOME>/dsh-purge/automatch.json` 的 `map` 里加一行，例如 `"glm-5.3-flash": "glm53f"`。短键留着当兜底。
3. 规则正文要有 `<DSH_HOME>/rules/<id>.md` 和同名 `.json`。
4. 跑 `node check-rules.mjs`。

这次在原有键之外只加了两条，依据都在仓库文件里：

- `glm-5.3-flash` → `glm53f`。`prompts/glm-5-3-flash.md`（以及同文的 `rules/glm53f.md`）写明 “GLM 5.3 Flash”。
- `qwen-3.7` → `qwen`。`prompts/qwen-3.7.md`（以及同文的 `rules/qwen.md`）写明 “Qwen 3.7”。

其余型号见文末说明；正文没写清官方全名的没有加。

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
