'use client';

import { animate, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { ui } from '@/data/map';
import { clampPan, zoomAt, type Camera } from '@/lib/camera';
import { layoutFocusArc, layoutSector } from '@/lib/layout';
import { BREAKPOINT_MOBILE, LAYOUT, MOTION, TOKENS } from '@/lib/tokens';
import type { Bounds, Department, DepartmentId, Point, Status } from '@/lib/types';
import { BrainCore } from './BrainCore';
import { SectorTree } from './SectorTree';

const DEG = Math.PI / 180;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.6;
const ORBITS = [170, 350, 530];

// React warns about useLayoutEffect during server rendering; the effect only matters in the browser.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (from: number, to: number, t: number) => {
  const x = clamp((t - from) / (to - from), 0, 1);
  return x * x * (3 - 2 * x);
};
/** Folds an angle into (-180, 180] so a rotation always takes the short way. */
const fold = (degrees: number) => {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
};

export type FlyRequest = { jobId: string; nonce: number };

type Geometry = {
  ready: boolean;
  width: number;
  height: number;
  mobile: boolean;
  cx: number;
  cy: number;
  ring: number;
  brain: number;
  treeScale: number;
  stripGap: number;
  stripY: number;
  /** Where the focused hub sits, in world units from the ring centre. */
  anchor: Point;
  focusFit: number;
  focusBounds: Bounds | null;
};

type ConstellationCanvasProps = {
  departments: readonly Department[];
  active: number;
  open: readonly DepartmentId[];
  focusId: DepartmentId | null;
  selectedId: string | null;
  statuses: Record<string, Status>;
  /** Set by search: fly the camera to this job once its sector is focused. */
  fly: FlyRequest | null;
  /** Bumped when the operator cycles sectors from the overview; unrolls the ring into a strip. */
  strip: number;
  onToggle: (id: DepartmentId) => void;
  onFocus: (id: DepartmentId) => void;
  onSelect: (jobId: string) => void;
};

/**
 * Views 1-3. One full-viewport SVG; everything in world space hangs off a single camera group.
 * Transforms are written straight to SVG attributes from Framer Motion values, so a frame of
 * animation never re-renders React and SVG rotations keep the hub as their origin.
 */
