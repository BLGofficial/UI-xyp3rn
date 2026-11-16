import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { JarvisVoiceState } from './types';

export type VoiceOrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type AudioLevels = {
  low?: number;
  mid?: number;
  high?: number;
  punch?: number;
};

export type OrbStateConfigEntry = {
  speed: number;
  foldDepth: number;
  freq: number;
  spinY: number;
  spinX: number;
  spinZ: number;
  bloom: number;
  listenW: number;
  thinkW: number;
  speakW: number;
};

// Distinct Voice Assistant State Configurations:
// IDLE has speed: 0.0 and zero pulse so it ONLY spins smoothly without pulsating.
// LISTENING has base speed: 0.0 when silent, and dynamically accelerates with live voice!
export const ORB_STATE_CONFIG: Readonly<Record<VoiceOrbState, OrbStateConfigEntry>> = {
  idle: {
    speed: 0.0,
    foldDepth: 0.18,
    freq: 0.9,
    spinY: 0.22,
    spinX: 0.0,
    spinZ: 0.0,
    bloom: 0.58,
    listenW: 0.0,
    thinkW: 0.0,
    speakW: 0.0,
  },
  listening: {
    speed: 0.0,
    foldDepth: 0.18,
    freq: 0.95,
    spinY: 0.22,
    spinX: 0.0,
    spinZ: 0.0,
    bloom: 0.62,
    listenW: 1.0,
    thinkW: 0.0,
    speakW: 0.0,
  },
  thinking: {
    speed: 1.35,
    foldDepth: 0.28,
    freq: 2.1,
    spinY: 1.15,
    spinX: 0.65,
    spinZ: 0.45,
    bloom: 0.92,
    listenW: 0.0,
    thinkW: 1.0,
    speakW: 0.0,
  },
  speaking: {
    speed: 0.75,
    foldDepth: 0.3,
    freq: 1.4,
    spinY: 0.36,
    spinX: 0.14,
    spinZ: 0.18,
    bloom: 0.88,
    listenW: 0.0,
    thinkW: 0.0,
    speakW: 1.0,
  },
};

export function mapJarvisStateToOrbState(state: JarvisVoiceState): VoiceOrbState {
  if (state === 'processing') return 'thinking';
  return state;
}

