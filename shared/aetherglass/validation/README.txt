AXM Aetherglass v7.1 validation evidence

Browser validation was not executed in this build environment.

Python Playwright and an installed Chromium executable were unavailable. The cloud browser could not reach the local package, so it was not used as a substitute. No prior screenshot or JSON result is presented as v7.1 evidence.

Run from the extracted package in an environment with Playwright and Chromium:

  python tools/browser_validate.py

Optional:

  AXM_CHROMIUM=/path/to/chromium python tools/browser_validate.py
  AXM_VALIDATION_OUT=/path/to/output python tools/browser_validate.py

The runner gates page errors, console warnings/errors, runtime requests, overflow, teardown errors, restoration, journey/capture cleanup, and strict stress completion.
