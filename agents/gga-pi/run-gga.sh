#!/usr/bin/env bash
# Run GGA with the Pi bridge (bin/kilo) first on PATH. Use it instead of `gga`:
#   agents/gga-pi/run-gga.sh run [--no-cache]
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PATH="$here/bin:$PATH" exec gga "$@"