const VERTEX_SHADER = `
  uniform float uMorphTime;
  uniform float uRealTime;
  uniform float uVoiceTime;
  uniform vec3 uPointer;
  uniform float uPointerActive;
  uniform float uPixelRatio;
  uniform float uRadius;
  uniform float uFoldDepth;
  uniform float uFreq;
  uniform float uAudioLow;
  uniform float uAudioMid;
  uniform float uAudioHigh;
  uniform float uVoicePunch;
  uniform float uListenWeight;
  uniform float uThinkWeight;
  uniform float uSpeakWeight;

  varying float vAlpha;
  varying float vRidge;
  varying vec3 vUnitPos;
  varying float vEnergy;
  varying float vSynapse;
  varying float vAcousticRing;
  varying float vVocalWave;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vec3 norm = normalize(normal);

    // Live voice energy envelope in Listening state (0.0 when silent)
    float voiceLevel = clamp(uAudioLow * 0.45 + uAudioMid * 0.75 + uAudioHigh * 0.45 + uVoicePunch * 0.8, 0.0, 2.2);

    // Frequency scales up dynamically when speaking into the mic
    float dynamicFreq = uFreq + (voiceLevel * 0.65 * uListenWeight);
    float n1 = snoise(norm * dynamicFreq + vec3(uMorphTime, -uMorphTime * 0.7, uMorphTime * 0.5));
    float n2 = snoise(norm * (dynamicFreq * 1.9) - vec3(uMorphTime * 0.6, uMorphTime * 0.9, -uMorphTime * 0.4));

    vec3 tangent = normalize(cross(norm, vec3(0.0, 1.0, 0.15)));
    vec3 bitangent = cross(norm, tangent);

    // Tangential flow stays at 1.0 when silent in Listening, and surges with your voice
    float activeFlow = 1.0 + (voiceLevel * 0.95 * uListenWeight) + uThinkWeight * 0.75 + uSpeakWeight * 0.55;
    vec3 surfaceFlow = norm + tangent * (n2 * 0.18 * activeFlow) + bitangent * (n1 * 0.15 * activeFlow);

    // LISTENING VOICE SWIRL: Tangential vortex & harmonic turbulence driven strictly by live voice
    if (uListenWeight > 0.001 && voiceLevel > 0.001) {
      float voiceAngle = atan(norm.z, norm.x);
      float voiceSwirl = sin(voiceAngle * 3.0 + norm.y * 8.0 - uVoiceTime * 9.0) * uAudioMid;
      float voiceFlutter = cos(voiceAngle * 5.0 - norm.y * 10.0 + uVoiceTime * 12.0) * uAudioHigh;
      surfaceFlow += tangent * (voiceSwirl * 0.28 + uVoicePunch * 0.18) * uListenWeight;
      surfaceFlow += bitangent * (voiceFlutter * 0.22) * uListenWeight;
    }

    // THINKING STATE: Helical vortex twist along the sphere's meridians
    if (uThinkWeight > 0.001) {
      float angle = atan(norm.z, norm.x);
      float spiralWave = sin(angle * 4.0 + norm.y * 9.0 - uRealTime * 7.5);
      surfaceFlow += tangent * spiralWave * 0.22 * uThinkWeight;
    }

    // Interactive cursor/touch ripple
    float interactStrength = (0.08 + voiceLevel * 0.14 * uListenWeight + uSpeakWeight * 0.12) * uPointerActive;
    float distToPointer = distance(norm * uRadius, uPointer);
    float hoverPush = smoothstep(1.05, 0.0, distToPointer);
    surfaceFlow += normalize(norm * uRadius - uPointer + 0.001) * hoverPush * interactStrength;

    vec3 sphereDir = normalize(surfaceFlow);

    // Base inward silk contour deepens dynamically when your voice hits the mic
    float dynamicFoldDepth = uFoldDepth + (voiceLevel * 0.14 * uListenWeight);
    float inwardFold = smoothstep(-0.15, 0.85, n1 * 0.6 + n2 * 0.4) * dynamicFoldDepth;

    // --- 1. LISTENING ANIMATION: Strictly Voice-Driven 3D Acoustic Waves (0.0 when silent!) ---
    float polarAngle = acos(clamp(sphereDir.z, -1.0, 1.0));
    float azimuth = atan(sphereDir.y, sphereDir.x);
    float ringWave = sin(polarAngle * 14.0 - uVoiceTime * 11.0);
    float harmonicCage = sin(sphereDir.y * 12.0 - uVoiceTime * 9.0) * cos(azimuth * 4.0 + uVoiceTime * 7.0);
    float highShimmer = snoise(sphereDir * 6.5 + vec3(uVoiceTime * 5.0)) * uAudioHigh * 0.20;

    float listenRings = ringWave * (uAudioMid * 0.24 + uAudioLow * 0.18);
    float voiceFormant = harmonicCage * (uAudioMid * 0.22 + uVoicePunch * 0.25);
    float bassBreath = (uAudioLow * 0.34 + uVoicePunch * 0.28) * (0.6 + 0.4 * cos(polarAngle * 3.0));

    float listenDisp = (listenRings + voiceFormant + bassBreath + highShimmer) * uListenWeight;
    vAcousticRing = clamp((smoothstep(0.1, 0.95, ringWave) * 0.65 + abs(harmonicCage) * 0.65) * voiceLevel * uListenWeight, 0.0, 1.4);

    // --- 2. THINKING ANIMATION: Synaptic Neural Pulses & Helical Compression Waves ---
    float synapseNoise = snoise(sphereDir * 4.5 + vec3(uRealTime * 3.2, -uRealTime * 4.0, uRealTime * 2.8));
    float neuralBand = sin(sphereDir.y * 16.0 - uRealTime * 12.0) * cos(sphereDir.x * 12.0 + uRealTime * 8.0);
    float thinkDisp = (synapseNoise * 0.14 + neuralBand * 0.06 - 0.06) * uThinkWeight;
    vSynapse = smoothstep(0.15, 0.85, synapseNoise * 0.6 + neuralBand * 0.4) * uThinkWeight;

    // --- 3. SPEAKING ANIMATION: Expressive Vocal Formant Articulation & Radial Projection ---
    float formant1 = sin(sphereDir.y * 11.0 - uRealTime * 10.0) * cos(sphereDir.x * 8.0);
    float formant2 = cos(sphereDir.z * 9.0 + uRealTime * 12.0);
    float speakDisp = ((formant1 * 0.18 + formant2 * 0.10) * uAudioMid + uAudioLow * 0.28) * uSpeakWeight;
    vVocalWave = clamp(abs(formant1) * uAudioMid * 1.4 * uSpeakWeight, 0.0, 1.2);

    // Final Radius (In IDLE, listenDisp = thinkDisp = speakDisp = 0, so radius never pulsates!)
    float finalRadius = uRadius - inwardFold + listenDisp + thinkDisp + speakDisp;
    vec3 pos = sphereDir * finalRadius;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vec3 viewDir = normalize(-mvPosition.xyz);
    vec3 viewNormal = normalize(normalMatrix * sphereDir);
    float fresnel = 1.0 - abs(dot(viewNormal, viewDir));
    float rimGlow = pow(fresnel, 1.75);

    float shellMask = snoise(sphereDir * 1.15 + vec3(uMorphTime * 0.35, uMorphTime * 0.25, -uMorphTime * 0.4));
    float innerWindow = smoothstep(-0.28, 0.22, shellMask + abs(sphereDir.x) * 0.35);
    float visibility = max(innerWindow, rimGlow * 0.92);

    float depthFade = smoothstep(-uRadius * 1.2, uRadius, pos.z);
    float dynamicActivity = (uAudioLow * 0.6 + uAudioMid * 1.1 + uAudioHigh * 0.7 + uVoicePunch * 0.9) * (uListenWeight + uSpeakWeight) + vSynapse * 0.9;

    vRidge = clamp(rimGlow * 1.1 + abs(n2) * 0.65 + dynamicActivity * 0.55, 0.0, 1.75);
    vAlpha = visibility * (0.22 + vRidge * 0.74) * (0.55 + 0.45 * depthFade);
    vUnitPos = sphereDir;
    vEnergy = dynamicActivity;

    float dynamicSizeBoost = (uAudioHigh * 2.6 + uVoicePunch * 1.8) * (uListenWeight + uSpeakWeight) + vSynapse * 2.2;
    gl_PointSize = (2.1 + vRidge * 1.65 + dynamicSizeBoost) * uPixelRatio * (1.0 / -mvPosition.z);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uListenWeight;
  uniform float uThinkWeight;
  uniform float uSpeakWeight;

  varying float vAlpha;
  varying float vRidge;
  varying vec3 vUnitPos;
  varying float vEnergy;
  varying float vSynapse;
  varying float vAcousticRing;
  varying float vVocalWave;

  void main() {
    if (vAlpha < 0.025) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.08, d);

    // Base Idle Palette: Warm Gold, Coral Rose, Champagne
    vec3 warmGold = vec3(1.0, 0.72, 0.24);
    vec3 coralRose = vec3(0.98, 0.44, 0.56);
    vec3 champagne = vec3(0.95, 0.91, 0.83);

    float sideMix = smoothstep(-0.9, 0.9, vUnitPos.x);
    vec3 baseCol = mix(warmGold, champagne, sideMix);
    float pinkFold = smoothstep(0.35, -0.75, vUnitPos.x) * smoothstep(0.55, -0.55, vUnitPos.y);
    baseCol = mix(baseCol, coralRose, pinkFold * 0.72);

    // 1. Listening Palette: Bioluminescent Cyan, Emerald Mint & Electric Aqua on live voice rings
    vec3 listenCyan = vec3(0.12, 0.92, 0.82);
    vec3 listenAqua = vec3(0.35, 0.75, 1.0);
    vec3 listenMint = vec3(0.75, 1.0, 0.95);
    vec3 listenCol = mix(baseCol, mix(listenCyan, listenAqua, sideMix), 0.55 + min(0.45, vEnergy * 0.4));
    listenCol = mix(listenCol, listenMint, clamp(vAcousticRing * 0.85, 0.0, 1.0));
    listenCol += vec3(0.25, 0.85, 0.95) * vAcousticRing * 0.55;

    // 2. Thinking Palette: Deep Violet, Electric Magenta & White-Hot Synaptic Sparks
    vec3 thinkViolet = vec3(0.58, 0.32, 1.0);
    vec3 thinkMagenta = vec3(1.0, 0.28, 0.76);
    vec3 thinkCol = mix(thinkViolet, thinkMagenta, smoothstep(-0.8, 0.8, vUnitPos.y));
    thinkCol = mix(baseCol, thinkCol, 0.78);
    thinkCol += vec3(0.88, 0.94, 1.0) * pow(vSynapse, 1.5) * 0.95;

    // 3. Speaking Palette: Radiant Solar Gold, Fiery Coral & Incandescent White Core
    vec3 speakGold = vec3(1.0, 0.80, 0.28);
    vec3 speakCoral = vec3(1.0, 0.38, 0.30);
    vec3 speakCol = mix(speakGold, speakCoral, smoothstep(-0.7, 0.7, vUnitPos.y));
    speakCol += vec3(1.0, 0.95, 0.86) * vVocalWave * 0.75;

    // Blend state colors seamlessly
    vec3 col = baseCol;
    col = mix(col, listenCol, uListenWeight);
    col = mix(col, thinkCol, uThinkWeight);
    col = mix(col, speakCol, uSpeakWeight);

    // Ridge & energy highlights
    col += vec3(0.35, 0.28, 0.18) * pow(vRidge, 2.0) + vec3(0.18, 0.28, 0.42) * vEnergy * 0.32;

    gl_FragColor = vec4(col, soft * vAlpha * 0.90);
  }
`;

