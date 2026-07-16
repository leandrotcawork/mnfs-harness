<#
.SYNOPSIS
OS-process codex dispatcher — the HARNESS-CORE §1/§3 ceremony encoded once.

.DESCRIPTION
Resolves role -> model/effort/path from roles.psd1 (never retyped from memory; effort ALWAYS
explicit — global codex default is xhigh). Runs `codex exec` with stdin closed, prompt from
file, full stream teed to agent__<id>.log, final message to agent__<id>.last.md, and writes
an ATOMIC agent__<id>.result.json receipt (timestamps, exit code, output hashes) replacing
the bare `.done` sentinel. Registry lifecycle: promotes `assembled` -> `started`, then
`completed`/`failed`.

NEVER auto-re-issues a writing worker: on timeout the codex process is stopped, the dispatch
is marked failed(reason=timeout), and the script EXITS for diagnosis — two writers on one
worktree is worse than any hang.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Role,
    [Parameter(Mandatory)][string]$PromptFile,
    [Parameter(Mandatory)][string]$Scratchpad,
    [Parameter(Mandatory)][string]$Registry,
    [string]$DispatchId,
    # Default comes from the role's Sandbox column in roles.psd1; pass explicitly to override.
    [ValidateSet('read-only', 'workspace-write', 'danger-full-access')][string]$Sandbox,
    [int]$TimeoutSec = 1800
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'HarnessDispatch.psm1') -Force
Assert-ScriptLock -ScriptPath $PSCommandPath

# --- preflight (J) -------------------------------------------------------------
$codexCmd = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCmd) { throw 'PREFLIGHT-FAIL: codex CLI not on PATH. Operator: run /codex:setup.' }
$codexVersion = (& codex --version 2>&1 | Out-String).Trim()
if (-not (Test-Path -LiteralPath $PromptFile)) { throw "PREFLIGHT-FAIL: prompt file missing: $PromptFile" }
if ((Get-Item -LiteralPath $PromptFile).Length -eq 0) { throw "PREFLIGHT-FAIL: prompt file empty: $PromptFile" }
if (-not (Test-Path -LiteralPath $Scratchpad)) { New-Item -ItemType Directory -Force -Path $Scratchpad | Out-Null }
$probe = Join-Path $Scratchpad ".write-probe-$([guid]::NewGuid().ToString('N').Substring(0,6))"
try { 'x' | Set-Content -LiteralPath $probe; Remove-Item -LiteralPath $probe -Force }
catch { throw "PREFLIGHT-FAIL: scratchpad not writable: $Scratchpad" }

$roles = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'roles.psd1')
if (-not $roles.ContainsKey($Role)) {
    throw "ROLE-UNKNOWN: '$Role'. Known: $($roles.Keys -join ', '). Roles live in roles.psd1 (mirror of HARNESS-CORE §1)."
}
$binding = $roles[$Role]
if ($binding.Path -eq 'companion') {
    throw "PATH-MISMATCH: role '$Role' is a short/companion dispatch — use /codex:rescue --model $($binding.Model) --effort $($binding.Effort) --wait (HARNESS-CORE §1). This script is the OS-process path only."
}
if (-not $Sandbox) { $Sandbox = $binding.Sandbox }

if (-not $DispatchId) {
    $DispatchId = New-DispatchId -Role $Role
    Add-DispatchEvent -Registry $Registry -DispatchId $DispatchId -State 'assembled' -Data @{
        role = $Role; promptFile = (Resolve-Path -LiteralPath $PromptFile).Path
        promptSha256 = Get-FileBodyHash -Path $PromptFile
        note = 'assembled implicitly by dispatcher (no New-DispatchPrompt run)'
    } | Out-Null
} else {
    $existing = Get-DispatchState -Registry $Registry -DispatchId $DispatchId
    if (-not $existing) { throw "DISPATCH-UNKNOWN: $DispatchId not in registry $Registry" }
    if ($existing.state -ne 'assembled') {
        throw "LIFECYCLE-VIOLATION: $DispatchId is '$($existing.state)', expected 'assembled'. NEVER re-issue a started/completed dispatch — diagnose instead."
    }
}

$logFile = Join-Path $Scratchpad "agent__$DispatchId.log"
$lastFile = Join-Path $Scratchpad "agent__$DispatchId.last.md"
$resultFile = Join-Path $Scratchpad "agent__$DispatchId.result.json"
$startedUtc = (Get-Date).ToUniversalTime().ToString('o')

Add-DispatchEvent -Registry $Registry -DispatchId $DispatchId -State 'started' -Data @{
    model = $binding.Model; effort = $binding.Effort; sandbox = $Sandbox
    codexVersion = $codexVersion; log = $logFile; lastMessage = $lastFile
} | Out-Null

