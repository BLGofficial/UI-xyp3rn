import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JarvisDock } from '@/components/JarvisDock';
import { JarvisView } from '@/components/JarvisView';
import { JarvisVisualizer } from '@/components/JarvisVisualizer';
import { X3liusPlayer } from '@/components/X3liusPlayer';
import { brain, ui, x3liusTracks } from '@/data/map';
import { LAYOUT } from '@/lib/tokens';

afterEach(() => vi.restoreAllMocks());

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
});
