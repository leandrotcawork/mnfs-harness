# Pester tests for the deterministic dispatch lane (HARNESS-CORE §4).
# Fixtures cover the field-named risks: CRLF/encoding drift, registry concurrency,
# fail-closed lock behavior, lifecycle enforcement, atomic receipt writes.
#Requires -Modules Pester

BeforeAll {
    $script:ScriptsDir = Split-Path -Parent $PSScriptRoot
    Import-Module (Join-Path $script:ScriptsDir 'HarnessDispatch.psm1') -Force
    $script:Sandbox = Join-Path ([System.IO.Path]::GetTempPath()) "harness-tests-$([guid]::NewGuid().ToString('N').Substring(0,8))"
    New-Item -ItemType Directory -Force -Path $script:Sandbox | Out-Null
}

AfterAll {
    if ($script:Sandbox -and (Test-Path $script:Sandbox)) {
        Remove-Item -Recurse -Force $script:Sandbox
    }
}

Describe 'Get-NormalizedBodyHash' {
    It 'gives identical hash for CRLF and LF variants of same text' {
        $lf = "line one`nline two`n"
        $crlf = "line one`r`nline two`r`n"
        (Get-NormalizedBodyHash -Text $lf) | Should -Be (Get-NormalizedBodyHash -Text $crlf)
    }

    It 'changes hash when body content changes' {
        (Get-NormalizedBodyHash -Text 'a') | Should -Not -Be (Get-NormalizedBodyHash -Text 'b')
    }

    It 'handles empty string' {
        # SHA-256 of empty input — known constant.
        (Get-NormalizedBodyHash -Text '') | Should -Be 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    }

    It 'is BOM-insensitive at file level (Get-FileBodyHash)' {
        $noBom = Join-Path $script:Sandbox 'nobom.txt'
        $withBom = Join-Path $script:Sandbox 'bom.txt'
        [System.IO.File]::WriteAllText($noBom, "same body`n", [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($withBom, "same body`n", [System.Text.UTF8Encoding]::new($true))
        # Get-Content -Raw strips the BOM on read, so hashes must match.
        (Get-FileBodyHash -Path $noBom) | Should -Be (Get-FileBodyHash -Path $withBom)
    }
}

Describe 'Dispatch registry (Add-DispatchEvent / Get-DispatchState)' {
    BeforeEach {
        $script:Registry = Join-Path $script:Sandbox "registry-$([guid]::NewGuid().ToString('N').Substring(0,6)).jsonl"
    }

    It 'appends events and reports last state per dispatch' {
        $id = New-DispatchId -Role 'test-role'
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'assembled' | Out-Null
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'started' | Out-Null
        (Get-DispatchState -Registry $script:Registry -DispatchId $id).state | Should -Be 'started'
    }

    It 'keeps every event (append-only, no rewrites)' {
        $id = New-DispatchId -Role 'test-role'
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'assembled' | Out-Null
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'started' | Out-Null
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'completed' | Out-Null
        @([System.IO.File]::ReadAllLines($script:Registry)).Count | Should -Be 3
    }

    It 'rejects states outside the lifecycle' {
        { Add-DispatchEvent -Registry $script:Registry -DispatchId 'x' -State 'done' } | Should -Throw
    }

    It 'survives concurrent appends without losing or corrupting lines' {
        $registry = $script:Registry
        $modulePath = Join-Path $script:ScriptsDir 'HarnessDispatch.psm1'
        $jobs = 1..4 | ForEach-Object {
            Start-Job -ScriptBlock {
                param($mod, $reg, $n)
                Import-Module $mod -Force
                foreach ($i in 1..10) {
                    Add-DispatchEvent -Registry $reg -DispatchId "job$n-evt$i" -State 'assembled' | Out-Null
                }
            } -ArgumentList $modulePath, $registry, $_
        }
        $jobs | Wait-Job -Timeout 60 | Out-Null
        $jobs | ForEach-Object { $_.State | Should -Be 'Completed' }
        $jobs | Remove-Job -Force
        $lines = @([System.IO.File]::ReadAllLines($registry) | Where-Object { $_ })
        $lines.Count | Should -Be 40
        # every line must be intact JSON
        foreach ($l in $lines) { { $l | ConvertFrom-Json } | Should -Not -Throw }
    }

    It 'returns empty for a registry that does not exist yet' {
        @(Get-DispatchState -Registry (Join-Path $script:Sandbox 'nope.jsonl')).Count | Should -Be 0
    }

    It 'skips a torn/malformed line without bricking the reader' {
        $id = New-DispatchId -Role 'test-role'
        Add-DispatchEvent -Registry $script:Registry -DispatchId $id -State 'assembled' | Out-Null
        Add-Content -LiteralPath $script:Registry -Value '{"dispatchId":"torn-write' -NoNewline
        Add-Content -LiteralPath $script:Registry -Value ''
        $state = Get-DispatchState -Registry $script:Registry -DispatchId $id -WarningAction SilentlyContinue
        $state.state | Should -Be 'assembled'
    }
}

Describe 'Assert-ScriptLock (fail closed)' {
    BeforeEach {
        $script:LockDir = Join-Path $script:Sandbox "lockdir-$([guid]::NewGuid().ToString('N').Substring(0,6))"
        New-Item -ItemType Directory -Force -Path $script:LockDir | Out-Null
        Copy-Item (Join-Path $script:ScriptsDir 'HarnessDispatch.psm1') $script:LockDir
        $script:Entry = Join-Path $script:LockDir 'Entry.ps1'
        Set-Content -LiteralPath $script:Entry -Value 'Write-Output ok'
    }

    It 'throws LOCK-MISSING when no lock file exists' {
        { Assert-ScriptLock -ScriptPath $script:Entry } | Should -Throw '*LOCK-MISSING*'
    }

    It 'throws LOCK-UNLISTED for a file absent from the lock' {
        @{ files = @{ 'HarnessDispatch.psm1' = (Get-FileBodyHash -Path (Join-Path $script:LockDir 'HarnessDispatch.psm1')) } } |
            ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $script:LockDir 'scripts.lock.json')
        { Assert-ScriptLock -ScriptPath $script:Entry } | Should -Throw '*LOCK-UNLISTED*'
    }

    It 'throws LOCK-MISMATCH when the entrypoint was edited after locking' {
        @{ files = @{
            'Entry.ps1' = (Get-FileBodyHash -Path $script:Entry)
            'HarnessDispatch.psm1' = (Get-FileBodyHash -Path (Join-Path $script:LockDir 'HarnessDispatch.psm1'))
        } } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $script:LockDir 'scripts.lock.json')
        Add-Content -LiteralPath $script:Entry -Value '# tampered'
        { Assert-ScriptLock -ScriptPath $script:Entry } | Should -Throw '*LOCK-MISMATCH*'
    }

    It 'throws LOCK-MISMATCH when the shared module was edited even if entrypoint matches' {
        @{ files = @{
            'Entry.ps1' = (Get-FileBodyHash -Path $script:Entry)
            'HarnessDispatch.psm1' = (Get-FileBodyHash -Path (Join-Path $script:LockDir 'HarnessDispatch.psm1'))
        } } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $script:LockDir 'scripts.lock.json')
        Add-Content -LiteralPath (Join-Path $script:LockDir 'HarnessDispatch.psm1') -Value '# tampered'
        { Assert-ScriptLock -ScriptPath $script:Entry } | Should -Throw '*LOCK-MISMATCH*'
    }

    It 'passes when all hashes match' {
        @{ files = @{
            'Entry.ps1' = (Get-FileBodyHash -Path $script:Entry)
            'HarnessDispatch.psm1' = (Get-FileBodyHash -Path (Join-Path $script:LockDir 'HarnessDispatch.psm1'))
        } } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $script:LockDir 'scripts.lock.json')
        { Assert-ScriptLock -ScriptPath $script:Entry } | Should -Not -Throw
    }
}

