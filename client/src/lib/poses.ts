import type { Category, Theme } from './types';

export interface PoseDef {
  id: string;
  label: string;
  group: 'men' | 'women';
  facing: 'front' | 'back' | 'side';
  /** Whether left/right symmetry is a primary judging criterion (weights scoring). */
  symmetric: boolean;
  reveals: string;
  judgeSees: string;
  cues: string[];
}

/** Men's mandatory poses — criteria from "The Sandow Plates". */
export const MENS_POSES: PoseDef[] = [
  {
    id: 'fdb',
    label: 'Front Double Biceps',
    group: 'men',
    facing: 'front',
    symmetric: true,
    reveals: 'The complete front: arms, delts, chest, quads, symmetry.',
    judgeSees: 'Overall front development and left-to-right balance — the signature opening statement.',
    cues: ['Plant feet shoulder-width; flare the lats wide', 'Curl both arms and "screw" the fists to peak the biceps', 'Drop the traps, lift the chest, crunch the abs on the exhale'],
  },
  {
    id: 'fls',
    label: 'Front Lat Spread',
    group: 'men',
    facing: 'front',
    symmetric: true,
    reveals: 'Back width from the front — the cobra-hood "V" taper.',
    judgeSees: 'Shoulder-to-waist taper and the dramatic flare of the lats.',
    cues: ['Set thumbs on the lower waist, elbows driven forward', 'Push the lats out and down to open the hood', 'Keep the waist tight and the chest high'],
  },
  {
    id: 'chest',
    label: 'Side Chest',
    group: 'men',
    facing: 'side',
    symmetric: false,
    reveals: 'Pec thickness, biceps, and the calf & hamstring of the bent leg.',
    judgeSees: 'Depth of the chest and the clean line of the whole side.',
    cues: ['Turn your best side to the judges', 'Bend the front knee and raise the heel to flex the calf', 'Grip the wrist, press the arms together, and inflate the chest'],
  },
  {
    id: 'triceps',
    label: 'Side Triceps',
    group: 'men',
    facing: 'side',
    symmetric: false,
    reveals: 'The triceps horseshoe, side chest, and leg.',
    judgeSees: 'Arm development and density down the visible side.',
    cues: ['Present your best arm; lock it straight and slightly back', 'Let the other hand grip the wrist and pull to extend', 'Bend the front leg and push the triceps hard'],
  },
  {
    id: 'bdb',
    label: 'Rear Double Biceps',
    group: 'men',
    facing: 'back',
    symmetric: true,
    reveals: 'Back detail, glutes, hamstrings, calves — the "Christmas tree" lower back.',
    judgeSees: 'Thickness and detail of the entire posterior chain.',
    cues: ["Mirror the front pose — but you're blind, so learn it by feel", 'Flare the lats and flex one calf with the heel raised', 'Squeeze everything from traps to glutes at once'],
  },
  {
    id: 'bls',
    label: 'Rear Lat Spread',
    group: 'men',
    facing: 'back',
    symmetric: true,
    reveals: 'Back width and lat sweep seen straight on.',
    judgeSees: 'How wide the back opens and how it tapers to the waist.',
    cues: ['Hands on the waist, elbows forward', 'Spread the lats as wide as they will go', 'Set one foot back with the calf flexed'],
  },
  {
    id: 'abs',
    label: 'Abdominals & Thighs',
    group: 'men',
    facing: 'front',
    symmetric: true,
    reveals: 'Midsection conditioning, serratus, and quad separation.',
    judgeSees: 'How hard and detailed the abs and front legs are.',
    cues: ['Hands behind the head; exhale fully', 'Crunch the abs down and in', 'Push one leg forward and flex the quad'],
  },
  {
    id: 'mm',
    label: 'Most Muscular',
    group: 'men',
    facing: 'front',
    symmetric: false,
    reveals: 'Raw mass and density — traps, arms, chest, the whole frame.',
    judgeSees: 'Sheer muscularity; often the showstopper of the posedown.',
    cues: ['Round and drop the shoulders forward', 'Drive the hands toward the center and clasp', 'Crunch the entire body into one dense knot'],
  },
];

