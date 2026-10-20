#!/usr/bin/env bash
set -e

VERSION="${1:-v1.0.0}"
echo "=== Building Anvil-MC $VERSION APK ==="
chmod +x gradlew
./gradlew assembleDebug assembleRelease

APK_PATH="app/build/outputs/apk/release/app-release.apk"
OUT_APK="Anvil-MC-${VERSION}.apk"
cp "$APK_PATH" "$OUT_APK"

echo "=== Tagging & Pushing $VERSION to GitHub ==="
git add -A
git commit -m "chore(release): Anvil-MC ${VERSION}" || true
git tag -f "$VERSION"
git push origin HEAD --tags

if command -v gh >/dev/null 2>&1; then
  echo "=== Publishing GitHub Release via gh CLI ==="
  gh release create "$VERSION" "$OUT_APK" --title "Anvil-MC $VERSION" --notes "Automated release of Anvil-MC ($OUT_APK)" || gh release upload "$VERSION" "$OUT_APK" --clobber
fi

echo "Done! APK available at: $OUT_APK"
