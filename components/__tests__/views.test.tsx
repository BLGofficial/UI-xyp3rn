import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobPanel } from '@/components/JobPanel';
import { SectorTree } from '@/components/SectorTree';
import { SkillViewer } from '@/components/SkillViewer';
import { departments, ui } from '@/data/map';
import { layoutFocusArc, layoutSector } from '@/lib/layout';
import type { Department, Job } from '@/lib/types';

const core = departments[0]!;
const find = (id: string): { job: Job; department: Department } => {
  for (const department of departments) {
    const job = department.jobs.find((candidate) => candidate.id === id);
    if (job) return { job, department };
  }
  throw new Error(`missing job ${id}`);
};
const titles = new Map(departments.flatMap((dept) => dept.jobs.map((job) => [job.id, job.title] as const)));

afterEach(() => vi.restoreAllMocks());

function renderPanel(id: string, overrides: Partial<Parameters<typeof JobPanel>[0]> = {}) {
  const { job, department } = find(id);
  const handlers = { onClose: vi.fn(), onNavigate: vi.fn(), onStatus: vi.fn(), onOpenSkill: vi.fn() };
  render(
    <JobPanel job={job} department={department} status={job.status} titles={titles} trapFocus {...handlers} {...overrides} />,
  );
  return { job, department, ...handlers };
}

describe('JobPanel', () => {
  it('renders all 14 sections from data', () => {
    const { job, department } = renderPanel('daily-digest-workflow');
    const dialog = screen.getByRole('dialog');
    const sections = dialog.querySelectorAll('[data-section]');
    expect([...sections].map((section) => section.getAttribute('data-section'))).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i + 1)),
    );
    sections.forEach((section) => expect(section.textContent?.trim()).not.toBe(''));

    expect(sections[0]).toHaveTextContent(ui.autonomy[job.autonomy]);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(job.title);
    expect(sections[2]).toHaveTextContent(`${department.name} · ${job.cluster}`);
    expect(sections[2]).toHaveTextContent('└─ Daily Digest.md');
    expect(sections[3]).toHaveTextContent(job.summary);
    job.breaksInto.forEach((item) => expect(sections[5]).toHaveTextContent(item));
    expect(sections[7]).toHaveTextContent(job.replaces);
    expect(sections[9]).toHaveTextContent(job.human);
    expect(sections[10]).toHaveTextContent(job.buildNotes);
    expect(sections[11]).toHaveTextContent(job.skill.installCmd);
  });

  it('emphasises the ladder row that matches the job autonomy', () => {
    renderPanel('daily-digest-workflow');
    const rows = screen.getByRole('dialog').querySelectorAll('[data-section="9"] [data-current]');
    expect([...rows].map((row) => row.getAttribute('data-current'))).toEqual(['false', 'false', 'true']);
  });

  it('navigates through BUILDS ON chips', async () => {
    const { onNavigate } = renderPanel('daily-digest-workflow');
    await userEvent.click(screen.getByRole('button', { name: 'Scribe Agent' }));
    expect(onNavigate).toHaveBeenCalledWith('scribe-agent');
  });

  it('reports status changes and marks the active segment', async () => {
    const { onStatus } = renderPanel('daily-digest-workflow', { status: 'in-development' });
    const group = screen.getByRole('group', { name: ui.status.label });
    expect(within(group).getByRole('button', { name: ui.status.options['in-development'] })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(group).getByRole('button', { name: ui.status.options.live }));
    expect(onStatus).toHaveBeenCalledWith('live');
  });

  it('opens the skill sheet from the download bar and the skill card, and closes', async () => {
    const { onOpenSkill, onClose } = renderPanel('daily-digest-workflow');
    await userEvent.click(screen.getByRole('button', { name: ui.panel.download.aria }));
    await userEvent.click(screen.getByRole('button', { name: /daily-digest/ }));
    expect(onOpenSkill).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: ui.panel.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog', () => {
    renderPanel('daily-digest-workflow');
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('marks a stub as a stub and offers no download for it', () => {
    const { onOpenSkill } = renderPanel('research-orchestrator-agent');
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-section="1"]')).toHaveTextContent(ui.stub.eyebrow);
    expect(dialog.querySelector('[data-section="11"]')).toHaveTextContent('claude/sonnet');
    const bar = dialog.querySelector('[data-section="5"] button');
    expect(bar).toBeDisabled();
    expect(bar).toHaveTextContent(ui.stub.text);
    dialog.querySelectorAll('[data-section="9"] [data-current]').forEach((row) => {
      expect(row).toHaveAttribute('data-current', 'false');
    });
    expect(onOpenSkill).not.toHaveBeenCalled();
  });
});

