#!/bin/bash

# Script to help with the release process
# リリースプロセスを支援するスクリプト

# Check if a version argument was provided
if [ -z "$1" ]; then
  echo "Error: No version specified"
  echo "Usage: ./scripts/release.sh <version|patch|minor|major>"
  echo "Examples:"
  echo "  ./scripts/release.sh 0.1.4    # Set specific version"
  echo "  ./scripts/release.sh patch    # Increment patch version (0.1.3 -> 0.1.4)"
  echo "  ./scripts/release.sh minor    # Increment minor version (0.1.3 -> 0.2.0)"
  echo "  ./scripts/release.sh major    # Increment major version (0.1.3 -> 1.0.0)"
  exit 1
fi

VERSION_ARG=$1

# Parse Version Type
if [[ "$VERSION_ARG" =~ ^(patch|minor|major)$ ]]; then
  INCREMENT_TYPE=$VERSION_ARG
  CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
  echo "Using semantic increment: $INCREMENT_TYPE (current version: $CURRENT_VERSION)"
else
  if ! [[ $VERSION_ARG =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+)?(\+[0-9A-Za-z-]+)?$ ]]; then
    echo "Error: Version must follow semantic versioning (e.g., 1.2.3, 1.2.3-beta, etc.)"
    echo "Or use one of: patch, minor, major"
    exit 1
  fi
  SPECIFIC_VERSION=$VERSION_ARG
  echo "Using specific version: $SPECIFIC_VERSION"
fi

# Git Branch Check
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Warning: You are not on the main branch. Current branch: $CURRENT_BRANCH"
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Git Status Check
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Please commit or stash your changes."
  exit 1
fi

# Sync with Remote
echo "Pulling latest changes from origin..."
git pull origin main

# Version Consistency Check
PACKAGE_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
INDEX_VERSION=$(grep -o 'version: "[^"]*"' src/index.ts | cut -d'"' -f2)
MANIFEST_VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

echo "Current versions:"
echo "- package.json: $PACKAGE_VERSION"
echo "- src/index.ts: $INDEX_VERSION"
echo "- manifest.json: $MANIFEST_VERSION"

# Version Update Functions
update_index_version() {
  local old_version=$1
  local new_version=$2
  
  echo "Updating version in src/index.ts from $old_version to $new_version..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/version: \"$old_version\"/version: \"$new_version\"/" src/index.ts
  else
    # Linux
    sed -i "s/version: \"$old_version\"/version: \"$new_version\"/" src/index.ts
  fi
  git add src/index.ts
}

update_manifest_version() {
  local old_version=$1
  local new_version=$2
  
  echo "Updating version in manifest.json from $old_version to $new_version..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/" manifest.json
  else
    # Linux
    sed -i "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/" manifest.json
  fi
  git add manifest.json
}

# Version Mismatch Warning
if [ "$PACKAGE_VERSION" != "$INDEX_VERSION" ] || [ "$PACKAGE_VERSION" != "$MANIFEST_VERSION" ]; then
  echo "Warning: Version mismatch detected between files."
  
  if [ -n "$SPECIFIC_VERSION" ]; then
    echo "Will update all files to version: $SPECIFIC_VERSION"
  else
    echo "Will update all files using increment: $INCREMENT_TYPE"
  fi
  
  read -p "Do you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Version Update Process
if [ -n "$INCREMENT_TYPE" ]; then
  echo "Incrementing version ($INCREMENT_TYPE)..."
  
  npm version $INCREMENT_TYPE --no-git-tag-version
  NEW_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
  
  update_index_version "$INDEX_VERSION" "$NEW_VERSION"
  update_manifest_version "$MANIFEST_VERSION" "$NEW_VERSION"
  
  git add package.json package-lock.json
  git commit -m "chore: release version $NEW_VERSION"
  git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"
else
  echo "Updating to specific version..."
  
  npm version $SPECIFIC_VERSION --no-git-tag-version
  update_index_version "$INDEX_VERSION" "$SPECIFIC_VERSION"
  update_manifest_version "$MANIFEST_VERSION" "$SPECIFIC_VERSION"
  
  git add package.json package-lock.json
  git commit -m "chore: release version $SPECIFIC_VERSION"
  git tag -a "v$SPECIFIC_VERSION" -m "Version $SPECIFIC_VERSION"
fi

# Push to Remote
FINAL_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

echo "Pushing changes and tag to remote..."
git push origin main
git push origin v$FINAL_VERSION

# Success Message
echo "Release process completed for version $FINAL_VERSION"
echo "The GitHub workflow will now build and publish the package to npm"
echo "Check the Actions tab in your GitHub repository for progress"