param()

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   GENERATION DES PACKS DE DISTRIBUTION (WINDOWS & MAC)" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$baseFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".env.example",
    ".gitignore",
    "README.md"
)

function Prepare-BaseDirectory($targetDir) {
    if (Test-Path $targetDir) { Remove-Item -Recurse -Force $targetDir }
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    New-Item -ItemType Directory -Path "$targetDir\assets" -Force | Out-Null
    New-Item -ItemType Directory -Path "$targetDir\data" -Force | Out-Null

    Copy-Item -Recurse "src" "$targetDir\src"
    Copy-Item -Recurse "dashboard" "$targetDir\dashboard"
    
    foreach ($file in $baseFiles) {
        if (Test-Path $file) { Copy-Item $file "$targetDir\" }
    }
    
    # .env pret a l'emploi
    Copy-Item ".env.example" "$targetDir\.env"
    
    # Echantillon CV neutre
    if (Test-Path "assets\sample_cv.txt") {
        Copy-Item "assets\sample_cv.txt" "$targetDir\assets\"
    }
}

# ==================== 1. PACK WINDOWS ====================
Write-Host "[1/3] Creation du Pack Windows..." -ForegroundColor Yellow
$winDir = "LinkedIn-Orchestrator-Windows"
$winZip = "LinkedIn-Orchestrator-Windows.zip"

Prepare-BaseDirectory $winDir

Copy-Item "0-Installation-Rapide.bat" "$winDir\"
Copy-Item "1-Connexion-LinkedIn.bat" "$winDir\"
Copy-Item "2-Connexion-HelloWork.bat" "$winDir\"
Copy-Item "3-Lancer-Orchestrator.bat" "$winDir\"
Copy-Item "Mettre-A-Jour.bat" "$winDir\"
Copy-Item "MODE_D_EMPLOI.txt" "$winDir\"

if (Test-Path $winZip) { Remove-Item -Force $winZip }
Compress-Archive -Path "$winDir\*" -DestinationPath $winZip -Force
Write-Host " -> $winZip genere avec succes !" -ForegroundColor Green

# ==================== 2. PACK MAC ====================
Write-Host "[2/3] Creation du Pack Mac..." -ForegroundColor Yellow
$macDir = "LinkedIn-Orchestrator-Mac"
$macZip = "LinkedIn-Orchestrator-Mac.zip"

Prepare-BaseDirectory $macDir

Copy-Item "0-Installation-Mac.command" "$macDir\"
Copy-Item "1-Connexion-LinkedIn-Mac.command" "$macDir\"
Copy-Item "2-Connexion-HelloWork-Mac.command" "$macDir\"
Copy-Item "3-Lancer-Orchestrator-Mac.command" "$macDir\"
Copy-Item "Mettre-A-Jour-Mac.command" "$macDir\"
Copy-Item "installer-permissions-mac.sh" "$macDir\"
Copy-Item "MODE_D_EMPLOI_MAC.txt" "$macDir\MODE_D_EMPLOI.txt"

if (Test-Path $macZip) { Remove-Item -Force $macZip }
Compress-Archive -Path "$macDir\*" -DestinationPath $macZip -Force
Write-Host " -> $macZip genere avec succes !" -ForegroundColor Green

# ==================== 3. PACK UNIVERSEL (PACK COMPLET) ====================
Write-Host "[3/3] Creation du Pack Universel (Windows + Mac)..." -ForegroundColor Yellow
$allDir = "LinkedIn-Orchestrator-Pack"
$allZip = "LinkedIn-Orchestrator-Pack.zip"

Prepare-BaseDirectory $allDir

Copy-Item "0-Installation-Rapide.bat" "$allDir\"
Copy-Item "1-Connexion-LinkedIn.bat" "$allDir\"
Copy-Item "2-Connexion-HelloWork.bat" "$allDir\"
Copy-Item "3-Lancer-Orchestrator.bat" "$allDir\"
Copy-Item "Mettre-A-Jour.bat" "$allDir\"
Copy-Item "0-Installation-Mac.command" "$allDir\"
Copy-Item "1-Connexion-LinkedIn-Mac.command" "$allDir\"
Copy-Item "2-Connexion-HelloWork-Mac.command" "$allDir\"
Copy-Item "3-Lancer-Orchestrator-Mac.command" "$allDir\"
Copy-Item "Mettre-A-Jour-Mac.command" "$allDir\"
Copy-Item "installer-permissions-mac.sh" "$allDir\"
Copy-Item "MODE_D_EMPLOI.txt" "$allDir\"
Copy-Item "MODE_D_EMPLOI_MAC.txt" "$allDir\"

if (Test-Path $allZip) { Remove-Item -Force $allZip }
Compress-Archive -Path "$allDir\*" -DestinationPath $allZip -Force
Write-Host " -> $allZip genere avec succes !" -ForegroundColor Green

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RECAPITULATIF DES ARCHIVES GENEREES :" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Get-Item "LinkedIn-Orchestrator-*.zip" | Select-Object Name, @{Name="Taille (Ko)"; Expression={[math]::Round($_.Length / 1KB, 1)}}, LastWriteTime | Format-Table -AutoSize
