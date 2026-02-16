export class SeededRng {
  private state: number;

  constructor(seed: string | number) {
    this.state = hashSeed(seed);
  }

  nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, maxInclusive: number): number {
    const low = Math.ceil(Math.min(min, maxInclusive));
    const high = Math.floor(Math.max(min, maxInclusive));
    const range = high - low + 1;

    if (!Number.isFinite(low) || !Number.isFinite(high) || range <= 0) {
      throw new Error('SeededRng.nextInt requires a valid finite integer range.');
    }

    return Math.floor(this.nextFloat() * range) + low;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('SeededRng.pick requires a non-empty array.');
    }

    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }
}

function hashSeed(seed: string | number): number {
  const seedText = String(seed);
  let hash = 2166136261;

  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
