(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ChatGPTConnectorCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ASSET_SCHEMA = 'axm.game-asset/v1';
  var MAX_PNG_BYTES = 6 * 1024 * 1024;

  function clean(value, max) {
    var output = String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    return max ? output.slice(0, max) : output;
  }
  function dimension(value) {
    var number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.max(16, Math.min(4096, number)) : 1024;
  }
  function buildPrompt(input) {
    input = input || {};
    var name = clean(input.name, 120);
    var game = clean(input.targetGame, 120);
    var brief = clean(input.brief, 1200);
    var style = clean(input.style, 120) || 'clean game art';
    var width = dimension(input.width);
    var height = dimension(input.height);
    var transparent = !!input.transparent;
    var hardEdges = !!input.hardEdges;
    if (!name || !game || !brief) throw new Error('Asset name, target game, and visual brief are required.');
    return [
      'Create one production-ready 2D game asset as a PNG.',
      'Asset: ' + name + '.',
      'Target game: ' + game + '.',
      'Visual brief: ' + brief + '.',
      'Canvas: ' + width + ' × ' + height + ' pixels.',
      'Style: ' + style + '.',
      transparent ? 'Use a truly transparent background.' : 'Use a finished background that fits the brief.',
      hardEdges ? 'Keep edges crisp and silhouettes readable at game scale.' : 'Keep the main form readable at game scale.',
      'Return one final image only: no mockup frame, watermark, labels, contact sheet, or extra variants.'
    ].join(' ');
  }
  function isPngBytes(bytes) {
    if (!bytes || bytes.length < 8 || bytes.length > MAX_PNG_BYTES) return false;
    var magic = [137, 80, 78, 71, 13, 10, 26, 10];
    for (var i = 0; i < magic.length; i += 1) if (bytes[i] !== magic[i]) return false;
    return true;
  }
  function tunnelProven(status) {
    status = status || {};
    if (status.platformMcp && status.platformMcp.connected === true && status.platformMcp.safeTunnel === true) return true;
    var platform = status.chatgpt || status.platform || {};
    var tunnel = platform.mcpTunnel || platform.mcp_tunnel || status.mcpTunnel || status.mcp_tunnel || {};
    return tunnel.connected === true && tunnel.proven === true;
  }
  function codingSeat(status) {
    status = status || {};
    var codex = status.codex || status.codingSeat || status;
    var installed = codex.installed === true || codex.cliInstalled === true || status.codexInstalled === true;
    var authenticated = codex.authenticated === true || codex.loginVerified === true || codex.authMode === 'chatgpt' || status.authMode === 'chatgpt';
    var accessible = codex.accessible === true || codex.cliAccessible === true;
    var running = codex.desktopRunning === true || codex.processDetected === true || status.desktopRunning === true;
    return {
      installed: installed,
      accessible: accessible,
      authenticated: authenticated,
      running: running,
      version: clean(codex.version || codex.cliVersion || status.cliVersion || '', 80),
      authMode: clean(codex.authMode || status.authMode || '', 40),
      label: authenticated && accessible ? 'READY' : authenticated ? 'LOGIN VERIFIED · CLI UNAVAILABLE' : installed ? 'INSTALLED · SIGN-IN UNPROVEN' : 'OFFLINE'
    };
  }
  function buildPacket(input) {
    input = input || {};
    if (!/^data:image\/png;base64,/i.test(String(input.dataUrl || ''))) throw new Error('A PNG data URL is required.');
    var name = clean(input.name, 120);
    var gameId = clean(input.targetGameId, 120);
    if (!name || !gameId) throw new Error('Asset name and target game are required.');
    return {
      schema: ASSET_SCHEMA,
      source_module: 'chatgpt-connector',
      target_game_id: gameId,
      name: name,
      kind: 'skin',
      status: 'proposal',
      data_url: input.dataUrl,
      provenance: {
        generator: 'chatgpt-chat-manual-handoff',
        original_file_name: clean(input.fileName, 180),
        request_prompt: clean(input.prompt, 2400),
        requested_dimensions: clean(input.requestedDimensions, 40),
        actual_dimensions: clean(input.actualDimensions, 40),
        handoff_created_at: new Date().toISOString(),
        platform_connection: input.tunnelProven === true ? 'proved-mcp-tunnel' : 'manual-handoff',
        automatic_accept: false
      }
    };
  }

  return { ASSET_SCHEMA: ASSET_SCHEMA, MAX_PNG_BYTES: MAX_PNG_BYTES, clean: clean, dimension: dimension, buildPrompt: buildPrompt, isPngBytes: isPngBytes, tunnelProven: tunnelProven, codingSeat: codingSeat, buildPacket: buildPacket };
}));
