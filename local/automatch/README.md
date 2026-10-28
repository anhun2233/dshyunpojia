# 破甲提示词：手动切换 + 按模型自动匹配

> 提示词正文（`prompts/`，以及 `rules/` 里的同文副本）来自
> <https://github.com/Alejandros17487/ai-jailbreaks>。
> 该仓库**没有许可证文件**。上游 README 写明仅供研究与教育使用
> （Research and educational use only），并提醒不要用于伤害他人、违法或违反模型服务条款。
> 本目录不对这些正文主张任何许可证。细节见 [prompts/NOTICE.md](prompts/NOTICE.md)。
>
> `prompts/_original-lcs.md`（规则 id `00-original`）是 dsh-purge 原版注入正文的本地副本，用来切回去，不是那个外部仓库里的文件。

本目录是社区插件 `dsh-purge-community` **之外**的本地附加组件。插件仓库本身仍是上游那一套；这里不改插件源码，而是：

1. **手动切换**：把选定档案写进 `<DSH_HOME>/prompt-inject.md`。
2. **自动匹配**：按当前模型代号，在注入时换成 `<DSH_HOME>/rules/` 里的规则。这部分要打进已经安装的插件目录，插件升级会清掉，需要重跑 `恢复自动匹配.ps1`。

给 agent 跟着做的安装步骤：[INSTALL.md](INSTALL.md)。

## 路径从哪来

- DSH 数据目录：环境变量 `DSH_HOME`，或参数 `-DshHome`。不要把某台电脑上的绝对路径写回脚本。
- 档案、补丁、提示词：相对本目录（脚本里的 `$PSScriptRoot`）。`恢复自动匹配.ps1` 和 `patch/` 必须放在一起。

## 手动切换

双击前，先在用户环境里设好 `DSH_HOME`。两个 bat 有 `pwsh` 就用它，没有就退回 Windows PowerShell（`powershell`）。

```text
切换.bat            交互菜单，输入序号切换
查看档案.bat        只看列表（不需要 DSH_HOME，也不建 backup\）
```

```powershell
$env:DSH_HOME = '你的 DSH 数据目录'
.\switch.ps1 -List
.\switch.ps1 grok
.\switch.ps1 -Current
.\switch.ps1 -Restore
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

引擎按当前模型代号选 `<DSH_HOME>/rules/<id>.md`。决策顺序在 `patch/automatch.js` 里：

1. `routes`：清洗后的代号完全相等。
2. `map`：前缀，长的优先。默认只认「代号以该键开头」。`automatch.json` 里 `"includes": true` 时，开头都没命中才再按「包含该键」匹配，而且不会压过已经对上的前缀。
3. `default`：兜底规则 id，空则不兜底。
4. 都没有 → 回落到 `prompt-inject.md`。

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
