# start.ps1 — kill stale processes and launch both dev servers
Write-Host "Stopping any processes on ports 3001 and 5173..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3001,5173 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

Write-Host "Starting API server on :3001 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\api'; npx tsx src/index.ts"

Start-Sleep -Seconds 1

Write-Host "Starting web server on :5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\apps\web'; npx vite"

Write-Host ""
Write-Host "Done! Open http://localhost:5173 in your browser." -ForegroundColor Green
