# 恢复自动匹配补丁（引擎 + 面板 UI）——插件更新后跑一次即可
# 幂等：已存在就跳过，缺什么补什么，最后自动语法自检。
#
# DSH 数据目录：环境变量 DSH_HOME，或 -DshHome。
# 补丁文件：与本脚本同级的 patch\（$PSScriptRoot）。脚本和 patch 必须在一起。
# 默认写入 profiles\desktop 下已安装的插件；其他 profile 传 -ProfileName。
#
# 用法：
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\恢复自动匹配.ps1 -DshHome $env:DSH_HOME
#   pwsh -NoProfile -ExecutionPolicy Bypass -File .\恢复自动匹配.ps1 -DshHome $env:DSH_HOME -ProfileName desktop

param(
    [string]$DshHome = $env:DSH_HOME,
    [string]$ProfileName = 'desktop'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($DshHome)) {
    Write-Host "未指定 DSH 数据目录。请设置环境变量 DSH_HOME，或传入 -DshHome <路径>。" -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrWhiteSpace($ProfileName)) {
    Write-Host "Profile 名称不能为空。" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath $DshHome)) {
    Write-Host "DSH 数据目录不存在：$DshHome" -ForegroundColor Red
    exit 1
}

$Plugin = Join-Path $DshHome "profiles\$ProfileName\node_modules\dsh-purge-community"
$Patch  = Join-Path $PSScriptRoot 'patch'
$Tuning  = Join-Path $Plugin 'lib\tuning.js'
$Index   = Join-Path $Plugin 'lib\index.js'
$Ui      = Join-Path $Plugin 'lib\redteam\ui.js'
$Client  = Join-Path $Plugin 'client.js'
$AutoJs  = Join-Path $Plugin 'lib\automatch.js'
$AutoUi  = Join-Path $Plugin 'lib\automatch-ui.js'
$AutoCfg = Join-Path $DshHome 'dsh-purge\automatch.json'

function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Write-Utf8NoBom([string]$Path, [string]$Text) {
    # Windows PowerShell 5.1 的 Set-Content -Encoding UTF8 会写 BOM。5.1 和 7 都走无 BOM。
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Text, $utf8)
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$changed = 0

Say ""; Say "=== dsh-purge 自动匹配补丁（引擎 + 面板）===" 'Cyan'
if (-not (Test-Path $Plugin)) { Say "找不到插件目录：$Plugin" 'Red'; exit 1 }

# ---------- 1. 两个新模块 ----------
$mods = @(
  @{ src = 'automatch.js';    dst = $AutoJs },
  @{ src = 'automatch-ui.js'; dst = $AutoUi }
)
foreach ($m in $mods) {
  $master = Join-Path $Patch $m.src
  if (-not (Test-Path $master)) { Say ("  [!] 缺主副本 " + $m.src) 'Yellow'; continue }
  if (-not (Test-Path $m.dst)) {
    Copy-Item $master $m.dst -Force
    Say ("  [+] 已放置 lib/" + $m.src) 'Green'; $changed++
  } elseif ((Get-FileHash $m.dst -Algorithm SHA256).Hash -ne (Get-FileHash $master -Algorithm SHA256).Hash) {
    Copy-Item $master $m.dst -Force
    Say ("  [~] lib/" + $m.src + " 已更新为主副本") 'Yellow'; $changed++
  } else {
    Say ("  [=] lib/" + $m.src + " 一致")
  }
}

# ---------- 2. tuning.js 开关 ----------
$t = Get-Content $Tuning -Raw -Encoding UTF8
if ($t -notmatch 'autoMatch') {
  Copy-Item $Tuning "$Tuning.bak-$stamp" -Force
  $a = 'refusalRetry: false, // 模型推脱时自动加一句加固重试一次（llm/stream 钩子）'
  if ($t.Contains($a)) {
    $t = $t.Replace($a, $a + "`n  autoMatch: true, // 按当前模型代号前缀自动选规则（见 automatch.js）")
    Write-Utf8NoBom $Tuning $t
    Say "  [+] tuning.js 已加 autoMatch 开关" 'Green'; $changed++
  } else { Say "  [!] tuning.js 锚点没找到" 'Yellow' }
} else { Say "  [=] tuning.js 已有 autoMatch" }

# ---------- 3. index.js ----------
$i = Get-Content $Index -Raw -Encoding UTF8
$dirty = $false

