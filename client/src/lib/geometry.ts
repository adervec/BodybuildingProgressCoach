import type { Landmark, PoseMetrics } from './types';
import type { PoseDef } from './poses';
import { clamp, round } from './format';

/** BlazePose / MediaPipe Pose 33-landmark indices we use. */
export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const;

/** Skeleton edges for overlay drawing. */
export const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

/**
 * Ideal joint angles ported from the guides' figure renderers (the `POSES`
 * objects). Convention: 0° = straight down, positive = toward viewer-right —
 * identical to the guides' `P(x,y,a,len)` helper. These are stylized targets,
 * so "reference-form match" is treated as directional, not absolute.
 */
interface GeomSpec {
  ulA: number; flA: number; urA: number; frA: number;
  tlA: number; trA: number;
}
const POSE_GEOM: Record<string, GeomSpec> = {
  fdb: { ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, trA: 7 },
  fls: { ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, trA: 7 },
  abs: { ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -5, trA: 16 },
  bdb: { ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, trA: 7 },
  bls: { ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, trA: 7 },
  mm: { ulA: -42, flA: 52, urA: 42, frA: -52, tlA: -9, trA: 9 },
  wpFDB: { ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, trA: 7 },
  vacuum: { ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -7, trA: 7 },
  wpRDB: { ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, trA: 7 },
  wpAbsThighs: { ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -5, trA: 16 },
  figureFront: { ulA: -18, flA: 39, urA: 18, frA: -39, tlA: -5, trA: 5 },
  figureBack: { ulA: -18, flA: 39, urA: 18, frA: -39, tlA: -5, trA: 5 },
};

