#!/usr/bin/env sh
cd "$(dirname "$0")/.." || exit 1
python3 tests/run_all.py
