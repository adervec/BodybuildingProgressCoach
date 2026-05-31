import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from './types';

const VERSION = '0.10.18';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function getLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const opts = {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE' as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      };
      try {
        return await PoseLandmarker.createFromOptions(fileset, {
          ...opts,
          baseOptions: { ...opts.baseOptions, delegate: 'GPU' },
        });
      } catch {
        // Some machines lack a usable WebGL/GPU delegate — fall back to CPU (WASM).
        return PoseLandmarker.createFromOptions(fileset, {
          ...opts,
          baseOptions: { ...opts.baseOptions, delegate: 'CPU' },
        });
      }
    })();
  }
  return landmarkerPromise;
}

export interface DetectResult {
  landmarks: Landmark[];
  width: number;
  height: number;
}

/** Run single-person pose detection on a loaded image or canvas. */
export async function detectPose(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<DetectResult | null> {
  const lm = await getLandmarker();
  const res = lm.detect(source);
  if (!res.landmarks || res.landmarks.length === 0) return null;
  const landmarks: Landmark[] = res.landmarks[0].map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    visibility: p.visibility ?? 1,
  }));
  const width = (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width;
  const height = (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height;
  return { landmarks, width, height };
}

/** Load an image URL into a fully-decoded HTMLImageElement. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/** Whether pose detection has been initialized (model downloaded). */
export function detectorReady(): boolean {
  return landmarkerPromise !== null;
}
