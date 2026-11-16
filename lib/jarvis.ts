import { mulberry32, stringToSeed } from './prng';
import { SECTOR_COLORS, LAYOUT } from './tokens';
import type {
  CommandKind,
  Department,
  DepartmentId,
  EngineId,
  JarvisVoiceState,
  Job,
  ParsedCommand,
  VisualizerBar,
  VisualizerRing,
} from './types';

const ALLOWED_SECTORS = new Set<string>(Object.keys(SECTOR_COLORS) as DepartmentId[]);
const ALLOWED_EXTENSIONS = new Set(['.md', '.wav', '.mp3', '.flac', '.json', '.txt']);

const AGENT_ALIASES: Record<string, string> = {
  jarvis: 'jarvis-agent',
  researcher: 'researcher-agent',
  scribe: 'scribe-agent',
  analyst: 'analyst-gemini',
  songwriter: 'x3lius-songwriter-agent',
};

const STATE_GAIN: Record<JarvisVoiceState, number> = {
  idle: 0.18,
  listening: 0.72,
  processing: 0.56,
  speaking: 0.92,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Validates a vault-relative file path against 06_GOVERNANCE/01_Standards/Path Safety & Extension Standard.md.
 * Rejects absolute paths, path traversal (`..`), hidden segments (`.`), unknown sectors, and unapproved extensions.
 * @param filePath path to validate
 */
export function isSafeVaultPath(filePath: string): boolean {
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
    return false;
  }
  if (trimmed.includes('\\') || trimmed.includes('//')) return false;
  const segments = trimmed.split('/');
  if (segments.length < 2) return false;
  if (!ALLOWED_SECTORS.has(segments[0] ?? '')) return false;
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || segment.startsWith('.')) {
      return false;
    }
  }
  const fileName = segments.at(-1) ?? '';
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return false;
  const ext = fileName.slice(dot).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Enforces the 01_CORE/07_Tools/vault.write.md No-Overwrite Guard: when `filePath` already exists in the
 * vault, returns a numbered copy such as `Note (2).md` or `Note (3).md`.
 * @param filePath candidate vault-relative path
 * @param existingFiles set of existing vault paths
 */
export function resolveSafeCopyPath(filePath: string, existingFiles: ReadonlySet<string>): string {
  const clean = filePath.trim();
  if (!existingFiles.has(clean)) return clean;
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let n = 2;
  while (existingFiles.has(`${stem} (${n})${ext}`)) {
    n++;
  }
  return `${stem} (${n})${ext}`;
}

/**
 * Extracts `@path` and `@agent` tokens from a prompt in order of appearance, without duplicates.
 * @param input raw prompt or terminal command
 */
export function extractContextRefs(input: string): string[] {
  const seen = new Set<string>();
  const matches = input.matchAll(/(?:^|\s)@([A-Za-z0-9_./-]+)/g);
  for (const match of matches) {
    const raw = (match[1] ?? '').replace(/[.,;:!?]+$/, '');
    if (raw) seen.add(raw);
  }
  return [...seen];
}

/**
 * Resolves `@path` and `@agent` tokens against the 137 vault jobs.
 * @param refs tokens from extractContextRefs
 * @param departments vault sectors
 */
export function resolveContextJobs(refs: readonly string[], departments: readonly Department[]): Job[] {
  if (refs.length === 0) return [];
  const allJobs = departments.flatMap((dept) => dept.jobs);
  const resolved = new Map<string, Job>();

  for (const ref of refs) {
    const lower = ref.toLowerCase();
    const aliasId = AGENT_ALIASES[lower];
    const hit = allJobs.find(
      (job) =>
        job.id === lower ||
        job.id === aliasId ||
        job.skill.name.toLowerCase() === lower ||
        job.file.toLowerCase() === lower ||
        job.file.toLowerCase().endsWith(`/${lower}`),
    );
    if (hit) resolved.set(hit.id, hit);
  }
  return [...resolved.values()];
}

/**
 * Jarvis Model Dispatcher (01_CORE/01_System_Prompts/Jarvis Routing Gateway.md):
 * routes analytical second-opinion, multimodal, and explicit `gemini` prompts to `gemini-api`
 * and operator, planning, vault, and songwriting prompts to `claude-code-cli`.
 * @param input raw command or voice transcript
 * @param preferred explicit engine override chosen by the operator
 */