declare global {
  interface Window {
    VoiceOrb?: VoiceAssistantOrb;
  }
}

export class VoiceAssistantOrb {
  container: HTMLElement;
  currentState: VoiceOrbState = 'idle';
  liveParams: OrbStateConfigEntry & {
    audioLow: number;
    audioMid: number;
    audioHigh: number;
    voicePunch: number;
  };

  audioCtx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  freqData: Uint8Array<ArrayBuffer> | null = null;
  micStream: MediaStream | null = null;
  isMicInitialized = false;
  externalAudioLevels: AudioLevels | null = null;
  onMicStatusChange?: (status: 'idle' | 'active' | 'denied') => void;

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;

  mouse = new THREE.Vector2(0, 0);
  targetMouse = new THREE.Vector2(0, 0);
  pointerWorld = new THREE.Vector3(0, 0, 10);
  pointerActive = 0.0;
  raycaster = new THREE.Raycaster();
  plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  readonly BASE_RADIUS = 1.15;
  sphereGeo: THREE.SphereGeometry;
  private uniforms: {
    uMorphTime: THREE.IUniform<number>;
    uRealTime: THREE.IUniform<number>;
    uVoiceTime: THREE.IUniform<number>;
    uPointer: THREE.IUniform<THREE.Vector3>;
    uPointerActive: THREE.IUniform<number>;
    uPixelRatio: THREE.IUniform<number>;
    uRadius: THREE.IUniform<number>;
    uFoldDepth: THREE.IUniform<number>;
    uFreq: THREE.IUniform<number>;
    uAudioLow: THREE.IUniform<number>;
    uAudioMid: THREE.IUniform<number>;
    uAudioHigh: THREE.IUniform<number>;
    uVoicePunch: THREE.IUniform<number>;
    uListenWeight: THREE.IUniform<number>;
    uThinkWeight: THREE.IUniform<number>;
    uSpeakWeight: THREE.IUniform<number>;
  };
  orbMat: THREE.ShaderMaterial;
  orb: THREE.Points;

