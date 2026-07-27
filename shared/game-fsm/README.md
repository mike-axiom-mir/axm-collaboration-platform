# Portable Game FSM

This is the small event/state layer between canonical world truth and timed animation playback. It does not replace the Holodeck state machine or the game animation spine.

Definitions use the `axm.game-fsm/v1` JSON contract. Guards, actions, enter and exit hooks are **names**, resolved from host registries; executable functions are rejected inside definitions. That repairs the source export's otherwise contradictory claim that function-bearing definitions were plain JSON.

Traces are bounded to 200 events by default and digest-bound. The runtime performs no file, network, world-state, rendering, or canon writes.

Status: **TEST**. A deterministic host must supply deterministic handlers if replay equivalence is required.