# --- run (ceremony: stdin closed, prompt from file, tee, -o) --------------------
# Everything below runs under a catch-all: a dispatch must NEVER be stranded at
# `started` with no terminal event — that would silently break the
# one-writer-per-worktree invariant for every later lifecycle check.
try {
$job = Start-Job -ScriptBlock {
    param($model, $effort, $sandbox, $lastFile, $promptFile, $logFile)
    $prompt = Get-Content -LiteralPath $promptFile -Raw
    @() | codex exec --model $model -c "model_reasoning_effort=$effort" --sandbox $sandbox `
        -o $lastFile $prompt 2>&1 | Tee-Object -FilePath $logFile
    $LASTEXITCODE
} -ArgumentList $binding.Model, $binding.Effort, $Sandbox, $lastFile, $PromptFile, $logFile

$completed = Wait-Job -Job $job -Timeout $TimeoutSec
$endedUtc = (Get-Date).ToUniversalTime().ToString('o')

if (-not $completed) {
    Stop-Job -Job $job; Remove-Job -Job $job -Force
    $receipt = [ordered]@{
        dispatchId = $DispatchId; verdict = 'FAILED — timeout'; reason = "no exit within ${TimeoutSec}s"
        startedUtc = $startedUtc; endedUtc = $endedUtc
        log = $logFile; policy = 'NEVER auto-re-issue a writing worker: diagnose the log, then operator/hub decides.'
    }
    Write-JsonAtomic -Path $resultFile -Object $receipt
    Add-DispatchEvent -Registry $Registry -DispatchId $DispatchId -State 'failed' -Data @{ reason = 'timeout'; result = $resultFile } | Out-Null
    throw "DISPATCH-TIMEOUT: $DispatchId exceeded ${TimeoutSec}s. Receipt: $resultFile. Do NOT re-issue — diagnose."
}

$jobOutput = Receive-Job -Job $job
Remove-Job -Job $job -Force
$exitCode = if ($null -ne $jobOutput -and @($jobOutput).Count -gt 0) { [int](@($jobOutput)[-1]) } else { -1 }

$lastExists = Test-Path -LiteralPath $lastFile
$receipt = [ordered]@{
    dispatchId      = $DispatchId
    role            = $Role
    model           = $binding.Model
    effort          = $binding.Effort
    sandbox         = $Sandbox
    codexVersion    = $codexVersion
    dispatcherPid   = $PID
    startedUtc      = $startedUtc
    endedUtc        = $endedUtc
    exitCode        = $exitCode
    promptFile      = (Resolve-Path -LiteralPath $PromptFile).Path
    promptSha256    = Get-FileBodyHash -Path $PromptFile
    log             = $logFile
    logSha256       = if (Test-Path -LiteralPath $logFile) { Get-FileBodyHash -Path $logFile } else { $null }
    lastMessage     = if ($lastExists) { $lastFile } else { $null }
    lastSha256      = if ($lastExists) { Get-FileBodyHash -Path $lastFile } else { $null }
    verdict         = 'FORM-COMPLETE — merit, truth, adequacy and ambiguity not assessed'
    notProven       = @('output correctness', 'plan adherence', 'evidence truth beyond exit code and file hashes')
}
Write-JsonAtomic -Path $resultFile -Object $receipt

$finalState = if ($exitCode -eq 0 -and $lastExists) { 'completed' } else { 'failed' }
Add-DispatchEvent -Registry $Registry -DispatchId $DispatchId -State $finalState -Data @{
    exitCode = $exitCode; result = $resultFile
} | Out-Null

if ($finalState -eq 'failed') {
    throw "DISPATCH-FAILED: $DispatchId exit=$exitCode lastMessage=$lastExists. Receipt: $resultFile. Do NOT re-issue — diagnose the log."
}
[pscustomobject]$receipt
} catch {
    # Terminal-event guarantee: if the dispatch is still `started` in the registry
    # (i.e. this exception is not one of our own already-registered throws), record
    # `failed` before propagating so no row is ever stranded mid-lifecycle.
    $state = Get-DispatchState -Registry $Registry -DispatchId $DispatchId
    if ($state -and $state.state -eq 'started') {
        try {
            Write-JsonAtomic -Path $resultFile -Object ([ordered]@{
                dispatchId = $DispatchId; verdict = 'FAILED — dispatcher exception'
                error = "$_"; startedUtc = $startedUtc
                endedUtc = (Get-Date).ToUniversalTime().ToString('o')
                dispatcherPid = $PID; log = $logFile
                policy = 'NEVER auto-re-issue a writing worker: diagnose, then operator/hub decides.'
            })
            Add-DispatchEvent -Registry $Registry -DispatchId $DispatchId -State 'failed' -Data @{ reason = 'dispatcher-exception'; error = "$_"; result = $resultFile } | Out-Null
        } catch {
            Write-Warning "Invoke-CodexDispatch: could not record failed event for ${DispatchId}: $_"
        }
    }
    throw
}
