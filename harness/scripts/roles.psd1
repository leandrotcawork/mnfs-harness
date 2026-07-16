@{
    # HARNESS-CORE §1 model matrix — data mirror consumed by Invoke-CodexDispatch.ps1.
    # Canonical source is HARNESS-CORE.md §1; edits land there first, here second.
    # Sandbox is the operational default per role (writers get workspace-write,
    # judges/auditors read-only); the -Sandbox parameter overrides per dispatch.
    'feature-planner'       = @{ Model = 'gpt-5.6-sol';  Effort = 'medium'; Path = 'os-process'; Sandbox = 'workspace-write' }
    'implementer-standard'  = @{ Model = 'gpt-5.6-luna'; Effort = 'high';   Path = 'os-process'; Sandbox = 'workspace-write' }
    'implementer-complex'   = @{ Model = 'gpt-5.6-sol';  Effort = 'low';    Path = 'os-process'; Sandbox = 'workspace-write' }
    'investigator'          = @{ Model = 'gpt-5.6-luna'; Effort = 'medium'; Path = 'companion';  Sandbox = 'read-only' }
    'gate-review'           = @{ Model = 'gpt-5.6-sol';  Effort = 'medium'; Path = 'os-process'; Sandbox = 'read-only' }
    'mission-co-planner'    = @{ Model = 'gpt-5.6-sol';  Effort = 'medium'; Path = 'os-process'; Sandbox = 'workspace-write' }
    'decomposition-auditor' = @{ Model = 'gpt-5.6-sol';  Effort = 'medium'; Path = 'os-process'; Sandbox = 'read-only' }
    'readiness-gate'        = @{ Model = 'gpt-5.6-sol';  Effort = 'high';   Path = 'os-process'; Sandbox = 'read-only' }
}
