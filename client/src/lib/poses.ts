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
  {
    id: 'vacuum',
    label: 'Vacuum Pose',
    group: 'men',
    facing: 'front',
    symmetric: true,
    reveals: 'The Golden-Era waistline — a midsection pulled in under the ribcage.',
    judgeSees: 'How small the waist can get against the width of the frame; control, not just size.',
    cues: ['Exhale everything, then pull the navel up under the ribs', 'Hands behind the head or resting light on the waist', 'Hold the vacuum while breathing shallow through the chest'],
  },
  {
    id: 'classic',
    label: 'Favorite Classic Pose',
    group: 'men',
    facing: 'front',
    symmetric: false,
    reveals: 'Your signature — a twisting three-quarter, a victory pose, an Arnold look.',
    judgeSees: 'Artistry and line: whether you can compose the physique, not just flex it.',
    cues: ['Pick the pose that flatters your best structure', 'Twist through the waist to shrink it and sweep the line', 'Point, reach or look along the pose — finish it to the fingertips'],
  },
  {
    id: 'mpFront',
    label: 'Physique — Front Stance',
    group: 'men',
    facing: 'front',
    symmetric: false,
    reveals: 'Beach-body balance: shoulders, chest, abs and taper above the board shorts.',
    judgeSees: 'A relaxed-looking stance that is anything but — taper, condition, presence.',
    cues: ['One hand on the hip, the other loose at the thigh', 'Flare the lats subtly — wide, not flexed-looking', 'Tight waist, tall spine, easy confident face'],
  },
  {
    id: 'mpBack',
    label: 'Physique — Back Stance',
    group: 'men',
    facing: 'back',
    symmetric: false,
    reveals: 'Back width, detail and the V-taper from behind.',
    judgeSees: 'Width and condition of the back carried with an unforced stance.',
    cues: ['Hand returns to the hip; open the back without a full spread', 'Keep the waist pinched and the lats wide', 'Weight settled evenly — no leaning'],
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
  {
    id: 'wellnessFront',
    label: 'Wellness — Front',
    group: 'women',
    facing: 'front',
    symmetric: false,
    reveals: 'The Wellness signature: developed quads and glutes against a tight, athletic upper body.',
    judgeSees: 'Lower-body mass presented in proportion — powerful legs that still make one clean line.',
    cues: ['Pop the hip and let the working leg carry the shape', 'Keep the upper body light: long neck, soft arms', 'Show the quad sweep without stiffening the pose'],
  },
  {
    id: 'wellnessBack',
    label: 'Wellness — Back',
    group: 'women',
    facing: 'back',
    symmetric: false,
    reveals: 'Glute and hamstring development — the division’s deciding view.',
    judgeSees: 'Density and shape of the glutes and hams with an arched, confident carriage.',
    cues: ['Arch through the low back — presented, never forced', 'Stagger the feet to split the hamstrings', 'Keep shoulders down; the story is below the waist'],
  },
  {
    id: 'figureSide',
    label: 'Figure — Quarter Turn (Side)',
    group: 'women',
    facing: 'side',
    symmetric: false,
    reveals: 'The profile: chest carriage, flat abdomen, hamstring-to-calf line.',
    judgeSees: 'A stacked, vertical profile — shoulders over hips over heels, nothing collapsing.',
    cues: ['Turn sharp and re-stack the posture instantly', 'Lift the ribcage; press the front hip forward slightly', 'Arms trace the body’s line — close but not clamped'],
  },
  {
    id: 'figureBack',
    label: 'Figure — Back',
    group: 'women',
    facing: 'back',
    symmetric: true,
    reveals: 'Back width and detail, glute-ham tie-in, and the X-frame from behind.',
    judgeSees: 'The V-taper mirrored: wide upper back narrowing hard into the waist.',
    cues: ['Hands on the waist; open the lats without a full spread', 'Stand tall to stretch the taper', 'Keep glutes and hamstrings tight through the hold'],
  },
  {
    id: 'wpSideChest',
    label: "Women's Physique — Side Chest",
    group: 'women',
    facing: 'side',
    symmetric: false,
    reveals: 'Chest carriage, shoulder cap, and the line of the near leg.',
    judgeSees: 'The side view held with tension and extension — strong but never bunched.',
    cues: ['Arms extended, open-handed — no clasped fists in this division', 'Bend the front knee and press the calf', 'Lift the chest and lengthen through the crown'],
  },
  {
    id: 'wpSideTri',
    label: "Women's Physique — Side Triceps",
    group: 'women',
    facing: 'side',
    symmetric: false,
    reveals: 'The triceps line, delt cap, and near-side conditioning.',
    judgeSees: 'A clean straight arm showing the triceps without hunching the shoulder.',
    cues: ['Lock the near arm long, fingers extended', 'Front leg extended, toe pointed to finish the line', 'Shoulders square — resist rolling toward the judges'],
  },
  {
    id: 'wpRDB',
    label: "Women's Physique — Rear Double Biceps",
    group: 'women',
    facing: 'back',
    symmetric: true,
    reveals: 'Back detail, glutes and hamstrings under full but graceful tension.',
    judgeSees: 'The whole posterior chain flexed while the pose stays open and lifted.',
    cues: ['Mirror the front — learn it by feel', 'Kick one heel back to flex the calf and split the hamstring', 'Open hands; keep the elbows lifted and wide'],
  },
  {
    id: 'wpAbsThighs',
    label: "Women's Physique — Abs & Thighs",
    group: 'women',
    facing: 'front',
    symmetric: true,
    reveals: 'Midsection conditioning and quad separation with feminine line.',
    judgeSees: 'A hard, controlled midsection that doesn’t cost the pose its length.',
    cues: ['Hands behind the head; exhale and crunch down', 'Extend one leg and flex the quad', 'Keep the chest lifted so the pose stays tall'],
  },
];

