import { describe, it, expect, vi } from 'vitest';
import type { PoseAnalysis } from './types';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
});
vi.stubGlobal('window', { dispatchEvent: () => true });
const { poseReviewChannel, buildReviewPayload, reviewFor, readReviews } = await import('./poseReview');

const A = 'aaaaaaaa-1111-2222-3333-444444444444.jpg';
const B = 'bbbbbbbb-1111-2222-3333-444444444444.jpg';
const session = (file_name: string, form: number): PoseAnalysis => ({
  id: 1, media_id: 1, athlete_id: 1, source: 'geometry', pose_type: 'fdb', form_score: form, symmetry_score: 80,
  ref_match_score: 60, confidence: 0.9, metrics: null, landmarks: [{ x: 0.51234, y: 0.5, z: 0, visibility: 0.99 }],
  created_at: '2026-11-01 10:00:00', captured_at: '2026-11-01', file_name,
});
const sessions = [session(A, 72), session(B, 64)];
const reply = {
  requestHash: 'x',
  reviews: [
    { sessionId: A, grade: 'B+', summary: 'Good taper.', strengths: ['lats'], fixes: ['level the hips'], next: 'drill hip level' },
    { sessionId: B, grade: 'C', summary: 'Shoulders tilt.', strengths: [], fixes: ['shoulders'], next: 'mirror work' },
    { sessionId: 'not-ours.jpg', grade: 'A', summary: 'ignored' },
    { sessionId: '__proto__', grade: 'A', summary: 'ignored' },
    { sessionId: A, grade: '<script>', summary: 'bad grade, dropped' },
  ],
};

describe('pose-review channel (AI grade beside the app score)', () => {
  it('requests only unreviewed geometry sessions, with raw detail and the app score', () => {
    const p = buildReviewPayload(null, sessions);
    expect(p.sessions.map((s) => s.sessionId)).toEqual([A, B]);
    expect(p.sessions[0].appScore.form).toBe(72);
    expect(p.sessions[0].landmarks[0]).toEqual([0.512, 0.5, 0, 0.99]);
  });

  it('previews one row per known session, ignores unknown or malformed ones', async () => {
    const rows = await poseReviewChannel(() => sessions).preview(reply);
    expect(rows.map((r) => r.id)).toEqual([A, B]);
    expect(rows[0].label).toMatch(/grade B\+ \(app form 72\)/);
  });

  it('applies only the ticked rows, keeps the app score, and undo removes the review', async () => {
    const ch = poseReviewChannel(async () => sessions);
    const res = await ch.apply(reply, [A]);
    expect(reviewFor(A)).toMatchObject({ grade: 'B+', fixes: ['level the hips'] });
    expect(reviewFor(B)).toBeNull();
    expect(sessions[0].form_score).toBe(72); // the app's own score is never replaced
    expect(buildReviewPayload(null, sessions).sessions.map((s) => s.sessionId)).toEqual([B]); // A is done

    ch.undo(JSON.parse(JSON.stringify(res.undo))); // undo data must survive JSON
    expect(reviewFor(A)).toBeNull();
    expect(Object.keys(readReviews())).toEqual([]);
  });
});