Describe 'Write-JsonAtomic' {
    It 'writes valid JSON and leaves no temp files behind' {
        $target = Join-Path $script:Sandbox 'receipt.json'
        Write-JsonAtomic -Path $target -Object @{ a = 1; nested = @{ b = 'x' } }
        (Get-Content -LiteralPath $target -Raw | ConvertFrom-Json).a | Should -Be 1
        @(Get-ChildItem $script:Sandbox -Filter 'receipt.json.tmp-*').Count | Should -Be 0
    }

    It 'replaces an existing file whole' {
        $target = Join-Path $script:Sandbox 'receipt2.json'
        Write-JsonAtomic -Path $target -Object @{ v = 'first' }
        Write-JsonAtomic -Path $target -Object @{ v = 'second' }
        (Get-Content -LiteralPath $target -Raw | ConvertFrom-Json).v | Should -Be 'second'
    }
}

Describe 'New-DispatchPrompt.ps1 (integration)' {
    BeforeAll {
        # Build an isolated vendored copy with a valid lock so Assert-ScriptLock passes.
        $script:VendorDir = Join-Path $script:Sandbox 'vendor'
        New-Item -ItemType Directory -Force -Path $script:VendorDir | Out-Null
        Get-ChildItem -LiteralPath $script:ScriptsDir -File | Where-Object { $_.Extension -in '.ps1', '.psm1', '.psd1' } |
            ForEach-Object { Copy-Item $_.FullName $script:VendorDir }
        $files = [ordered]@{}
        Get-ChildItem -LiteralPath $script:VendorDir -File | Where-Object { $_.Extension -in '.ps1', '.psm1', '.psd1' } |
            Sort-Object Name | ForEach-Object { $files[$_.Name] = Get-FileBodyHash -Path $_.FullName }
        @{ bundleVersion = 'test'; files = $files } | ConvertTo-Json -Depth 3 |
            Set-Content -LiteralPath (Join-Path $script:VendorDir 'scripts.lock.json')

        $script:PromptDir = Join-Path $script:Sandbox 'prompts'
        New-Item -ItemType Directory -Force -Path $script:PromptDir | Out-Null
        $script:Pack = Join-Path $script:PromptDir 'pack.md'
        Set-Content -LiteralPath $script:Pack -Value "impl-pack v1.0.0 · milestone <id> · body-sha256 <hash>`nPACK BODY LINE ONE`nPACK BODY LINE TWO"
        $script:Bindings = Join-Path $script:PromptDir 'bindings.md'
        Set-Content -LiteralPath $script:Bindings -Value 'BINDINGS BLOCK'
        $script:Card = Join-Path $script:PromptDir 'card.md'
        Set-Content -LiteralPath $script:Card -Value 'CARD BLOCK'
    }

    It 'assembles pack -> bindings -> card in order, stamps version + hash, registers assembled' {
        $out = Join-Path $script:PromptDir 'prompt1.md'
        $reg = Join-Path $script:PromptDir 'reg1.jsonl'
        $result = & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') `
            -PackFile $script:Pack -BindingsFile $script:Bindings -CardFile $script:Card `
            -OutFile $out -Registry $reg -Milestone 'M-TEST' -Role 'implementer-standard'

        $result.state | Should -Be 'assembled'
        $result.packVersion | Should -Be '1.0.0'
        $result.verdict | Should -Match 'FORM-COMPLETE'

        $prompt = Get-Content -LiteralPath $out -Raw
        $prompt | Should -Match 'impl-pack v1\.0\.0 · milestone M-TEST · body-sha256 [0-9a-f]{64}'
        $prompt | Should -Not -Match '<id>'
        $prompt | Should -Not -Match '<hash>'
        $prompt.IndexOf('PACK BODY') | Should -BeLessThan $prompt.IndexOf('BINDINGS BLOCK')
        $prompt.IndexOf('BINDINGS BLOCK') | Should -BeLessThan $prompt.IndexOf('CARD BLOCK')

        (Get-DispatchState -Registry $reg -DispatchId $result.dispatchId).state | Should -Be 'assembled'
    }

    It 'produces byte-identical stamped prefix across two assemblies of same pack (frozen prefix)' {
        $out1 = Join-Path $script:PromptDir 'p-a.md'
        $out2 = Join-Path $script:PromptDir 'p-b.md'
        $reg = Join-Path $script:PromptDir 'reg2.jsonl'
        $r1 = & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $script:Pack -BindingsFile $script:Bindings -CardFile $script:Card -OutFile $out1 -Registry $reg -Milestone 'M-TEST' -Role 'implementer-standard'
        $r2 = & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $script:Pack -BindingsFile $script:Bindings -CardFile $script:Card -OutFile $out2 -Registry $reg -Milestone 'M-TEST' -Role 'implementer-standard'
        $r1.packBodySha256 | Should -Be $r2.packBodySha256
        $r1.promptSha256 | Should -Be $r2.promptSha256
    }

    It 'appends addenda LAST with their own hash header' {
        $add = Join-Path $script:PromptDir 'addendum-2026-07-16.md'
        Set-Content -LiteralPath $add -Value 'ADDENDUM RULE'
        $out = Join-Path $script:PromptDir 'p-add.md'
        $reg = Join-Path $script:PromptDir 'reg3.jsonl'
        & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $script:Pack -BindingsFile $script:Bindings -CardFile $script:Card -OutFile $out -Registry $reg -Milestone 'M-TEST' -Role 'implementer-standard' -AddendumFile $add | Out-Null
        $prompt = Get-Content -LiteralPath $out -Raw
        $prompt.IndexOf('CARD BLOCK') | Should -BeLessThan $prompt.IndexOf('ADDENDUM RULE')
        $prompt | Should -Match 'ADDENDUM addendum-2026-07-16\.md · body-sha256 [0-9a-f]{64}'
    }

    It 'refuses a pack whose first line is not a stamp template' {
        $badPack = Join-Path $script:PromptDir 'badpack.md'
        Set-Content -LiteralPath $badPack -Value "no stamp here`nbody"
        $out = Join-Path $script:PromptDir 'p-bad.md'
        $reg = Join-Path $script:PromptDir 'reg4.jsonl'
        { & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $badPack -BindingsFile $script:Bindings -CardFile $script:Card -OutFile $out -Registry $reg -Milestone 'M' -Role 'r' } |
            Should -Throw '*PACK-MALFORMED*'
    }

    It 'refuses empty input files' {
        $empty = Join-Path $script:PromptDir 'empty.md'
        New-Item -ItemType File -Force -Path $empty | Out-Null
        $reg = Join-Path $script:PromptDir 'reg5.jsonl'
        { & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $script:Pack -BindingsFile $empty -CardFile $script:Card -OutFile (Join-Path $script:PromptDir 'x.md') -Registry $reg -Milestone 'M' -Role 'r' } |
            Should -Throw '*INPUT-EMPTY*'
    }

    It 'writes the prompt CRLF-free with UTF-8 no BOM' {
        $out = Join-Path $script:PromptDir 'p-enc.md'
        $reg = Join-Path $script:PromptDir 'reg6.jsonl'
        & (Join-Path $script:VendorDir 'New-DispatchPrompt.ps1') -PackFile $script:Pack -BindingsFile $script:Bindings -CardFile $script:Card -OutFile $out -Registry $reg -Milestone 'M-TEST' -Role 'implementer-standard' | Out-Null
        $bytes = [System.IO.File]::ReadAllBytes($out)
        # no BOM
        ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB) | Should -BeFalse
        # no CR anywhere
        ($bytes -contains 0x0D) | Should -BeFalse
    }
}

