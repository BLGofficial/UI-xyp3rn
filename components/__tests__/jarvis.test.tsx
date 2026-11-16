import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JarvisDock } from '@/components/JarvisDock';
import { JarvisView } from '@/components/JarvisView';
import { JarvisVisualizer } from '@/components/JarvisVisualizer';
import { X3liusPlayer } from '@/components/X3liusPlayer';
import { brain, ui, x3liusTracks } from '@/data/map';
import { LAYOUT } from '@/lib/tokens';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('JarvisVisualizer', () => {
  it('renders harmonic rings, frequency bars, both engine cores and triggers voice toggle', async () => {
    const onTriggerVoice = vi.fn();
    render(
      <JarvisVisualizer
        state="listening"
        activeEngine="claude-code-cli"
        energy={0.8}
        onTriggerVoice={onTriggerVoice}
      />,
    );
    expect(screen.getByText(brain.cores[0].label)).toBeInTheDocument();
    expect(screen.getByText(brain.cores[1].label)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-visualizer-bar]')).toHaveLength(LAYOUT.jarvisBarCount);
    expect(document.querySelectorAll('[data-visualizer-ring]')).toHaveLength(LAYOUT.jarvisRingCount);

    await userEvent.click(screen.getByRole('button', { name: ui.jarvis.visualizer.trigger }));
    expect(onTriggerVoice).toHaveBeenCalledTimes(1);
  });
});