if ($i -notmatch 'import \* as automatch ') {
  $a = 'import * as rules from "./rules.js";'
  if ($i.Contains($a)) {
    $i = $i.Replace($a, $a + "`nimport * as automatch from `"./automatch.js`";")
    Say "  [+] index.js 引入 automatch" 'Green'; $changed++; $dirty = $true
  } else { Say "  [!] index.js 找不到 rules 引入行" 'Yellow' }
}
if ($i -notmatch 'automatch-ui') {
  $a = 'import * as automatch from "./automatch.js";'
  if ($i.Contains($a)) {
    $i = $i.Replace($a, $a + "`nimport * as automatchUi from `"./automatch-ui.js`";")
    Say "  [+] index.js 引入 automatch-ui" 'Green'; $changed++; $dirty = $true
  } else { Say "  [!] index.js 找不到 automatch 引入行" 'Yellow' }
}
if ($i -notmatch 'inject\.automatch') {
  $a = 'function readInjectFallback(context) {' + "`n" + '  let home = "";' + "`n" + '  try { home = core.findDshHome(); } catch { home = ""; }' + "`n" + '  const refreshed = refreshHungOperator(home);'
  if ($i.Contains($a)) {
    $ins = 'function readInjectFallback(context) {' + "`n" + '  let home = "";' + "`n" + '  try { home = core.findDshHome(); } catch { home = ""; }' + "`n`n" +
      '  // ── 自动匹配：按当前模型代号前缀选规则，命中就整段替换 ──' + "`n" +
      '  try {' + "`n" +
      '    if (readTuning().autoMatch) {' + "`n" +
      '      const auto = automatch.resolve(home, context);' + "`n" +
      '      if (auto) {' + "`n" +
      '        let rt = false;' + "`n" +
      '        try { rt = isRedteamSession(context); } catch { rt = false; }' + "`n" +
      '        const out = modePromptText(auto.text, rt);' + "`n" +
      '        purgeLog("inject.automatch", { model: auto.model, rule: auto.ruleId, how: auto.how, bytes: out.length });' + "`n" +
      '        return out;' + "`n" +
      '      }' + "`n" +
      '    }' + "`n" +
      '  } catch { /* 回落 */ }' + "`n`n" +
      '  const refreshed = refreshHungOperator(home);'
    $i = $i.Replace($a, $ins)
    Say "  [+] index.js 注入链路接入" 'Green'; $changed++; $dirty = $true
  } else { Say "  [!] index.js 找不到 readInjectFallback 锚点" 'Yellow' }
}
if ($i -notmatch 'automatch\.record') {
  $a = 'ctx.on("llm/stream", (options, next) => {'
  if ($i.Contains($a)) {
    $i = $i.Replace($a, $a + "`n" + '    try { automatch.record(options?.session?.id || options?.sessionId || "", options?.model); } catch {}')
    Say "  [+] index.js 记录模型" 'Green'; $changed++; $dirty = $true
  }
}
if ($i -notmatch 'automatchGet') {
  $a = '  if (op === "status") {' + "`n" + '    return { ok: true, ...(await rules.rulesStatus(dshHome, cwdHint)) };' + "`n" + '  }'
  if ($i.Contains($a)) {
    $ins = $a + "`n" +
      '  if (op === "automatchGet") {' + "`n" +
      '    return automatchUi.handleAutoMatchOp(dshHome, { op: "automatchGet" });' + "`n" +
      '  }' + "`n" +
      '  if (op === "automatchSet") {' + "`n" +
      '    return automatchUi.handleAutoMatchOp(dshHome, { op: "automatchSet", cfg: body && body.cfg });' + "`n" +
      '  }'
    $i = $i.Replace($a, $ins)
    Say "  [+] index.js 加 automatchGet/Set 路由" 'Green'; $changed++; $dirty = $true
  } else { Say "  [!] index.js 找不到 rules status op 锚点" 'Yellow' }
}
if ($dirty) {
  Copy-Item $Index "$Index.bak-$stamp" -Force -ErrorAction SilentlyContinue
  Write-Utf8NoBom $Index $i
}