Describe 'Invoke-CodexDispatch.ps1 (guards — no live codex run)' {
    BeforeAll {
        $script:Dispatcher = Join-Path $script:VendorDir 'Invoke-CodexDispatch.ps1'
        $script:GuardScratch = Join-Path $script:Sandbox 'guard-scratch'
        New-Item -ItemType Directory -Force -Path $script:GuardScratch | Out-Null
        $script:GuardPrompt = Join-Path $script:GuardScratch 'prompt.md'
        Set-Content -LiteralPath $script:GuardPrompt -Value 'prompt body'
    }

    It 'rejects an unknown role before spending anything' {
        $reg = Join-Path $script:GuardScratch 'reg-a.jsonl'
        { & $script:Dispatcher -Role 'no-such-role' -PromptFile $script:GuardPrompt -Scratchpad $script:GuardScratch -Registry $reg } |
            Should -Throw '*ROLE-UNKNOWN*'
    }

    It 'rejects a companion-path role (investigator) — OS-process script is the wrong lane' {
        $reg = Join-Path $script:GuardScratch 'reg-b.jsonl'
        { & $script:Dispatcher -Role 'investigator' -PromptFile $script:GuardPrompt -Scratchpad $script:GuardScratch -Registry $reg } |
            Should -Throw '*PATH-MISMATCH*'
    }

    It 'rejects a dispatchId not in the registry' {
        $reg = Join-Path $script:GuardScratch 'reg-c.jsonl'
        Add-DispatchEvent -Registry $reg -DispatchId 'seed' -State 'assembled' | Out-Null
        { & $script:Dispatcher -Role 'implementer-standard' -PromptFile $script:GuardPrompt -Scratchpad $script:GuardScratch -Registry $reg -DispatchId 'ghost-id' } |
            Should -Throw '*DISPATCH-UNKNOWN*'
    }

    It 'NEVER re-issues: rejects a dispatchId already promoted past assembled' {
        $reg = Join-Path $script:GuardScratch 'reg-d.jsonl'
        Add-DispatchEvent -Registry $reg -DispatchId 'dup-1' -State 'assembled' | Out-Null
        Add-DispatchEvent -Registry $reg -DispatchId 'dup-1' -State 'started' | Out-Null
        { & $script:Dispatcher -Role 'implementer-standard' -PromptFile $script:GuardPrompt -Scratchpad $script:GuardScratch -Registry $reg -DispatchId 'dup-1' } |
            Should -Throw '*LIFECYCLE-VIOLATION*'
    }

    It 'rejects an empty prompt file' {
        $reg = Join-Path $script:GuardScratch 'reg-e.jsonl'
        $empty = Join-Path $script:GuardScratch 'empty-prompt.md'
        New-Item -ItemType File -Force -Path $empty | Out-Null
        { & $script:Dispatcher -Role 'implementer-standard' -PromptFile $empty -Scratchpad $script:GuardScratch -Registry $reg } |
            Should -Throw '*PREFLIGHT-FAIL*'
    }
}
