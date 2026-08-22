# Third-party software

The optional presentation-only 3D depth layer imports the Workshop's retained
source snapshot of **Three.js r160**, Copyright © 2010–2024 Three.js authors,
under the MIT License. The retained module and full license are at
`shared/vendor/three-r160/three.module.js` and
`shared/vendor/three-r160/LICENSE`.

BuddyFarm serves that exact local module through `/vendor/three.module.js`.
Nothing is fetched from the network at runtime, and Three.js is not part of the
server-owned farm authority.
