import * as THREE from './vendor/three.module.js';

export const RENDER_PROFILES = Object.freeze({
  native: Object.freeze({
    id: 'native',
    label: 'PS2 Native',
    post: false,
    bloomScale: 0,
    bloomStrength: 0,
    threshold: 1,
    knee: 0,
    vignette: 0,
    grain: 0
  }),
  preview: Object.freeze({
    id: 'preview',
    label: 'PS3 Preview',
    post: true,
    bloomScale: 0.35,
    bloomStrength: 0.32,
    threshold: 1.0,
    knee: 0.35,
    vignette: 0.1,
    grain: 0.0015
  }),
  high: Object.freeze({
    id: 'high',
    label: 'PS3 High Preview',
    post: true,
    bloomScale: 0.6,
    bloomStrength: 0.48,
    threshold: 0.82,
    knee: 0.32,
    vignette: 0.2,
    grain: 0.004
  })
});

const FULLSCREEN_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAGMENT = /* glsl */`
  uniform sampler2D tScene;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(uThreshold, uThreshold + uKnee, luminance);
    gl_FragColor = vec4(color * weight, 1.0);
  }
`;

const BLUR_FRAGMENT = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    vec3 color = texture2D(tInput, vUv).rgb * 0.227027;
    vec2 offset1 = uDirection * 1.3846153846;
    vec2 offset2 = uDirection * 3.2307692308;
    color += texture2D(tInput, vUv + offset1).rgb * 0.3162162162;
    color += texture2D(tInput, vUv - offset1).rgb * 0.3162162162;
    color += texture2D(tInput, vUv + offset2).rgb * 0.0702702703;
    color += texture2D(tInput, vUv - offset2).rgb * 0.0702702703;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloomStrength;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 color = texture2D(tScene, vUv).rgb;
    color += texture2D(tBloom, vUv).rgb * uBloomStrength;
    vec2 centered = vUv - 0.5;
    float vignette = 1.0 - uVignette * smoothstep(0.34, 0.82, length(centered) * 1.4142);
    color *= vignette;
    float noise = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 61.0);
    color += (noise - 0.5) * uGrain;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeTarget(width, height, depthBuffer = false) {
  const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer,
    stencilBuffer: false
  });
  target.texture.generateMipmaps = false;
  return target;
}

function makePass(fragmentShader, uniforms, toneMapped = false) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, camera, material, quad };
}

export class LocalPostProcess {
  constructor(renderer, initialProfile = 'native') {
    this.renderer = renderer;
    this.profile = RENDER_PROFILES.native;
    this.time = 0;
    this.width = 0;
    this.height = 0;
    this.sceneTarget = null;
    this.bloomTargetA = null;
    this.bloomTargetB = null;

    this.brightPass = makePass(BRIGHT_FRAGMENT, {
      tScene: { value: null },
      uThreshold: { value: this.profile.threshold },
      uKnee: { value: this.profile.knee }
    });
    this.blurPass = makePass(BLUR_FRAGMENT, {
      tInput: { value: null },
      uDirection: { value: new THREE.Vector2() }
    });
    this.compositePass = makePass(COMPOSITE_FRAGMENT, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloomStrength: { value: this.profile.bloomStrength },
      uVignette: { value: this.profile.vignette },
      uGrain: { value: this.profile.grain },
      uTime: { value: 0 }
    }, true);

    this.setProfile(initialProfile);
  }

  setProfile(id) {
    const profile = RENDER_PROFILES[id];
    if (!profile) throw new Error(`Unknown render profile: ${id}`);
    this.profile = profile;
    this.brightPass.material.uniforms.uThreshold.value = profile.threshold;
    this.brightPass.material.uniforms.uKnee.value = profile.knee;
    this.compositePass.material.uniforms.uBloomStrength.value = profile.bloomStrength;
    this.compositePass.material.uniforms.uVignette.value = profile.vignette;
    this.compositePass.material.uniforms.uGrain.value = profile.grain;
    if (profile.post) this.rebuildTargets();
    return profile;
  }

  resize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.max(1, Math.floor(size.x));
    const height = Math.max(1, Math.floor(size.y));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    if (this.profile.post) this.rebuildTargets();
  }

  rebuildTargets() {
    if (!this.profile.post || !this.width || !this.height) return;
    this.disposeTargets();
    const bloomWidth = Math.max(1, Math.round(this.width * this.profile.bloomScale));
    const bloomHeight = Math.max(1, Math.round(this.height * this.profile.bloomScale));
    this.sceneTarget = makeTarget(this.width, this.height, true);
    this.bloomTargetA = makeTarget(bloomWidth, bloomHeight);
    this.bloomTargetB = makeTarget(bloomWidth, bloomHeight);
  }

  render(scene, camera, delta = 0.016) {
    this.time += delta;
    if (!this.profile.post) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    if (!this.sceneTarget) {
      this.resize();
      if (!this.sceneTarget) {
        this.renderer.setRenderTarget(null);
        this.renderer.render(scene, camera);
        return;
      }
    }

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.brightPass.material.uniforms.tScene.value = this.sceneTarget.texture;
    this.renderer.setRenderTarget(this.bloomTargetA);
    this.renderer.clear();
    this.renderer.render(this.brightPass.scene, this.brightPass.camera);

    const blurUniforms = this.blurPass.material.uniforms;
    blurUniforms.tInput.value = this.bloomTargetA.texture;
    blurUniforms.uDirection.value.set(1 / this.bloomTargetA.width, 0);
    this.renderer.setRenderTarget(this.bloomTargetB);
    this.renderer.clear();
    this.renderer.render(this.blurPass.scene, this.blurPass.camera);

    blurUniforms.tInput.value = this.bloomTargetB.texture;
    blurUniforms.uDirection.value.set(0, 1 / this.bloomTargetB.height);
    this.renderer.setRenderTarget(this.bloomTargetA);
    this.renderer.clear();
    this.renderer.render(this.blurPass.scene, this.blurPass.camera);

    const compositeUniforms = this.compositePass.material.uniforms;
    compositeUniforms.tScene.value = this.sceneTarget.texture;
    compositeUniforms.tBloom.value = this.bloomTargetA.texture;
    compositeUniforms.uTime.value = this.time;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.compositePass.scene, this.compositePass.camera);
  }

  disposeTargets() {
    this.sceneTarget?.dispose();
    this.bloomTargetA?.dispose();
    this.bloomTargetB?.dispose();
    this.sceneTarget = null;
    this.bloomTargetA = null;
    this.bloomTargetB = null;
  }

  dispose() {
    this.disposeTargets();
    for (const pass of [this.brightPass, this.blurPass, this.compositePass]) {
      pass.quad.geometry.dispose();
      pass.material.dispose();
    }
  }
}