describe('SkillViewer', () => {
  const { job } = find('scribe-agent');

  it('renders frontmatter as a callout and headings from the note', () => {
    render(<SkillViewer job={job} onClose={vi.fn()} />);
    const body = screen.getByTestId('skill-body');
    expect(body.querySelector('pre')).toHaveTextContent('type: agent');
    expect(within(body).getByRole('heading', { level: 4 })).toHaveTextContent('Instructions');
    expect(screen.getByText(ui.viewer.badge)).toBeInTheDocument();
  });

  it('copies the install command and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<SkillViewer job={job} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: ui.viewer.copyInstall }));
    expect(writeText).toHaveBeenCalledWith(job.skill.installCmd);
    expect(await screen.findByRole('button', { name: ui.viewer.copied })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('says so when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<SkillViewer job={job} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: ui.viewer.copy }));
    expect(await screen.findByRole('button', { name: ui.viewer.failed })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('SectorTree', () => {
  const handlers = () => ({ onSelect: vi.fn(), onToggle: vi.fn(), onFocus: vi.fn() });
  const renderTree = (open: boolean, props = handlers()) => {
    render(
      <svg>
        <SectorTree
          department={core}
          layout={layoutSector(core)}
          variant="overview"
          open={open}
          scale={1}
          statuses={{ 'jarvis-agent': 'in-development' }}
          selectedId={null}
          interactive
          {...props}
        />
      </svg>,
    );
    return props;
  };

  it('exposes every job as a labelled button in cluster order', () => {
    renderTree(true);
    const nodes = [...document.querySelectorAll<SVGGElement>('.node')];
    expect(nodes.map((node) => node.getAttribute('data-job-id'))).toEqual(core.jobs.map((job) => job.id));
    nodes.forEach((node) => {
      expect(node).toHaveAttribute('role', 'button');
      expect(node).toHaveAttribute('tabindex', '0');
    });
    expect(screen.getByRole('button', { name: 'Mission & Operator Identity, CORE ENGINE, live' })).toBeInTheDocument();
    // The operator's override wins over the seed status.
    expect(screen.getByRole('button', { name: 'Jarvis Operator, CORE ENGINE, in development' })).toHaveAttribute(
      'data-status',
      'in-development',
    );
  });

  it('selects a job with the keyboard', () => {
    const { onSelect } = renderTree(true);
    fireEvent.keyDown(screen.getByRole('button', { name: /^Scribe Agent/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('scribe-agent');
  });

  it('toggles on click or Space and focuses on Enter or double-click', () => {
    const { onToggle, onFocus } = renderTree(true);
    const hub = screen.getByRole('button', { name: /sector hub/ });
    expect(hub).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(hub);
    fireEvent.keyDown(hub, { key: ' ' });
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledWith('01_CORE');
    fireEvent.keyDown(hub, { key: 'Enter' });
    fireEvent.doubleClick(hub);
    expect(onFocus).toHaveBeenCalledTimes(2);
  });

  it('takes collapsed nodes out of the tab order and draws one stub per branch', () => {
    renderTree(false);
    expect(document.querySelector('.tree')).toHaveAttribute('data-open', 'false');
    document.querySelectorAll('.node').forEach((node) => expect(node).toHaveAttribute('tabindex', '-1'));
    expect(document.querySelectorAll('.tree-stubs line')).toHaveLength(8);
    expect(screen.getByRole('button', { name: /sector hub/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('draws icons, labels, satellites and START HERE in the focus variant', () => {
    render(
      <svg>
        <SectorTree
          department={core}
          layout={layoutFocusArc(core)}
          variant="focus"
          open
          scale={1}
          statuses={{}}
          selectedId="mission-identity"
          interactive
          onSelect={vi.fn()}
        />
      </svg>,
    );
    const mission = document.querySelector('[data-job-id="mission-identity"]')!;
    expect(mission).toHaveAttribute('data-selected', 'true');
    expect(mission).toHaveTextContent(ui.focus.startHere);
    expect(mission.querySelectorAll('.sat-label')).toHaveLength(3);
    expect(mission.querySelectorAll('.pulse-ring')).toHaveLength(2);
    expect(document.querySelector('.tree')).toHaveTextContent('02_Agents');
    expect(document.querySelector('.tree')).toHaveTextContent('8 jobs');
  });
});
