# Holodeck Screen Deck

The first Holodeck substrate adapter renders `axm.holodeck-deck-plan/v1` through the Workshop's local Three.js copy. It does not define world meaning. Keyboard, touch, and the exposed machine API all dispatch `axm.holodeck-intent/v1` through the same kernel.

The adapter writes browser storage only when **Save snapshot** is explicitly pressed. Reload begins from compiled initial state until **Restore snapshot** is explicitly requested.

The **Run machine step** control dispatches a real `machine` actor intent through that same public path, while the movement controls dispatch `human` actor intents. Interaction prompts are derived from declared world-state availability. Because H0 has no animation, the WebGL adapter renders only when state or viewport size changes instead of running a permanent frame loop.

This `TEST` module proves a screen simulation. It does not claim VR, AR, hologram hardware, haptics, physical-space control, or autonomous authority.
