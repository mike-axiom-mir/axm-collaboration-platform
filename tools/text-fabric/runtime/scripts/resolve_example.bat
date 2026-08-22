@echo off
cd /d %~dp0..
python -m axm_text_fabric.cli resolve examples\request_game_reward.json --pretty
pause
