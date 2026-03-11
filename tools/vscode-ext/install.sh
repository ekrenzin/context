#!/usr/bin/env bash
#
# Symlink the Context Services extension into the Cursor/VS Code extensions
# directory so it loads on next window reload.
#
# Usage:
#   ./tools/vscode-ext/install.sh           # install (build + symlink)
#   ./tools/vscode-ext/install.sh --remove  # uninstall (remove symlink)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DASHBOARD_DIR="${ROOT_DIR}/tools/command-center"
LINK_NAME="ctx-services"

find_ext_dir() {
  local candidates=(
    "${HOME}/.cursor/extensions"
    "${HOME}/.vscode/extensions"
  )
  for dir in "${candidates[@]}"; do
    if [[ -d "${dir}" ]]; then
      echo "${dir}"
      return 0
    fi
  done
  return 1
}

EXT_DIR="$(find_ext_dir)" || {
  echo "Could not find a Cursor or VS Code extensions directory." >&2
  echo "Looked in ~/.cursor/extensions and ~/.vscode/extensions" >&2
  exit 1
}

LINK="${EXT_DIR}/${LINK_NAME}"

if [[ "${1:-}" == "--remove" ]]; then
  if [[ -L "${LINK}" ]]; then
    rm "${LINK}"
    echo "Removed: ${LINK}"
    echo "Reload the window to deactivate."
  else
    echo "No symlink found at ${LINK}. Nothing to remove."
  fi
  exit 0
fi

if [[ -L "${LINK}" ]]; then
  existing="$(readlink "${LINK}")"
  if [[ "${existing}" == "${SCRIPT_DIR}" ]]; then
    echo "Already installed at ${LINK}"
    echo "Reload the window if you have not already: Cmd+Shift+P -> Developer: Reload Window"
    exit 0
  fi
  echo "Updating symlink (was: ${existing})"
  rm "${LINK}"
fi

if [[ -e "${LINK}" ]]; then
  echo "Error: ${LINK} exists and is not a symlink. Remove it manually first." >&2
  exit 1
fi

echo "==> Installing command-center dependencies..."
(cd "${DASHBOARD_DIR}" && npm install --no-fund --no-audit) || {
  echo "Command-center dependency install failed." >&2
  exit 1
}

echo "==> Building command-center frontend..."
(cd "${DASHBOARD_DIR}" && npm run build:web) || {
  echo "Command-center build failed." >&2
  exit 1
}

echo "==> Installing extension dependencies and building..."
(cd "${SCRIPT_DIR}" && npm install --no-fund --no-audit && npm run build) || {
  echo "Extension build failed." >&2
  exit 1
}

ln -s "${SCRIPT_DIR}" "${LINK}"
echo "Installed: ${LINK} -> ${SCRIPT_DIR}"
echo ""
echo "Reload the window to activate: Cmd+Shift+P -> Developer: Reload Window"
