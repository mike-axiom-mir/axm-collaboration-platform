// AXM Universal Object Fabric v0.5 — Three.js world-kit bridge
// Loads either the combined proof GLB or an instance-based scene that reuses each source GLB.

function absoluteUrl(value, base = globalThis.location?.href || 'file:///') {
  return new URL(value, base).toString();
}

function joinUrl(base, relative) {
  return new URL(relative, base.endsWith('/') ? base : `${base}/`).toString();
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`AXM fetch failed ${response.status}: ${url}`);
  return response.json();
}

export class AXMWorldKitLoader {
  constructor({ THREE, gltfLoader, packageBaseUrl }) {
    if (!THREE || !gltfLoader || !packageBaseUrl) {
      throw new Error('AXMWorldKitLoader requires THREE, gltfLoader and packageBaseUrl');
    }
    this.THREE = THREE;
    this.gltfLoader = gltfLoader;
    this.packageBaseUrl = absoluteUrl(packageBaseUrl);
    this.templatePromises = new Map();
  }

  async loadCombined(worldManifestUrl) {
    const manifestUrl = absoluteUrl(worldManifestUrl);
    const manifest = await readJson(manifestUrl);
    const rootUrl = new URL('./', manifestUrl).toString();
    const gltf = await this.gltfLoader.loadAsync(joinUrl(rootUrl, manifest.game_glb));
    gltf.scene.userData.axmWorld = { manifest, mode: 'combined', sourceUrl: manifestUrl };
    return gltf.scene;
  }

  async #sourceTemplate(runtimeManifestPath) {
    const runtimeUrl = joinUrl(this.packageBaseUrl, runtimeManifestPath);
    if (!this.templatePromises.has(runtimeUrl)) {
      this.templatePromises.set(runtimeUrl, (async () => {
        const runtime = await readJson(runtimeUrl);
        const runtimeRoot = new URL('./', runtimeUrl).toString();
        const lod0 = runtime.models?.lods?.[0];
        if (!lod0?.file) throw new Error(`AXM runtime has no LOD0: ${runtimeUrl}`);
        const gltf = await this.gltfLoader.loadAsync(joinUrl(runtimeRoot, lod0.file));
        return { runtime, scene: gltf.scene };
      })());
    }
    return this.templatePromises.get(runtimeUrl);
  }

  async loadInstanced(worldManifestUrl) {
    const manifestUrl = absoluteUrl(worldManifestUrl);
    const manifest = await readJson(manifestUrl);
    const root = new this.THREE.Group();
    root.name = manifest.world_id;
    root.userData.axmWorld = { manifest, mode: 'source-clone', sourceUrl: manifestUrl, instances: {} };

    const uniqueRuntimePaths = [...new Set((manifest.instances || []).map(item => item.source_runtime_manifest))];
    await Promise.all(uniqueRuntimePaths.map(path => this.#sourceTemplate(path)));

    for (const instance of manifest.instances || []) {
      const template = await this.#sourceTemplate(instance.source_runtime_manifest);
      const object = template.scene.clone(true);
      object.name = instance.id;
      const position = instance.position_m || [0, 0, 0];
      object.position.set(position[0], position[1], position[2]);
      object.rotation.y = this.THREE.MathUtils.degToRad(instance.rotation_y_deg || 0);
      object.userData.axmInstance = {
        id: instance.id,
        asset_id: instance.asset_id,
        asset_version: instance.asset_version,
        role: instance.role,
        state: instance.state || {},
        universal_object_manifest: instance.universal_object_manifest,
      };
      root.add(object);
      root.userData.axmWorld.instances[instance.id] = object;
    }
    return root;
  }

  clearCache() {
    this.templatePromises.clear();
  }
}