  clock = new THREE.Clock();
  morphTime = 0;
  voiceTime = 0;
  prevVoiceRaw = 0;
  isRunning = true;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private _onPointerMove!: (e: PointerEvent) => void;
  private _onPointerLeave!: () => void;
  private _onResize!: () => void;

  constructor(container: HTMLElement, onMicStatusChange?: (status: 'idle' | 'active' | 'denied') => void) {
    this.container = container;
    this.onMicStatusChange = onMicStatusChange;
    this.liveParams = {
      ...ORB_STATE_CONFIG.idle,
      audioLow: 0,
      audioMid: 0,
      audioHigh: 0,
      voicePunch: 0,
    };

    this.scene = new THREE.Scene();
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 360;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 0.0, 6.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.04;
    this.controls.enablePan = false;
    this.controls.minDistance = 3.8;
    this.controls.maxDistance = 9.0;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.58, 0.45, 0.18);
    this.composer.addPass(this.bloomPass);

    this.sphereGeo = new THREE.SphereGeometry(this.BASE_RADIUS, 220, 165);
    this.uniforms = {
      uMorphTime: { value: 0 },
      uRealTime: { value: 0 },
      uVoiceTime: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 10) },
      uPointerActive: { value: 0.0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uRadius: { value: this.BASE_RADIUS },
      uFoldDepth: { value: 0.18 },
      uFreq: { value: 0.9 },
      uAudioLow: { value: 0.0 },
      uAudioMid: { value: 0.0 },
      uAudioHigh: { value: 0.0 },
      uVoicePunch: { value: 0.0 },
      uListenWeight: { value: 0.0 },
      uThinkWeight: { value: 0.0 },
      uSpeakWeight: { value: 0.0 },
    };
    this.orbMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    this.orb = new THREE.Points(this.sphereGeo, this.orbMat);
    this.scene.add(this.orb);

    this._bindEvents();
    this._animate = this._animate.bind(this);
    this.rafId = requestAnimationFrame(this._animate);
    window.VoiceOrb = this;
  }

  /**
   * Switch the Voice Assistant Orb state: 'idle' | 'listening' | 'thinking' | 'speaking'
   */
  setState(nextState: VoiceOrbState): void {
    if (!ORB_STATE_CONFIG[nextState]) return;
    this.currentState = nextState;
    if (nextState === 'listening') {
      void this.initMicrophone();
    }
  }

  /**
   * Request microphone access and connect live voice reactivity.
   */
  async initMicrophone(): Promise<boolean> {
    if (this.isMicInitialized) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => undefined);
      }
      this.onMicStatusChange?.('active');
      return true;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.onMicStatusChange?.('denied');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      this.micStream = stream;
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctx();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.62;
      source.connect(this.analyser);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.isMicInitialized = true;
      this.onMicStatusChange?.('active');
      return true;
    } catch {
      this.onMicStatusChange?.('denied');
      return false;
    }
  }

  /**
   * Connect any custom Web Audio API AudioNode or HTMLMediaElement (e.g., TTS or X3LIUS audio output).
   */
  connectAudioNode(audioNodeOrElement: AudioNode | HTMLMediaElement): void {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.audioCtx) {
      this.audioCtx = new Ctx();
    }
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.62;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (typeof HTMLMediaElement !== 'undefined' && audioNodeOrElement instanceof HTMLMediaElement) {
      const source = this.audioCtx.createMediaElementSource(audioNodeOrElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    } else if ('connect' in audioNodeOrElement && typeof audioNodeOrElement.connect === 'function') {
      audioNodeOrElement.connect(this.analyser);
    }
    this.isMicInitialized = true;
  }

  /**
   * Optional manual override to feed custom audio levels ({ low, mid, high, punch }) from an external pipeline.
   */
  setAudioLevels(levels: AudioLevels | null): void {
    this.externalAudioLevels = levels;
  }

  private _bindEvents(): void {
    this._onPointerMove = (e: PointerEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.targetMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.targetMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointerActive = 1.0;
    };
    this._onPointerLeave = () => {
      this.pointerActive = 0.0;
    };
    this._onResize = () => {
      const width = this.container.clientWidth || 360;
      const height = this.container.clientHeight || 360;
      if (!width || !height) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
      this.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
    };

    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerleave', this._onPointerLeave);
    window.addEventListener('resize', this._onResize);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this._onResize());
      this.resizeObserver.observe(this.container);
    }
  }

  private _animate(): void {
    if (!this.isRunning) return;
    this.rafId = requestAnimationFrame(this._animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();
    const target = ORB_STATE_CONFIG[this.currentState];

    let low = 0;
    let mid = 0;
    let high = 0;
    let punch = 0;

    if (this.externalAudioLevels) {
      low = this.externalAudioLevels.low ?? 0;
      mid = this.externalAudioLevels.mid ?? 0;
      high = this.externalAudioLevels.high ?? 0;
      punch = this.externalAudioLevels.punch ?? 0;
    } else if (this.currentState === 'idle') {
      low = 0;
      mid = 0;
      high = 0;
      punch = 0;
    } else if (this.currentState === 'listening') {
      if (this.analyser && this.freqData) {
        this.analyser.getByteFrequencyData(this.freqData);
        let rawLow = 0;
        let rawMid = 0;
        let rawHigh = 0;
        for (let i = 1; i <= 8; i++) rawLow += this.freqData[i] ?? 0;
        for (let i = 9; i <= 42; i++) rawMid += this.freqData[i] ?? 0;
        for (let i = 43; i <= 110; i++) rawHigh += this.freqData[i] ?? 0;

        rawLow = rawLow / (8 * 255);
        rawMid = rawMid / (34 * 255);
        rawHigh = rawHigh / (68 * 255);

        const gate = 0.035;
        low = Math.max(0, rawLow - gate) * 2.8;
        mid = Math.max(0, rawMid - gate) * 3.4;
        high = Math.max(0, rawHigh - gate * 0.8) * 3.6;

        const currentVoiceRaw = low * 0.4 + mid * 0.45 + high * 0.15;
        const delta = Math.max(0, currentVoiceRaw - this.prevVoiceRaw);
        this.prevVoiceRaw = currentVoiceRaw;
        punch = Math.min(1.5, delta * 6.5);
      }
    } else if (this.currentState === 'speaking') {
      if (this.analyser && this.freqData) {
        this.analyser.getByteFrequencyData(this.freqData);
        let rawLow = 0;
        let rawMid = 0;
        let rawHigh = 0;
        for (let i = 1; i <= 8; i++) rawLow += this.freqData[i] ?? 0;
        for (let i = 9; i <= 42; i++) rawMid += this.freqData[i] ?? 0;
        for (let i = 43; i <= 110; i++) rawHigh += this.freqData[i] ?? 0;
        const sum = rawLow + rawMid + rawHigh;
        if (sum > 10) {
          low = (rawLow / (8 * 255)) * 2.4;
          mid = (rawMid / (34 * 255)) * 2.8;
          high = (rawHigh / (68 * 255)) * 2.8;
        } else {
          const phraseEnv = 0.55 + 0.45 * Math.sin(elapsed * 1.7);
          const syllable = Math.pow(Math.max(0, Math.sin(elapsed * 8.2) * Math.cos(elapsed * 3.4) + 0.35), 1.4);
          const consonant = Math.abs(Math.sin(elapsed * 23.0)) * 0.45;
          low = syllable * phraseEnv * 0.85;
          mid = syllable * phraseEnv * (0.95 + 0.3 * Math.sin(elapsed * 15.0));
          high = (syllable * 0.5 + consonant) * phraseEnv * 0.8;
        }
      } else {
        const phraseEnv = 0.55 + 0.45 * Math.sin(elapsed * 1.7);
        const syllable = Math.pow(Math.max(0, Math.sin(elapsed * 8.2) * Math.cos(elapsed * 3.4) + 0.35), 1.4);
        const consonant = Math.abs(Math.sin(elapsed * 23.0)) * 0.45;
        low = syllable * phraseEnv * 0.85;
        mid = syllable * phraseEnv * (0.95 + 0.3 * Math.sin(elapsed * 15.0));
        high = (syllable * 0.5 + consonant) * phraseEnv * 0.8;
      }
    } else if (this.currentState === 'thinking') {
      low = 0.25 + 0.2 * Math.sin(elapsed * 7.0);
      mid = 0.45 + 0.3 * Math.cos(elapsed * 11.0);
      high = 0.65 + 0.35 * Math.sin(elapsed * 17.0);
    }

    const isSpeakingNow = low + mid + high > 0.01;
    const lerpRate =
      this.currentState === 'listening'
        ? isSpeakingNow
          ? 0.35
          : 0.16
        : this.currentState === 'idle'
          ? 0.18
          : 0.24;

    this.liveParams.audioLow = THREE.MathUtils.lerp(this.liveParams.audioLow, low, lerpRate);
    this.liveParams.audioMid = THREE.MathUtils.lerp(this.liveParams.audioMid, mid, lerpRate);
    this.liveParams.audioHigh = THREE.MathUtils.lerp(this.liveParams.audioHigh, high, lerpRate);
    this.liveParams.voicePunch = THREE.MathUtils.lerp(this.liveParams.voicePunch, punch, 0.28);

    if (
      this.currentState === 'listening' &&
      !isSpeakingNow &&
      this.liveParams.audioLow + this.liveParams.audioMid + this.liveParams.audioHigh < 0.004
    ) {
      this.liveParams.audioLow = 0;
      this.liveParams.audioMid = 0;
      this.liveParams.audioHigh = 0;
      this.liveParams.voicePunch = 0;
    }

    const activeVoiceEnergy =
      this.liveParams.audioLow * 0.4 +
      this.liveParams.audioMid * 0.6 +
      this.liveParams.audioHigh * 0.3 +
      this.liveParams.voicePunch * 0.7;

    const targetSpeed =
      this.currentState === 'listening' ? Math.min(1.65, activeVoiceEnergy * 1.45) : target.speed;

    this.liveParams.speed = THREE.MathUtils.lerp(this.liveParams.speed, targetSpeed, 0.15);
    this.liveParams.foldDepth = THREE.MathUtils.lerp(this.liveParams.foldDepth, target.foldDepth, 0.06);
    this.liveParams.freq = THREE.MathUtils.lerp(this.liveParams.freq, target.freq, 0.06);
    this.liveParams.spinY = THREE.MathUtils.lerp(this.liveParams.spinY, target.spinY, 0.06);
    this.liveParams.spinX = THREE.MathUtils.lerp(this.liveParams.spinX, target.spinX, 0.06);
    this.liveParams.spinZ = THREE.MathUtils.lerp(this.liveParams.spinZ, target.spinZ, 0.06);
    this.liveParams.bloom = THREE.MathUtils.lerp(this.liveParams.bloom, target.bloom, 0.06);

    this.liveParams.listenW = THREE.MathUtils.lerp(this.liveParams.listenW, target.listenW, 0.08);
    this.liveParams.thinkW = THREE.MathUtils.lerp(this.liveParams.thinkW, target.thinkW, 0.08);
    this.liveParams.speakW = THREE.MathUtils.lerp(this.liveParams.speakW, target.speakW, 0.08);

    this.morphTime += dt * this.liveParams.speed;
    this.voiceTime += dt * (activeVoiceEnergy * 1.85) * this.liveParams.listenW;

    this.mouse.lerp(this.targetMouse, 0.08);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.ray.intersectPlane(this.plane, this.pointerWorld);

    this.uniforms.uMorphTime.value = this.morphTime;
    this.uniforms.uRealTime.value = elapsed;
    this.uniforms.uVoiceTime.value = this.voiceTime;
    this.uniforms.uPointer.value.copy(this.pointerWorld);
    this.uniforms.uPointerActive.value = THREE.MathUtils.lerp(
      this.uniforms.uPointerActive.value,
      this.pointerActive,
      0.08,
    );
    this.uniforms.uFoldDepth.value = this.liveParams.foldDepth;
    this.uniforms.uFreq.value = this.liveParams.freq;
    this.uniforms.uAudioLow.value = this.liveParams.audioLow;
    this.uniforms.uAudioMid.value = this.liveParams.audioMid;
    this.uniforms.uAudioHigh.value = this.liveParams.audioHigh;
    this.uniforms.uVoicePunch.value = this.liveParams.voicePunch;
    this.uniforms.uListenWeight.value = this.liveParams.listenW;
    this.uniforms.uThinkWeight.value = this.liveParams.thinkW;
    this.uniforms.uSpeakWeight.value = this.liveParams.speakW;

    this.bloomPass.strength =
      this.liveParams.bloom +
      (this.liveParams.audioMid * 0.35 + this.liveParams.voicePunch * 0.3) *
        (this.liveParams.listenW + this.liveParams.speakW);

    const voiceSpinBoost =
      activeVoiceEnergy * 0.85 * this.liveParams.listenW + this.liveParams.audioLow * 0.35 * this.liveParams.speakW;
    this.orb.rotation.y += dt * (this.liveParams.spinY + voiceSpinBoost);

    if (this.currentState === 'idle') {
      this.orb.rotation.x = THREE.MathUtils.lerp(this.orb.rotation.x, 0.0, 0.05);
      this.orb.rotation.z = THREE.MathUtils.lerp(this.orb.rotation.z, 0.1, 0.05);
    } else if (this.currentState === 'listening') {
      const voiceTiltX = Math.sin(this.voiceTime * 4.5) * 0.26 * Math.min(1.0, activeVoiceEnergy);
      const voiceTiltZ = 0.1 + Math.cos(this.voiceTime * 3.5) * 0.24 * Math.min(1.0, activeVoiceEnergy);
      this.orb.rotation.x = THREE.MathUtils.lerp(this.orb.rotation.x, voiceTiltX, 0.12);
      this.orb.rotation.z = THREE.MathUtils.lerp(this.orb.rotation.z, voiceTiltZ, 0.12);
    } else if (this.currentState === 'thinking') {
      this.orb.rotation.x += dt * this.liveParams.spinX;
      this.orb.rotation.z += dt * this.liveParams.spinZ;
    } else {
      const targetRotX = Math.sin(elapsed * 3.2) * 0.12 * this.liveParams.speakW;
      const targetRotZ = Math.sin(elapsed * 0.6) * 0.16;
      this.orb.rotation.x = THREE.MathUtils.lerp(this.orb.rotation.x, targetRotX, 0.06);
      this.orb.rotation.z = THREE.MathUtils.lerp(this.orb.rotation.z, targetRotZ, 0.06);
    }

    this.controls.update();
    this.composer.render();
  }

  destroy(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerleave', this._onPointerLeave);
    window.removeEventListener('resize', this._onResize);

    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
      this.micStream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }

    this.controls.dispose();
    this.bloomPass.dispose();
    this.composer.dispose();
    this.sphereGeo.dispose();
    this.orbMat.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (window.VoiceOrb === this) {
      delete window.VoiceOrb;
    }
  }
}
