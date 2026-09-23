// The demo path of the simulated USYC index, taken from spec section 9:
//
//   Oct 1 2026 -> index 1.00   (market opens)
//   Jan 1 2027 -> index 1.025  (Bank claims 24.390243 USYC of yield)
//   Apr 1 2027 -> index 1.05   (maturity)
//
// Between two keyframes the index moves in a straight line. The oracle bot and
// the "+1 week" button in the UI both use nextOracleStep, so the demo always
// hits these exact values.

export const DEMO_START = "2026-10-01T00:00:00Z";
export const DEMO_MATURITY = "2027-04-01T00:00:00Z";

type Keyframe = {
  time: string;
  index: number;
};

const KEYFRAMES: Keyframe[] = [
  { time: DEMO_START, index: 1.0 },
  { time: "2027-01-01T00:00:00Z", index: 1.025 },
  { time: DEMO_MATURITY, index: 1.05 },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The scheduled index at a given time. Example: indexAt("2026-11-15T12:00:00Z") = 1.0125
export function indexAt(time: string): number {
  const t = Date.parse(time);
  const first = KEYFRAMES[0];
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  if (t <= Date.parse(first.time)) {
    return first.index;
  }
  if (t >= Date.parse(last.time)) {
    return last.index;
  }

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const from = KEYFRAMES[i];
    const to = KEYFRAMES[i + 1];
    const fromTime = Date.parse(from.time);
    const toTime = Date.parse(to.time);
    if (t >= fromTime && t <= toTime) {
      const progress = (t - fromTime) / (toTime - fromTime);
      return from.index + (to.index - from.index) * progress;
    }
  }
  return last.index;
}

export type OracleStep = {
  newIndex: string; // Daml Decimal, for example "1.0250000000"
  newSimTime: string; // ISO time, for example "2027-01-01T00:00:00.000Z"
};

// The next value to publish, or null when the demo clock has reached maturity.
//
// Rules:
// - Move the clock forward `stepDays`, but never jump over a keyframe.
//   Example with 7-day steps: ..., Dec 24, Dec 31, Jan 1 (keyframe), Jan 8, ...
// - The index never goes down. If someone published a higher index by hand,
//   keep that one (Publish would reject a lower index anyway).
export function nextOracleStep(currentIndex: string, currentSimTime: string, stepDays: number): OracleStep | null {
  const now = Date.parse(currentSimTime);
  const maturity = Date.parse(DEMO_MATURITY);
  if (now >= maturity) {
    return null;
  }

  let next = now + stepDays * MS_PER_DAY;
  for (const keyframe of KEYFRAMES) {
    const keyframeTime = Date.parse(keyframe.time);
    if (keyframeTime > now && keyframeTime < next) {
      next = keyframeTime;
    }
  }

  const newSimTime = new Date(next).toISOString();
  const scheduledIndex = indexAt(newSimTime);
  const newIndex = Math.max(scheduledIndex, Number(currentIndex));
  return {
    newIndex: newIndex.toFixed(10),
    newSimTime,
  };
}

// Whole days from `simTime` to maturity. Example: Jan 1 2027 -> 90.
export function daysToMaturity(simTime: string): number {
  const days = (Date.parse(DEMO_MATURITY) - Date.parse(simTime)) / MS_PER_DAY;
  return Math.max(0, Math.ceil(days));
}