export const ALL_POSES: PoseDef[] = [...MENS_POSES, ...WOMENS_POSES];

/** Each division's actual mandatory / judged pose list, in call-out order. */
const CATEGORY_META: Record<Category, { label: string; theme: Theme; group: 'men' | 'women'; poses: string[] }> = {
  men_bodybuilding: { label: "Men's Bodybuilding", theme: 'ink', group: 'men', poses: ['fdb', 'fls', 'chest', 'triceps', 'bdb', 'bls', 'abs', 'mm'] },
  classic_physique: { label: 'Classic Physique', theme: 'ink', group: 'men', poses: ['fdb', 'chest', 'bdb', 'abs', 'vacuum', 'classic'] },
  mens_physique: { label: "Men's Physique", theme: 'ink', group: 'men', poses: ['mpFront', 'mpBack'] },
  bikini: { label: 'Bikini', theme: 'marble', group: 'women', poses: ['bikiniFront', 'backPose'] },
  wellness: { label: 'Wellness', theme: 'marble', group: 'women', poses: ['wellnessFront', 'wellnessBack'] },
  figure: { label: 'Figure', theme: 'marble', group: 'women', poses: ['figureFront', 'figureSide', 'figureBack'] },
  womens_physique: { label: "Women's Physique", theme: 'marble', group: 'women', poses: ['wpFDB', 'wpSideChest', 'wpRDB', 'wpSideTri', 'wpAbsThighs'] },
  womens_bodybuilding: { label: "Women's Bodybuilding", theme: 'marble', group: 'women', poses: ['wpFDB', 'wpSideChest', 'wpRDB', 'wpSideTri', 'wpAbsThighs', 'mm'] },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export function categoryLabel(c: Category): string {
  return CATEGORY_META[c]?.label ?? c;
}
export function themeFor(c: Category): Theme {
  return CATEGORY_META[c]?.theme ?? 'ink';
}

/** The division's mandatory poses, in call-out order. */
export function posesForCategory(c: Category): PoseDef[] {
  const ids = CATEGORY_META[c]?.poses ?? CATEGORY_META.men_bodybuilding.poses;
  return ids.map((id) => ALL_POSES.find((p) => p.id === id)).filter((p): p is PoseDef => !!p);
}

export function findPose(id: string | null | undefined): PoseDef | undefined {
  if (!id) return undefined;
  return ALL_POSES.find((p) => p.id === id);
}

export function poseLabel(id: string | null | undefined): string {
  return findPose(id)?.label ?? (id ? id : 'Untagged');
}
