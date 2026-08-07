import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from './types';

// Self-hosted, same-origin assets — provisioned into client/public/mediapipe by
// scripts/provision-mediapipe.mjs (see the "predev"/"prebuild" hooks). No CDN calls.
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/models/pose_landmarker_lite.task`;

type Mode = 'IMAGE' | 'VIDEO';
const landmarkers: Partial<Record<Mode, Promise<PoseLandmarker>>> = {};

function getLandmarker(mode: Mode): Promise<PoseLandmarker> {
  if (!landmarkers[mode]) {
    landmarkers[mode] = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const opts = {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: mode,
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
  return landmarkers[mode]!;
}

export interface DetectResult {
  landmarks: Landmark[];
  width: number;
  height: number;
}

function toLandmarks(res: { landmarks?: { x: number; y: number; z?: number; visibility?: number }[][] }): Landmark[] | null {
  if (!res.landmarks || res.landmarks.length === 0) return null;
  return res.landmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 }));
}

/** Run single-person pose detection on a loaded image or canvas. */
export async function detectPose(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<DetectResult | null> {
  const lm = await getLandmarker('IMAGE');
  const landmarks = toLandmarks(lm.detect(source));
  if (!landmarks) return null;
  const width = (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width;
  const height = (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height;
  return { landmarks, width, height };
}

/** Live detection on a playing <video>. Timestamps must increase monotonically (use performance.now()). */
export async function detectPoseVideo(video: HTMLVideoElement, timestampMs: number): Promise<DetectResult | null> {
  const lm = await getLandmarker('VIDEO');
  const landmarks = toLandmarks(lm.detectForVideo(video, timestampMs));
  if (!landmarks) return null;
  return { landmarks, width: video.videoWidth, height: video.videoHeight };
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
  return !!landmarkers.IMAGE || !!landmarkers.VIDEO;
}
