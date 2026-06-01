import type { RoutePoint } from './gpxParser';

export interface Climb {
  startDistance: number;
  endDistance: number;
  elevationGain: number;
  lengthM: number;
  avgGrade: number;
  score: number;
  category: 'Cat4' | 'Cat3' | 'Cat2' | 'Cat1' | 'HC';
}

// Tuning parameters — see docs/climb-detection-parameters.html for a visual explanation.
const MIN_GRADE_PCT = 1;
const MAX_GAP_DESCENT_M = 30;
const MAX_GAP_DISTANCE_M = 500;
const MIN_SCORE = 8000;

function assignCategory(score: number): Climb['category'] {
  if (score > 80000) return 'HC';
  if (score > 64000) return 'Cat1';
  if (score > 32000) return 'Cat2';
  if (score > 16000) return 'Cat3';
  return 'Cat4';
}

export function detectClimbs(points: RoutePoint[]): Climb[] {
  if (points.length < 2) return [];

  interface Run { startIdx: number; endIdx: number; }

  // Build ascending runs: contiguous spans where point-to-point grade > MIN_GRADE_PCT
  const runs: Run[] = [];
  let inRun = false;
  let runStart = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const distDiff = points[i + 1].distance - points[i].distance;
    if (distDiff === 0) continue;
    const grade = (points[i + 1].ele - points[i].ele) / distDiff * 100;

    if (grade > MIN_GRADE_PCT) {
      if (!inRun) { runStart = i; inRun = true; }
    } else if (inRun) {
      runs.push({ startIdx: runStart, endIdx: i });
      inRun = false;
    }
  }
  if (inRun) runs.push({ startIdx: runStart, endIdx: points.length - 1 });

  // Merge adjacent runs in a single left-to-right pass.
  // A gap qualifies for merging when net descent < MAX_GAP_DESCENT_M AND
  // gap distance < MAX_GAP_DISTANCE_M — handles false flats and switchback dips
  // without absorbing genuine descents. Chains (A→B→C) are handled naturally.
  const merged: Run[] = [];
  for (const run of runs) {
    if (merged.length === 0) { merged.push({ ...run }); continue; }
    const last = merged[merged.length - 1];
    const gapStart = points[last.endIdx];
    const gapEnd = points[run.startIdx];
    const gapDescent = gapStart.ele - gapEnd.ele;
    const gapDistance = gapEnd.distance - gapStart.distance;
    if (gapDescent >= 0 && gapDescent < MAX_GAP_DESCENT_M && gapDistance < MAX_GAP_DISTANCE_M) {
      last.endIdx = run.endIdx;
    } else {
      merged.push({ ...run });
    }
  }

  // Score each candidate and assign category. Score = lengthM × avgGrade.
  // Note: score = (end.ele - start.ele) * 100 for any straight segment — length
  // and grade cancel out — so the formula correctly rewards steep long climbs.
  return merged.flatMap(run => {
    const start = points[run.startIdx];
    const end = points[run.endIdx];
    const elevationGain = end.ele - start.ele;
    if (elevationGain <= 0) return [];
    const lengthM = end.distance - start.distance;
    if (lengthM <= 0) return [];
    const avgGrade = (elevationGain / lengthM) * 100;
    const score = lengthM * avgGrade;
    if (score <= MIN_SCORE) return [];
    return [{
      startDistance: start.distance,
      endDistance: end.distance,
      elevationGain,
      lengthM,
      avgGrade,
      score,
      category: assignCategory(score),
    }];
  });
}
