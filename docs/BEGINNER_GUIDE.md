# AXM Workshop Beginner Guide

You do not need to understand Git branches, terminals, or AI configuration to
try the core Workshop.

## Windows

1. On the repository page, select **Code > Download ZIP**.
2. Open Downloads, right-click the ZIP, and select **Extract All**.
3. Open the extracted `axm-collaboration-platform` folder.
4. Double-click `OPEN_AXM_WORKSHOP.cmd`.
5. Keep the server window open while using AXM.

The launcher prefers its private `runtime\node\node.exe`, then a compatible
Node.js already on the computer. If neither exists on Windows x64 or ARM64, it
announces a one-time download of Node.js 24.17.0 LTS from `nodejs.org`, checks
the pinned SHA-256, and copies only `node.exe` into this Workshop's private
runtime folder. It does not request administrator permission, install a system
service, change system Node.js, run `npm install`, or upload Workshop data.

The first bootstrap needs internet access. Later core Hub starts are local.

## macOS or Linux

Install a compatible Node.js release, open a terminal in the extracted folder,
and run:

```sh
chmod +x start-hub.sh
./start-hub.sh
```

## Common problems

### I see code instead of the Hub

You opened the launcher on GitHub or inside the ZIP. Download the complete ZIP,
extract it, and launch the file from the extracted folder.

### Runtime download or verification failed

Read `AXM_START_REPORT.txt` beside the launcher. Check that the computer can
reach `https://nodejs.org`, then run `OPEN_AXM_WORKSHOP.cmd` again. AXM removes
an unverified download and will not execute it.

If the automatic route is unavailable, install the current Node.js LTS from
<https://nodejs.org/en/download> and retry. The core Hub does not require
`npm install`.

### The browser did not open

Leave the server window open and visit <http://127.0.0.1:8788/hub/index.html>.
The server tries a small range of later local ports if 8788 is busy; its window
prints the exact address in use.

### The port is already in use

An earlier AXM server may still be open. Return to its browser tab or close the
old server window and launch once more. Avoid starting several full Workshop
stacks at the same time on a small laptop.

### Do I need an AI account?

No. AI connections are optional. The local Hub, tools, documentation, and
included test experiences can be explored without an AI provider account.

## Stopping safely

Close the server window when you are finished. Public source packages do not
contain your downloaded runtime, local saves, logs, or history.

## Asking for help

Use the repository's Bug report template. Say what you clicked, what you
expected, and what appeared. Screenshots are helpful after you crop private
tabs, names, tokens, and personal data.
