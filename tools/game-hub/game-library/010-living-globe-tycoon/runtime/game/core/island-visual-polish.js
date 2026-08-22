(function (root) {
  'use strict';

  root.AXMIslandVisualPolishFactory = function createIslandVisualPolish(THREE, scene, renderer, options) {
    const canvas = options.canvas;
    const radius = Number(options.radius || 30);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.toneMappingExposure = 1.04;

    const skyGeometry = new THREE.IcosahedronGeometry(520, 3);
    const skyPositions = skyGeometry.getAttribute('position');
    const skyColors = new Float32Array(skyPositions.count * 3);
    skyGeometry.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.renderOrder = -1000;
    scene.add(sky);

    function skyGlyph(coreColor, haloColor, coreRadius) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(coreRadius, 12),
        new THREE.MeshBasicMaterial({ color: coreColor, side: THREE.DoubleSide, toneMapped: false }),
      );
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(coreRadius * 1.42, coreRadius * 0.08, 4, 16),
        new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false }),
      );
      group.add(core, halo);
      group.renderOrder = -900;
      scene.add(group);
      return group;
    }

    const sunGlyph = skyGlyph(0xffdf83, 0xff9e4a, 5.2);
    const moonGlyph = skyGlyph(0xbdd7ff, 0x7699d2, 3.4);
    const tmpDirection = new THREE.Vector3();
    const tmpSun = new THREE.Vector3();
    const base = new THREE.Color();
    const zenith = new THREE.Color();
    const horizon = new THREE.Color();
    const under = new THREE.Color();
    const output = new THREE.Color();
    let contour = null;

    function setPlanet(planet) {
      if (contour) {
        scene.remove(contour);
        contour.geometry.dispose();
        contour.material.dispose();
      }
      const edges = new THREE.EdgesGeometry(planet.geometry, 2);
      contour = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: 0x071f1c,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        toneMapped: false,
      }));
      contour.scale.setScalar(1.0007);
      contour.renderOrder = 2;
      scene.add(contour);
      canvas.dataset.facetContours = String(edges.getAttribute('position').count / 2);
    }

    function updateSky(up, skyColor, phase, sunPosition, camera, sunIntensity) {
      base.copy(skyColor);
      const night = phase < 0.23 || phase > 0.77;
      const dawn = (phase >= 0.23 && phase < 0.34) || (phase > 0.68 && phase <= 0.77);
      zenith.copy(base).offsetHSL(night ? 0.015 : -0.025, night ? 0.08 : 0.12, night ? -0.035 : -0.11);
      horizon.copy(base).lerp(new THREE.Color(dawn ? 0xffb36e : night ? 0x263c58 : 0xb9e7dc), dawn ? 0.5 : 0.38);
      under.copy(base).multiplyScalar(night ? 0.24 : 0.42);
      tmpSun.copy(sunPosition).normalize();
      for (let index = 0; index < skyPositions.count; index += 1) {
        tmpDirection.set(skyPositions.getX(index), skyPositions.getY(index), skyPositions.getZ(index)).normalize();
        const elevation = tmpDirection.dot(up);
        const band = Math.round(Math.max(0, Math.min(1, elevation)) * 7) / 7;
        if (elevation < -0.03) output.copy(under);
        else output.copy(horizon).lerp(zenith, Math.pow(band, 0.72));
        const sunFacing = tmpDirection.dot(tmpSun);
        if (sunIntensity > 0.02 && sunFacing > 0.965) output.lerp(new THREE.Color(0xffd58b), (sunFacing - 0.965) / 0.035 * 0.45);
        skyColors[index * 3] = output.r;
        skyColors[index * 3 + 1] = output.g;
        skyColors[index * 3 + 2] = output.b;
      }
      skyGeometry.getAttribute('color').needsUpdate = true;

      sunGlyph.visible = sunIntensity > 0.02;
      sunGlyph.position.copy(tmpSun).multiplyScalar(360);
      sunGlyph.quaternion.copy(camera.quaternion);
      const moonDirection = tmpSun.clone().negate();
      moonGlyph.visible = night;
      moonGlyph.position.copy(moonDirection).multiplyScalar(350);
      moonGlyph.quaternion.copy(camera.quaternion);
      canvas.dataset.visualPhase = night ? 'night' : dawn ? 'golden-hour' : 'day';
    }

    canvas.dataset.visualPass = 'low-poly-atmosphere-01';
    canvas.dataset.visualAuthority = 'presentation-only';
    canvas.dataset.skyFacets = String(skyPositions.count);

    return Object.freeze({
      setPlanet,
      updateSky,
      diagnostics: function diagnostics() {
        return Object.freeze({
          visualPass: canvas.dataset.visualPass,
          authority: canvas.dataset.visualAuthority,
          skyFacets: Number(canvas.dataset.skyFacets),
          facetContours: Number(canvas.dataset.facetContours || 0),
          phase: canvas.dataset.visualPhase || 'unknown',
          radius,
        });
      },
    });
  };
})(window);
