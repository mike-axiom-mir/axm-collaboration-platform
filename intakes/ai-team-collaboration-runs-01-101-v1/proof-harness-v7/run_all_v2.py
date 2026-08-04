from axm_team_harness.runner_v2 import run_all_v2
import json
if __name__ == '__main__':
    print(json.dumps(run_all_v2(), ensure_ascii=False, indent=2))
