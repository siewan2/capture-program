$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem -Path "$PSScriptRoot/../dist/Capture-Program-Setup-*.exe" | Select-Object -First 1
if (!$installer) { throw 'Installer not found' }
$installDir = Join-Path $env:TEMP ('Capture Program Install Test ' + [guid]::NewGuid())
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$entryName = 'com.siewan.captureprogram'
$startupLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'Capture Program.lnk'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Capture Program.lnk'
$menuLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'Capture Program.lnk'
$wshell = New-Object -ComObject WScript.Shell
try {
  $process = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installDir" -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
  $executable = Join-Path $installDir 'Capture Program.exe'
  if (!(Test-Path $executable)) { throw 'Installed executable not found' }
  if (!(Test-Path $startupLink)) { throw 'Installer did not create the Startup shortcut' }
  $shortcut = $wshell.CreateShortcut($startupLink)
  if ($shortcut.TargetPath -ne $executable -or $shortcut.Arguments -ne '--startup-hidden') { throw 'Incorrect Startup shortcut target or arguments' }
  if (!(Test-Path $desktopLink) -or !(Test-Path $menuLink)) { throw 'Desktop or Start Menu shortcut missing' }
  $env:CAPTURE_TEST_EXE = $executable
  node "$PSScriptRoot/desktop-smoke.cjs"
  if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' }
  node "$PSScriptRoot/gallery-smoke.cjs"
  if ($LASTEXITCODE -ne 0) { throw 'Installed gallery interactions failed' }
  # Verify that uninstall removes only this installation's automatic-start entry.
  New-Item -Path $runKey -Force | Out-Null
  New-ItemProperty -Path $runKey -Name $entryName -PropertyType String -Value ('"' + $executable + '" --startup-hidden') -Force | Out-Null
  $uninstaller = Get-ChildItem -Path $installDir -Filter 'Uninstall*.exe' | Select-Object -First 1
  if (!$uninstaller) { throw 'Uninstaller not found' }
  $removed = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S _?=$installDir" -Wait -PassThru
  if ($removed.ExitCode -ne 0) { throw "Uninstall failed: $($removed.ExitCode)" }
  if (Test-Path $executable) { throw 'Uninstall left the application executable behind' }
  $remaining = Get-ItemProperty -Path $runKey -Name $entryName -ErrorAction SilentlyContinue
  if ($null -ne $remaining) { throw 'Uninstall left the login startup entry behind' }
  foreach ($link in @($startupLink,$desktopLink,$menuLink)) { if (Test-Path $link) { throw "Uninstall left shortcut: $link" } }
  # Silent installation can explicitly opt out of login startup.
  $optOut = Start-Process -FilePath $installer.FullName -ArgumentList "/S /NOSTARTUP /D=$installDir" -Wait -PassThru
  if ($optOut.ExitCode -ne 0 -or (Test-Path $startupLink)) { throw 'Startup opt-out failed' }
  $uninstaller = Get-ChildItem -Path $installDir -Filter 'Uninstall*.exe' | Select-Object -First 1
  Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S _?=$installDir" -Wait | Out-Null
  if (Test-Path $executable) { throw 'Opt-out installation uninstall failed' }
  Write-Host 'PASS installer, real installed app, Startup shortcut, opt-out, legacy startup cleanup, uninstall and shortcut removal.'
} finally {
  Remove-Item Env:CAPTURE_TEST_EXE -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $runKey -Name $entryName -ErrorAction SilentlyContinue
  if (Test-Path $installDir) { Remove-Item -Path $installDir -Recurse -Force }
}
