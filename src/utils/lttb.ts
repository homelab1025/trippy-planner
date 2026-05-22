// Largest Triangle Three Buckets downsampling (Sveinn Steinarsson, 2013).
// Preserves visual peaks and troughs while reducing point count to `target`.
// TODO: understand the algorithm, run mutation testing and address the survivors

function lttb<T>(
  data: T[],
  target: number,
  x: (p: T) => number,
  y: (p: T) => number
): T[] {
  if (data.length <= target) return [...data];

  const result: T[] = [data[0]];
  const bucketSize = (data.length - 2) / (target - 2);
  let a = 0;

  for (let i = 0; i < target - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);
    const nextStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length - 1);

    let avgX = 0, avgY = 0, count = 0;
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += x(data[j]); avgY += y(data[j]); count++;
    }
    if (count > 0) { avgX /= count; avgY /= count; }

    const aX = x(data[a]), aY = y(data[a]);
    let maxArea = -1, maxIdx = bucketStart;
    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs((aX - avgX) * (y(data[j]) - aY) - (aX - x(data[j])) * (avgY - aY));
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }

    result.push(data[maxIdx]);
    a = maxIdx;
  }

  result.push(data[data.length - 1]);
  return result;
}

// Runs LTTB and then re-inserts any pinned points that were dropped,
// maintaining sort order by x value.
export function lttbWithPinnedPoints<T>(
  data: T[],
  target: number,
  isPinned: (p: T) => boolean,
  x: (p: T) => number,
  y: (p: T) => number
): T[] {
  if (data.length <= target) return data;

  const downsampled = lttb(data, target, x, y);
  const kept = new Set(downsampled);
  const missing = data.filter(p => isPinned(p) && !kept.has(p));

  if (missing.length === 0) return downsampled;

  return [...downsampled, ...missing].sort((a, b) => x(a) - x(b));
}
