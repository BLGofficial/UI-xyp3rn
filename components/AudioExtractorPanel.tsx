'use client';

import {
  Check,
  Copy,
  FolderOpen,
  Layers,
  Mic2,
  Music2,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Waves,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AUDIO_EXTRACTED_PROMPTS_DIR, saveExtractedAudioPrompts } from '@/lib/audio-reverse-engineer';
import type {
  AudioPromptFacet,
  AudioPromptSaveMode,
  AudioReverseEngineeredSpec,
  GatewayMode,
  SavedAudioPromptFile,
  SavedAudioPromptSummary,
} from '@/lib/types';

type AudioExtractorPanelProps = {
  spec: AudioReverseEngineeredSpec | null;
  analyzing: boolean;
  analysisMode: GatewayMode;
  savedPrompts: SavedAudioPromptSummary[];
  onAnalyzeFile: (file: File) => void;
  onUpdateSpec: (next: AudioReverseEngineeredSpec) => void;
  onDiscard: () => void;
  onSavedSuccess: (files: SavedAudioPromptFile[]) => void;
  onRefreshLibrary?: () => void;
  onInspectSavedPrompt?: (vaultPath: string) => void;
};

const FACET_OPTIONS: ReadonlyArray<{ id: AudioPromptFacet; label: string }> = [
  { id: 'style', label: 'Style Prompt' },
  { id: 'genres', label: 'Genres' },
  { id: 'vocal', label: 'Singing & Vocal' },
  { id: 'flow', label: 'Flow & Cadence' },
  { id: 'instruments', label: 'Instruments & Mix' },
];

type TabId = 'style' | 'vocal' | 'instruments';

