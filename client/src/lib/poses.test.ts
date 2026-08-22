import { describe, it, expect } from 'vitest';
import { ALL_POSES, CATEGORIES, posesForCategory, findPose, poseLabel } from './poses';
import { renderPoseSVG } from './poseDiagram';

describe('pose library', () => {
  it('has unique ids', () => {
    const ids = ALL_POSES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all divisions with a non-empty, resolvable mandatory list', () => {
    for (const c of CATEGORIES) {
      const poses = posesForCategory(c);
      expect(poses.length, c).toBeGreaterThan(0);
      // Every id in the division list resolved to a real PoseDef (none were dropped).
      for (const p of poses) expect(findPose(p.id)).toBe(p);
    }
  });

  it('gives every division its judged pose count', () => {
    expect(posesForCategory('men_bodybuilding')).toHaveLength(8);
    expect(posesForCategory('classic_physique')).toHaveLength(6);
    expect(posesForCategory('mens_physique')).toHaveLength(3);
    expect(posesForCategory('bikini')).toHaveLength(3);
    expect(posesForCategory('wellness')).toHaveLength(3);
    expect(posesForCategory('figure')).toHaveLength(3);
    expect(posesForCategory('womens_physique')).toHaveLength(5);
    expect(posesForCategory('womens_bodybuilding')).toHaveLength(8);
  });

  it('renders a reference diagram for every pose', () => {
    for (const p of ALL_POSES) {
      const svg = renderPoseSVG(p.id);
      expect(svg, p.id).toContain('<svg');
    }
  });

  it('every pose carries complete coaching content', () => {
    for (const p of ALL_POSES) {
      expect(p.label.length, p.id).toBeGreaterThan(3);
      expect(p.reveals.length, p.id).toBeGreaterThan(10);
      expect(p.judgeSees.length, p.id).toBeGreaterThan(10);
      expect(p.cues.length, p.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('poseLabel falls back to the raw id for unknown poses', () => {
    expect(poseLabel('fdb')).toBe('Front Double Biceps');
    expect(poseLabel('nope')).toBe('nope');
    expect(poseLabel(null)).toBe('Untagged');
  });
});
