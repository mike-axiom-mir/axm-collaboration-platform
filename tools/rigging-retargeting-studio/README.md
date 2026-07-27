# Rigging & Retargeting Studio

An AXM-native, offline humanoid retargeting foundation. It maps the current 31-joint pedestrian skeleton to explicit canonical roles, describes IK targets, hinge constraints, and gameplay sockets, and retargets all 22 source clips onto visibly tall/narrow and compact/broad rest poses.

Foot-contact slide is sampled at 30 Hz, copied joint rotations carry a measured angular error, and skin weights are independently recounted. Metrics never approve extreme-pose deformation; that gate remains human.

Run `node selftest.js` or open `index.html` through Workshop Hub.