/** Women's divisions — criteria from "The Atalanta Plates". */
export const WOMENS_POSES: PoseDef[] = [
  {
    id: 'bikiniFront',
    label: 'Bikini — Front',
    group: 'women',
    facing: 'front',
    symmetric: false,
    reveals: 'Balance, proportion, athletic shape, glute–hamstring tie-in, tone, presence — not size or hardness.',
    judgeSees: 'A confident S-curve with the hip popped; one long line from crown to heel.',
    cues: ['Pop the hip and shift weight to draw the S-curve', 'Long neck; shoulders back and down; soft, confident face', 'Keep the line long — never let posture collapse'],
  },
  {
    id: 'backPose',
    label: 'Back Pose (Bikini / Wellness)',
    group: 'women',
    facing: 'back',
    symmetric: false,
    reveals: 'Glute and hamstring development; for Wellness, greater lower-body mass vs a tighter upper body.',
    judgeSees: 'A gentle arch presenting the glutes with a proud, upright torso.',
    cues: ['Arch just enough — never force it', 'Carry leg mass with an upright torso', 'The back pose often decides placings — sell it cleanly'],
  },
  {
    id: 'figureFront',
    label: 'Figure — Front',
    group: 'women',
    facing: 'front',
    symmetric: true,
    reveals: 'Symmetry, shape, firm tone — the coveted "X-frame": capped delts, wide back, small waist.',
    judgeSees: 'The X-frame stretched tall from crown to heel.',
    cues: ['Hands on the waist; drive elbows out and slightly forward', 'Stand tall to stretch the frame', 'Sharp, deliberate quarter turns'],
  },
  {
    id: 'wpFDB',
    label: "Women's Physique — Front Double Biceps",
    group: 'women',
    facing: 'front',
    symmetric: true,
    reveals: 'Muscularity, symmetry, and conditioning balanced by grace and presentation.',
    judgeSees: 'Full tension held with flow and a lengthened, graceful line.',
    cues: ['Flex with full tension, but flow between poses', 'Extend the fingers and lengthen the line to soften it', 'Let the routine breathe and build'],
  },
];

export const ALL_POSES: PoseDef[] = [...MENS_POSES, ...WOMENS_POSES];

const CATEGORY_META: Record<Category, { label: string; theme: Theme; group: 'men' | 'women' }> = {
  men_bodybuilding: { label: "Men's Bodybuilding", theme: 'ink', group: 'men' },
  classic_physique: { label: 'Classic Physique', theme: 'ink', group: 'men' },
  mens_physique: { label: "Men's Physique", theme: 'ink', group: 'men' },
  bikini: { label: 'Bikini', theme: 'marble', group: 'women' },
  wellness: { label: 'Wellness', theme: 'marble', group: 'women' },
  figure: { label: 'Figure', theme: 'marble', group: 'women' },
  womens_physique: { label: "Women's Physique", theme: 'marble', group: 'women' },
  womens_bodybuilding: { label: "Women's Bodybuilding", theme: 'marble', group: 'women' },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export function categoryLabel(c: Category): string {
  return CATEGORY_META[c]?.label ?? c;
}
export function themeFor(c: Category): Theme {
  return CATEGORY_META[c]?.theme ?? 'ink';
}

/** Poses relevant to an athlete's category. */
export function posesForCategory(c: Category): PoseDef[] {
  return CATEGORY_META[c]?.group === 'women' ? WOMENS_POSES : MENS_POSES;
}

export function findPose(id: string | null | undefined): PoseDef | undefined {
  if (!id) return undefined;
  return ALL_POSES.find((p) => p.id === id);
}

export function poseLabel(id: string | null | undefined): string {
  return findPose(id)?.label ?? (id ? id : 'Untagged');
}
