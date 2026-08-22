
from __future__ import annotations
import json
from axm_team_harness.runner_v3 import run_all_v3

if __name__ == '__main__':
    print(json.dumps(run_all_v3(), ensure_ascii=False, indent=2))
