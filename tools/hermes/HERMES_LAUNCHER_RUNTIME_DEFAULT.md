# Hermes Launcher Runtime Default

Status: TEST / launcher rule.

The launcher should treat runtime as required by default.

Hermes is a runnable local agent. If the launcher does not start or check runtime, the module becomes paperwork instead of useful local body strength.

## Core rule

```text
Runtime ON by default.
Action OFF by default until consent.
```

This means:

- the launcher should check whether real Hermes is installed
- the launcher should help start the real Hermes runtime
- the launcher should check the AXM control layer
- the launcher should show status clearly
- the launcher should not let tasks act without consent

## Startup flow

```text
1. Open AXM launcher.
2. Check real Hermes runtime.
3. If missing, offer install/setup path.
4. If present but stopped, offer start.
5. Check AXM control layer.
6. Load available package profiles.
7. Show active connector and identity binding.
8. Keep actions locked until consent.
```

## Runtime is not consent

Runtime being active does not mean Hermes may act.

Runtime only means the local body is available.

Consent controls action.

## Default launcher states

```text
RUNTIME_MISSING
RUNTIME_STOPPED
RUNTIME_READY
CONTROL_LAYER_READY
CONSENT_OFF
CONSENT_ON
RUN_ACTIVE
RUN_STOPPED
```

## Safe default

On launcher open:

```text
runtime check: yes
runtime start: allowed if configured
identity sharing: off unless configured
package auto-load: allowed if selected
agent action: blocked until consent
```

## Main Hub relationship

Main Hub chooses the connector.

Hermes launcher checks the runtime.

Specialist Command Center binds identity/package to connector.

Shell Review checks what happened after runs.

## AXM rule

Keep Hermes runnable.

Make runtime easy.

Keep action consent-gated.

Do not confuse an active runtime with permission to act.