export function AudioExtractorPanel({
  spec,
  analyzing,
  analysisMode,
  savedPrompts,
  onAnalyzeFile,
  onUpdateSpec,
  onDiscard,
  onSavedSuccess,
  onRefreshLibrary,
  onInspectSavedPrompt,
}: AudioExtractorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('style');
  const [selectedFacets, setSelectedFacets] = useState<AudioPromptFacet[]>([
    'style',
    'genres',
    'vocal',
    'flow',
    'instruments',
  ]);
  const [saveMode, setSaveMode] = useState<AudioPromptSaveMode>('unified');
  const [customTitle, setCustomTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<SavedAudioPromptFile[] | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (spec) {
      setCustomTitle(spec.title);
      setSaveError(null);
      setSavedBanner(null);
    }
  }, [spec]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAnalyzeFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onAnalyzeFile(file);
  };

  const toggleFacet = (facet: AudioPromptFacet) => {
    setSelectedFacets((prev) =>
      prev.includes(facet) ? prev.filter((item) => item !== facet) : [...prev, facet],
    );
  };

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      globalThis.setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      // Clipboard unavailable in restricted test environment
    }
  };

  const handleSaveToObsidian = async () => {
    if (!spec || selectedFacets.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveExtractedAudioPrompts({
      spec,
      saveMode,
      selectedFacets,
      customTitle: customTitle.trim() || spec.title,
      actor: 'operator',
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error ?? 'Failed to save prompt Markdown into Obsidian.');
      return;
    }
    setSavedBanner(result.savedFiles);
    onSavedSuccess(result.savedFiles);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-col gap-3"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.flac,.ogg,.m4a,audio/*"
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      {!spec && !analyzing && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-hairline bg-black/25 p-3 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#3ECFB2]/40 bg-[#3ECFB2]/10 text-[#3ECFB2]">
            <Waves size={16} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-ink-dim">
            Drop an audio file here or click below to reverse-engineer its <span className="text-ink">Style Prompt, Genres, Vocal/Singing DNA, Flow</span> and <span className="text-ink">Instruments</span> into Markdown — without storing the audio file.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="micro flex items-center gap-1.5 rounded-md border border-[#3ECFB2]/50 bg-[#3ECFB2]/15 px-3 py-1.5 text-[#BFFFEF] hover:border-[#3ECFB2]"
            >
              <Upload size={12} strokeWidth={1.6} aria-hidden="true" />
              IMPORT &amp; REVERSE ENGINEER AUDIO
            </button>
          </div>
          <p className="font-mono text-[10px] text-ink-dim">
            Save destination: <span className="text-accent">{AUDIO_EXTRACTED_PROMPTS_DIR}/</span>
          </p>
        </div>
      )}

      {analyzing && (
        <div className="flex items-center justify-center gap-2.5 rounded-lg border border-[#3ECFB2]/35 bg-[#3ECFB2]/10 px-3 py-4 font-mono text-xs text-[#BFFFEF]">
          <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
          <span>Running in-memory Web Audio DSP &amp; prompt reverse engineering...</span>
        </div>
      )}

      {spec && !analyzing && (
        <div className="flex flex-col gap-2.5">
          {/* Header summary & telemetry pills */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="truncate font-mono text-[11px] font-semibold text-[#BFFFEF]" title={spec.sourceFileName}>
              {spec.sourceFileName}
            </span>
            <span className="micro rounded border border-hairline px-1.5 py-0.5 text-[9px] text-ink-dim">
              {analysisMode === 'live-gateway' ? 'OS3 ENGINE' : 'LOCAL DSP'} · NO AUDIO SAVED
            </span>
          </div>

          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            <span className="chip py-0.5 text-[#3ECFB2]">{spec.telemetry.bpm} BPM</span>
            <span className="chip py-0.5 text-s02_knowledge">
              {spec.telemetry.musicalKey} {spec.telemetry.scale}
            </span>
            <span className="chip py-0.5 text-ink">~{spec.telemetry.estimatedLufs} LUFS</span>
            <span className="chip py-0.5 text-ink-dim">SUB {Math.round(spec.telemetry.subBassRatio * 100)}%</span>
            <span className="chip py-0.5 text-accent">VOCAL {Math.round(spec.telemetry.vocalActivityScore * 100)}%</span>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex items-center gap-1 rounded-md border border-hairline bg-black/30 p-0.5" role="tablist">
            {(
              [
                { id: 'style', label: 'STYLE & GENRES', icon: Sparkles },
                { id: 'vocal', label: 'VOCAL & FLOW', icon: Mic2 },
                { id: 'instruments', label: 'INSTRUMENTS & MIX', icon: Sliders },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`micro flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[9px] transition-colors ${
                    selected ? 'bg-ink/15 font-bold text-ink' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  <Icon size={10} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          {activeTab === 'style' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="extracted-style-prompt" className="micro text-ink-dim">
                  Style Prompt (editable)
                </label>
                <button
                  type="button"
                  onClick={() => void copyText('stylePrompt', spec.stylePrompt)}
                  className="micro flex items-center gap-1 text-[10px] text-accent hover:text-ink"
                >
                  {copiedKey === 'stylePrompt' ? <Check size={10} /> : <Copy size={10} />}
                  {copiedKey === 'stylePrompt' ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <textarea
                id="extracted-style-prompt"
                rows={3}
                value={spec.stylePrompt}
                onChange={(e) => onUpdateSpec({ ...spec, stylePrompt: e.target.value })}
                className="w-full rounded-md border border-hairline bg-black/45 p-2 font-mono text-[11px] leading-relaxed text-ink focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {spec.genres.map((g) => (
                  <span key={g} className="micro rounded border border-[#38BDF8]/40 bg-[#38BDF8]/10 px-1.5 py-0.5 text-[9px] text-[#38BDF8]">
                    {g}
                  </span>
                ))}
                {spec.subgenresAndMoods.map((m) => (
                  <span key={m} className="micro rounded border border-hairline px-1.5 py-0.5 text-[9px] text-ink-dim">
                    {m}
                  </span>
                ))}
              </div>
              <p className="font-mono text-[10px] text-ink-dim">
                <span className="text-ink">Exclude:</span> {spec.negativePrompt}
              </p>
            </div>
          )}

          {activeTab === 'vocal' && (
            <div className="flex flex-col gap-2 rounded-md border border-hairline bg-black/30 p-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="micro text-accent">
                  {spec.vocalSpec.hasVocals ? 'LEAD VOCAL DETECTED' : 'INSTRUMENTAL / STEM'}
                </span>
                <span className="text-[10px] text-ink-dim">{spec.vocalSpec.register}</span>
              </div>
              <p className="text-ink">{spec.vocalSpec.delivery}</p>
              <p className="text-ink-dim">
                <span className="text-ink">Singing:</span> {spec.vocalSpec.singingStyle}
              </p>
              <div className="border-t border-hairline pt-1.5">
                <p className="text-ink">
                  <span className="text-[#3ECFB2]">Flow Pocket:</span> {spec.flowSpec.pocket}
                </p>
                <p className="mt-0.5 text-ink-dim">{spec.flowSpec.cadence}</p>
                <p className="mt-1 text-[10px] text-s02_knowledge">
                  Tags: {spec.sunoMetaTags.slice(0, 3).join(' ')}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'instruments' && (
            <div className="flex flex-col gap-1.5 rounded-md border border-hairline bg-black/30 p-2.5 font-mono text-[11px]">
              <p>
                <span className="text-[#3ECFB2]">Bass/Sub:</span> {spec.instrumentsSpec.bassAndSub.join(', ')}
              </p>
              <p>
                <span className="text-accent">Drums:</span> {spec.instrumentsSpec.drumsAndPercussion.join(', ')}
              </p>
              <p>
                <span className="text-s02_knowledge">Melodic:</span> {spec.instrumentsSpec.melodicAndHarmonic.join(', ')}
              </p>
              <p className="text-[10px] text-ink-dim">
                <span className="text-ink">Mix Spec:</span> {spec.instrumentsSpec.mixAndMastering}
              </p>
              {spec.telemetry.sections && spec.telemetry.sections.length > 0 && (
                <div className="mt-1 flex items-center gap-1 pt-1">
                  {spec.telemetry.sections.map((sec) => (
                    <div
                      key={`${sec.label}-${sec.startSec}`}
                      title={`${sec.label}: ${sec.startSec}s - ${sec.endSec}s`}
                      className="flex flex-1 flex-col items-center rounded border border-hairline/70 bg-black/35 px-1 py-0.5"
                    >
                      <span className="truncate text-[8px] uppercase text-ink-dim">{sec.label.split(' ')[0]}</span>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[#F59B5C]"
                          style={{ width: `${Math.round(sec.energy * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Operator Decision Block: Choose what Markdown files to save to Obsidian */}
          <div className="flex flex-col gap-2 rounded-lg border border-[#F59B5C]/30 bg-black/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="micro flex items-center gap-1 text-accent">
                <FolderOpen size={11} aria-hidden="true" />
                Save Decision → Obsidian
              </span>
              <span className="font-mono text-[10px] text-ink-dim" title="Dedicated folder storing ONLY extracted audio prompts">
                {AUDIO_EXTRACTED_PROMPTS_DIR}/
              </span>
            </div>

            <input
              type="text"
              aria-label="Extracted prompt note title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Note title in Obsidian..."
              className="h-7 rounded border border-hairline bg-black/50 px-2 font-mono text-[11px] text-ink focus:outline-none"
            />

            {/* Facet Toggles */}
            <div className="flex flex-wrap gap-1.5">
              {FACET_OPTIONS.map((facet) => {
                const checked = selectedFacets.includes(facet.id);
                return (
                  <button
                    key={facet.id}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleFacet(facet.id)}
                    className={`micro flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] transition-colors ${
                      checked
                        ? 'border-[#3ECFB2]/60 bg-[#3ECFB2]/15 text-[#BFFFEF]'
                        : 'border-hairline text-ink-dim hover:text-ink'
                    }`}
                  >
                    {checked && <Check size={9} aria-hidden="true" />}
                    {facet.label}
                  </button>
                );
              })}
            </div>

            {/* Save mode selector + Commit / Discard */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 rounded border border-hairline p-0.5">
                <button
                  type="button"
                  aria-pressed={saveMode === 'unified'}
                  onClick={() => setSaveMode('unified')}
                  className={`micro flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] ${
                    saveMode === 'unified' ? 'bg-ink text-bg font-bold' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  <Music2 size={9} />
                  1 .MD
                </button>
                <button
                  type="button"
                  aria-pressed={saveMode === 'per-facet'}
                  onClick={() => setSaveMode('per-facet')}
                  className={`micro flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] ${
                    saveMode === 'per-facet' ? 'bg-ink text-bg font-bold' : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  <Layers size={9} />
                  .MD PER FACET
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onDiscard}
                  title="Discard analysis without saving anything"
                  className="micro flex items-center gap-1 rounded border border-hairline px-2 py-1 text-[10px] text-ink-dim hover:text-ink"
                >
                  <Trash2 size={10} aria-hidden="true" />
                  DISCARD
                </button>
                <button
                  type="button"
                  disabled={saving || selectedFacets.length === 0}
                  onClick={() => void handleSaveToObsidian()}
                  className="micro flex items-center gap-1 rounded border border-accent bg-accent px-2.5 py-1 text-[10px] font-bold text-bg hover:brightness-110 disabled:opacity-50"
                >
                  <Save size={10} aria-hidden="true" />
                  {saving ? 'SAVING...' : 'SAVE TO OBSIDIAN'}
                </button>
              </div>
            </div>

            {saveError && <p className="font-mono text-[10px] text-[#FF7A7E]">{saveError}</p>}

            {savedBanner && savedBanner.length > 0 && (
              <div className="rounded border border-[#3ECFB2]/40 bg-[#3ECFB2]/10 p-2 font-mono text-[10px] text-[#BFFFEF]">
                <p className="font-semibold">
                  Saved {savedBanner.length} Markdown file(s) to {AUDIO_EXTRACTED_PROMPTS_DIR}/
                </p>
                {savedBanner.map((f) => (
                  <p key={f.vaultPath} className="truncate text-[9px] opacity-90">
                    • {f.vaultPath} ({f.sha256.slice(0, 8)})
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Library Archive strictly from 09_X3LIUS_MUSIC/AUDIO_EXTRACTED_PROMPTS */}
      <div className="flex flex-col gap-1 border-t border-hairline/70 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="micro text-[9px] text-ink-dim">
            Obsidian Folder ({savedPrompts.length})
          </span>
          <div className="flex items-center gap-2">
            {spec && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="micro text-[9px] text-[#3ECFB2] hover:text-ink"
              >
                + NEW FILE
              </button>
            )}
            {onRefreshLibrary && (
              <button
                type="button"
                onClick={onRefreshLibrary}
                className="micro text-[9px] text-ink-dim hover:text-ink"
              >
                REFRESH
              </button>
            )}
          </div>
        </div>
        {savedPrompts.length === 0 ? (
          <p className="font-mono text-[10px] text-ink-dim">
            No saved extracted prompts yet in {AUDIO_EXTRACTED_PROMPTS_DIR}/.
          </p>
        ) : (
          <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
            {savedPrompts.map((item) => (
              <li key={item.vaultPath}>
                <button
                  type="button"
                  onClick={() => onInspectSavedPrompt?.(item.vaultPath)}
                  className="flex w-full items-center justify-between gap-2 rounded border border-hairline/60 bg-black/30 px-2 py-1 text-left font-mono text-[10px] text-ink-dim hover:border-accent/50 hover:text-ink"
                >
                  <span className="truncate text-ink">{item.title}</span>
                  <span className="shrink-0 text-[9px] text-[#3ECFB2]">
                    {item.bpm ? `${item.bpm} BPM` : '.md'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
