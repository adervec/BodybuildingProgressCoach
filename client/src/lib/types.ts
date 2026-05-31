export type Category =
  | 'men_bodybuilding'
  | 'classic_physique'
  | 'mens_physique'
  | 'bikini'
  | 'wellness'
  | 'figure'
  | 'womens_physique'
  | 'womens_bodybuilding';

export type Theme = 'ink' | 'marble';

export interface Athlete {
  id: number;
  name: string;
  category: Category;
  height_cm: number | null;
  notes: string | null;
  created_at: string;
  media_count?: number;
  comp_count?: number;
  latest_thumb?: string | null;
}

export interface MediaAsset {
  id: number;
  athlete_id: number;
  kind: 'photo' | 'video';
  file_name: string;
  thumb_name: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  captured_at: string;
  pose_type: string | null;
  division: string | null;
  notes: string | null;
  created_at: string;
  url: string;
  thumb_url: string | null;
  analyses?: PoseAnalysis[];
}

export interface PoseMetrics {
  scaleUnitPx: number;
  shoulderWidth: number;
  hipWidth: number;
  vTaper: number;
  symmetry: {
    score: number;
    shoulderTilt: number;
    hipTilt: number;
    armElevationDiff: number;
    elbowAngleDiff: number;
    legAngleDiff: number;
  };
  refMatch: { score: number; perLimb: { name: string; measured: number; ideal: number; diff: number }[] } | null;
  confidence: number;
  notes: string[];
}

export interface PoseAnalysis {
  id: number;
  media_id: number;
  athlete_id: number;
  source: 'geometry' | 'ai' | 'manual';
  pose_type: string | null;
  form_score: number | null;
  symmetry_score: number | null;
  ref_match_score: number | null;
  confidence: number | null;
  metrics?: PoseMetrics | null;
  landmarks?: Landmark[] | null;
  ai_feedback?: AiCoaching | null;
  created_at: string;
  captured_at?: string;
  media_pose?: string | null;
  file_name?: string;
  kind?: string;
  thumb_url?: string | null;
  url?: string;
}

export interface AiCoaching {
  overall_impression: string;
  estimated_pose_match: string;
  strengths: { area: string; note: string }[];
  improvements: { area: string; note: string; priority: 'high' | 'medium' | 'low' }[];
  pose_specific_cues: string[];
  conditioning_notes: string;
  honesty_caveats: string;
  confidence: number;
  model: string;
}

export interface BodyComp {
  id: number;
  athlete_id: number;
  measured_at: string;
  weight: number | null;
  weight_unit: string;
  body_fat_pct: number | null;
  lean_mass: number | null;
  measurements: Record<string, number>;
  source: 'manual' | 'scale';
  notes: string | null;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