# ---------- 4. redteam/ui.js（备用通道，可选） ----------
$u = Get-Content $Ui -Raw -Encoding UTF8
$udirty = $false
if ($u -notmatch 'automatch-ui') {
  $a = "import { dispatch, dispatchAsync } from './store-core.js'"
  if ($u.Contains($a)) {
    $u = $u.Replace($a, $a + "`nimport { handleAutoMatchOp } from '../automatch-ui.js'")
    Say "  [+] ui.js 引入接口" 'Green'; $changed++; $udirty = $true
  }
}
if ($u -notmatch 'handleAutoMatchOp\(dshHomeOf') {
  # 1.6.60 里这一行是 8 个空格。用 4 个空格会当成更长缩进的子串命中，插入块会歪。
  $a = '        const platformResult = handlePlatformOp(store, request)'
  if ($u.Contains($a)) {
    $u = $u.Replace($a, '        const amResult = handleAutoMatchOp(dshHomeOf(), request)' + "`n" +
      '        if (amResult !== undefined) {' + "`n" +
      '          sendJson(res, 200, amResult)' + "`n" +
      '          return' + "`n" +
      '        }' + "`n" + $a)
    Say "  [+] ui.js 备用分发挂载" 'Green'; $changed++; $udirty = $true
  } else { Say "  [!] ui.js 找不到 handlePlatformOp 锚点（备用通道）" 'Yellow' }
}
if ($udirty) {
  Copy-Item $Ui "$Ui.bak-$stamp" -Force -ErrorAction SilentlyContinue
  Write-Utf8NoBom $Ui $u
}

# ---------- 5. client.js 面板控件 ----------
$c = Get-Content $Client -Raw -Encoding UTF8
$cdirty = $false
$boxFile = Join-Path $Patch 'ui-automatch-box.js'

if ($c -notmatch 'function AutoMatchBox') {
  $a = 'function ruleLabel(r) {' + "`n" + '  if (!r) return "";' + "`n" + '  if (r.name !== r.id) return r.name + " (" + r.id + ")";' + "`n" + '  return r.id;' + "`n" + '}'
  if ((Test-Path $boxFile) -and $c.Contains($a)) {
    $box = Get-Content $boxFile -Raw -Encoding UTF8
    $c = $c.Replace($a, $a + "`n" + $box)
    Say "  [+] client.js 加 AutoMatchBox 组件" 'Green'; $changed++; $cdirty = $true
  } else { Say "  [!] client.js 组件锚点没找到（ruleLabel）" 'Yellow' }
}
if ($c -notmatch 'h\(AutoMatchBox') {
  $a = '      { className: "dshpp-block" },' + "`n" + '      h(' + "`n" + '        "div",' + "`n" + '        { className: "dshpp-split" },'
  if ($c.Contains($a)) {
    $ins = '      { className: "dshpp-block" },' + "`n" +
      '      h(AutoMatchBox, { key: "automatch" })' + "`n" + '    ),' + "`n" + '    h(' + "`n" +
      '      "div",' + "`n" + '      { className: "dshpp-block" },' + "`n" + '      h(' + "`n" +
      '        "div",' + "`n" + '        { className: "dshpp-split" },'
    $c = $c.Replace($a, $ins)
    Say "  [+] client.js 挂控件到规则面板" 'Green'; $changed++; $cdirty = $true
  } else { Say "  [!] client.js 渲染锚点没找到（dshpp-split）" 'Yellow' }
}
if ($cdirty) {
  Copy-Item $Client "$Client.bak-$stamp" -Force -ErrorAction SilentlyContinue
  Write-Utf8NoBom $Client $c
}

# ---------- 6. 配置 ----------
if (-not (Test-Path $AutoCfg)) { Say "  [!] 缺 automatch.json（映射/路由配置）" 'Yellow' } else { Say "  [=] automatch.json 存在" }

# ---------- 7. 语法自检 ----------
Say ""; Say "=== 语法自检 ===" 'Cyan'
$failed = 0
foreach ($f in @($Tuning, $Index, $AutoJs, $AutoUi, $Ui, $Client)) {
  if (-not (Test-Path $f)) { Say ("  SKIP " + (Split-Path $f -Leaf)) 'Yellow'; continue }
  $out = & node --check $f 2>&1
  if ($LASTEXITCODE -eq 0) { Say ("  OK   " + $f.Replace($Plugin + '\', '')) 'Green' }
  else { Say ("  FAIL " + $f.Replace($Plugin + '\', '') + " : " + ($out -join ' ')) 'Red'; $failed++ }
}

Say ""
if ($failed -gt 0) { Say "有文件语法失败，先别重启，把 FAIL 的报错发出来。" 'Red' }
elseif ($changed -gt 0) { Say "共改动 $changed 处。★ 重启 DeepSeek Harness 生效。" 'Yellow' }
else { Say "补丁已完整。若面板没出现开关，重启一次 DSH。" 'Green' }
Say ""
