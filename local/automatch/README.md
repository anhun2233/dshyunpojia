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

1. **多套提示词，可以手动换。** `prompts/` 里按模型放了 30 套正文，`profiles.json` 给每套一个短名字。`switch.ps1 grok` 会把选中的那份写进 `<DSH_HOME>/prompt-inject.md`。下一轮组装就会按文件时间重读，不用为了这次切换重启。详见下面「什么时候要重启」。
2. **按当前模型自动换提示词。** 开关是 `automatch.json` 里的 `enabled`，默认开。开着并且命中时，整段换成对应规则，不和手动那份拼在一起。没命中，或把开关关掉，就退回你在面板点「启用」后写进目标文件的规则，或 `switch.ps1` 写入的 `prompt-inject.md`。键写官方全名（`flash` 这类厂商后缀算名字），中转站加在官方名后面的 `-ts`、`-x2` 不管。规则在下面一节。
3. **插件升级之后把补丁打回去。** 自动匹配要改已经装好的插件文件。升级会把那些改动盖掉，再跑一次 `恢复自动匹配.ps1`。提示词库和 `automatch.json` 不在插件包里，升级不会清掉。

<a id="auto-route-switch"></a>

## 自动路由开关

默认开（`enabled: true`），和你电脑上现在的配置一致。

| 状态 | 实际行为 |
| --- | --- |
| 关 | 不看模型。系统提示用 `prompt-inject.md`（`switch.ps1` 写进去的，或面板把规则「启用」到这份文件）。自动规则不会换掉它，也不会拼在后面。 |
| 开，并且命中 | 这一轮注入整段换成命中的规则。不用 `prompt-inject.md`，两份不叠加。 |
| 开，但没命中 | `default` 为空时退回上面那份手动规则。`default` 写了规则 id 时，用那条兜底规则，不退回手动文件。示例里 `default` 是空的，所以没命中就退回手动。 |

面板：规则页规则列表上方，「自动路由：开/关」。点一下只改 `enabled`，其它键保留。下一轮对话就生效，不用为了拨开关重启。第一次把补丁打进插件之后，要重启一次，面板上才会出现这个开关。

命令行（`切换.bat` 打开的菜单里按 `a` 也是这个）：

```powershell
.\switch.ps1 -AutoRoute status
.\switch.ps1 -AutoRoute off
.\switch.ps1 -AutoRoute on
```

## 什么时候要重启

不用为了换 `prompt-inject.md` 重启。`lib/index.js` 的 `refreshHungOperator` 在每次 `system-prompt/assemble`、`session/created`、`agent-preset/selected`，以及注入回落时都会看这份文件的修改时间。200ms 内且时间没变才用缓存；时间变了就 `syncPromptInjectOnDiskSync` 再 `resolveInjectText`。用户自己的正文不会被同步成插件默认稿。

仍要退出重开 DSH 的只有这些情况：

1. **第一次**把自动路由补丁打进已安装的插件。
2. **插件升级之后**重跑 `恢复自动匹配.ps1`。补丁在 `node_modules` 里，当前进程不会热加载。

还有一种源码里的例外，不是缓存造成的：本进程只要成功解析过一次，`refreshHungOperator` 就会 `rememberCommittedOverride`，把当时的正文钉在内存里。`resolveInjectText` 先看这颗钉子，再看磁盘。提示词框点保存会把钉子更新成新稿，所以框里保存下一轮就生效。`switch.ps1` / `切换.bat` 只改磁盘，钉子还是旧稿时，新文件要退出重开才会进注入。进程刚启动、还没钉过时，下一轮就读磁盘，不用重启。

面板规则「启用」写的是 `<DSH_HOME>/AGENTS.md` 或 `CLAUDE.md`（`target` 不是这两份时会被改成 `AGENTS.md`），不写 `prompt-inject.md`，也不被这颗钉子挡住。插件激活接口的提示是新会话生效，不是重启进程。

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
| `kimi-k2-xxx` | `kimi-k2-xxx` | `kimik2xxx` | `kimi-k2` | `kimi2` |
| `mistral-large-4-xx` | `mistral-large-4-xx` | `mistrallarge4xx` | `mistral-large` | `mistral-large` |
| `mistral-small` | `mistral-small` | `mistralsmall` | `mistral` | `unified` |
| `qwen-3.7-xx` | `qwen-3.7-xx` | `qwen37xx` | `qwen-3.7` | `qwen` |

`GLM 5.2 flash` 命中 `glm-5.2` → `glm52`。提示词里写的是 GLM-5.2，没有 flash 这个官方后缀，所以不会配到 `glm-5.3-flash`。

对不上任何键、`default` 又是空的（例如 `not-a-known-model`）时，不注入自动规则。

### 怎么给新模型加一条

键填**官方全名**，值填已有的规则 id。官方名里的 `flash`、`pro`、`turbo` 要写上。中转站自己加的尾巴不要写进键。

1. 在 `prompts/` 或 `rules/<id>.md` 里确认正文或文件名写了这个官方全名。对不上就先别加。
2. 在 `<DSH_HOME>/dsh-purge/automatch.json` 的 `map` 里加一行，例如 `"glm-5.3-flash": "glm53f"`。短键留着当兜底。
3. 规则正文要有 `<DSH_HOME>/rules/<id>.md` 和同名 `.json`。
4. 跑 `node check-rules.mjs`。

按正文补进 `map`、且没有改掉原有键值的有：

- `glm-5.3-flash` → `glm53f`。`prompts/glm-5-3-flash.md` 写明 “GLM 5.3 Flash”。
- `qwen-3.7` → `qwen`。`prompts/qwen-3.7.md` 写明 “Qwen 3.7”。
- `kimi-k2` → `kimi2`。`prompts/kimi-k2.md` 写明 “Kimi k2”。短键 `kimi` 仍是 `kimi3`。
- `mistral-large` → `mistral-large`。`prompts/mistral-large-4.md` 写明 “Mistral Large 4”。短键 `mistral` 仍是 `unified`。

文件名和正文对不上、因此没有加键的，写在 [prompts/NOTICE.md](prompts/NOTICE.md)。原有键值都没改。其中疑似错配、只记录不改的是：`deepseek-v4` / `deepseek-v4.1` / `deepseek` → `dsv4`，但 `deepseek-v4.md` 正文写的是 DeepSeek-V3；`grok-4.7` → `grok`（`grok-config.txt`），而 `grok-4.7.md` 自称 Grok Build，且对应的规则 `grok47` 不在 `map` 里；`glm-5.3` → `glm53f`，正文是 GLM 5.3 Flash，键本身没有 flash。

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

切换器写完的提示是：下一轮组装按 `prompt-inject.md` 的修改时间重读，不用为了缓存重启。自动匹配开着并且命中了规则时，注入用的是规则正文，不是这一份文件。想让手动切换生效，先关掉自动路由，或让当前模型没有命中。见 [INSTALL.md](INSTALL.md)。

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
