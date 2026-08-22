#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
exec node --test tests/*.test.js tests/*.test.cjs
