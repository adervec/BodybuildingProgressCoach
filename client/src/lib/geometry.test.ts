import { describe, it, expect } from 'vitest';
import { analyzePose, interiorAngle, angularDiff, segAngle, dist } from './geometry';
import { findPose } from './poses';
import type { Landmark } from './types';

function blank(): Landmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
}
function set(lms: Landmark[], i: number, x: number, y: number) {
  lms[i] = { x, y, z: 0, visibility: 1 };
}

/** A perfectly left/right-mirrored front double-biceps pose. */
function symmetricFDB(): Landmark[] {
  const l = blank();
  set(l, 0, 0.5, 0.3); // nose
  set(l, 11, 0.4, 0.4); // L shoulder
  set(l, 12, 0.6, 0.4); // R shoulder
  set(l, 13, 0.3, 0.3); // L elbow
  set(l, 14, 0.7, 0.3); // R elbow
  set(l, 15, 0.42, 0.22); // L wrist
  set(l, 16, 0.58, 0.22); // R wrist
  set(l, 23, 0.44, 0.62); // L hip
  set(l, 24, 0.56, 0.62); // R hip
  set(l, 25, 0.43, 0.8); // L knee
  set(l, 26, 0.57, 0.8); // R knee
  set(l, 27, 0.44, 0.96); // L ankle
  set(l, 28, 0.56, 0.96); // R ankle
  return l;
}

describe('angle helpers', () => {
  it('interiorAngle of a right angle is 90°', () => {
    expect(interiorAngle({ x: 1, y: 0, v: 1 }, { x: 0, y: 0, v: 1 }, { x: 0, y: 1, v: 1 })).toBeCloseTo(90, 4);
  });
  it('angularDiff wraps around 360', () => {
    expect(angularDiff(10, 350)).toBeCloseTo(20, 4);
    expect(angularDiff(-170, 170)).toBeCloseTo(20, 4);
  });
  it('segAngle: 0° points straight down, +90° points right', () => {
    expect(segAngle({ x: 0, y: 0, v: 1 }, { x: 0, y: 1, v: 1 })).toBeCloseTo(0, 4);
    expect(segAngle({ x: 0, y: 0, v: 1 }, { x: 1, y: 0, v: 1 })).toBeCloseTo(90, 4);
  });
  it('dist is euclidean', () => {
    expect(dist({ x: 0, y: 0, v: 1 }, { x: 3, y: 4, v: 1 })).toBeCloseTo(5, 4);
  });
});

describe('analyzePose', () => {
  const fdb = findPose('fdb');

  it('scores a mirrored pose as near-perfectly symmetric', () => {
    const out = analyzePose(symmetricFDB(), 1000, 1000, fdb);
    expect(out.symmetry_score).toBeGreaterThan(95);
    expect(out.confidence).toBeCloseTo(1, 1);
  });

  it('computes a V-taper > 1 when shoulders are wider than hips', () => {
    const out = analyzePose(symmetricFDB(), 1000, 1000, fdb);
    expect(out.metrics.vTaper).toBeGreaterThan(1);
    expect(out.metrics.shoulderWidth).toBeGreaterThan(out.metrics.hipWidth);
  });

  it('penalizes a tilted, lopsided pose', () => {
    const l = symmetricFDB();
    set(l, 12, 0.6, 0.5); // drop the right shoulder → tilt + asymmetry
    set(l, 14, 0.72, 0.46);
    const out = analyzePose(l, 1000, 1000, fdb);
    const sym = analyzePose(symmetricFDB(), 1000, 1000, fdb).symmetry_score!;
    expect(out.symmetry_score!).toBeLessThan(sym);
  });

  it('returns a form score for symmetric poses and null for untagged', () => {
    const tagged = analyzePose(symmetricFDB(), 1000, 1000, fdb);
    expect(tagged.form_score).not.toBeNull();
    const untagged = analyzePose(symmetricFDB(), 1000, 1000, undefined);
    expect(untagged.form_score).toBeNull();
  });
});
