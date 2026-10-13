#!/bin/bash
echo "=========================================="
echo "  ⚡ VOLTKER - Memulai aplikasi..."
echo "=========================================="
if [ ! -d node_modules ]; then
  echo "Menginstall dependencies pertama kali..."
  npm install
fi
npm run dev
