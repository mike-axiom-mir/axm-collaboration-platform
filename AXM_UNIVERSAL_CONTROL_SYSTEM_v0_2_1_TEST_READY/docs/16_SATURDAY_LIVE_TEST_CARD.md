# AXM Universal Controls — Saturday Live Test Card

Version under test: **v0.2.1 test-ready**  
Purpose: test the connection repair with two humans and real phones. This is not a visual-quality review.

## Start

1. Extract the ZIP completely.
2. Double-click `tools\START_SATURDAY_TEST_WINDOWS.cmd`.
3. Keep the server window open.
4. The PC host page opens automatically.
5. On the phone, use the LAN link printed in the server window.
6. Confirm the phone says `CONNECTED · P1` and the PC says the phone connected.

## Five short tests

### A. Normal control

- Move and aim for 30 seconds.
- Press the main action repeatedly.
- Expected: stable movement, no unexplained stalls, no stuck direction.

### B. Deliberate network stall

- Tap `TEST` on the phone.
- Hold a movement direction.
- Have the second person tap `SIMULATE 5s STALL` while movement is active.
- Expected:
  - the host stops movement after the watchdog window;
  - the host reports `stale-timeout` and input neutralization;
  - the phone reconnects as the same player;
  - the old held direction is not replayed after reconnect.

### C. Phone lock and return

- Move once, release, lock the phone for 5–10 seconds, then unlock it.
- Expected: temporary disconnect is allowed; the same player seat returns without manual re-pairing.

### D. Browser switch

- Switch to another phone app for 5–10 seconds and return.
- Expected: input is neutralized while hidden and resumes safely when visible.

### E. Wi-Fi interruption

- Turn Wi-Fi off for about 5 seconds, then turn it on again.
- Expected: status becomes offline/reconnecting, movement does not remain stuck, and the same seat resumes.

## Evidence to save

On the PC host page, tap **DOWNLOAD TEST LOG** after the tests. Keep the downloaded JSON even when everything works; it records reconnects, watchdog recoveries, rejection counts, RTT samples, and event timing.

## Pass conditions

- No direction remains held after a disconnect or stall.
- A genuine reconnect returns to the same player seat.
- No old movement packet is replayed after reconnect.
- The phone does not require cloud access.
- Controls remain usable after at least three disruption cycles.

## Honest failure labels

- **CONTROL FAILURE:** touch input itself does not produce the expected action.
- **TRANSPORT FAILURE:** phone UI works but the host stops receiving input.
- **RECOVERY FAILURE:** connection returns but wrong player, stuck input, or stale movement is replayed.
- **DEVICE/NETWORK LIMITATION:** phone browser, battery saver, router isolation, or Wi-Fi policy blocks the test.

Do not call the test passed from memory. Save the host log and note the phone model, browser, and network used.
