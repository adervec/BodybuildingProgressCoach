import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaAsset, Athlete, BodyComp } from './types';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
});
const { planCheckins, photosForPlans, buildCheckinPayload, checkinReviewChannel, checkinReviews, latestCheckinReview } = await import('./checkinReview');

const uuid = (n: number) => `${String(n).repeat(8)}-1111-2222-3333-444444444444.jpg`;
const athlete = { id: 1, name: 'Ada', category: 'bikini', height_cm: 165 } as Athlete;
const photo = (id: number, pose_type: string, captured_at: string) =>
  ({ id, athlete_id: 1, kind: 'photo', file_name: uuid(id), pose_type, captured_at, thumb_name: null, mime: 'image/jpeg', width: 1, height: 1, division: null, notes: null, created_at: '', url: '' }) as MediaAsset;
const media = [
  photo(1, 'bikiniFront', '2026-10-01'), // the first
  photo(2, 'bikiniFront', '2026-11-01'), // the previous
  photo(3, 'bikiniFront', '2026-11-20'), // today
  photo(4, 'backPose', '2026-11-20'),    // today, a pose with no history
];
const comp = [
  { id: 1, athlete_id: 1, measured_at: '2026-11-19', weight: 58, weight_unit: 'kg', body_fat_pct: 16, lean_mass: null, measurements: {}, source: 'manual', notes: null, created_at: '' },
  { id: 2, athlete_id: 1, measured_at: '2026-10-02', weight: 60, weight_unit: 'kg', body_fat_pct: 18, lean_mass: null, measurements: {}, source: 'manual', notes: null, created_at: '' },
] as unknown as BodyComp[];
const data = { athlete, media, comp, analyses: [] };

beforeEach(() => ls.clear());

describe('checkin-review channel: what changed, photo against earlier photo', () => {
  it('a check-in is a day with pose photos; each pose is compared with its previous and first photo, plus the nearest weigh-in', () => {
    const plans = planCheckins(data);
    expect(plans.map((p) => p.day)).toEqual(['2026-11-20', '2026-11-01', '2026-10-01']);
    const today = plans[0];
    expect(today.photos.map((m) => m.id)).toEqual([3, 4]);
    const front = today.compare.find((c) => c.pose === 'bikiniFront')!;
    expect([front.previous?.id, front.first?.id]).toEqual([2, 1]);
    expect(today.compare.find((c) => c.pose === 'backPose')).toMatchObject({ previous: null, first: null });
    expect(today.bodyComp?.measured_at).toBe('2026-11-19');
    expect(new Set(photosForPlans([today]))).toEqual(new Set([uuid(1), uuid(2), uuid(3), uuid(4)]));
  });

  it('the payload points at photos only when they went to the folder', () => {
    const p = buildCheckinPayload(data, new Set([uuid(3), uuid(2)]));
    const today = p.checkins[0];
    expect(today.photos[0].photo).toBe(`checkin-review/photos/${uuid(3)}`);
    expect(today.photos[1].photo).toBeNull();
    expect(today.compare[0].previous).toEqual({ at: '2026-11-01', photo: `checkin-review/photos/${uuid(2)}` });
    expect(buildCheckinPayload(data).photosIncluded).toBe(false);
  });

  it('validates the reply, stores it per athlete and day, and undo removes it', async () => {
    ls.set('bpc-cowork-sent', JSON.stringify({ 'checkin-review': [uuid(3)] }));
    const ch = checkinReviewChannel(async () => data);
    const reply = { requestHash: 'x', reviews: [
      { sessionId: '2026-11-20', grade: 'B', bodyFat: '15-17%', conditioning: 'Improving', improved: ['glutes'], lagging: ['delts'], summary: 'Leaner.', fixes: ['more side delt'], next: 'lateral raises' },
      { sessionId: '2026-12-25', grade: 'A', summary: 'no photos that day: dropped' },
      { sessionId: 'yesterday', grade: 'A', summary: 'not a date: dropped' },
      { sessionId: '2026-11-01', grade: 'Z', summary: 'bad grade: dropped' },
    ] };
    expect((await ch.preview(reply)).map((r) => r.id)).toEqual(['2026-11-20']);
    const res = await ch.apply(reply, ['2026-11-20']);
    expect(checkinReviews('Ada')['2026-11-20']).toMatchObject({ grade: 'B', bodyFat: '15-17%', conditioning: 'improving', lagging: ['delts'], fromPhoto: true });
    expect(latestCheckinReview('ada')?.day).toBe('2026-11-20'); // the athlete key ignores case
    expect(planCheckins(data).map((p) => p.day)).toEqual(['2026-11-01', '2026-10-01']); // reviewed days drop out

    ch.undo(JSON.parse(JSON.stringify(res.undo)));
    expect(latestCheckinReview('Ada')).toBeNull();
  });
});
