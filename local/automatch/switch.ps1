# 破甲提示词一键切换器
# 档案目录 = 本脚本所在目录（$PSScriptRoot）。
# DSH 数据目录 = 环境变量 DSH_HOME，或 -DshHome。
# -List 只读本地档案，不需要 DSH_HOME。
# 用法:
#   .\switch.ps1 -List
#   .\switch.ps1 -DshHome $env:DSH_HOME grok
#   .\switch.ps1 -Current
#   .\switch.ps1 -Restore

param(
    [string]$Profile,
    [switch]$List,
    [switch]$Current,
    [switch]$Restore,
    [string]$DshHome = $env:DSH_HOME
)

$ErrorActionPreference = 'Stop'
$Root      = $PSScriptRoot
$PromptDir = Join-Path $Root 'prompts'
$BackupDir = Join-Path $Root 'backup'
$MapFile   = Join-Path $Root 'profiles.json'
$StateFile = Join-Path $Root 'current.json'
$Target    = if ([string]::IsNullOrWhiteSpace($DshHome)) { '' } else { Join-Path $DshHome 'prompt-inject.md' }

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Get-Map {
    if (-not (Test-Path $MapFile)) { throw "找不到 profiles.json：$MapFile" }
    $j = Get-Content $MapFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $out = [ordered]@{}
    foreach ($p in $j.PSObject.Properties) {
        $out[$p.Name] = @{ file = $p.Value.file; name = $p.Value.name; note = $p.Value.note }
    }
    return $out
}

function Show-List {
    $map = Get-Map
    $cur = $null
    if (Test-Path $StateFile) {
        $cur = (Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json).profile
    }
    Write-Host ""
    Write-Host "  可用档案（共 $($map.Count) 套）" -ForegroundColor Cyan
    Write-Host "  ------------------------------------------------------------------"
    $i = 0
    foreach ($k in $map.Keys) {
        $i++
        $mark = if ($k -eq $cur) { ' ←当前' } else { '' }
        $size = 0
        $fp = Join-Path $PromptDir $map[$k].file
        if (Test-Path $fp) { $size = (Get-Item $fp).Length }
        Write-Host ("  {0,2}) {1,-9} {2,-24} {3,7} B  {4}{5}" -f $i, $k, $map[$k].name, $size, $map[$k].note, $mark)
    }
    Write-Host ""
}

function Show-Current {
    if (Test-Path $StateFile) {
        $s = Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        Write-Host ""
        Write-Host "  当前档案: $($s.profile)  ($($s.name))" -ForegroundColor Green
        Write-Host "  切换时间: $($s.at)"
        Write-Host "  目标文件: $Target  ($((Get-Item $Target).Length) 字节)"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "  还没有切换过（或状态丢失）。当前 prompt-inject.md: $((Get-Item $Target).Length) 字节" -ForegroundColor Yellow
        Write-Host ""
    }
}

function Switch-Profile([string]$key) {
    $map = Get-Map
    if (-not $map.Contains($key)) { throw "没有这个档案: $key（用 -List 看全部）" }
    $src = Join-Path $PromptDir $map[$key].file
    if (-not (Test-Path -LiteralPath $src)) { throw "档案文件缺失: $src" }
    if (-not (Test-Path -LiteralPath $Target)) { throw "找不到提示词文件：$Target 。确认插件已安装，且该目录下有 prompt-inject.md。" }
    if ($map[$key].file -match 'gemma4|gpt-oss-20b') {
        Write-Host "  提醒: $key 是 Ollama Modelfile 格式，不是纯系统提示词，切进 DSH 可能格式不符" -ForegroundColor Yellow
    }

    # 备份当前
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bak = Join-Path $BackupDir "prompt-inject-$stamp-$key-prev.md"
    Copy-Item $Target $bak -Force

    # 写入新内容
    Copy-Item $src $Target -Force

    # 记录状态
    @{ profile = $key; name = $map[$key].name; at = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'); backup = $bak } |
        ConvertTo-Json | Set-Content $StateFile -Encoding UTF8

    Write-Host ""
    Write-Host "  已切换 → $key  ($($map[$key].name))" -ForegroundColor Green
    Write-Host "  写入: $Target  ($((Get-Item $Target).Length) 字节)"
    Write-Host "  备份: $bak"
    Write-Host ""
    Write-Host "  ★ 需要重启 DeepSeek Harness 才生效（提示词只在启动时读一次）" -ForegroundColor Yellow
    Write-Host ""
}

function Restore-Last {
    $bak = Get-ChildItem $BackupDir -Filter 'prompt-inject-*.md' -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $bak) { throw "没有备份可还原" }
    Copy-Item $bak.FullName $Target -Force
    Write-Host ""
    Write-Host "  已还原: $($bak.Name)" -ForegroundColor Green
    Write-Host "  目标文件现在: $((Get-Item $Target).Length) 字节"
    Write-Host "  ★ 重启 DSH 生效" -ForegroundColor Yellow
    Write-Host ""
}

function Require-DshHome {
    if ([string]::IsNullOrWhiteSpace($DshHome)) {
        Write-Host "未指定 DSH 数据目录。请设置环境变量 DSH_HOME，或传入 -DshHome <路径>。" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path -LiteralPath $DshHome)) {
        Write-Host "DSH 数据目录不存在：$DshHome" -ForegroundColor Red
        exit 1
    }
}

# ---- 入口 ----
if ($List)    { Show-List; exit 0 }
Require-DshHome
if ($Current) { Show-Current; exit 0 }
if ($Restore) { Restore-Last; exit 0 }
if ($Profile) { Switch-Profile $Profile; exit 0 }

# 交互模式
while ($true) {
    Show-List
    Show-Current
    Write-Host "  输入序号或档案名切换；r=还原上一份；q=退出" -ForegroundColor Cyan
    $in = Read-Host "  选择"
    if ($in -eq 'q' -or $in -eq '') { break }
    if ($in -eq 'r') { Restore-Last; continue }
    $map = Get-Map
    if ($in -match '^\d+$') {
        $idx = [int]$in
        $keys = @($map.Keys)
        if ($idx -lt 1 -or $idx -gt $keys.Count) { Write-Host "  序号超出范围" -ForegroundColor Red; continue }
        Switch-Profile $keys[$idx - 1]
    } elseif ($map.Contains($in)) {
        Switch-Profile $in
    } else {
        Write-Host "  无效输入" -ForegroundColor Red
    }
}
