param()

$packDir = "LinkedIn-Orchestrator-Pack"
$zipFile = "LinkedIn-Orchestrator-Pack.zip"

Write-Host "[1/5] Nettoyage..."
if (Test-Path $packDir) { Remove-Item -Recurse -Force $packDir }
if (Test-Path $zipFile) { Remove-Item -Force $zipFile }

Write-Host "[2/5] Creation dossiers..."
New-Item -ItemType Directory -Path $packDir -Force | Out-Null
New-Item -ItemType Directory -Path "$packDir\assets" -Force | Out-Null
New-Item -ItemType Directory -Path "$packDir\data" -Force | Out-Null

Write-Host "[3/5] Copie sources..."
Copy-Item -Recurse "src" "$packDir\src"
Copy-Item -Recurse "dashboard" "$packDir\dashboard"
Copy-Item "package.json" "$packDir\"
Copy-Item "package-lock.json" "$packDir\"
Copy-Item "tsconfig.json" "$packDir\"
Copy-Item ".env.example" "$packDir\.env.example"
Copy-Item ".env.example" "$packDir\.env"
Copy-Item "README.md" "$packDir\"
Copy-Item "MODE_D_EMPLOI.txt" "$packDir\"
Copy-Item "0-Installation-Rapide.bat" "$packDir\"
Copy-Item "1-Connexion-LinkedIn.bat" "$packDir\"
Copy-Item "2-Connexion-HelloWork.bat" "$packDir\"
Copy-Item "3-Lancer-Orchestrator.bat" "$packDir\"
Copy-Item "0-Installation-Mac.command" "$packDir\"
Copy-Item "1-Connexion-LinkedIn-Mac.command" "$packDir\"
Copy-Item "2-Connexion-HelloWork-Mac.command" "$packDir\"
Copy-Item "3-Lancer-Orchestrator-Mac.command" "$packDir\"
Copy-Item "assets\sample_cv.txt" "$packDir\assets\"

Write-Host "[4/5] Compression ZIP..."
Compress-Archive -Path "$packDir\*" -DestinationPath $zipFile -Force

Write-Host "[5/5] Termine !"
Get-Item $zipFile | Select-Object Name, Length, LastWriteTime
