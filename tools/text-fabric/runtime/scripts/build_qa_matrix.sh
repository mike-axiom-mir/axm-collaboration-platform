#!/usr/bin/env sh
set -eu
python -m axm_text_fabric.cli qa-matrix "${1:-./compiled/visual_qa}" --ids axm_future_core golden_victory chrome_system protected_subtitle --force
