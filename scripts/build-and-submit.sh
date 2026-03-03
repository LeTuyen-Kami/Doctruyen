#!/bin/bash
set -e

PROFILE=production
PLATFORM=ios

# Build local
eas build --platform $PLATFORM --local --profile $PROFILE

# Tìm file .ipa mới nhất trong thư mục hiện tại
IPA_PATH=$(find . -type f -name "*.ipa" -print0 | xargs -0 ls -t | head -1)

# Submit lên App Store
eas submit --platform $PLATFORM --path "$IPA_PATH" --profile $PROFILE