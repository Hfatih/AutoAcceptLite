$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$workRoot = $PSScriptRoot
$payload = Join-Path $workRoot 'payload'
$appOut = Join-Path $payload 'app'
$runtime = Join-Path $payload 'runtime'
$assetRoot = Join-Path $workRoot 'assets'
$csc = 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$compiler = $env:INNO_SETUP_COMPILER
if ([string]::IsNullOrWhiteSpace($compiler)) {
    $compiler = @('C:/Program Files (x86)/Inno Setup 7/ISCC.exe', 'C:/Program Files (x86)/Inno Setup 6/ISCC.exe') |
        Where-Object { Test-Path $_ } | Select-Object -First 1
}

if (!(Test-Path (Join-Path $runtime 'node.exe'))) { throw 'Node.js x64 runtime is missing from packaging/windows/payload/runtime.' }
if (!(Test-Path (Join-Path $runtime 'LICENSE.node.txt'))) { throw 'Copy the Node.js license and third-party notices to LICENSE.node.txt.' }
if (!(Test-Path $csc)) { throw '.NET Framework C# compiler was not found.' }
if ([string]::IsNullOrWhiteSpace($compiler) -or !(Test-Path $compiler)) { throw 'Inno Setup ISCC.exe was not found. Set INNO_SETUP_COMPILER if installed elsewhere.' }
New-Item -ItemType Directory -Force -Path (Join-Path $workRoot 'dist') | Out-Null

Push-Location $repoRoot
try {
    & npm ci --omit=dev --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
} finally { Pop-Location }

if (Test-Path $appOut) { Remove-Item -LiteralPath $appOut -Recurse -Force }
New-Item -ItemType Directory -Force -Path $appOut | Out-Null
foreach ($name in @('index.js', 'config.json', 'package.json', 'package-lock.json', 'README.md', 'README.en.md', 'README.tr.md', 'LICENSE', 'LICENSE.upstream', 'THIRD-PARTY-NOTICES.md')) {
    Copy-Item -LiteralPath (Join-Path $repoRoot $name) -Destination $appOut
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'src') -Destination $appOut -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'node_modules') -Destination $appOut -Recurse

& $csc /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/win32icon:$(Join-Path $assetRoot 'AutoAcceptLite.ico')" "/out:$(Join-Path $payload 'AutoAcceptLite.exe')" (Join-Path $workRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Tray launcher build failed.' }
& $csc /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 /define:UNINSTALL /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/win32icon:$(Join-Path $assetRoot 'AutoAcceptLite.ico')" "/out:$(Join-Path $workRoot 'dist/AutoAcceptLite-Kaldir.exe')" (Join-Path $workRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Uninstaller helper build failed.' }
& $compiler (Join-Path $workRoot 'setup.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup build failed.' }
