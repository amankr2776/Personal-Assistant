#!/bin/bash
# ============================================================
# 🚀 AIRA — Deploy to Vercel via GitHub
# Run this from your local terminal (where you have git/gh auth)
# ============================================================

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║        AIRA — Deploying to Vercel             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check if gh is authenticated
if command -v gh &>/dev/null; then
  echo "✅ GitHub CLI found"
else
  echo "⚠️  gh CLI not found. Install: https://cli.github.com"
  echo "   Or just push manually: git push origin main"
fi

echo ""
echo "Step 1: Pushing to GitHub..."
git push origin main 2>/dev/null || {
  echo ""
  echo "❌ Push failed. Make sure you're in the jarvis/ directory"
  echo "   and GitHub remote is set: git remote add origin https://github.com/hackonauts/jarvis.git"
  exit 1
}

echo "✅ Pushed to GitHub!"
echo ""

echo "Step 2: Setting Vercel environment variables..."
echo ""
echo "Run these commands in your terminal (or set in Vercel Dashboard):"
echo ""
echo "  vercel env add VITE_FIREBASE_API_KEY production"
echo "  → AIzaSyCTX7yc3H6wGqfSZKc-5fmBLT_ObQGWZfg"
echo ""
echo "  vercel env add VITE_FIREBASE_AUTH_DOMAIN production"
echo "  → studio-5920787368-5b5cb.firebaseapp.com"
echo ""
echo "  vercel env add VITE_FIREBASE_PROJECT_ID production"
echo "  → studio-5920787368-5b5cb"
echo ""
echo "  vercel env add VITE_FIREBASE_STORAGE_BUCKET production"
echo "  → studio-5920787368-5b5cb.firebasestorage.app"
echo ""
echo "  vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production"
echo "  → 964876206782"
echo ""
echo "  vercel env add VITE_FIREBASE_APP_ID production"
echo "  → 1:964876206782:web:3fa62ccc850decdd0114ef"
echo ""
echo "  vercel env add VITE_FIREBASE_PROJECT_ID production (for server-side auth)"
echo "  → studio-5920787368-5b5cb"
echo ""
echo "Step 3: Vercel auto-deploys from GitHub push!"
echo ""
echo "🎉 Done! Check: https://jarvis-murex-five.vercel.app"