export function ConstellationCanvas({
  departments,
  active,
  open,
  focusId,
  selectedId,
  statuses,
  fly,
  strip,
  onToggle,
  onFocus,
  onSelect,
}: ConstellationCanvasProps) {
  const reduced = useReducedMotion() ?? false;
  const count = departments.length;
  const step = 360 / count;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const overviewRef = useRef<SVGGElement>(null);
  const focusRef = useRef<SVGGElement>(null);
  const brainRef = useRef<SVGGElement>(null);
  const watermarkRef = useRef<SVGTextElement>(null);
  const sectorRefs = useRef<(SVGGElement | null)[]>([]);
  const glyphRefs = useRef<(SVGGElement | null)[]>([]);
  const labelRefs = useRef<(SVGGElement | null)[]>([]);
  const spokeRefs = useRef<(SVGLineElement | null)[]>([]);

  const [size, setSize] = useState({ width: 0, height: 0 });
  // Keeps the focus tree mounted while it animates out.
  const [lingering, setLingering] = useState<DepartmentId | null>(null);
  const shownFocus = focusId ?? lingering;
  const focusIndex = departments.findIndex((dept) => dept.id === shownFocus);

  // Longest tree at the hub's nominal size; fixes the overview scale before the real layouts exist.
  const baseReach = useMemo(() => Math.max(1, ...departments.map((dept) => layoutSector(dept).reach)), [departments]);
  const focusLayouts = useMemo(() => departments.map((dept) => layoutFocusArc(dept)), [departments]);
  const colors = useMemo(() => departments.map((dept) => dept.color), [departments]);
  const setGlyph = useMemo(
    () => departments.map((_, i) => (element: SVGGElement | null) => void (glyphRefs.current[i] = element)),
    [departments],
  );

  const rotationTarget = useRef(-active * step);
  const previousActive = useRef(active);
  const rot = useSpring(-active * step, { stiffness: 80, damping: 17 });
  const slide = useSpring(active, { stiffness: 120, damping: 20 });
  const unroll = useMotionValue(0);
  const focusT = useMotionValue(0);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const zoom = useMotionValue(1);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo<Geometry>(() => {
    const { width, height } = size;
    const mobile = width < BREAKPOINT_MOBILE;
    const top = mobile ? 132 : 72;
    const bottom = mobile ? 88 : 92;
    const cx = width / 2;
    const cy = top + (height - top - bottom) / 2;
    const ring = LAYOUT.ringRadiusRatio * Math.min(width, height);
    const room = Math.min(cx - 10, (height - top - bottom) / 2) - ring - 10;
    // The hub keeps its pixel size, so only the part of the tree beyond the hub edge scales.
    const treeScale = clamp((room - LAYOUT.hubRadius) / (baseReach - LAYOUT.hubRadius), 0.36, 1);
    const anchorY = height - (mobile ? 118 : 128);
    const focusLayout = focusLayouts[focusIndex];
    let focusFit = 1;
    let focusBounds: Bounds | null = null;
    let anchorX = 0;
    if (focusLayout) {
      const b = focusLayout.bounds;
      // On a phone the tree is wider than the screen, so centre the tree rather than the hub.
      const halfWidth = (mobile ? (b.maxX - b.minX) / 2 : Math.max(-b.minX, b.maxX)) + 70;
      const tall = -b.minY + 92;
      focusFit = clamp(Math.min((cx - (mobile ? 8 : 24)) / halfWidth, (anchorY - top - 8) / tall), 0.5, 1.1);
      anchorX = mobile ? (-(b.minX + b.maxX) / 2) * focusFit : 0;
      focusBounds = {
        minX: anchorX + b.minX * focusFit,
        maxX: anchorX + b.maxX * focusFit,
        minY: anchorY - cy + b.minY * focusFit,
        maxY: anchorY - cy,
      };
    }
    return {
      ready: width > 0 && height > 0,
      width,
      height,
      mobile,
      cx,
      cy,
      ring,
      brain: ring * 0.5,
      // Geometry is in world units; the tree shrinks to fit rather than run under the chrome.
      // Rounded so a resize does not re-solve six layouts on every pixel.
      treeScale: Math.round(treeScale * 50) / 50,
      stripGap: clamp(width / 4.2, 150, 300),
      stripY: (height - top - bottom) * 0.16,
      anchor: { x: anchorX, y: anchorY - cy },
      focusFit,
      focusBounds,
    };
  }, [size, baseReach, focusLayouts, focusIndex]);

  const overview = useMemo(
    () => departments.map((dept) => layoutSector(dept, { hubRadius: LAYOUT.hubRadius / geometry.treeScale })),
    [departments, geometry.treeScale],
  );

  const geometryRef = useRef(geometry);
  const focusIndexRef = useRef(focusIndex);

  const apply = useCallback(() => {
    const g = geometryRef.current;
    if (!g.ready) return;
    const rotation = rot.get();
    const u = unroll.get();
    const offset = slide.get();
    const f = focusT.get();
    let focusHub: Point = { x: 0, y: g.ring };

    for (let i = 0; i < count; i++) {
      const degrees = 90 + i * step + rotation;
      const cos = Math.cos(degrees * DEG);
      const sin = Math.sin(degrees * DEG);
      const x = lerp(cos * g.ring, (i - offset) * g.stripGap, u);
      const y = lerp(sin * g.ring, g.stripY, u);
      // Trees are laid out growing up; +90 turns "up" into "away from the ring centre".
      const turn = fold(degrees + 90) * (1 - u);
      sectorRefs.current[i]?.setAttribute(
        'transform',
        `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${turn.toFixed(2)}) scale(${g.treeScale.toFixed(4)})`,
      );
      glyphRefs.current[i]?.setAttribute('transform', `rotate(${(-turn).toFixed(2)})`);

      // Labels sit beside the hub on the side facing away from the ring's vertical axis,
      // so their text always runs outward and never across the brain.
      const side = cos < -0.1 ? -1 : 1;
      const flip = -sin * side < 0 ? -1 : 1;
      const tx = -sin * flip;
      const ty = cos * flip;
      const label = labelRefs.current[i];
      if (label) {
        const lx = lerp(cos * g.ring + tx * 44 + cos * 8, x, u);
        const ly = lerp(sin * g.ring + ty * 44 + sin * 8 - 3, y + 48, u);
        label.setAttribute('transform', `translate(${lx.toFixed(2)} ${ly.toFixed(2)})`);
        label.setAttribute('text-anchor', u > 0.5 ? 'middle' : side > 0 ? 'start' : 'end');
        // Taglines are wider than the gap between strip hubs; they return when the ring re-forms.
        label.style.setProperty('--tagline', String(clamp(1 - 2.5 * u, 0, 1)));
      }

      const spoke = spokeRefs.current[i];
      if (spoke) {
        spoke.setAttribute('x1', (cos * (g.ring - LAYOUT.hubRadius)).toFixed(2));
        spoke.setAttribute('y1', (sin * (g.ring - LAYOUT.hubRadius)).toFixed(2));
        spoke.setAttribute('x2', (cos * g.brain).toFixed(2));
        spoke.setAttribute('y2', (sin * g.brain).toFixed(2));
        spoke.style.opacity = String(0.16 * clamp(1 - 3 * u, 0, 1));
      }
      if (i === focusIndexRef.current) focusHub = { x, y };
    }

    // The fly-in: the overview scales up around the focused hub while that hub travels to the
    // bottom-centre anchor and the focus tree grows out of it.
    const k = 1 + 1.4 * f;
    const hx = lerp(focusHub.x, g.anchor.x, f);
    const hy = lerp(focusHub.y, g.anchor.y, f);
    const overviewLayer = overviewRef.current;
    if (overviewLayer) {
      overviewLayer.setAttribute(
        'transform',
        `translate(${(hx - k * focusHub.x).toFixed(2)} ${(hy - k * focusHub.y).toFixed(2)}) scale(${k.toFixed(4)})`,
      );
      overviewLayer.style.opacity = String(1 - smooth(0.05, 0.6, f));
      overviewLayer.style.visibility = f > 0.995 ? 'hidden' : 'visible';
      overviewLayer.style.pointerEvents = f > 0.2 ? 'none' : 'auto';
    }
    const focusLayer = focusRef.current;
    if (focusLayer) {
      focusLayer.setAttribute(
        'transform',
        `translate(${g.anchor.x.toFixed(2)} ${g.anchor.y.toFixed(2)}) scale(${(g.focusFit * (0.5 + 0.5 * f)).toFixed(4)})`,
      );
      focusLayer.style.opacity = String(smooth(0.3, 1, f));
      focusLayer.style.pointerEvents = f > 0.8 ? 'auto' : 'none';
    }
    if (brainRef.current) brainRef.current.style.opacity = String(1 - 0.85 * u);
    if (watermarkRef.current) watermarkRef.current.style.opacity = String(0.05 * f);
    cameraRef.current?.setAttribute(
      'transform',
      `translate(${(g.cx + panX.get()).toFixed(2)} ${(g.cy + panY.get()).toFixed(2)}) scale(${zoom.get().toFixed(4)})`,
    );
  }, [count, step, rot, unroll, slide, focusT, panX, panY, zoom]);

  // Runs after every render so new geometry and freshly mounted nodes are positioned before paint.
  useIsomorphicLayoutEffect(() => {
    geometryRef.current = geometry;
    focusIndexRef.current = focusIndex;
    apply();
  });

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    const stops = [rot, unroll, slide, focusT, panX, panY, zoom].map((value) => value.on('change', schedule));
    return () => {
      cancelAnimationFrame(frame);
      stops.forEach((stop) => stop());
    };
  }, [apply, rot, unroll, slide, focusT, panX, panY, zoom]);

  // Rotate the ring so the active sector lands at 6 o'clock.
  useEffect(() => {
    let delta = active - previousActive.current;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    previousActive.current = active;
    rotationTarget.current -= delta * step;
    if (reduced) {
      rot.jump(rotationTarget.current);
      slide.jump(active);
    } else {
      rot.set(rotationTarget.current);
      slide.set(active);
    }
  }, [active, count, step, reduced, rot, slide]);

  // Cycling from the overview unrolls the ring into a strip, then re-forms it once idle.
  const firstStrip = useRef(strip);
  useEffect(() => {
    if (strip === firstStrip.current || reduced) return;
    const out = animate(unroll, 1, { duration: 0.42, ease: 'easeInOut' });
    const timer = window.setTimeout(() => {
      animate(unroll, 0, { duration: 0.56, ease: 'easeInOut' });
    }, MOTION.stripIdle);
    return () => {
      out.stop();
      window.clearTimeout(timer);
    };
  }, [strip, reduced, unroll]);

  useEffect(() => {
    const duration = (reduced ? MOTION.reduced : MOTION.fly) / 1000;
    const options = { duration, ease: 'easeInOut' } as const;
    if (focusId) {
      setLingering(focusId);
      // A strip in flight would fight the fly-in.
      unroll.set(0);
      const controls = [animate(focusT, 1, options), animate(panX, 0, options), animate(panY, 0, options), animate(zoom, 1, options)];
      return () => controls.forEach((control) => control.stop());
    }
    const controls = [
      animate(focusT, 0, { ...options, onComplete: () => setLingering(null) }),
      animate(panX, 0, options),
      animate(panY, 0, options),
      animate(zoom, 1, options),
    ];
    return () => controls.forEach((control) => control.stop());
  }, [focusId, reduced, focusT, panX, panY, zoom, unroll]);

  const setCamera = useCallback(
    (next: Camera) => {
      const g = geometryRef.current;
      const pan = g.focusBounds
        ? clampPan({ x: next.x, y: next.y }, next.zoom, g.focusBounds, g, { x: g.cx, y: g.cy }, 80)
        : { x: next.x, y: next.y };
      zoom.set(next.zoom);
      panX.set(pan.x);
      panY.set(pan.y);
    },
    [panX, panY, zoom],
  );

  // Search: fly to the job. Declared after the focus effect so it wins over that effect's camera reset.
  useEffect(() => {
    if (!fly) return;
    const g = geometryRef.current;
    const index = departments.findIndex((dept) => dept.jobs.some((job) => job.id === fly.jobId));
    const node = focusLayouts[index]?.nodes.find((candidate) => candidate.id === fly.jobId);
    if (!node || !g.ready || !g.focusBounds || index !== focusIndexRef.current) return;
    const targetZoom = clamp(0.95 / g.focusFit, 1, 1.9);
    const world = { x: g.anchor.x + node.x * g.focusFit, y: g.anchor.y + node.y * g.focusFit };
    // Aim left of the job panel on wide screens, above the bottom sheet on narrow ones.
    const aim = g.mobile
      ? { x: g.width / 2, y: g.height * 0.12 }
      : { x: clamp((g.width - Math.min(720, g.width)) / 2, 180, g.width / 2), y: g.height * 0.46 };
    const pan = clampPan(
      { x: aim.x - g.cx - targetZoom * world.x, y: aim.y - g.cy - targetZoom * world.y },
      targetZoom,
      g.focusBounds,
      g,
      { x: g.cx, y: g.cy },
      40,
    );
    const options = { duration: (reduced ? MOTION.reduced : MOTION.fly) / 1000, ease: 'easeInOut' } as const;
    const controls = [animate(zoom, targetZoom, options), animate(panX, pan.x, options), animate(panY, pan.y, options)];
    return () => controls.forEach((control) => control.stop());
  }, [fly, departments, focusLayouts, reduced, panX, panY, zoom]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !focusId) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const g = geometryRef.current;
      const box = svg.getBoundingClientRect();
      setCamera(
        zoomAt(
          { x: panX.get(), y: panY.get(), zoom: zoom.get() },
          { x: event.clientX - box.left, y: event.clientY - box.top },
          Math.exp(-event.deltaY * 0.0015),
          { x: g.cx, y: g.cy },
          ZOOM_MIN,
          ZOOM_MAX,
        ),
      );
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [focusId, panX, panY, zoom, setCamera]);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ moved: false, travel: 0, pinch: 0 });

  const local = (event: PointerEvent<SVGSVGElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!focusId) return;
    pointers.current.set(event.pointerId, local(event));
    const points = [...pointers.current.values()];
    gesture.current = {
      moved: false,
      travel: 0,
      pinch: points.length === 2 ? Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y) : 0,
    };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const g = geometryRef.current;
    const camera = { x: panX.get(), y: panY.get(), zoom: zoom.get() };
    const points = [...pointers.current.values()];

    if (points.length === 2 && gesture.current.pinch > 0) {
      const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
      const middle = { x: (points[0]!.x + points[1]!.x) / 2, y: (points[0]!.y + points[1]!.y) / 2 };
      setCamera(zoomAt(camera, middle, distance / gesture.current.pinch, { x: g.cx, y: g.cy }, ZOOM_MIN, ZOOM_MAX));
      gesture.current.pinch = distance;
      gesture.current.moved = true;
      return;
    }

    gesture.current.travel += Math.hypot(point.x - previous.x, point.y - previous.y);
    // A few pixels of slack so a click on a node is not mistaken for a drag.
    if (!gesture.current.moved && gesture.current.travel < 4) return;
    if (!gesture.current.moved) {
      gesture.current.moved = true;
      // Capture only once a drag is certain; capturing on pointerdown would steal node clicks.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setCamera({ ...camera, x: camera.x + point.x - previous.x, y: camera.y + point.y - previous.y });
  };

  const onPointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onClickCapture = (event: MouseEvent<SVGSVGElement>) => {
    if (!gesture.current.moved) return;
    gesture.current.moved = false;
    event.stopPropagation();
  };

  const focusDept = departments[focusIndex];
  const focusLayout = focusLayouts[focusIndex];

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        className="map-svg h-full w-full"
        role="group"
        aria-label={ui.overview.mapLabel}
        style={{ cursor: focusId ? 'grab' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id="half-left">
            <rect x={-18} y={-18} width={18} height={36} />
          </clipPath>
          <clipPath id="half-right">
            <rect x={0} y={-18} width={18} height={36} />
          </clipPath>
        </defs>

        {geometry.ready && (
          <>
            <text
              ref={watermarkRef}
              className="sector-name"
              aria-hidden="true"
              x={geometry.cx}
              y={geometry.cy + geometry.height * 0.06}
              textAnchor="middle"
              // ~22vw as specified, capped so a long sector name still fits the viewport.
              fontSize={Math.min(geometry.width * 0.22, (geometry.width * 1.04) / ((focusDept?.name.length ?? 1) * 0.9))}
              fill={TOKENS.ink}
              style={{ opacity: 0 }}
            >
              {focusDept?.name}
            </text>

            <motion.g ref={cameraRef}>
              <g ref={overviewRef} aria-hidden={focusId ? true : undefined}>
                {departments.map((dept, i) => (
                  <line
                    key={dept.id}
                    ref={(element) => void (spokeRefs.current[i] = element)}
                    stroke={TOKENS.ink}
                    strokeWidth={0.6}
                  />
                ))}
                <g ref={brainRef}>
                  <BrainCore radius={geometry.brain} colors={colors} />
                </g>
                {departments.map((dept, i) => (
                  <g
                    key={dept.id}
                    ref={(element) => void (sectorRefs.current[i] = element)}
                    className="sector"
                    style={{ opacity: i === active ? 1 : 0.55 }}
                  >
                    <SectorTree
                      department={dept}
                      layout={overview[i]!}
                      variant="overview"
                      open={open.includes(dept.id)}
                      scale={geometry.treeScale}
                      statuses={statuses}
                      selectedId={selectedId}
                      interactive={!focusId}
                      glyphRef={setGlyph[i]}
                      onSelect={onSelect}
                      onToggle={onToggle}
                      onFocus={onFocus}
                    />
                  </g>
                ))}
                {departments.map((dept, i) => (
                  <g
                    key={dept.id}
                    ref={(element) => void (labelRefs.current[i] = element)}
                    aria-hidden="true"
                    // Six 150px labels cannot sit beside a ring 170px across; phones keep the active one.
                    style={{ opacity: geometry.mobile && i !== active ? 0 : 1, transition: 'opacity 300ms ease' }}
                  >
                    <text
                      className="sector-name"
                      fontSize={geometry.mobile ? 11 : 13}
                      fill={i === active ? dept.color : TOKENS.ink}
                    >
                      {dept.name}
                    </text>
                    {!geometry.mobile && (
                      <text className="svg-micro sector-tagline" y={14} fontSize={8.5} fill={TOKENS.inkDim}>
                        {dept.tagline}
                      </text>
                    )}
                  </g>
                ))}
              </g>

              <g ref={focusRef} style={{ opacity: 0 }}>
                {focusDept && focusLayout && (
                  <g key={focusDept.id} className="fade-in">
                    {ORBITS.map((radius) => (
                      <path
                        key={radius}
                        d={`M${(Math.cos(-172 * DEG) * radius).toFixed(1)} ${(Math.sin(-172 * DEG) * radius).toFixed(1)}A${radius} ${radius} 0 0 1 ${(Math.cos(-8 * DEG) * radius).toFixed(1)} ${(Math.sin(-8 * DEG) * radius).toFixed(1)}`}
                        fill="none"
                        stroke={TOKENS.ink}
                        strokeWidth={1}
                        opacity={0.07}
                      />
                    ))}
                    <SectorTree
                      department={focusDept}
                      layout={focusLayout}
                      variant="focus"
                      open
                      scale={1}
                      statuses={statuses}
                      selectedId={selectedId}
                      interactive={Boolean(focusId)}
                      onSelect={onSelect}
                    />
                  </g>
                )}
              </g>
            </motion.g>
          </>
        )}
      </svg>
    </div>
  );
}