type Pt = { x: number; y: number; v: number };

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Guide convention angle of segment a→b: 0° = down, + = toward right. */
export function segAngle(a: Pt, b: Pt): number {
  return (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
}

/** Interior angle at vertex b formed by a-b-c, in degrees (0–180). */
export function interiorAngle(a: Pt, b: Pt, c: Pt): number {
  const u = { x: a.x - b.x, y: a.y - b.y };
  const v = { x: c.x - b.x, y: c.y - b.y };
  const dot = u.x * v.x + u.y * v.y;
  const mag = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (mag === 0) return 0;
  return (Math.acos(clamp(dot / mag, -1, 1)) * 180) / Math.PI;
}

/** Smallest absolute difference between two angles, in degrees. */
export function angularDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Tilt of segment a→b away from horizontal (0 = perfectly level). */
function tiltFromHorizontal(a: Pt, b: Pt): number {
  let t = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  if (t > 90) t = 180 - t;
  return t;
}

export interface GeometryResult {
  metrics: PoseMetrics;
  form_score: number | null;
  symmetry_score: number | null;
  ref_match_score: number | null;
  confidence: number;
}

/**
 * Compute objective metrics + scores from detected landmarks.
 * `width`/`height` are the source image pixel dimensions (landmarks are normalized).
 */
export function analyzePose(
  landmarks: Landmark[],
  width: number,
  height: number,
  pose: PoseDef | undefined
): GeometryResult {
  const P = (i: number): Pt => ({ x: landmarks[i].x * width, y: landmarks[i].y * height, v: landmarks[i].visibility });

  const lSh = P(LM.lShoulder), rSh = P(LM.rShoulder);
  const lHip = P(LM.lHip), rHip = P(LM.rHip);
  const lEl = P(LM.lElbow), rEl = P(LM.rElbow);
  const lWr = P(LM.lWrist), rWr = P(LM.rWrist);
  const lKn = P(LM.lKnee), rKn = P(LM.rKnee);
  const lAn = P(LM.lAnkle), rAn = P(LM.rAnkle);

  const shoulderMid = { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2, v: 1 };
  const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2, v: 1 };
  const scaleUnit = dist(shoulderMid, hipMid) || 1;

  // Objective proportions (scale-normalized — robust to camera distance).
  const shoulderWidth = round(dist(lSh, rSh) / scaleUnit, 2);
  const hipWidth = round(dist(lHip, rHip) / scaleUnit, 2);
  const vTaper = round(shoulderWidth / (hipWidth || 1), 2);

  // Confidence from landmark visibility.
  const keyPts = [lSh, rSh, lEl, rEl, lWr, rWr, lHip, rHip, lKn, rKn];
  const confidence = round(clamp(keyPts.reduce((s, p) => s + (p.v ?? 0), 0) / keyPts.length, 0, 1), 2);

  // Symmetry (magnitude-based, side-agnostic).
  const shoulderTilt = tiltFromHorizontal(lSh, rSh);
  const hipTilt = tiltFromHorizontal(lHip, rHip);
  const armElevationDiff = Math.abs(Math.abs(segAngle(lSh, lEl)) - Math.abs(segAngle(rSh, rEl)));
  const elbowAngleDiff = Math.abs(interiorAngle(lSh, lEl, lWr) - interiorAngle(rSh, rEl, rWr));
  const legAngleDiff = Math.abs(interiorAngle(lHip, lKn, lAn) - interiorAngle(rHip, rKn, rAn));

  const symmetryScore = round(
    clamp(100 - (shoulderTilt * 1.2 + hipTilt * 1.0 + armElevationDiff * 0.5 + elbowAngleDiff * 0.35 + legAngleDiff * 0.3)),
    0
  );

  const notes: string[] = [];

  // Reference-form match vs the guide's ideal angles (where a spec exists).
  let refMatch: PoseMetrics['refMatch'] = null;
  let refScore: number | null = null;
  const spec = pose ? POSE_GEOM[pose.id] : undefined;
  if (spec) {
    // Map measured limbs to the guide's L/R by viewer x-position.
    const leftIsViewerLeft = lSh.x <= rSh.x;
    const vL = leftIsViewerLeft
      ? { sh: lSh, el: lEl, wr: lWr, hip: lHip, kn: lKn }
      : { sh: rSh, el: rEl, wr: rWr, hip: rHip, kn: rKn };
    const vR = leftIsViewerLeft
      ? { sh: rSh, el: rEl, wr: rWr, hip: rHip, kn: rKn }
      : { sh: lSh, el: lEl, wr: lWr, hip: lHip, kn: lKn };

    const perLimb = [
      { name: 'Upper arm (L)', measured: segAngle(vL.sh, vL.el), ideal: spec.ulA },
      { name: 'Forearm (L)', measured: segAngle(vL.el, vL.wr), ideal: spec.flA },
      { name: 'Upper arm (R)', measured: segAngle(vR.sh, vR.el), ideal: spec.urA },
      { name: 'Forearm (R)', measured: segAngle(vR.el, vR.wr), ideal: spec.frA },
      { name: 'Thigh (L)', measured: segAngle(vL.hip, vL.kn), ideal: spec.tlA },
      { name: 'Thigh (R)', measured: segAngle(vR.hip, vR.kn), ideal: spec.trA },
    ].map((l) => ({ ...l, measured: round(l.measured, 0), diff: round(angularDiff(l.measured, l.ideal), 0) }));

    const avgDiff = perLimb.reduce((s, l) => s + l.diff, 0) / perLimb.length;
    refScore = round(clamp(100 - avgDiff * 1.0), 0);
    refMatch = { score: refScore, perLimb };
    notes.push('Reference-form match compares your joint angles to the guide’s stylized ideal — read it as directional, not absolute.');
  }

  // Composite form score with honest handling of poses we can’t fairly score by geometry.
  let formScore: number | null = null;
  if (pose) {
    if (pose.symmetric && refScore != null) {
      formScore = round(0.45 * symmetryScore + 0.45 * refScore + 0.1 * confidence * 100);
    } else if (pose.symmetric) {
      formScore = round(0.75 * symmetryScore + 0.25 * confidence * 100);
    } else if (refScore != null) {
      formScore = round(0.7 * refScore + 0.3 * confidence * 100);
    } else {
      notes.push('Side / asymmetric pose: a geometric form score isn’t computed (it would be unfair). Use AI coaching or manual review — the proportion & symmetry numbers above still apply.');
    }
  }

  if (confidence < 0.5) {
    notes.push('Low landmark confidence — improve lighting and framing, and keep the whole body in frame for a reliable read.');
  }

  const metrics: PoseMetrics = {
    scaleUnitPx: round(scaleUnit, 1),
    shoulderWidth,
    hipWidth,
    vTaper,
    symmetry: {
      score: symmetryScore,
      shoulderTilt: round(shoulderTilt, 1),
      hipTilt: round(hipTilt, 1),
      armElevationDiff: round(armElevationDiff, 1),
      elbowAngleDiff: round(elbowAngleDiff, 1),
      legAngleDiff: round(legAngleDiff, 1),
    },
    refMatch,
    confidence,
    notes,
  };

  return { metrics, form_score: formScore, symmetry_score: symmetryScore, ref_match_score: refScore, confidence };
}
