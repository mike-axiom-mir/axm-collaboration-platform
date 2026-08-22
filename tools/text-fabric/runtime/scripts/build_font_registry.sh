#!/usr/bin/env sh
set -eu
python -m axm_text_fabric.cli build-font-registry "$@"
