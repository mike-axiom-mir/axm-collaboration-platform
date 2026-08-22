// AXM Universal Object Fabric v0.7 — Three.js bridge
// Supply THREE and a GLTFLoader instance from the same Three.js release used by the game.
// This helper reads contracts; it never writes into a project or controls physical hardware.

function absoluteUrl(value, base = globalThis.location?.href || 'file:///') {
  return new URL(value, base).toString();
}

function joinUrl(base, relative) {
  return new URL(relative, base.endsWith('/') ? base : `${base}/`).toString();
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`AXM fetch failed ${response.status}: ${url}`);
  const value = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`AXM expected a JSON object: ${url}`);
  }
  return value;
}

function runtimeCapsuleReference(manifest) {
  const reference = manifest.runtime_capsule
    ?? manifest.contracts?.runtime_capsule
    ?? manifest.industry_outputs?.runtime_capsule;
  return typeof reference === 'string' && reference.length > 0 ? reference : null;
}

function axmData(source) {
  return source?.userData?.axm || source || {};
}

function lodContract(source) {
  const data = axmData(source);
  const capsule = data.runtimeCapsule
    || (data.schema_version === '0.7' && data.lods ? data : null);
  const runtime = data.runtime || (data.models ? data : {});
  const records = capsule?.lods?.records ?? runtime.models?.lods ?? [];
  const policy = capsule?.lods?.policy ?? runtime.lod_policy ?? {};
  return {
    records: Array.isArray(records) ? records : [],
    policy: policy && typeof policy === 'object' && !Array.isArray(policy) ? policy : {},
  };
}

function socketRecords(source) {
  const data = axmData(source);
  const capsule = data.runtimeCapsule
    || (data.schema_version === '0.7' && data.sockets ? data : null);
  const records = capsule?.sockets?.records ?? data.sockets ?? [];
  return Array.isArray(records) ? records : [];
}

export class AXMUniversalObjectLoader {
  constructor({ THREE, gltfLoader, packageBaseUrl }) {
    if (!THREE || !gltfLoader || !packageBaseUrl) {
      throw new Error('AXMUniversalObjectLoader requires THREE, gltfLoader and packageBaseUrl');
    }
    this.THREE = THREE;
    this.gltfLoader = gltfLoader;
    this.packageBaseUrl = absoluteUrl(packageBaseUrl);
    this.materialCache = new Map();
  }

