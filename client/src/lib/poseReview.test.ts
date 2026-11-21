import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaAsset, PoseAnalysis, Athlete } from './types';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
});
const { poseReviewChannel, buildReviewPayload, pickSessions, reviewFor, readReviews } = await import('./poseReview');

const A = 'aaaaaaaa-1111-2222-3333-444444444444.jpg';
const B = 'bbbbbbbb-1111-2222-3333-444444444444.png';
const athlete = { id: 1, name: 'Ada', category: 'men_bodybuilding', height_cm: 180 } as Athlete;
const photo = (id: number, file_name: string, pose_type: string | null, captured_at: string, kind: 'photo' | 'video' = 'photo') =>
  ({ id, athlete_id: 1, kind, file_name, pose_type, captured_at, thumb_name: null, mime: 'image/jpeg', width: 1, height: 1, division: null, notes: null, created_at: '', url: '' }) as MediaAsset;
const media = [
  photo(1, A, 'fdb', '2026-11-01'),
  photo(2, B, 'fls', '2026-11-08'), // a side pose: geometry can't score it, the judge can
  photo(3, 'cccccccc-1111-2222-3333-444444444444.mp4', 'fdb', '2026-11-09', 'video'),
  photo(4, 'dddddddd-1111-2222-3333-444444444444.jpg', null, '2026-11-10'), // untagged
];
const analyses: PoseAnalysis[] = [{
  id: 9, media_id: 1, athlete_id: 1, source: 'geometry', pose_type: 'fdb', form_score: 72, symmetry_score: 80,
  ref_match_score: 60, confidence: 0.9, metrics: null, landmarks: [{ x: 0.51234, y: 0.5, z: 0, visibility: 0.99 }],
  created_at: '', captured_at: '2026-11-01', file_name: A,
}];
const data = { athlete, media, analyses, comp: [] };
const reply = {
  requestHash: 'x',
  reviews: [
    { sessionId: A, grade: 'B+', summary: 'Good taper.', strengths: ['lats'], fixes: ['level the hips'], next: 'drill hip level',
      scores: { muscularity: 12, conditioning: 6.44, symmetry: 'high' }, lagging: ['calves'] },
    { sessionId: B, grade: 'C', summary: 'Chest is flat side-on.', fixes: ['lift the chest'], next: 'mirror work' },
    { sessionId: 'not-ours.jpg', grade: 'A', summary: 'ignored' },
    { sessionId: '__proto__', grade: 'A', summary: 'ignored' },
    { sessionId: A, grade: '<script>', summary: 'bad grade, dropped' },
  ],
};

beforeEach(() => ls.clear());

describe('pose-review channel: the AI judge, beside the app score', () => {
  it('every pose-tagged photo is a session, side poses included, newest first; videos and untagged photos are not', () => {
    expect(pickSessions(data).map((m) => m.file_name)).toEqual([B, A]);
  });

  it('carries the photo path only for photos that actually went to the folder, plus geometry as a hint', () => {
    const none = buildReviewPayload(data);
    expect(none.photosIncluded).toBe(false);
    expect(none.sessions.every((s) => s.photo === null)).toBe(true);

    const p = buildReviewPayload(data, new Set([A, B]));
    expect(p.photosIncluded).toBe(true);
    const [b, a] = p.sessions;
    expect(b.photo).toBe('pose-review/photos/bbbbbbbb-1111-2222-3333-444444444444.jpg'); // re-encoded: always .jpg
    expect(b.appScore).toBeNull(); // side pose: no geometry score
    expect(a.appScore!.form).toBe(72);
    expect(a.landmarks[0]).toEqual([0.512, 0.5, 0, 0.99]);
    expect(p.athlete!.divisionName).toBeTruthy();
  });

  it('previews one row per known session, and drops unknown, malformed or unsafe entries', async () => {
    const rows = await poseReviewChannel(async () => data).preview(reply);
    expect(rows.map((r) => r.id)).toEqual([A, B]);
    expect(rows[0].label).toMatch(/grade B\+/);
  });

  it('applies only the ticked rows with clamped scores, knows whether the agent saw the photo, and undo removes it', async () => {
    ls.set('bpc-cowork-sent', JSON.stringify({ 'pose-review': [A] })); // the last request carried A's photo
    const ch = poseReviewChannel(async () => data);
    const res = await ch.apply(reply, [A]);
    expect(reviewFor(A)).toMatchObject({ grade: 'B+', fixes: ['level the hips'], lagging: ['calves'], fromPhoto: true,
      scores: { muscularity: 10, conditioning: 6.4 } });
    expect(reviewFor(A)!.scores).not.toHaveProperty('symmetry'); // not a number: dropped
    expect(reviewFor(B)).toBeNull();
    expect(analyses[0].form_score).toBe(72); // the app's own score is never replaced
    expect(pickSessions(data).map((m) => m.file_name)).toEqual([B]); // A is done

    ch.undo(JSON.parse(JSON.stringify(res.undo))); // undo data must survive JSON
    expect(reviewFor(A)).toBeNull();
    expect(Object.keys(readReviews())).toEqual([]);
  });
});
