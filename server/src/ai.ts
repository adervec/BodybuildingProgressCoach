import Anthropic from '@anthropic-ai/sdk';
import { COACH_PRINCIPLES, ALL_POSES, findPose, type PoseCriteria } from './rubric.js';

const PRIMARY_MODEL = process.env.AI_MODEL || 'claude-opus-4-8';
const FALLBACK_MODELS = ['claude-sonnet-4-6', 'claude-sonnet-4-5'];

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface CoachingResult {
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

const COACHING_TOOL: Anthropic.Tool = {
  name: 'submit_coaching',
  description: 'Submit a structured, honest posing & physique assessment judged strictly against the supplied criteria.',
  input_schema: {
    type: 'object',
    properties: {
      overall_impression: { type: 'string', description: 'Two or three honest sentences on the overall presentation of this pose.' },
      estimated_pose_match: { type: 'string', description: 'How well the photo actually matches the requested pose, and any mismatch noticed.' },
      strengths: {
        type: 'array',
        description: 'Genuine strengths visible in the photo, each tied to the criteria.',
        items: { type: 'object', properties: { area: { type: 'string' }, note: { type: 'string' } }, required: ['area', 'note'] },
      },
      improvements: {
        type: 'array',
        description: 'Specific, actionable improvements judged against the criteria. Be honest, never harsh.',
        items: {
          type: 'object',
          properties: { area: { type: 'string' }, note: { type: 'string' }, priority: { type: 'string', enum: ['high', 'medium', 'low'] } },
          required: ['area', 'note', 'priority'],
        },
      },
      pose_specific_cues: { type: 'array', description: 'Concrete cues to drill for this exact pose.', items: { type: 'string' } },
      conditioning_notes: { type: 'string', description: 'Honest, non-prescriptive notes on conditioning/presentation as visible on stage-style lighting. No diet/medical advice.' },
      honesty_caveats: { type: 'string', description: 'Limits of this read: photo angle, lighting, cropping, resolution.' },
      confidence: { type: 'number', description: '0..1 confidence in this assessment given photo quality.' },
    },
    required: ['overall_impression', 'estimated_pose_match', 'strengths', 'improvements', 'pose_specific_cues', 'conditioning_notes', 'honesty_caveats', 'confidence'],
  },
};

function rubricText(poses: PoseCriteria[]): string {
  return poses
    .map(
      (p) =>
        `• ${p.label} [id:${p.id}]\n  Reveals: ${p.reveals}\n  Judge sees: ${p.judgeSees}\n  Cues: ${p.cues.join('; ')}`
    )
    .join('\n');
}

export interface AnalyzeArgs {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  poseId?: string | null;
  division?: string | null;
  objectiveMetrics?: Record<string, unknown> | null;
}

export async function analyzePhoto(args: AnalyzeArgs): Promise<CoachingResult> {
  const pose = findPose(args.poseId);
  const focusBlock = pose
    ? `THE POSE TO JUDGE:\n${rubricText([pose])}`
    : `No specific pose was tagged. Identify the most likely pose from the list and judge against it.`;

  // Stable, cacheable system prompt: principles + the full rubric library.
  // Cast through unknown so cache_control compiles across SDK minor versions.
  const system = [
    {
      type: 'text',
      text: `${COACH_PRINCIPLES}\n\nFULL POSING RUBRIC LIBRARY (judge only against these):\n${rubricText(ALL_POSES)}`,
      cache_control: { type: 'ephemeral' },
    },
  ] as unknown as Anthropic.MessageCreateParams['system'];

  const metricLine = args.objectiveMetrics
    ? `\n\nObjective measurements already computed locally (use them, don't contradict the math):\n${JSON.stringify(
        args.objectiveMetrics
      )}`
    : '';

  const userContent: Anthropic.MessageParam['content'] = [
    { type: 'image', source: { type: 'base64', media_type: args.mediaType, data: args.imageBase64 } },
    {
      type: 'text',
      text: `${focusBlock}${
        args.division ? `\n\nDivision context: ${args.division}` : ''
      }${metricLine}\n\nAssess this athlete's pose. Call submit_coaching with your honest, criteria-based judgement.`,
    },
  ];

  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastErr: unknown;
  for (const model of models) {
    try {
      const resp = await getClient().messages.create({
        model,
        max_tokens: 1200,
        system,
        tools: [COACHING_TOOL],
        tool_choice: { type: 'tool', name: 'submit_coaching' },
        messages: [{ role: 'user', content: userContent }],
      });
      const block = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!block) throw new Error('No structured output returned by the model.');
      return { ...(block.input as Omit<CoachingResult, 'model'>), model };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      // Only fall through on "model not found / not available"; otherwise rethrow.
      if (status === 404 || status === 400) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error('AI analysis failed.');
}
