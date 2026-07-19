# Cognitive Calibration & Benchmark Lab

Status: `TEST`

Technical child of Cognitive Resource Meter. It binds a declared prediction interval to one exact, digest-verified Meter observation and archives the literal inside/outside comparison.

It never changes the observed value, compares unlike dimensions, ranks models, or claims calibrated accuracy from insufficient evidence. Capture requires `cognitive.calibration.write` and an explicit action header.

Open it from **Hub -> Build -> Cognitive Resource Meter -> Calibration & Benchmark Lab**.

Verification: `node tools/cognitive-calibration-lab/selftest.js`
