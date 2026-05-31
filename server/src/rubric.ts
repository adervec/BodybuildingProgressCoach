/**
 * Posing rubric — ported verbatim in spirit from the two style guides
 * (The Sandow Plates / The Atalanta Plates). This is the SAME criteria the
 * UI shows and the SAME criteria the AI coach is told to judge against, so
 * assessment stays consistent and "fair".
 */

export interface PoseCriteria {
  id: string;
  label: string;
  group: 'men' | 'women';
  /** What the pose is meant to display. */
  reveals: string;
  /** What a judge is looking for. */
  judgeSees: string;
  /** Execution cues. */
  cues: string[];
}

export const MENS_POSES: PoseCriteria[] = [
  {
    id: 'fdb',
    label: 'Front Double Biceps',
    group: 'men',
    reveals: 'The complete front: arms, delts, chest, quads, symmetry.',
    judgeSees: 'Overall front development and left-to-right balance — the signature opening statement.',
    cues: [
      'Plant feet shoulder-width; flare the lats wide',
      'Curl both arms and "screw" the fists to peak the biceps',
      'Drop the traps, lift the chest, crunch the abs on the exhale',
    ],
  },
  {
    id: 'fls',
    label: 'Front Lat Spread',
    group: 'men',
    reveals: 'Back width from the front — the cobra-hood "V" taper.',
    judgeSees: 'Shoulder-to-waist taper and the dramatic flare of the lats.',
    cues: [
      'Set thumbs on the lower waist, elbows driven forward',
      'Push the lats out and down to open the hood',
      'Keep the waist tight and the chest high',
    ],
  },
  {
    id: 'chest',
    label: 'Side Chest',
    group: 'men',
    reveals: 'Pec thickness, biceps, and the calf & hamstring of the bent leg.',
    judgeSees: 'Depth of the chest and the clean line of the whole side.',
    cues: [
      'Turn your best side to the judges',
      'Bend the front knee and raise the heel to flex the calf',
      'Grip the wrist, press the arms together, and inflate the chest',
    ],
  },
  {
    id: 'triceps',
    label: 'Side Triceps',
    group: 'men',
    reveals: 'The triceps horseshoe, side chest, and leg.',
    judgeSees: 'Arm development and density down the visible side.',
    cues: [
      'Present your best arm; lock it straight and slightly back',
      'Let the other hand grip the wrist and pull to extend',
      'Bend the front leg and push the triceps hard',
    ],
  },
  {
    id: 'bdb',
    label: 'Rear Double Biceps',
    group: 'men',
    reveals: 'Back detail, glutes, hamstrings, calves — the "Christmas tree" lower back.',
    judgeSees: 'Thickness and detail of the entire posterior chain.',
    cues: [
      "Mirror the front pose — but you're blind, so learn it by feel",
      'Flare the lats and flex one calf with the heel raised',
      'Squeeze everything from traps to glutes at once',
    ],
  },
  {
    id: 'bls',
    label: 'Rear Lat Spread',
    group: 'men',
    reveals: 'Back width and lat sweep seen straight on.',
    judgeSees: 'How wide the back opens and how it tapers to the waist.',
    cues: [
      'Hands on the waist, elbows forward',
      'Spread the lats as wide as they will go',
      'Set one foot back with the calf flexed',
    ],
  },
  {
    id: 'abs',
    label: 'Abdominals & Thighs',
    group: 'men',
    reveals: 'Midsection conditioning, serratus, and quad separation.',
    judgeSees: 'How hard and detailed the abs and front legs are.',
    cues: ['Hands behind the head; exhale fully', 'Crunch the abs down and in', 'Push one leg forward and flex the quad'],
  },
  {
    id: 'mm',
    label: 'Most Muscular',
    group: 'men',
    reveals: 'Raw mass and density — traps, arms, chest, the whole frame.',
    judgeSees: 'Sheer muscularity; often the showstopper of the posedown.',
    cues: ['Round and drop the shoulders forward', 'Drive the hands toward the center and clasp', 'Crunch the entire body into one dense knot'],
  },
];

export const WOMENS_POSES: PoseCriteria[] = [
  {
    id: 'bikiniFront',
    label: 'Bikini — Front',
    group: 'women',
    reveals: 'Balance, proportion, a healthy athletic shape, glute–hamstring tie-in, tone, stage presence — not size or hardness.',
    judgeSees: 'A confident S-curve with the hip popped; long line from crown to heel.',
    cues: ['Pop the hip and shift weight to draw the S-curve', 'Long neck; shoulders back and down; soft, confident face', 'Keep the line long — never collapse the posture'],
  },
  {
    id: 'backPose',
    label: 'Wellness / Bikini — Back',
    group: 'women',
    reveals: 'Glute and hamstring development; for Wellness, greater lower-body mass vs a tighter upper body.',
    judgeSees: 'A gentle arch presenting the glutes; proud, upright torso.',
    cues: ['Arch just enough — never force it', 'Carry leg mass with an upright torso', 'The back pose often decides placings — sell it cleanly'],
  },
  {
    id: 'figureFront',
    label: 'Figure — Front',
    group: 'women',
    reveals: 'Symmetry, shape, firm tone — the coveted "X-frame": capped delts, wide back, small waist, shapely legs. No striations or vascularity.',
    judgeSees: 'The X-frame stretched tall from crown to heel.',
    cues: ['Hands on the waist; drive elbows out and slightly forward', 'Stand tall to stretch the frame', 'Sharp, deliberate quarter turns'],
  },
  {
    id: 'wpFDB',
    label: "Women's Physique — Front Double Biceps",
    group: 'women',
    reveals: 'Muscularity, symmetry, and conditioning balanced by grace and presentation.',
    judgeSees: 'Full tension held with flow and a lengthened, graceful line.',
    cues: ['Flex with full tension, but flow between poses', 'Extend the fingers and lengthen the line to soften it', 'Let the routine breathe and build'],
  },
];

export const ALL_POSES: PoseCriteria[] = [...MENS_POSES, ...WOMENS_POSES];

export function findPose(id: string | null | undefined): PoseCriteria | undefined {
  if (!id) return undefined;
  return ALL_POSES.find((p) => p.id === id);
}

/** Shared "house philosophy" — keeps the coach honest, fair, and on-brand. */
export const COACH_PRINCIPLES = `
You are an experienced, honest bodybuilding posing & physique coach. You judge
strictly against the criteria provided and the long lineage of the sport
("the body presented as sculpture"). Core principles:
- Be HONEST and FAIR: name real strengths AND real weaknesses. Never flatter.
- Judge ONLY against the stated criteria for the requested pose/division.
- Be SPECIFIC and actionable: tie every note to a body part, line, or cue.
- Be RESPECTFUL and constructive. Never shame the athlete or their body. Do NOT
  give diet, calorie, weight-loss, or medical prescriptions. Stay on posing,
  conditioning presentation, lines, symmetry, and stagecraft.
- Acknowledge uncertainty from photo angle, lighting, or framing when relevant.
`.trim();
