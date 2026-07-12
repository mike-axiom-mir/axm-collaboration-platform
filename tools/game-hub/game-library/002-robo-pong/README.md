# Robo Pong 002

Clean AXM Game Hub rebuild. The game is deliberately self-contained: one Node.js authoritative runtime and one HTML5 Canvas client, with no internet or package install required.

Modes:

- Mike vs Nova (`human-vs-ai`)
- Mike vs Errol on the same Wi-Fi (`human-vs-human`)
- Codex vs Nova exhibition (`ai-vs-ai`)

Each human controller supports touch, Arrow/A-D keys, and a random activatable special. The current special appears on the colored controller button and activates by tapping it or pressing Space. After use, a different random special arrives after a short cooldown:

- Mega Shield temporarily widens your paddle.
- Paddle Warp snaps your paddle underneath the ball.
- Slow Field slows the arena ball for a brief reaction window.
- Paddle Jam temporarily slows the opponent.

AI-controlled seats draw from and activate the same inventory. First player to 7 wins. The Game Hub owns seat selection and starts the runtime on port 8792 only while a match is active.

For LAN play, open Game Hub, choose **Mike + Errol**, and scan the generated QR code from the second device. Windows may request permission for Node.js on private networks.
