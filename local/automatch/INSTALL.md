# 安装说明（给 agent）

这份说明是给在用户电脑上操作的 AI agent 的。先问，再动手。路径用用户自己的回答，不要沿用任何旧文档里的盘符路径。

插件升级、应用宿主补丁、重启，是三件不同的事。不要替用户杀进程，不要调用重启接口，不要改提示词以外的用户配置来“消掉”告警。

## 这个仓库是什么

[anhun2233/dsh-purge](https://github.com/anhun2233/dsh-purge) 是社区插件 [dsh-purge-community](https://github.com/kingcharleslzy-ai/dsh-purge) 的 fork。插件负责 DSH（DeepSeek Harness）里的宿主补丁、自检、提示词和规则面板。

`local/automatch/` 是用户写在插件外面的附加组件。它让同一套插件带上多份按模型准备的提示词，并提供两种用法：

- **手动切换**：把选中的档案写入 `<DSH_HOME>/prompt-inject.md`。
- **自动匹配**：DSH 当前用哪个模型，注入时就换上对应规则。

附加组件**不在**插件发行 tgz 里。`dsh plugin add` 只会装上插件。本目录要单独从本仓库拷走。插件源码保持上游 1.6.60，补丁打在**已经安装**的那份 `node_modules` 上。

## 提示词从哪来

`prompts/` 里除 `_original-lcs.md` 以外的正文，来自 <https://github.com/Alejandros17487/ai-jailbreaks>。

该仓库没有许可证文件。上游 README 写明仅供研究与教育使用（Research and educational use only），并提醒不要用于伤害他人、违法或违反服务条款。本仓库不对这些正文主张许可证。`rules/*.md` 是其中一部分的同文副本。完整说明见 [prompts/NOTICE.md](prompts/NOTICE.md)。

`_original-lcs.md` / 规则 `00-original` 是插件原版注入正文的副本，用来切回去。

## 先问清的三件事

记下来，后面每一步都用这些答案。

1. **DSH 数据目录**（下面写成 `$DshHome`）。用户可能已经设了环境变量 `DSH_HOME`。没设的话，先问实际路径。常见默认是用户主目录下的 `.dsh`（Windows：`%USERPROFILE%\.dsh`）。目录对不上就停，不要改去另一份安装。
2. **profile 名称**。Desktop 一般是 `desktop`，CLI/Web 示例是 `web`。恢复脚本默认 `desktop`。以用户这次要改的那个实例为准。
3. **附加组件放在哪个文件夹**（下面写成 `$Addon`）。这是整个 `local/automatch` 目录的落点，不是插件的 `node_modules`。

然后再问第 4 件：

4. **恢复脚本放哪**。默认就放在 `$Addon`，和 `patch/` 同级。脚本用 `$PSScriptRoot` 找 `patch/`。用户若要把脚本放到别处，必须把 `patch/` 一起带走，不能只拷 `.ps1`。

## A. 安装 dsh-purge-community

目标：`$DshHome/profiles/<profile>/node_modules/dsh-purge-community/package.json` 里的版本是 **1.6.60**。本仓库核对锚点用的就是这个版本。别的版本可以试，但锚点可能对不上，脚本会留下 `[!]`，不要硬改插件源码。

按仓库根目录 [README.md](../../README.md) 的「安装」选入口，并遵守 [AGENTS.md](../../AGENTS.md) §12：

- 第一次安装：DSH 官方插件界面，或该实例的 `dsh plugin --profile <实际名称> add <1.6.60 的 tgz URL>`。
- 已经有 `dsh-purge` 或旧独立面板：走社区安装器迁移，不要先卸载。
- 不要运行 `add dsh-purge`、`add dsh-purge-community`，也不要全局 npm 安装。
- 安装成功不等于已经「应用」宿主补丁，也不要安装后自动应用或重启。

装完后用只读命令核对，不要用模型会不会拒绝来判断装好了没有：

```powershell
$env:DSH_HOME = '<$DshHome>'
node (Join-Path $env:DSH_HOME "profiles\<profile>\node_modules\dsh-purge-community\bin\community.js") status
```

`package.json` 的 `version` 应为 `1.6.60`。插件目录不存在就停在这一步，不要跑恢复脚本。

宿主补丁（面板里的「应用」）是插件自己的步骤，和下面的自动匹配补丁不是一回事。用户要破甲补丁时，让他们自己点「应用」，再按 README 完整退出并重新打开。你不要代点重启。

## B. 放置附加组件

把本仓库的 `local/automatch/` 整份拷到用户在第 3 问里给的 `$Addon`。下面这些要在：

- `switch.ps1`、`切换.bat`、`查看档案.bat`、`profiles.json`
- `恢复自动匹配.ps1` 和 `patch/`（三个 js）
- `prompts/`、`rules/`、`examples/dsh-purge/automatch.json`、`check-rules.mjs`

不要拷运行时状态。仓库里本来也没有 `current.json` 和 `backup/`。

## C. 打补丁、放入示例配置、重启、看面板

在 `$Addon`（或用户指定的、旁边带有 `patch/` 的目录）执行。有 `pwsh` 就用 PowerShell 7；没有就用 Windows PowerShell 5.1（`powershell`）。两个 bat 会自己选。脚本写入补丁和 `current.json` 时用无 BOM 的 UTF-8，5.1 和 7 都不会在文件头加 BOM。

```powershell
$env:DSH_HOME = '<$DshHome>'
pwsh -NoProfile -ExecutionPolicy Bypass -File "$Addon\恢复自动匹配.ps1" -DshHome $env:DSH_HOME -ProfileName '<profile>'
```

profile 是 `desktop` 时可以省略 `-ProfileName`。

怎么读输出：

- `[+]` / `[~]`：这次写上了。`[=]`：已经在，跳过。
- `[!]` **锚点没找到**：插件文件和 1.6.60 不一致。脚本不会发明新补丁。把这行记下来，停手，不要为了消掉黄字去改用户的 `lib/`。
- 末尾「语法自检」有 `FAIL`：**先不要让用户重启**。把 `node --check` 的报错留下。
- 全部 `OK`，且有改动：请用户**自己**完整退出 DSH 再打开（Windows 要退出托盘，不要只关窗口）。你不要杀进程。

示例路由配置。目标是：

```text
<$DshHome>/dsh-purge/automatch.json
```

源文件是 `$Addon/examples/dsh-purge/automatch.json`。目标已存在就不要覆盖，把现有内容读给用户看，问要不要换成示例。不存在就拷过去。没有这份文件时，引擎仍会用 `patch/automatch.js` 里的内置 `map`；拷示例是为了以后只改 json、不改代码。

规则库。自动匹配读的是 `<$DshHome>/rules/<id>.md`，不是附加组件目录里的 `rules/`。把 `$Addon/rules/*.md` 和同名 `.json` 拷到 `<$DshHome>/rules/`。同名文件已存在就先问。`state.json` 会把面板当前规则设成 `grok47`，已有这份文件时默认不要覆盖。

拷完后在附加组件目录跑：

```powershell
node "$Addon\check-rules.mjs"
```

它检查 `patch/automatch.js` 的 `DEFAULTS` 和 `examples/dsh-purge/automatch.json` 里每个规则 id 都有 `rules/<id>.md` 与 `.json`。失败就先补文件，不要带着会落空的映射去重启。

然后请用户重启。重启之后你再看面板：

1. 打开左侧栏 Purge。
2. 进入规则区块，规则列表上方应有一行「自动匹配」。
3. 按钮文案是「已开启 · 点此关闭」或「已关闭 · 点此开启」。这就是面板开关，它写 `automatch.json` 的 `enabled`。

没有这一行：多半是 `client.js` 锚点没打上，或进程还是旧的。看恢复脚本的输出，不要去改仓库里的 `client.js`。

开关显示已开启，但注入仍像 `prompt-inject.md`：再看 `<$DshHome>/dsh-purge/tuning.json`。注入路径要求 `autoMatch` 不是 `false`。缺这个字段时用插件默认值（补丁写入的默认是 `true`）。文件里若写了 `false`，问用户要不要改成 `true`，不要擅自改别的字段。

## 手动切换

```powershell
$env:DSH_HOME = '<$DshHome>'
pwsh -NoProfile -ExecutionPolicy Bypass -File "$Addon\switch.ps1" -List
pwsh -NoProfile -ExecutionPolicy Bypass -File "$Addon\switch.ps1" <档案键>
```

也可以双击 `$Addon\切换.bat`（需要环境变量 `DSH_HOME`）。`查看档案.bat` 只列档案。两个 bat 在没有 `pwsh` 时改用 `powershell`。位置参数是档案键：`switch.ps1 grok`。参数名不是 `$Profile`。

| 动作 | 结果 |
| --- | --- |
| 写入 | `<$DshHome>/prompt-inject.md` 被换成 `prompts/` 里该档案的全文 |
| 备份 | 只有真正切换才建 `$Addon/backup/`，文件名 `prompt-inject-<时间>-<档案键>-prev.md`。`-List` 不建这个目录 |
| 状态 | `$Addon/current.json`（无 BOM 的 UTF-8，本机文件，不要提交） |
| 查看 | `-Current` 在 `prompt-inject.md` 还不存在时只打印路径，退出码仍是 0 |
| 还原 | `.\switch.ps1 -Restore` 用 `backup/` 里最新一份盖回 `prompt-inject.md` |

档案键在 `profiles.json`。`-List` 或 `查看档案.bat` 能看到。

切换器结束时会写：**需要重启 DeepSeek Harness 才生效**。按这个提示请用户重启后再看，不要假设热加载已经吃到新文件。

自动匹配的关系：`tuning.autoMatch` 为真、配置 `enabled` 为真、并且当前模型命中了一条有正文的规则时，注入用规则，**整段替换**，不会读刚才写入的 `prompt-inject.md`。手动切换要生效，先在面板关掉自动匹配，或让当前模型落空（没有 route / map / default）。命中失败时才回落到 `prompt-inject.md`。

## 自动匹配怎么选

模型代号先清洗（`patch/automatch.js` 的 `normalizeModel`）：

- 转小写
- 去掉开头的 `provider/`
- 去掉 `[...]`（例如 `[1m]`）
- 去掉所有空白

然后按这个顺序（`decide`）：

1. **routes**：清洗后的整串等于键。面板「精确指定」写的就是这里。
2. **map**：键越长越先比。清洗后的代号**以该键开头**才命中。`glm-5.3` 会压过 `glm`。过短的键仍可能吃掉一串更长的开头，加键之前先想清楚。只有 `automatch.json` 里 `"includes": true` 时，开头全部落空之后才再做一次「包含该键」。包含匹配不会抢在真正的前缀之前。示例配置里的 `includes` 是 `false`。
3. **default**：非空才用。
4. 否则返回空，调用方使用 `prompt-inject.md`。

规则正文必须是 `<$DshHome>/rules/<id>.md`，且 id 匹配 `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`。文件空或不存在则当作没选中，回落。

两道开关都要开，注入才会走自动匹配：

- `<$DshHome>/dsh-purge/tuning.json` 的 `autoMatch` 不为 false（补丁默认 true）
- `<$DshHome>/dsh-purge/automatch.json` 的 `enabled` 不为 false（面板那个按钮）

改 json 或规则 md 之后，引擎大约 1 秒缓存。下一轮注入会读到，不必为了改映射再重启。**第一次打进 `node_modules` 的补丁**仍要重启，旧进程不会热加载那些文件。

当前模型从会话请求头的 `config.model` 取；没有的话用这一会话上次在 `llm/stream` 里记下的代号。

## 手动加一套新提示词

两处登记，用途不同。只做手动切换就做 1 和 2。要自动匹配就再做 3 和 4。

1. 把全文放进 `$Addon/prompts/<文件名>`。Ollama Modelfile（以 `FROM` 开头）不要拿去当 DSH 系统提示。
2. 在 `$Addon/profiles.json` 加一条。键是切换器的档案名，值里要有 `file`（相对 `prompts/`）、`name`、`note`：

```json
"my-model": {
  "name": "显示名",
  "file": "my-model.md",
  "note": "一句话说明"
}
```

3. 自动匹配用的 id 自定（符合上面的正则）。把同一份正文写到 `<$DshHome>/rules/<id>.md`，并写 `<$DshHome>/rules/<id>.json`：

```json
{
  "name": "显示名",
  "target": "prompt-inject.md",
  "tier": 1
}
```

`target` 用 `prompt-inject.md` 才会被注入链路拿去替换。建议同时在 `$Addon/rules/` 留一份，方便以后重装。

4. 编辑 `<$DshHome>/dsh-purge/automatch.json`（没有就从示例拷一份再改）：

- 某个完整代号固定用一套：放进 `routes`，键用清洗后的代号。
- 一系列型号共用：放进 `map`，长前缀写全。默认只认开头。需要「包含」时把 `includes` 设为 `true`，并再跑一次 `check-rules.mjs`。
- 新 id 必须同时有 `rules/<id>.md` 和 `rules/<id>.json`。映射指向不存在的 id 时，引擎会悄悄回落到 `prompt-inject.md`。
- 不确定的型号可以指向已有的 `unified`，或留空让它回落 `prompt-inject.md`。

面板规则列表刷新后能看到新 id。自动匹配那一行的下拉读的是同一份 `rules/` 目录。

## 插件升级之后

升级或重装会换掉 `node_modules/dsh-purge-community`，下面这些会丢：

- `lib/automatch.js`、`lib/automatch-ui.js`
- 对 `lib/tuning.js`、`lib/index.js`、`lib/redteam/ui.js`、`client.js` 的插入

**必须再跑一次** `恢复自动匹配.ps1`。脚本是幂等的：还在的跳过，缺的补上，最后 `node --check`。

这些不在插件包里，升级不会清掉：

- `$Addon` 整份目录
- `<$DshHome>/dsh-purge/automatch.json` 和 `tuning.json` 里用户已写的字段
- `<$DshHome>/rules/`
- `<$DshHome>/prompt-inject.md`（自定义正文；若面板里变回了插件默认，再跑一次 `switch.ps1` 把档案写回去）

新版本若改了锚点，脚本会打印 `[!]` 并留下原文件。不要整文件覆盖插件，也不要删用户规则来“修好”。把失败的锚点和插件版本记下来再改脚本。

## 1.6.60 上核对过的锚点

对照的是本仓库里与上游标签 `v1.6.60` 一致的源码。每一条都只出现一次。

| 文件 | 锚点 | 结果 |
| --- | --- | --- |
| `lib/tuning.js` | `refusalRetry: false, // 模型推脱时自动加一句加固重试一次（llm/stream 钩子）` | 命中 |
| `lib/index.js` | `import * as rules from "./rules.js";` | 命中 |
| `lib/index.js` | `readInjectFallback` 里 `findDshHome` 之后的 `const refreshed = refreshHungOperator(home);` | 命中 |
| `lib/index.js` | `ctx.on("llm/stream", (options, next) => {` | 命中 |
| `lib/index.js` | `rules.rulesStatus(dshHome, cwdHint)` 那条 `op === "status"` | 命中 |
| `lib/redteam/ui.js` | `import { dispatch, dispatchAsync } from './store-core.js'` | 命中 |
| `lib/redteam/ui.js` | `const platformResult = handlePlatformOp(store, request)` | 行还在，但缩进是 **8 个空格**。脚本已按 8 空格替换。旧的 4 空格会当成这一行的子串命中，插入后缩进是歪的，语法仍能过 |
| `client.js` | `function ruleLabel` 四行 | 命中 |
| `client.js` | `dshpp-block` 紧接着 `dshpp-split` 的那一段 | 命中一次（规则列表，不是技能列表） |

`lib/rules.js` 的 `RULE_TARGETS` 和 `client.js` 的 `TARGETS` 仍是 `AGENTS.md` / `CLAUDE.md`。恢复脚本不改这两处。

## 不要做的事

- 不要改本仓库的 `lib/`、`client.js` 来“把自动匹配做进插件”。补丁只存在于用户机器上已安装的那份。
- 不要提交 `current.json`、`backup/`，也不要提交用户的 `prompt-inject.md`。
- 不要把 `rules/00-original.md` 当成可随便覆盖的草稿。
- 不要在没问过用户时覆盖已有的 `automatch.json`、`rules/` 或 `state.json`。
- 不要为这些提示词补一个许可证声明。
