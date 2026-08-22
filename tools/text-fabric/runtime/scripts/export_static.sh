#!/usr/bin/env sh
set -eu
python -m axm_text_fabric.cli export-static "${1:-axm_future_core}" "${2:-./compiled/axm_static.svg}" --png --force