  async load(objectManifestUrl, options = {}) {
    const manifestUrl = absoluteUrl(objectManifestUrl);
    const manifest = await readJson(manifestUrl);
    const objectRoot = new URL('./', manifestUrl).toString();
    const capsuleReference = runtimeCapsuleReference(manifest);
    const capsuleUrl = capsuleReference ? joinUrl(objectRoot, capsuleReference) : null;
    const visualReference = manifest.industry_outputs?.visual_skin;
    const visualUrl = typeof visualReference === 'string'
      ? joinUrl(objectRoot, visualReference)
      : null;
    const [assembly, materials, gameBinding, runtimeCapsule, visualSkin] = await Promise.all([
      readJson(joinUrl(objectRoot, manifest.contracts.assembly)),
      readJson(joinUrl(objectRoot, manifest.contracts.materials)),
      readJson(joinUrl(objectRoot, manifest.industry_outputs.game)),
      capsuleUrl ? readJson(capsuleUrl) : Promise.resolve(null),
      visualUrl ? readJson(visualUrl) : Promise.resolve(null),
    ]);
    const runtimeReference = runtimeCapsule?.source_binding?.runtime_manifest?.portable_path
      ?? gameBinding.runtime_manifest;
    const runtimeUrl = joinUrl(this.packageBaseUrl, runtimeReference);
    const runtime = await readJson(runtimeUrl);
    const runtimeRoot = new URL('./', runtimeUrl).toString();
    const runtimeSockets = runtimeCapsule
      ? runtimeCapsule.sockets?.records ?? []
      : await this.#loadLegacySockets(runtime, runtimeRoot);
    const selectedLOD = this.#selectLoadLOD(
      { runtimeCapsule, runtime },
      options.lod,
      options.projectedScreenHeight,
    );
    if (!selectedLOD?.file) throw new Error(`AXM runtime has no selectable LOD model: ${runtimeUrl}`);
    const glbUrl = joinUrl(runtimeRoot, selectedLOD.file);
    const gltf = await this.gltfLoader.loadAsync(glbUrl);
    const root = gltf.scene;
    root.name = root.name || manifest.asset_id;
    root.userData.axm = {
      manifest,
      assembly,
      materials,
      runtime,
      runtimeCapsule,
      visualSkin,
      visualVariant: null,
      sockets: Array.isArray(runtimeSockets) ? runtimeSockets : [],
      selectedLOD,
      gameBinding,
      joints: {},
      state: runtimeCapsule?.states?.default ?? gameBinding.state_machine?.initial ?? null,
      sourceUrls: {
        manifest: manifestUrl,
        runtimeCapsule: capsuleUrl,
        visualSkin: visualUrl,
        runtime: runtimeUrl,
        glb: glbUrl,
      },
    };
    this.#applyMaterials(root, materials);
    this.#buildAssembly(root, assembly);
    if (visualSkin) {
      this.setVisualVariant(root, visualSkin.fallback_variant ?? 'default');
    }
    return root;
  }

  async #loadLegacySockets(runtime, runtimeRoot) {
    const reference = runtime.models?.sockets;
    if (typeof reference !== 'string' || reference.length === 0) return [];
    const manifest = await readJson(joinUrl(runtimeRoot, reference));
    return Array.isArray(manifest.sockets) ? manifest.sockets : [];
  }

  #selectLoadLOD(source, requestedLOD, projectedScreenHeight) {
    const records = lodContract(source).records;
    if (Number.isInteger(requestedLOD)) {
      const exact = records.find((record) => record?.lod === requestedLOD);
      if (!exact) throw new Error(`Unknown AXM LOD: ${requestedLOD}`);
      return exact;
    }
    return this.selectLOD(source, projectedScreenHeight);
  }

  /**
   * Select one declared LOD record from projected screen height.
   *
   * This is a pure recommendation helper: it does not install camera listeners
   * or swap an already-loaded model. Invalid input safely selects the first
   * declared record.
   */
  selectLOD(source, projectedScreenHeight = Number.POSITIVE_INFINITY) {
    const { records, policy } = lodContract(source);
    if (records.length === 0) return null;
    const ordered = [...records].sort(
      (left, right) => Number(left?.lod ?? 0) - Number(right?.lod ?? 0),
    );
    const coverage = Number(projectedScreenHeight);
    if (!Number.isFinite(coverage) || coverage < 0) return ordered[0];
    const thresholds = policy.starting_screen_height_thresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0) return ordered[0];
    let selectedIndex = 0;
    while (selectedIndex < ordered.length - 1) {
      const threshold = Number(thresholds[selectedIndex]);
      if (!Number.isFinite(threshold) || coverage >= threshold) break;
      selectedIndex += 1;
    }
    return ordered[selectedIndex];
  }

  /**
   * Resolve an exact, case-sensitive socket ID without inventing a transform.
   */
  getSocket(source, socketId) {
    if (typeof socketId !== 'string' || socketId.length === 0) return null;
    return socketRecords(source).find((record) => record?.id === socketId) ?? null;
  }

  #materialFor(record) {
    const pbr = record.appearance || {};
    const rgba = pbr.base_color_rgba || [180, 180, 180, 255];
    const emissive = pbr.emissive_rgb || [0, 0, 0];
    const key = JSON.stringify([record.material_profile, pbr]);
    if (this.materialCache.has(key)) return this.materialCache.get(key);

    const automaticDepthWrite = rgba[3] >= 255 && (pbr.transmission ?? 0) <= 0;
    const depthWrite = pbr.depth_write === 'ON'
      ? true
      : pbr.depth_write === 'OFF'
        ? false
        : automaticDepthWrite;
    const parameters = {
      name: `AXM_${record.material_profile}`,
      color: new this.THREE.Color(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255),
      opacity: rgba[3] / 255,
      transparent: rgba[3] < 255 || (pbr.transmission ?? 0) > 0,
      depthWrite,
      side: pbr.double_sided ? this.THREE.DoubleSide : this.THREE.FrontSide,
      metalness: pbr.metallic ?? 0,
      roughness: pbr.roughness ?? 0.6,
      emissive: new this.THREE.Color(emissive[0] || 0, emissive[1] || 0, emissive[2] || 0),
      emissiveIntensity: pbr.emissive_intensity ?? 1,
    };
    const usePhysical = Number.isFinite(pbr.transmission) || Number.isFinite(pbr.ior);
    if (usePhysical) {
      parameters.transmission = pbr.transmission ?? 0;
      parameters.ior = pbr.ior ?? 1.5;
      parameters.thickness = pbr.thickness_m ?? 0;
    }
    const material = usePhysical
      ? new this.THREE.MeshPhysicalMaterial(parameters)
      : new this.THREE.MeshStandardMaterial(parameters);
    this.materialCache.set(key, material);
    return material;
  }

  #applyMaterials(root, materialManifest) {
    for (const record of materialManifest.nodes || []) {
      const object = root.getObjectByName(record.node);
      if (!object || !object.isMesh) continue;
      object.material = this.#materialFor(record);
      object.userData.axmMaterialProfile = record.material_profile;
      object.castShadow = true;
      object.receiveShadow = true;
    }
  }

  #buildAssembly(root, assembly) {
    const groupMap = new Map();
    for (const record of assembly.groups || []) {
      const group = new this.THREE.Group();
      group.name = `AXM_GROUP_${record.id}`;
      const pivot = record.pivot_m || [0, 0, 0];
      group.position.set(pivot[0], pivot[1], pivot[2]);
      group.userData.axmGroupId = record.id;
      root.add(group);
      groupMap.set(record.id, group);
      for (const nodeName of record.members || []) {
        const object = root.getObjectByName(nodeName);
        if (object) group.attach(object); // preserve current world transform
      }
    }

    for (const joint of assembly.joints || []) {
      const parent = groupMap.get(joint.parent_group);
      const child = groupMap.get(joint.child_group);
      if (parent && child && child.parent !== parent) parent.attach(child);
    }

    // Base transforms must be captured after all re-parenting.
    for (const group of groupMap.values()) {
      group.userData.axmBasePosition = group.position.clone();
      group.userData.axmBaseQuaternion = group.quaternion.clone();
    }

    for (const joint of assembly.joints || []) {
      const child = groupMap.get(joint.child_group);
      if (!child) continue;
      root.userData.axm.joints[joint.id] = {
        contract: joint,
        group: child,
        value: Number(joint.default ?? 0),
      };
      this.setJointValue(root, joint.id, Number(joint.default ?? 0));
    }
    root.userData.axm.groups = groupMap;
  }

  setJointValue(root, jointId, requestedValue) {
    const record = root.userData?.axm?.joints?.[jointId];
    if (!record) throw new Error(`Unknown AXM joint: ${jointId}`);
    const { contract, group } = record;
    const limits = contract.limits || {};
    let value = Number(requestedValue);
    if (!Number.isFinite(value)) throw new Error(`AXM joint value must be finite: ${jointId}`);
    if (contract.type !== 'continuous' && Number.isFinite(limits.min) && Number.isFinite(limits.max)) {
      value = Math.min(limits.max, Math.max(limits.min, value));
    }
    const axisValues = contract.axis || [0, 1, 0];
    const axis = new this.THREE.Vector3(axisValues[0], axisValues[1], axisValues[2]).normalize();
    const basePosition = group.userData.axmBasePosition;
    const baseQuaternion = group.userData.axmBaseQuaternion;
    if (contract.type === 'revolute' || contract.type === 'continuous') {
      const delta = new this.THREE.Quaternion().setFromAxisAngle(axis, this.THREE.MathUtils.degToRad(value));
      group.quaternion.copy(baseQuaternion).multiply(delta);
    } else if (contract.type === 'prismatic') {
      group.position.copy(basePosition).add(axis.multiplyScalar(value));
    }
    record.value = value;
    return value;
  }

  setObjectState(root, requestedState) {
    const machine = root.userData?.axm?.gameBinding?.state_machine || {};
    const states = machine.states || [];
    if (states.length && !states.includes(requestedState)) {
      throw new Error(`Unknown AXM object state: ${requestedState}`);
    }
    root.userData.axm.state = requestedState;
    return requestedState;
  }

  availableVisualVariants(root) {
    const variants = root.userData?.axm?.visualSkin?.variants;
    return variants && typeof variants === 'object' ? Object.keys(variants).sort() : [];
  }

  /**
   * Apply one generated portable-PBR fallback. Renderer-specific outline,
   * bloom, refraction and texture layers remain optional hints owned by the
   * receiving game.
   */
  setVisualVariant(root, variantId) {
    const skin = root.userData?.axm?.visualSkin;
    const truth = skin?.truth_boundaries;
    const protectedFields = [
      'geometry_modified',
      'physical_material_truth_modified',
      'simulation_modified',
      'manufacturing_authority',
    ];
    if (!truth || protectedFields.some((field) => truth[field] !== false)) {
      throw new Error('AXM visual skin violates protected truth boundaries');
    }
    if (skin?.state_routing?.mode !== 'EXPLICIT-ONLY') {
      throw new Error('AXM visual skin state routing must remain EXPLICIT-ONLY');
    }
    const variant = skin?.variants?.[variantId];
    if (!variant) {
      throw new Error(`Unknown AXM visual variant: ${variantId}`);
    }
    for (const record of variant.portable_fallback?.nodes || []) {
      const object = root.getObjectByName(record.node);
      if (!object || !object.isMesh) continue;
      object.material = this.#materialFor({
        material_profile: `${record.material_profile}@${variantId}`,
        appearance: record.appearance,
      });
      object.userData.axmVisualVariant = variantId;
    }
    root.userData.axm.visualVariant = variantId;
    return {
      variantId,
      rendererHints: variant.renderer_hints || {},
      layerSlots: variant.layer_slots || [],
      externalCapabilities: variant.external_capabilities || [],
    };
  }

  tick(root, deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
    for (const [jointId, record] of Object.entries(root.userData?.axm?.joints || {})) {
      const drive = record.contract.drive || {};
      if (drive.mode === 'velocity') {
        const speedDeg = Number.isFinite(drive.speed_deg_s)
          ? drive.speed_deg_s
          : this.THREE.MathUtils.radToDeg(drive.speed_rad_s || 0);
        this.setJointValue(root, jointId, record.value + speedDeg * deltaSeconds);
      } else if (drive.mode === 'spring') {
        const target = Number(record.contract.default ?? 0);
        const speed = Number(drive.return_speed ?? 0);
        const distance = target - record.value;
        const step = Math.sign(distance) * Math.min(Math.abs(distance), speed * deltaSeconds);
        this.setJointValue(root, jointId, record.value + step);
      }
    }
  }

  disposeMaterials() {
    for (const material of this.materialCache.values()) material.dispose();
    this.materialCache.clear();
  }
}
