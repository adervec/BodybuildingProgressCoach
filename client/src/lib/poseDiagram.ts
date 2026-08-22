/**
 * Original anatomical pose-figure renderer — ported from the two style guides'
 * SVG mannequin renderers (renderFront / renderSide / renderFemaleFront).
 * Returns an SVG string for a given pose id; styled by POSE_FIG_CSS using the
 * active theme's accent color, so it works on both ink and marble themes.
 */

const VB = { w: 200, h: 380 };

function P(x: number, y: number, a: number, len: number): [number, number] {
  const r = (a * Math.PI) / 180;
  return [x + len * Math.sin(r), y + len * Math.cos(r)];
}
function limb(x1: number, y1: number, x2: number, y2: number, w: number): string {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${w}" stroke-linecap="round" class="fl"/>`;
}
function dot(x: number, y: number, r: number): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="jt"/>`;
}

interface MaleSpec {
  id: string;
  ulA: number; flA: number; urA: number; frA: number;
  tlA: number; clA: number; trA: number; crA: number;
  facing: 'front' | 'back';
  spread?: boolean;
  traps?: boolean;
}

function renderFront(p: MaleSpec): string {
  const sL: [number, number] = [66, 118], sR: [number, number] = [134, 118];
  const hL: [number, number] = [87, 210], hR: [number, number] = [113, 210];
  const headC: [number, number] = [100, 70], headR = 16;

  const eL = P(sL[0], sL[1], p.ulA, 44), wL = P(eL[0], eL[1], p.flA, 42);
  const eR = P(sR[0], sR[1], p.urA, 44), wR = P(eR[0], eR[1], p.frA, 42);
  const kL = P(hL[0], hL[1], p.tlA, 64), fL = P(kL[0], kL[1], p.clA, 58);
  const kR = P(hR[0], hR[1], p.trA, 64), fR = P(kR[0], kR[1], p.crA, 58);

  const baseY = Math.max(fL[1], fR[1]);
  const back = p.facing === 'back';
  let s = '';
  s += `<defs><radialGradient id="g${p.id}" cx="50%" cy="32%" r="62%"><stop offset="0%" stop-color="rgba(231,196,122,.16)"/><stop offset="100%" stop-color="rgba(231,196,122,0)"/></radialGradient></defs>`;
  s += `<ellipse cx="100" cy="132" rx="94" ry="150" fill="url(#g${p.id})"/>`;
  s += `<path d="M${100 - 46} ${baseY + 8} L${100 + 46} ${baseY + 8} L${100 + 58} ${VB.h - 8} L${100 - 58} ${VB.h - 8} Z" class="plinth"/>`;
  s += `<line x1="${100 - 58}" y1="${VB.h - 8}" x2="${100 + 58}" y2="${VB.h - 8}" class="plinth-line"/>`;
  if (p.spread) {
    s += `<path d="M64 124 Q38 158 88 198 L88 166 Z" class="wing"/>`;
    s += `<path d="M136 124 Q162 158 112 198 L112 166 Z" class="wing"/>`;
  }
  if (p.traps) s += `<path d="M78 118 Q100 100 122 118 Z" class="ff"/>`;
  else s += `<path d="M84 118 Q100 104 116 118" class="trap"/>`;
  s += `<path d="M66,118 C58,121 61,170 88,196 L112,196 C139,170 142,121 134,118 C128,108 72,108 66,118 Z" class="ff"/>`;
  s += `<path d="M86,193 L114,193 L112,212 Q100,220 88,212 Z" class="trunk"/>`;
  s += `<line x1="100" y1="116" x2="100" y2="99" stroke-width="13" stroke-linecap="round" class="fl"/>`;
  s += `<circle cx="${headC[0]}" cy="${headC[1]}" r="${headR}" class="head"/>`;
  s += limb(sL[0], sL[1], eL[0], eL[1], 15) + limb(eL[0], eL[1], wL[0], wL[1], 13);
  s += limb(sR[0], sR[1], eR[0], eR[1], 15) + limb(eR[0], eR[1], wR[0], wR[1], 13);
  s += limb(hL[0], hL[1], kL[0], kL[1], 19) + limb(kL[0], kL[1], fL[0], fL[1], 16);
  s += limb(hR[0], hR[1], kR[0], kR[1], 19) + limb(kR[0], kR[1], fR[0], fR[1], 16);
  s += dot(wL[0], wL[1], 7) + dot(wR[0], wR[1], 7);
  s += dot(sL[0], sL[1], 4) + dot(sR[0], sR[1], 4) + dot(eL[0], eL[1], 4) + dot(eR[0], eR[1], 4);
  s += dot(hL[0], hL[1], 4) + dot(hR[0], hR[1], 4) + dot(kL[0], kL[1], 4) + dot(kR[0], kR[1], 4);
  if (back) {
    s += `<path d="M100 120 L100 192" class="det"/>`;
    s += `<path d="M78 128 Q88 168 96 193 M122 128 Q112 168 104 193" class="det"/>`;
    s += `<path d="M92 196 L96 210 M108 196 L104 210" class="det"/>`;
  } else {
    s += `<path d="M100 126 L100 190" class="det"/>`;
    s += `<path d="M80 134 Q100 146 120 134" class="det"/>`;
    s += `<path d="M91 158 H109 M91 168 H109 M91 178 H109" class="det"/>`;
  }
  return `<svg viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="pose figure">${s}</svg>`;
}

function renderSide(variant: 'chest' | 'triceps' | 'quarter'): string {
  let s = '';
  const id = variant;
  s += `<defs><radialGradient id="gs${id}" cx="50%" cy="32%" r="62%"><stop offset="0%" stop-color="rgba(231,196,122,.16)"/><stop offset="100%" stop-color="rgba(231,196,122,0)"/></radialGradient></defs>`;
  s += `<ellipse cx="100" cy="132" rx="94" ry="150" fill="url(#gs${id})"/>`;
  const hip: [number, number] = [100, 206];
  // 'quarter' stands tall (a quarter-turn), the posed variants stagger the legs.
  const posed = variant !== 'quarter';
  const kneeF: [number, number] = posed ? [126, 250] : [106, 252], footF: [number, number] = posed ? [136, 304] : [108, 306];
  const kneeB: [number, number] = posed ? [88, 262] : [92, 254], footB: [number, number] = posed ? [82, 332] : [90, 308];
  const baseY = Math.max(footF[1], footB[1]);
  s += `<path d="M${100 - 48} ${baseY + 8} L${100 + 50} ${baseY + 8} L${100 + 60} ${VB.h - 8} L${100 - 58} ${VB.h - 8} Z" class="plinth"/>`;
  s += `<line x1="${100 - 58}" y1="${VB.h - 8}" x2="${100 + 60}" y2="${VB.h - 8}" class="plinth-line"/>`;
  s += `<g class="far">`;
  s += limb(hip[0] - 2, hip[1], kneeB[0], kneeB[1], 18) + limb(kneeB[0], kneeB[1], footB[0], footB[1], 15);
  s += dot(kneeB[0], kneeB[1], 4) + `</g>`;
  s += `<path d="M88,206 Q82,176 84,150 Q86,134 96,131 Q112,133 122,144 Q128,160 124,176 Q118,194 110,204 Q104,212 88,206 Z" class="ff"/>`;
  s += `<path d="M88,192 Q76,200 84,210 Q92,214 100,206" class="ff2"/>`;
  s += `<path d="M88,192 Q104,202 116,194 L118,208 Q104,216 90,210 Z" class="trunk"/>`;
  s += `<line x1="100" y1="148" x2="110" y2="129" stroke-width="13" stroke-linecap="round" class="fl"/>`;
  s += `<circle cx="114" cy="108" r="16" class="head"/>`;
  s += limb(hip[0] + 2, hip[1], kneeF[0], kneeF[1], 19) + limb(kneeF[0], kneeF[1], footF[0], footF[1], 16);
  if (variant === 'chest') {
    const sN: [number, number] = [106, 142], eN: [number, number] = [126, 178], hN: [number, number] = [104, 192];
    const sB: [number, number] = [94, 142], eB: [number, number] = [80, 176], hB: [number, number] = [102, 192];
    s += `<g class="far">` + limb(sB[0], sB[1], eB[0], eB[1], 14) + limb(eB[0], eB[1], hB[0], hB[1], 12) + `</g>`;
    s += limb(sN[0], sN[1], eN[0], eN[1], 15) + limb(eN[0], eN[1], hN[0], hN[1], 13);
    s += dot(eN[0], eN[1], 4) + dot(hN[0], hN[1], 7);
    s += `<path d="M106 148 Q124 156 124 172" class="det"/>`;
  } else if (variant === 'triceps') {
    const sB: [number, number] = [96, 142], eB: [number, number] = [94, 190], hB: [number, number] = [88, 230];
    const sN: [number, number] = [108, 142], eN: [number, number] = [120, 182], hN: [number, number] = [92, 226];
    s += `<g class="far">` + limb(sB[0], sB[1], eB[0], eB[1], 15) + limb(eB[0], eB[1], hB[0], hB[1], 13) + dot(eB[0], eB[1], 4) + `</g>`;
    s += limb(sN[0], sN[1], eN[0], eN[1], 15) + limb(eN[0], eN[1], hN[0], hN[1], 13);
    s += dot(eN[0], eN[1], 4) + dot(hN[0], hN[1], 7);
    s += `<path d="M95 148 L92 190" class="det"/>`;
  } else {
    // Quarter turn: both arms trace the body's line, hanging long.
    const sB: [number, number] = [96, 142], eB = P(sB[0], sB[1], 4, 42), hB = P(eB[0], eB[1], 2, 40);
    const sN: [number, number] = [106, 142], eN = P(sN[0], sN[1], -3, 42), hN = P(eN[0], eN[1], -2, 40);
    s += `<g class="far">` + limb(sB[0], sB[1], eB[0], eB[1], 13) + limb(eB[0], eB[1], hB[0], hB[1], 11) + dot(eB[0], eB[1], 4) + `</g>`;
    s += limb(sN[0], sN[1], eN[0], eN[1], 13) + limb(eN[0], eN[1], hN[0], hN[1], 11);
    s += dot(eN[0], eN[1], 4) + dot(hN[0], hN[1], 6);
    s += `<path d="M100 150 L98 196" class="det"/>`;
  }
  s += dot(hip[0], hip[1], 4) + dot(kneeF[0], kneeF[1], 4);
  return `<svg viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="pose figure">${s}</svg>`;
}

interface FemaleSpec {
  id: string;
  shDX?: number; hipDX?: number; headDX?: number;
  armL?: 'angle' | 'hip' | 'down'; armR?: 'angle' | 'hip' | 'down';
  ulA?: number; flA?: number; urA?: number; frA?: number;
  tlA?: number; clA?: number; trA?: number; crA?: number;
  facing: 'front' | 'back';
  spread?: boolean;
}

function renderFemaleFront(p: FemaleSpec): string {
  const shH = 27, hipH = 18, ua = 42, fa = 40, th = 66, ca = 60;
  const shX = 100 + (p.shDX || 0), pxX = 100 + (p.hipDX || 0);
  const sL: [number, number] = [shX - shH, 120], sR: [number, number] = [shX + shH, 120];
  const hL: [number, number] = [pxX - hipH, 212], hR: [number, number] = [pxX + hipH, 212];
  const headC: [number, number] = [100 + (p.headDX || 0), 72], headR = 15;
  const back = p.facing === 'back';

  function arm(side: 'L' | 'R'): { e: [number, number]; w: [number, number] } {
    const sh = side === 'L' ? sL : sR;
    const mode = side === 'L' ? p.armL || 'angle' : p.armR || 'angle';
    if (mode === 'hip') {
      const hand: [number, number] = side === 'L' ? [pxX - hipH + 3, 205] : [pxX + hipH - 3, 205];
      const out = side === 'L' ? -16 : 16;
      const elbow: [number, number] = [sh[0] + out, (sh[1] + hand[1]) / 2 + 8];
      return { e: elbow, w: hand };
    }
    if (mode === 'down') {
      const a = side === 'L' ? -9 : 9;
      const e = P(sh[0], sh[1], a, ua), w = P(e[0], e[1], a, fa);
      return { e, w };
    }
    const ul = side === 'L' ? p.ulA! : p.urA!, fl = side === 'L' ? p.flA! : p.frA!;
    const e = P(sh[0], sh[1], ul, ua), w = P(e[0], e[1], fl, fa);
    return { e, w };
  }
  const aL = arm('L'), aR = arm('R');
  const kL = P(hL[0], hL[1], p.tlA != null ? p.tlA : -6, th), fL = P(kL[0], kL[1], p.clA != null ? p.clA : -1, ca);
  const kR = P(hR[0], hR[1], p.trA != null ? p.trA : 6, th), fR = P(kR[0], kR[1], p.crA != null ? p.crA : 1, ca);
  const baseY = Math.max(fL[1], fR[1]);

  let s = '';
  s += `<defs><radialGradient id="fg${p.id}" cx="50%" cy="30%" r="62%"><stop offset="0%" stop-color="rgba(168,127,51,.14)"/><stop offset="100%" stop-color="rgba(168,127,51,0)"/></radialGradient></defs>`;
  s += `<ellipse cx="100" cy="130" rx="92" ry="150" fill="url(#fg${p.id})"/>`;
  s += `<path d="M${100 - 44} ${baseY + 8} L${100 + 44} ${baseY + 8} L${100 + 56} ${VB.h - 8} L${100 - 56} ${VB.h - 8} Z" class="plinth"/>`;
  s += `<line x1="${100 - 56}" y1="${VB.h - 8}" x2="${100 + 56}" y2="${VB.h - 8}" class="plinth-line"/>`;
  if (p.spread) {
    s += `<path d="M${shX - shH - 2} 124 Q${shX - shH - 26} 158 ${pxX - hipH} 196 L${pxX - hipH} 168 Z" class="wing"/>`;
    s += `<path d="M${shX + shH + 2} 124 Q${shX + shH + 26} 158 ${pxX + hipH} 196 L${pxX + hipH} 168 Z" class="wing"/>`;
  }
  s += `<path d="M${sL[0]},120 C${sL[0] - 6},124 ${shX - 9},168 ${shX - 9},192 L${shX + 9},192 C${shX + 9},168 ${sR[0] + 6},124 ${sR[0]},120 C${sR[0] - 6},112 ${sL[0] + 6},112 ${sL[0]},120 Z" class="ff"/>`;
  s += `<path d="M${pxX - hipH + 3},189 Q${pxX - hipH - 3},202 ${pxX - hipH + 4},213 Q${pxX},221 ${pxX + hipH - 4},213 Q${pxX + hipH + 3},202 ${pxX + hipH - 3},189 Z" class="trunk"/>`;
  if (!back) s += `<path d="M${shX - 18},133 Q${shX},143 ${shX + 18},133 L${shX + 15},139 Q${shX},147 ${shX - 15},139 Z" class="trunk"/>`;
  else s += `<path d="M${shX - 19},131 L${shX + 19},131 L${shX + 17},137 L${shX - 17},137 Z" class="trunk"/>`;
  s += `<line x1="${shX}" y1="118" x2="${headC[0]}" y2="101" stroke-width="11" stroke-linecap="round" class="fl"/>`;
  s += `<circle cx="${headC[0]}" cy="${headC[1]}" r="${headR}" class="head"/>`;
  s += limb(sL[0], sL[1], aL.e[0], aL.e[1], 13) + limb(aL.e[0], aL.e[1], aL.w[0], aL.w[1], 11);
  s += limb(sR[0], sR[1], aR.e[0], aR.e[1], 13) + limb(aR.e[0], aR.e[1], aR.w[0], aR.w[1], 11);
  s += limb(hL[0], hL[1], kL[0], kL[1], 18) + limb(kL[0], kL[1], fL[0], fL[1], 15);
  s += limb(hR[0], hR[1], kR[0], kR[1], 18) + limb(kR[0], kR[1], fR[0], fR[1], 15);
  s += dot(aL.w[0], aL.w[1], 6) + dot(aR.w[0], aR.w[1], 6);
  s += dot(sL[0], sL[1], 3.4) + dot(sR[0], sR[1], 3.4) + dot(aL.e[0], aL.e[1], 3.4) + dot(aR.e[0], aR.e[1], 3.4);
  s += dot(hL[0], hL[1], 3.4) + dot(hR[0], hR[1], 3.4) + dot(kL[0], kL[1], 3.4) + dot(kR[0], kR[1], 3.4);
  if (back) {
    s += `<path d="M${pxX} 160 L${pxX} 192" class="det"/>`;
    s += `<path d="M${pxX - 9},196 Q${pxX - 13},206 ${pxX - 7},214 M${pxX + 9},196 Q${pxX + 13},206 ${pxX + 7},214" class="det"/>`;
  } else {
    s += `<path d="M${shX} 150 L${shX} 188" class="det"/>`;
    s += `<path d="M${shX - 8} 162 H${shX + 8} M${shX - 7} 172 H${shX + 7}" class="det"/>`;
  }
  return `<svg viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="pose figure">${s}</svg>`;
}

const MALE: Record<string, MaleSpec> = {
  fdb: { id: 'fdb', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front' },
  fls: { id: 'fls', ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front', spread: true },
  abs: { id: 'abs', ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -5, clA: -2, trA: 16, crA: 8, facing: 'front' },
  bdb: { id: 'bdb', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'back' },
  bls: { id: 'bls', ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'back', spread: true },
  mm: { id: 'mm', ulA: -42, flA: 52, urA: 42, frA: -52, tlA: -9, clA: -3, trA: 9, crA: 3, facing: 'front', traps: true },
  vacuum: { id: 'vac', ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front' },
  classic: { id: 'cls', ulA: -124, flA: 150, urA: 35, frA: 10, tlA: -14, clA: -4, trA: 8, crA: 3, facing: 'front' },
  mpFront: { id: 'mpf', ulA: -10, flA: -6, urA: 40, frA: -40, tlA: -6, clA: -2, trA: 6, crA: 2, facing: 'front' },
  mpBack: { id: 'mpb', ulA: -10, flA: -6, urA: 40, frA: -40, tlA: -6, clA: -2, trA: 6, crA: 2, facing: 'back' },
};

const FEMALE: Record<string, FemaleSpec> = {
  bikiniFront: { id: 'bk', shDX: -4, hipDX: 9, headDX: -3, armL: 'down', armR: 'hip', tlA: 11, clA: 6, trA: 2, crA: 1, facing: 'front' },
  backPose: { id: 'bp', shDX: 3, hipDX: -2, headDX: 4, armL: 'down', armR: 'hip', tlA: -12, clA: -6, trA: 6, crA: 2, facing: 'back' },
  figureFront: { id: 'fgr', armL: 'hip', armR: 'hip', tlA: -5, clA: -2, trA: 5, crA: 2, facing: 'front', spread: true },
  wpFDB: { id: 'wf', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front' },
  wellnessFront: { id: 'wlf', shDX: -3, hipDX: 8, headDX: -2, armL: 'down', armR: 'hip', tlA: 12, clA: 6, trA: 2, crA: 1, facing: 'front' },
  wellnessBack: { id: 'wlb', shDX: 2, hipDX: -2, headDX: 3, armL: 'hip', armR: 'down', tlA: -12, clA: -6, trA: 6, crA: 2, facing: 'back' },
  figureBack: { id: 'fgb', armL: 'hip', armR: 'hip', tlA: -5, clA: -2, trA: 5, crA: 2, facing: 'back', spread: true },
  wpRDB: { id: 'wrdb', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'back' },
  wpAbsThighs: { id: 'wat', ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -4, clA: -2, trA: 14, crA: 6, facing: 'front' },
  wbFDB: { id: 'wbf', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front' },
  wbFLS: { id: 'wbfl', ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'front', spread: true },
  wbBDB: { id: 'wbb', ulA: -124, flA: 150, urA: 124, frA: -150, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'back' },
  wbBLS: { id: 'wbbl', ulA: -74, flA: 20, urA: 74, frA: -20, tlA: -7, clA: -2, trA: 7, crA: 2, facing: 'back', spread: true },
  wbAbs: { id: 'wba', ulA: -128, flA: 162, urA: 128, frA: -162, tlA: -5, clA: -2, trA: 16, crA: 8, facing: 'front' },
};

/** Side poses share the profile mannequin; the female side poses reuse it — it's a stylized silhouette. */
const SIDE: Record<string, 'chest' | 'triceps' | 'quarter'> = {
  chest: 'chest',
  triceps: 'triceps',
  wpSideChest: 'chest',
  wpSideTri: 'triceps',
  figureSide: 'quarter',
  bikiniSide: 'quarter',
  wellnessSide: 'quarter',
  mpSide: 'quarter',
  wbSideChest: 'chest',
  wbSideTri: 'triceps',
};

export function renderPoseSVG(id: string): string {
  if (SIDE[id]) return renderSide(SIDE[id]);
  if (MALE[id]) return renderFront(MALE[id]);
  if (FEMALE[id]) return renderFemaleFront(FEMALE[id]);
  return '';
}

export const POSE_FIG_CSS = `
.pose-fig svg{width:100%;height:auto;display:block;}
.pose-fig .fl{stroke:var(--accent);}
.pose-fig .ff{fill:color-mix(in srgb,var(--accent) 12%,transparent);stroke:var(--accent);stroke-width:2;stroke-linejoin:round;}
.pose-fig .ff2{fill:color-mix(in srgb,var(--accent) 10%,transparent);stroke:var(--accent);stroke-width:1.4;}
.pose-fig .trunk{fill:var(--accent);opacity:.82;}
.pose-fig .head{fill:color-mix(in srgb,var(--accent) 17%,transparent);stroke:var(--accent);stroke-width:2;}
.pose-fig .jt{fill:var(--accent-bright);}
.pose-fig .det{stroke:color-mix(in srgb,var(--text) 45%,transparent);stroke-width:1.3;fill:none;}
.pose-fig .trap{stroke:var(--accent);stroke-width:1.6;fill:none;opacity:.8;}
.pose-fig .wing{fill:color-mix(in srgb,var(--accent) 8%,transparent);stroke:color-mix(in srgb,var(--accent) 40%,transparent);stroke-width:1.4;}
.pose-fig .plinth{fill:color-mix(in srgb,var(--accent) 8%,transparent);stroke:color-mix(in srgb,var(--accent) 30%,transparent);stroke-width:1;}
.pose-fig .plinth-line{stroke:color-mix(in srgb,var(--accent) 50%,transparent);stroke-width:1.4;}
.pose-fig .far{opacity:.42;}
`;
