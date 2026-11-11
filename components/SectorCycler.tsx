'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ui } from '@/data/map';
import type { Department } from '@/lib/types';

type SectorCyclerProps = {
  department: Department;
  onPrevious: () => void;
  onNext: () => void;
};

const ARROW = 'grid h-11 w-11 place-items-center rounded-full text-ink-dim hover:text-ink';

/** Bottom-centre "‹ 01_CORE ›" control with the sector tagline beneath. */
export function SectorCycler({ department, onPrevious, onNext }: SectorCyclerProps) {
  return (
    <div role="group" aria-label={ui.cycler.label} className="flex flex-col items-center">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrevious} aria-label={ui.cycler.previous} className={ARROW}>
          <ChevronLeft size={18} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <p
          aria-live="polite"
          className="min-w-[12ch] whitespace-nowrap text-center font-serif text-base font-light uppercase lining-nums tracking-label md:text-lg"
          style={{ color: department.color }}
        >
          {department.id}
        </p>
        <button type="button" onClick={onNext} aria-label={ui.cycler.next} className={ARROW}>
          <ChevronRight size={18} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>
      <p className="micro -mt-1 whitespace-nowrap text-center text-micro-sm text-ink-dim md:text-micro">{department.tagline}</p>
    </div>
  );
}
