import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_EXTRACTED_PROMPTS_DIR,
  buildLocalReverseEngineeredSpec,
  extractAudioTelemetryFromFile,
  fetchExtractedAudioPrompts,
  reverseEngineerAudio,
  saveExtractedAudioPrompts,
} from '@/lib/audio-reverse-engineer';

describe('audio reverse-engineer client engine', () => {
  it('extracts heuristic telemetry cleanly without failing when Web Audio decode is unavailable', async () => {
    const file = new File([new Uint8Array(256)], 'Dark-UK-Drill-140-Demo.wav', { type: 'audio/wav' });
    const telemetry = await extractAudioTelemetryFromFile(file);

    expect(telemetry.fileName).toBe('Dark-UK-Drill-140-Demo.wav');
    expect(telemetry.bpm).toBe(140);
    expect(telemetry.durationSec).toBeGreaterThan(0);

    const spec = buildLocalReverseEngineeredSpec(telemetry);
    expect(spec.genres.some((g) => /drill/i.test(g))).toBe(true);
    expect(spec.stylePrompt).toContain('140 BPM');
    expect(spec.vocalSpec.delivery.length).toBeGreaterThan(10);
    expect(spec.flowSpec.pocket).toContain('140 BPM');
    expect(spec.instrumentsSpec.bassAndSub.length).toBeGreaterThan(0);
  });

  it('calls gateway reverse-engineer & save-prompts endpoints targeting only AUDIO_EXTRACTED_PROMPTS', async () => {
    const mockSpec = buildLocalReverseEngineeredSpec({
      fileName: 'Night-Walk.mp3',
      durationSec: 120,
      sampleRate: 44100,
      channels: 2,
      bpm: 128,
      bpmConfidence: 0.9,
      musicalKey: 'C',
      scale: 'minor',
      keyConfidence: 0.85,
      rmsDb: -11,
      peakDb: -0.5,
      crestDb: 10.5,
      estimatedLufs: -10.2,
      spectralCentroidHz: 2100,
      subBassRatio: 0.34,
      lowMidRatio: 0.28,
      vocalMidRatio: 0.26,
      airHighRatio: 0.19,
      stereoWidth: 0.6,
      transientDensity: 4.1,
      swingFactor: 0.14,
      vocalActivityScore: 0.45,
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/audio/reverse-engineer')) {
        return new Response(
          JSON.stringify({ ok: true, folder: AUDIO_EXTRACTED_PROMPTS_DIR, spec: mockSpec }),
          { status: 200 },
        );
      }
      if (url.includes('/api/audio/save-prompts')) {
        return new Response(
          JSON.stringify({
            ok: true,
            folder: AUDIO_EXTRACTED_PROMPTS_DIR,
            savedFiles: [
              {
                facet: 'unified',
                vaultPath: `${AUDIO_EXTRACTED_PROMPTS_DIR}/2026-11-16-Night-Walk-Extracted-Prompt.md`,
                sha256: 'abc123def456',
                byteSize: 1200,
                createdCopy: false,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/audio/prompts')) {
        return new Response(
          JSON.stringify({
            ok: true,
            folder: AUDIO_EXTRACTED_PROMPTS_DIR,
            prompts: [
              {
                vaultPath: `${AUDIO_EXTRACTED_PROMPTS_DIR}/2026-11-16-Night-Walk-Extracted-Prompt.md`,
                title: 'Night Walk',
                sha256: 'abc123def456',
                tags: ['audio-extracted-prompt'],
                status: 'draft',
                bpm: 128,
                musicalKey: 'C minor',
                sourceAudio: 'Night-Walk.mp3',
                updatedAt: '2026-11-16T00:00:00.000Z',
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    }) as unknown as typeof fetch;

    const rev = await reverseEngineerAudio(mockSpec.telemetry, { fetchImpl: fetchMock });
    expect(rev.mode).toBe('live-gateway');
    expect(rev.folder).toBe(AUDIO_EXTRACTED_PROMPTS_DIR);

    const saved = await saveExtractedAudioPrompts(
      { spec: rev.spec, saveMode: 'unified', selectedFacets: ['style', 'vocal'] },
      { fetchImpl: fetchMock },
    );
    expect(saved.ok).toBe(true);
    expect(saved.folder).toBe(AUDIO_EXTRACTED_PROMPTS_DIR);
    expect(saved.savedFiles[0]?.vaultPath.startsWith(`${AUDIO_EXTRACTED_PROMPTS_DIR}/`)).toBe(true);

    const listed = await fetchExtractedAudioPrompts({ fetchImpl: fetchMock });
    expect(listed.ok).toBe(true);
    expect(listed.prompts).toHaveLength(1);
  });
});