export function routeEngine(input: string, preferred?: EngineId): EngineId {
  if (preferred) return preferred;
  const clean = input.replace(/^xyp3rn>\s*/i, '').trim().toLowerCase();
  if (
    clean.startsWith('gemini ') ||
    clean.includes('gemini') ||
    clean.includes('second opinion') ||
    clean.includes('@analyst') ||
    clean.includes('multimodal') ||
    clean.includes('live stream')
  ) {
    return 'gemini-api';
  }
  return 'claude-code-cli';
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Parses a `xyp3rn>` CLI instruction or natural voice command into a typed directive.
 * @param input raw operator text or voice transcript
 * @param preferredEngine optional engine override
 */
export function parseJarvisCommand(input: string, preferredEngine?: EngineId): ParsedCommand {
  const raw = input.trim();
  const body = raw.replace(/^xyp3rn>\s*/i, '').trim();
  const contextRefs = extractContextRefs(body);
  const engine = routeEngine(raw, preferredEngine);

  const [firstWord = '', ...restTokens] = body.split(/\s+/);
  const head = firstWord.toLowerCase();
  const rest = restTokens.join(' ').trim();

  if (head === 'status' && !rest) {
    return { kind: 'status', raw, command: 'status', args: '', engine, contextRefs };
  }
  if (head === 'read' && rest) {
    return { kind: 'read', raw, command: 'read', args: rest, targetPath: unquote(rest), engine, contextRefs };
  }
  if (head === 'write' && rest) {
    const [targetPath = '', ...contentParts] = rest.split(/\s+/);
    return {
      kind: 'write',
      raw,
      command: 'write',
      args: unquote(contentParts.join(' ')),
      targetPath: unquote(targetPath),
      engine,
      contextRefs,
    };
  }
  if (head === 'append' && rest) {
    const [targetPath = '', ...contentParts] = rest.split(/\s+/);
    return {
      kind: 'append',
      raw,
      command: 'append',
      args: unquote(contentParts.join(' ')),
      targetPath: unquote(targetPath),
      engine,
      contextRefs,
    };
  }
  if (head === 'search' && rest) {
    return { kind: 'search', raw, command: 'search', args: unquote(rest), engine, contextRefs };
  }
  if (head === 'flow' && rest) {
    return { kind: 'flow', raw, command: 'flow', args: rest, engine, contextRefs };
  }
  if (head === 'task' && rest) {
    const [sub = '', ...taskRest] = rest.split(/\s+/);
    const kind: CommandKind = sub.toLowerCase() === 'run' ? 'task-run' : 'task-new';
    return { kind, raw, command: `task ${sub.toLowerCase()}`, args: taskRest.join(' ').trim(), engine, contextRefs };
  }
  if (head === 'registry') {
    return { kind: 'registry', raw, command: 'registry', args: rest, engine, contextRefs };
  }
  if (head === 'promote') {
    return {
      kind: 'promote',
      raw,
      command: 'promote',
      args: rest || 'all',
      targetPath: rest && rest !== 'all' ? unquote(rest) : undefined,
      engine,
      contextRefs,
    };
  }
  if (head === 'connections') {
    return { kind: 'connections', raw, command: 'connections', args: rest || 'refresh', engine, contextRefs };
  }
  if (head === 'specialists') {
    return { kind: 'specialists', raw, command: 'specialists', args: rest, engine, contextRefs };
  }
  if (head === 'research' && rest) {
    return { kind: 'research', raw, command: 'research', args: unquote(rest), engine, contextRefs };
  }
  if (head === 'record' && rest) {
    return { kind: 'record', raw, command: 'record', args: rest, engine, contextRefs };
  }
  if (head === 'records') {
    return { kind: 'records', raw, command: 'records', args: rest, engine, contextRefs };
  }
  if (head === 'song' && rest.toLowerCase().startsWith('new ')) {
    return { kind: 'song-new', raw, command: 'song new', args: rest.slice(4).trim(), engine, contextRefs };
  }
  if (head === 'compose' && rest) {
    return { kind: 'compose', raw, command: 'compose', args: unquote(rest), engine, contextRefs };
  }
  if (head === 'play' && rest) {
    return { kind: 'play', raw, command: 'play', args: unquote(rest.replace(/\s+now$/i, '')), engine, contextRefs };
  }
  if (head === 'gemini' && rest) {
    return { kind: 'gemini', raw, command: 'gemini', args: unquote(rest), engine: 'gemini-api', contextRefs };
  }
  if (head === 'run' && rest) {
    return { kind: 'run', raw, command: 'run', args: rest, engine, contextRefs };
  }

  return { kind: 'chat', raw, command: 'chat', args: body, engine, contextRefs };
}

/**
 * Deterministic radial frequency bars around the Jarvis core orb.
 * @param state current voice/routing state
 * @param energy normalized energy in [0, 1]
 * @param phase animation phase in radians
 * @param count number of radial bars
 */
export function buildVisualizerBars(
  state: JarvisVoiceState,
  energy: number,
  phase = 0,
  count: number = LAYOUT.jarvisBarCount,
): VisualizerBar[] {
  const rng = mulberry32(stringToSeed(`jarvis-bars:${state}`));
  const baseGain = STATE_GAIN[state] * clamp(energy, 0.05, 1);

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const seedJitter = 0.35 + rng() * 0.65;
    const wave = 0.5 + 0.5 * Math.sin(angle * 3 + phase + index * 0.45);
    const amplitude = clamp(0.08 + baseGain * (0.45 * seedJitter + 0.55 * wave), 0.08, 1);
    const inner = LAYOUT.jarvisBarInner;
    const outer = inner + amplitude * LAYOUT.jarvisBarMaxLen;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      index,
      angle,
      x1: Number((cos * inner).toFixed(2)),
      y1: Number((sin * inner).toFixed(2)),
      x2: Number((cos * outer).toFixed(2)),
      y2: Number((sin * outer).toFixed(2)),
      amplitude: Number(amplitude.toFixed(4)),
    };
  });
}

