import { SkinRuntime } from "../src/index.mjs";

// Replace this import with your game-owned contract loading route.
const gameContract = {
  type: "axm.game-skin-contract",
  version: "1.0",
  gameId: "replace.with.your.game.id",
  gameVersion: "0.1.0",
  adapterApi: "axm.style-adapter.v1",
  rendererProfile: "replace-with-renderer",
  slots: []
};

let currentPresentation = null;

export const gameStyleAdapter = {
  id: "replace.with.your.game.style-adapter",

  describe() {
    return gameContract;
  },

  async preview(resolvedSkin) {
    // Render only in an isolated specimen or preview scene.
    // Do not mutate the live authoritative game.
    return {
      ok: false,
      status: "NOT_IMPLEMENTED",
      reason: "Connect an isolated game-owned preview scene."
    };
  },

  async apply(resolvedSkin) {
    const previous = currentPresentation;

    // Map resolvedSkin.slots into game-owned presentation APIs here.
    // Do not accept gameplay, input, networking, permission, or simulation fields.
    currentPresentation = resolvedSkin;

    return {
      ok: true,
      rollbackToken: { previous },
      evidence: {
        slotsAccepted: Object.keys(resolvedSkin.slots).length,
        presentationAuthority: resolvedSkin.presentationAuthority
      }
    };
  },

  async rollback(token) {
    currentPresentation = token.previous;
    // Restore game-owned defaults or the recorded previous presentation here.
    return {
      ok: true,
      evidence: { restored: true }
    };
  }
};

export function createGameStyleRuntime() {
  const runtime = new SkinRuntime();
  runtime.registerAdapter(gameStyleAdapter);
  return runtime;
}