describe('X3liusPlayer', () => {
  it('renders track metadata, 24 spectrum bars, transport controls, COMPOSE and IMPORT RENDER', async () => {
    const handlers = {
      onSelectTrack: vi.fn(),
      onTogglePlay: vi.fn(),
      onCompose: vi.fn(),
      onImportRender: vi.fn(),
      onOpenJob: vi.fn(),
    };
    render(
      <X3liusPlayer
        tracks={x3liusTracks}
        activeTrackId="uk-drill"
        playing
        importedFiles={{}}
        {...handlers}
      />,
    );

    expect(screen.getByRole('heading', { name: '-FREE- Uk Drill Type' })).toBeInTheDocument();
    expect(screen.getByText(/140 BPM/)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-spectrum-bar]')).toHaveLength(LAYOUT.playerSpectrumBars);

    await userEvent.click(screen.getByRole('button', { name: ui.player.pause }));
    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Neon Static' }));
    expect(handlers.onSelectTrack).toHaveBeenCalledWith('neon-static');

    await userEvent.click(screen.getByRole('button', { name: ui.player.compose }));
    expect(handlers.onCompose).toHaveBeenCalledWith(x3liusTracks[0]);

    await userEvent.click(screen.getByRole('button', { name: ui.player.openHub }));
    expect(handlers.onOpenJob).toHaveBeenCalledWith('uk-drill-song-hub');

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['audio'], 'custom-drill-master.wav', { type: 'audio/wav' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(handlers.onImportRender).toHaveBeenCalledWith('uk-drill', 'custom-drill-master.wav');
  });
});

describe('JarvisDock and JarvisView', () => {
  it('submits commands from the operator dock and opens the full-screen console', async () => {
    const onOpenConsole = vi.fn();
    const onSelectJob = vi.fn();
    render(
      <JarvisDock
        activeSector="01_CORE"
        selectedJobId={null}
        onOpenConsole={onOpenConsole}
        onSelectJob={onSelectJob}
      />,
    );

    const input = screen.getByRole('textbox', { name: ui.jarvis.inputLabel });
    await userEvent.type(input, 'xyp3rn> status{Enter}');
    expect(await screen.findByText(/137/, undefined, { timeout: 3000 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: ui.jarvis.openConsole }));
    expect(onOpenConsole).toHaveBeenCalledTimes(1);
  });

  it('runs quick commands, navigates @context job chips and embeds X3LIUS player in full-screen view', async () => {
    const onClose = vi.fn();
    const onSelectJob = vi.fn();
    render(
      <JarvisView
        activeSector="01_CORE"
        selectedJobId={null}
        onClose={onClose}
        onSelectJob={onSelectJob}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: ui.jarvis.title });
    expect(within(dialog).getByRole('heading', { name: '-FREE- Uk Drill Type' })).toBeInTheDocument();

    // Run the Mission.md quick command, which injects @01_CORE/00_Identity/Mission.md
    const quickBtn = within(dialog).getByRole('button', { name: /Mission\.md/i });
    await userEvent.click(quickBtn);

    const chip = await within(dialog).findByRole('button', { name: /Mission & Operator Identity/i }, { timeout: 3000 });
    await userEvent.click(chip);
    expect(onSelectJob).toHaveBeenCalledWith('mission-identity');
  });

  it('supports collapsible glass windows, hover-reveal pin toggle, and audio reverse-engineering with operator save decision', async () => {
    const fetchCalls: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        fetchCalls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
        if (url.includes('/api/health')) {
          return new Response(
            JSON.stringify({ ok: true, indexStats: { totalFiles: 20354, bySector: {} }, agentsCount: 52 }),
            { status: 200 },
          );
        }
        if (url.includes('/api/audio/prompts')) {
          return new Response(
            JSON.stringify({ ok: true, folder: '09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS', prompts: [] }),
            { status: 200 },
          );
        }
        if (url.includes('/api/audio/save-prompts')) {
          return new Response(
            JSON.stringify({
              ok: true,
              folder: '09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS',
              savedFiles: [
                {
                  facet: 'unified',
                  vaultPath: '09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS/2026-11-16-Test-Drill-Extracted-Prompt.md',
                  sha256: 'deadbeef1234',
                  byteSize: 900,
                  createdCopy: false,
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 404 });
      }),
    );

    render(<JarvisView activeSector="01_CORE" selectedJobId={null} />);
    const dialog = screen.getByRole('dialog', { name: ui.jarvis.title });

    // 1. Toggle Hover Reveal -> Glass Pinned
    const pinBtn = within(dialog).getByRole('button', { name: /HOVER REVEAL/i });
    await userEvent.click(pinBtn);
    expect(within(dialog).getByRole('button', { name: /GLASS PINNED/i })).toBeInTheDocument();

    // 2. Import an audio file via X3liusPlayer's file input
    const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    const wavFile = new File([new Uint8Array(64)], 'Test-Drill-140.wav', { type: 'audio/wav' });
    fireEvent.change(fileInput, { target: { files: [wavFile] } });

    // 3. Extraction finishes cleanly WITHOUT automatically saving
    expect(await within(dialog).findByDisplayValue(/140 BPM/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchCalls.some((c) => c.url.includes('/api/audio/save-prompts'))).toBe(false);

    // 4. Inspect Vocal & Flow and Instruments & Mix tabs
    await userEvent.click(within(dialog).getByRole('tab', { name: /VOCAL & FLOW/i }));
    expect(within(dialog).getByText(/Flow Pocket:/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('tab', { name: /INSTRUMENTS & MIX/i }));
    expect(within(dialog).getByText(/Mix Spec:/i)).toBeInTheDocument();

    // 5. Explicitly click SAVE TO OBSIDIAN -> calls /api/audio/save-prompts targeting dedicated folder
    const saveBtn = within(dialog).getByRole('button', { name: /SAVE TO OBSIDIAN/i });
    await userEvent.click(saveBtn);
    expect(
      await within(dialog).findByText(/Saved 1 Markdown file\(s\) to 09_X3LIUS_MUSIC\/AUDIO_EXTRACTED_PROMPTS\//i),
    ).toBeInTheDocument();
    expect(fetchCalls.some((c) => c.url.includes('/api/audio/save-prompts'))).toBe(true);
  });

  it('supports Vault/OS read acceptance toggle, source/function citation inspection, and change proposal Accept/Decline', async () => {
    window.localStorage.clear();
    const decideBodies: Array<{ proposalId: string; decision: string }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/health')) {
          return new Response(
            JSON.stringify({ ok: true, indexStats: { totalFiles: 20355, bySector: {} }, agentsCount: 52 }),
            { status: 200 },
          );
        }
        if (url.includes('/api/audio/prompts')) {
          return new Response(
            JSON.stringify({ ok: true, folder: '09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS', prompts: [] }),
            { status: 200 },
          );
        }
        if (url.includes('/api/jarvis/inspect')) {
          return new Response(
            JSON.stringify({
              ok: true,
              scope: 'os',
              path: 'core/gateway/audio-reverse-engineer.ts',
              title: 'audio-reverse-engineer.ts',
              lineCount: 779,
              symbols: [
                {
                  kind: 'function',
                  name: 'reverseEngineerAudioTelemetry',
                  line: 150,
                  signature: 'export async function reverseEngineerAudioTelemetry(',
                },
              ],
              content: 'export async function reverseEngineerAudioTelemetry() { /* verified */ }',
              truncated: false,
              sha256: 'sha256abc',
            }),
            { status: 200 },
          );
        }
        if (url.includes('/api/jarvis/proposal/decide')) {
          const parsed = JSON.parse(String(init?.body ?? '{}')) as { proposalId: string; decision: string };
          decideBodies.push(parsed);
          return new Response(
            JSON.stringify({
              ok: true,
              applied: parsed.decision === 'approved',
              decision: parsed.decision,
              vaultPath: '10_INBOX/2026-11-16-note.md',
              sha256: 'cafebabe1234',
              message:
                parsed.decision === 'approved'
                  ? 'Change accepted and written to "10_INBOX/2026-11-16-note.md".'
                  : 'Declined proposed change.',
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/api/jarvis')) {
          const body = JSON.parse(String(init?.body ?? '{}')) as { prompt: string; readAccepted?: boolean };
          if (body.readAccepted === false) {
            return new Response(
              JSON.stringify({
                ok: true,
                requiresReadAcceptance: true,
                reply: 'Jarvis requires acceptance before reading Vault/OS.',
              }),
              { status: 200 },
            );
          }
          if (body.prompt.toLowerCase().startsWith('create')) {
            return new Response(
              JSON.stringify({
                ok: true,
                reply: 'Proposed WRITE to "10_INBOX/2026-11-16-note.md". Should I apply this change or make no changes?',
                proposal: {
                  id: 'prop-99',
                  action: 'write',
                  targetScope: 'vault',
                  targetPath: '10_INBOX/2026-11-16-note.md',
                  content: '# Test Note\n',
                  preview: '# Test Note\n',
                  reason: 'Create draft note',
                  isCanonical: false,
                  status: 'pending',
                },
              }),
              { status: 200 },
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              reply: 'Whole OS matched core/gateway/audio-reverse-engineer.ts (reverseEngineerAudioTelemetry).',
              citations: [
                {
                  scope: 'os',
                  path: 'core/gateway/audio-reverse-engineer.ts',
                  title: 'audio-reverse-engineer.ts',
                  symbols: ['reverseEngineerAudioTelemetry@L150'],
                  snippet: 'L150: export async function reverseEngineerAudioTelemetry',
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 404 });
      }),
    );

    render(<JarvisView activeSector="01_CORE" selectedJobId={null} />);
    const dialog = screen.getByRole('dialog', { name: ui.jarvis.title });

    // 1. Lock read access -> verify prompt asks for acceptance, then click ACCEPT READ ACCESS
    await userEvent.click(within(dialog).getByRole('button', { name: /VAULT\/OS READ: ACCEPTED/i }));
    const textbox = within(dialog).getByRole('textbox', { name: ui.jarvis.inputLabel });
    await userEvent.type(textbox, 'Explain reverseEngineerAudioTelemetry{Enter}');

    const acceptReadBtn = await within(dialog).findByRole('button', { name: /ACCEPT READ ACCESS/i });
    await userEvent.click(acceptReadBtn);

    // 2. Citations render & clicking inspects file symbols/functions
    const citeBtn = await within(dialog).findByRole('button', { name: /core\/gateway\/audio-reverse-engineer\.ts/i });
    await userEvent.click(citeBtn);
    const inspector = await within(dialog).findByRole('region', { name: /OS and Vault Source Inspector/i });
    expect(within(inspector).getByText(/function reverseEngineerAudioTelemetry@L150/i)).toBeInTheDocument();
    await userEvent.click(within(inspector).getByRole('button', { name: /Close source inspector/i }));

    // 3. Natural change request queues pending proposal -> click ACCEPT & APPLY
    await userEvent.type(textbox, 'Create 10_INBOX/2026-11-16-note.md # Test Note{Enter}');
    const applyBtn = await within(dialog).findByRole('button', { name: /ACCEPT & APPLY/i });
    await userEvent.click(applyBtn);

    expect(await within(dialog).findByText(/APPLIED ✓/i)).toBeInTheDocument();
    expect(decideBodies[0]).toMatchObject({ proposalId: 'prop-99', decision: 'approved' });
  });
});
