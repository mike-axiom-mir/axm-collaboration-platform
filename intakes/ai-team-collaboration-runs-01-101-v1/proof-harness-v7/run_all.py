
from __future__ import annotations
import json
from axm_team_harness.runner import run_all

if __name__ == '__main__':
    print(json.dumps(run_all(), ensure_ascii=False, indent=2))