/**
 * Deterministic concentric harmonic rings around the Jarvis core orb.
 * @param state current voice/routing state
 * @param energy normalized energy in [0, 1]
 * @param count number of rings
 */
export function buildVisualizerRings(
  state: JarvisVoiceState,
  energy: number,
  count: number = LAYOUT.jarvisRingCount,
): VisualizerRing[] {
  const clamped = clamp(energy, 0, 1);
  const boost = STATE_GAIN[state] * clamped;
  return Array.from({ length: count }, (_, index) => {
    const radius = Number((LAYOUT.jarvisOrbRadius + (index + 1) * LAYOUT.jarvisRingStep + boost * (index + 1) * 2.5).toFixed(2));
    const opacity = Number(clamp(0.42 - index * 0.08 + boost * 0.18, 0.1, 0.75).toFixed(3));
    return {
      index,
      radius,
      strokeWidth: index === 0 ? 1.4 : 1,
      opacity,
      dashOffset: Number(((index + 1) * 14 * (1 + boost)).toFixed(2)),
    };
  });
}

/**
 * Deterministic 24-band spectrum array for the X3LIUS `/api/music/pulse` relay.
 * @param trackId canonical track id
 * @param bpm beats per minute
 * @param progress playback position in seconds
 * @param playing whether playback is active
 * @param count number of spectrum bands
 */
export function buildTrackSpectrum(
  trackId: string,
  bpm: number,
  progress: number,
  playing: boolean,
  count: number = LAYOUT.playerSpectrumBars,
): number[] {
  const rng = mulberry32(stringToSeed(`x3lius-spectrum:${trackId}:${bpm}`));
  const beatHz = Math.max(1, bpm) / 60;
  const beatPhase = progress * beatHz * Math.PI * 2;
  const kick = Math.pow(0.5 + 0.5 * Math.cos(beatPhase), 2);

  return Array.from({ length: count }, (_, index) => {
    const bandWeight = rng();
    if (!playing) {
      return Number((0.08 + bandWeight * 0.08).toFixed(3));
    }
    // Low indices carry sub-bass/808 energy synced to the kick; mid/high bands shimmer at harmonics.
    const lowBias = 1 - index / count;
    const harmonic = 0.5 + 0.5 * Math.sin(beatPhase * (1 + (index % 4) * 0.5) + index * 0.6);
    const level = 0.14 + lowBias * 0.42 * kick + harmonic * 0.32 + bandWeight * 0.12;
    return Number(clamp(level, 0.1, 1).toFixed(3));
  });
}

