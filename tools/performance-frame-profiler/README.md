# Frame & Render Performance Profiler

Profiles the integrated five-asset AXM-native Forge scene twice on the current browser: storefront, animated person, modular building, vehicle, and foliage once in the native WebGL2 runtime and once through a real fullscreen post-process upload/pass. Thirty warm-up frames are excluded, ninety timing rows are retained per mode, and CPU stages, supported GPU timer queries, shader compilation, draws, triangles, texture traffic, stalls, percentiles, and spikes remain inspectable.

The worst timing state is deterministically replayed outside the measurement window and its PNG digest is linked to the exact worst timing row. Profiler overhead is calibrated and declared. Overdraw is honestly labelled as a pressure proxy until a pixel-exact analysis pass exists.

Run `node selftest.js` or open `index.html` through Workshop Hub.
