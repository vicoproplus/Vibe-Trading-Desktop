# scripts/desktop/build-windows.ps1
# 端到端构建 Windows MSI 安装包。
# 编排: fetch-runtime → install-deps → assemble → cargo tauri build，产物归档到 release/。
#
# 用法:
#   .\scripts\desktop\build-windows.ps1                  # 端到端构建
#   .\scripts\desktop\build-windows.ps1 -SkipRuntime     # 跳过 runtime 重建（调试）
#   .\scripts\desktop\build-windows.ps1 -PbsTag <tag> -PbsAsset <name>  # 覆盖 PBS 版本
#
# 前置（须在 PATH）: node, npm, cargo, cargo-tauri, uv

param(
  [string]$PbsTag    = "20260610",
  [string]$PbsAsset  = "cpython-3.12.13+20260610-x86_64-pc-windows-msvc-install_only.tar.gz",
  [string]$OutputDir = ".\release",
  [switch]$SkipRuntime
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$DesktopScripts = "$Root\scripts\desktop"
$BuildStartTime = Get-Date

function Write-Step([int]$Index, [string]$Name) {
  Write-Host ""
  Write-Host "=== [$Index/4] $Name ===" -ForegroundColor Cyan
}

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Step0Checks {
  Write-Step 0 "Pre-check"
  $missing = @()
  foreach ($name in @("node", "npm", "cargo", "uv")) {
    if (-not (Test-Command $name)) { $missing += $name }
  }
  # cargo-tauri 不是独立可执行，用 cargo 子命令验证
  cargo tauri --version *> $null
  if ($LASTEXITCODE -ne 0) { $missing += "cargo-tauri" }

  if ($missing.Count -gt 0) {
    Write-Host "Missing prerequisites:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Install hints:"
    Write-Host '  cargo tauri : cargo install tauri-cli --version "^2"'
    Write-Host "  uv          : pip install uv  (or https://docs.astral.sh/uv/)"
    Write-Host "  node/npm    : https://nodejs.org/"
    Write-Host "  cargo/rustc : https://rustup.rs/"
    exit 1
  }
  Write-Host "All prerequisites present." -ForegroundColor Green
}

function Invoke-Step1Runtime {
  Write-Step 1 "Prepare runtime"
  $Runtime = "$Root\.desktop-build\python-runtime"
  if ($SkipRuntime) {
    Write-Host "Skipping runtime rebuild (-SkipRuntime)" -ForegroundColor Yellow
    if (-not (Test-Path "$Runtime\python.exe")) {
      throw "runtime missing at $Runtime but -SkipRuntime set; remove the flag or run fetch-runtime first"
    }
    return
  }
  $env:PBS_TAG = $PbsTag
  $env:PBS_ASSET = $PbsAsset
  & "$DesktopScripts\fetch-runtime.ps1"
  if ($LASTEXITCODE -ne 0) { throw "[FAILED] step 1: fetch-runtime exited $LASTEXITCODE" }
  & "$DesktopScripts\install-deps.ps1" "$Runtime"
  if ($LASTEXITCODE -ne 0) { throw "[FAILED] step 1: install-deps exited $LASTEXITCODE" }
  Write-Host "Runtime ready at: $Runtime" -ForegroundColor Green
}

function Invoke-Step2Assemble {
  Write-Step 2 "Assemble"
  & "$DesktopScripts\assemble.ps1"
  if ($LASTEXITCODE -ne 0) { throw "[FAILED] step 2: assemble exited $LASTEXITCODE" }
  Write-Host "Assembly complete (.desktop-build populated)" -ForegroundColor Green
}

function Invoke-Step3Tauri {
  Write-Step 3 "Tauri build"
  Push-Location "$Root\src-tauri"
  try {
    cargo tauri build --bundles msi
    if ($LASTEXITCODE -ne 0) { throw "[FAILED] step 3: cargo tauri build exited $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  Write-Host "MSI built at src-tauri/target/release/bundle/msi/" -ForegroundColor Green
}

# 主流程（后续 task 在此扩展）
Push-Location $Root
try {
  Invoke-Step0Checks
  Invoke-Step1Runtime
  Invoke-Step2Assemble
  Invoke-Step3Tauri
} finally {
  Pop-Location
}
