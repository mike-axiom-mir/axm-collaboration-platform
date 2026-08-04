#!/usr/bin/env sh
cd "$(dirname "$0")/.." || exit 1
python3 -m axm_text_fabric.cli resolve examples/request_game_reward.json --pretty
