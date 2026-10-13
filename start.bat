@echo off
title VOLTKER - Toko Tas
echo ==========================================
echo   ⚡ VOLTKER - Memulai aplikasi...
echo ==========================================
if not exist node_modules (
  echo Menginstall dependencies pertama kali...
  call npm install
)
call npm run dev
pause
