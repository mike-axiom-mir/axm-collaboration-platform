(function (root) {
  'use strict';
  const AXM = root.AXM;

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
    const encoded = unescape(encodeURIComponent(text));
    return Uint8Array.from(encoded, (character) => character.charCodeAt(0));
  }

  // Dependency-free SHA-256 for local/file/about:blank contexts where Web Crypto is
  // unavailable. This produces the same digest as crypto.subtle and Node crypto;
  // integrity never silently degrades to a non-cryptographic checksum.
  function sha256Portable(text) {
    const bytes = utf8Bytes(text);
    const bitLength = bytes.length * 8;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);

    const constants = new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const state = new Uint32Array([
      0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
      0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    ]);
    const words = new Uint32Array(64);
    const rotateRight = (value, amount) => (value >>> amount) | (value << (32 - amount));

    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15];
        const y = words[index - 2];
        const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
        const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
      }

      let [a,b,c,d,e,f,g,h] = state;
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
      state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
      state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
      state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    }
    return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
  }

  async function sha256(text) {
    if (root.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return sha256Portable(text);
  }

  function integrityPayload(pkg) {
    const clone = AXM.Utils.clone(pkg);
    delete clone.integrity;
    return AXM.Utils.canonicalJson(clone);
  }

  AXM.PackageIO = {
    async createModulePackage(moduleId, registry, metadata = {}) {
      const entry = registry.get(moduleId);
      if (!entry) throw new Error(`Cannot package unknown module: ${moduleId}`);
      const modules = registry.dependencyClosure(moduleId).map((module) => AXM.Utils.clone(module));
      const pkg = {
        schema: 'axm.visual-module-package/1',
        packageId: metadata.packageId || `package.${moduleId}.${Date.now()}`,
        name: metadata.name || entry.name,
        version: metadata.version || entry.version,
        entryModuleId: moduleId,
        created: new Date().toISOString(),
        creator: metadata.creator || 'Mike — Axiom/Mir',
        description: metadata.description || entry.description,
        modules,
        compatibility: {
          minimumFabricVersion: '1.0.0',
          adapters: ['web'],
          declaredFutureAdapters: ['static-svg', 'generic-game-contract']
        },
        sharing: {
          consentChecked: false,
          licenseChecked: !/unset|unknown/i.test(entry.provenance?.license || ''),
          note: 'Public sharing remains blocked by policy until license and consent are reviewed.'
        }
      };
      pkg.integrity = { algorithm: 'sha256', value: await sha256(integrityPayload(pkg)) };
      return pkg;
    },

    async createRecipePackage(recipe, registry, metadata = {}) {
      const dependencyIds = new Set();
      (recipe.layers || []).forEach((layer) => {
        if (!registry.has(layer.moduleId)) return;
        registry.dependencyClosure(layer.moduleId).forEach((module) => dependencyIds.add(module.id));
      });
      const customModules = [...dependencyIds]
        .filter((id) => registry.sourceOf(id) === 'custom')
        .map((id) => AXM.Utils.clone(registry.get(id)));
      const pkg = {
        schema: 'axm.visual-recipe-package/1',
        packageId: metadata.packageId || `recipe-package.${AXM.Utils.slugify(recipe.name)}.${Date.now()}`,
        name: metadata.name || recipe.name,
        version: metadata.version || recipe.version || '1.0.0',
        created: new Date().toISOString(),
        recipe: AXM.Utils.clone(recipe),
        bundledCustomModules: customModules,
        requiredBuiltins: [...dependencyIds].filter((id) => registry.sourceOf(id) === 'builtin'),
        sharing: {
          consentChecked: false,
          note: 'Review provenance and license fields before public sharing.'
        }
      };
      pkg.integrity = { algorithm: 'sha256', value: await sha256(integrityPayload(pkg)) };
      return pkg;
    },

    async verifyIntegrity(pkg) {
      if (!pkg?.integrity?.value) return { verified: false, reason: 'No integrity value.' };
      const actual = await sha256(integrityPayload(pkg));
      return {
        verified: actual === pkg.integrity.value,
        expected: pkg.integrity.value,
        actual,
        algorithm: pkg.integrity.algorithm || 'unknown'
      };
    },

    async previewPackage(pkg, registry) {
      const report = AXM.Validator.validatePackage(pkg, registry);
      const integrity = pkg?.integrity?.value ? await this.verifyIntegrity(pkg) : { verified: false, reason: 'No integrity value.' };
      const modules = pkg?.schema === 'axm.visual-module-package/1' ? (pkg.modules || []) : (pkg.bundledCustomModules || []);
      const builtInCollisions = [];
      const customUpdates = [];
      const newCustom = [];
      for (const module of modules) {
        const existing = registry.get(module.id);
        if (!existing) newCustom.push(module.id);
        else if (registry.sourceOf(module.id) === 'builtin') {
          const identical = AXM.Utils.canonicalJson(existing) === AXM.Utils.canonicalJson(module);
          builtInCollisions.push({ moduleId: module.id, identical, blocked: !identical });
        } else customUpdates.push(module.id);
      }
      const provenanceItems = modules.map((module) => module.provenance || {});
      const unresolvedLicenses = provenanceItems.filter((item) => /unset|unknown|pending/i.test(item.license || '')).length;
      const blocked = !report.valid || Boolean(pkg?.integrity?.value && !integrity.verified) || builtInCollisions.some((item) => item.blocked);
      return {
        schema: pkg?.schema || 'unknown',
        name: pkg?.name || pkg?.packageId || 'Unnamed package',
        version: pkg?.version || 'unknown',
        valid: report.valid,
        blocked,
        report,
        integrity,
        counts: { modules: modules.length, newCustom: newCustom.length, customUpdates: customUpdates.length, builtInMatches: builtInCollisions.filter((item) => item.identical).length },
        newCustom, customUpdates, builtInCollisions, unresolvedLicenses,
        sharing: AXM.Utils.clone(pkg?.sharing || null)
      };
    },

    async importPackage(pkg, registry) {
      const report = AXM.Validator.validatePackage(pkg, registry);
      if (!report.valid) {
        const message = report.errors.map((item) => item.message).join(' ');
        throw new Error(`Package rejected: ${message}`);
      }
      const integrity = await this.verifyIntegrity(pkg);
      if (pkg.integrity?.value && !integrity.verified) {
        throw new Error('Package integrity verification failed. No modules were imported.');
      }
      const staging = registry.clone();
      const imported = [];
      if (pkg.schema === 'axm.visual-module-package/1') {
        for (const module of pkg.modules) {
          const existing = staging.get(module.id);
          if (existing && staging.sourceOf(module.id) === 'builtin') {
            if (AXM.Utils.canonicalJson(existing) !== AXM.Utils.canonicalJson(module)) {
              throw new Error(`Package attempts to replace built-in module ${module.id}. Import stopped.`);
            }
            continue;
          }
          staging.register(module, { source: 'custom', overwrite: Boolean(existing) });
          imported.push(module.id);
        }
        const stagedReport = AXM.Validator.validateCatalog(staging);
        if (!stagedReport.valid) throw new Error(`Package rejected after staged closure validation: ${stagedReport.errors.map((item) => item.message).join(' ')}`);
        registry.replaceFrom(staging);
        return { type: 'module', imported, entryModuleId: pkg.entryModuleId, integrity };
      }
      if (pkg.schema === 'axm.visual-recipe-package/1') {
        for (const module of pkg.bundledCustomModules || []) {
          const existing = staging.get(module.id);
          if (existing && staging.sourceOf(module.id) === 'builtin') {
            throw new Error(`Recipe package attempts to replace built-in module ${module.id}.`);
          }
          staging.register(module, { source: 'custom', overwrite: Boolean(existing) });
          imported.push(module.id);
        }
        const stagedReport = AXM.Validator.validateCatalog(staging);
        if (!stagedReport.valid) throw new Error(`Recipe package rejected after staged closure validation: ${stagedReport.errors.map((item) => item.message).join(' ')}`);
        const recipeReport = AXM.Validator.validateRecipe(pkg.recipe, staging);
        if (!recipeReport.valid) {
          throw new Error(`Bundled recipe is invalid after dependency import: ${recipeReport.errors.map((item) => item.message).join(' ')}`);
        }
        registry.replaceFrom(staging);
        return { type: 'recipe', imported, recipe: AXM.Utils.clone(pkg.recipe), integrity };
      }
      throw new Error('Unsupported package schema.');
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
