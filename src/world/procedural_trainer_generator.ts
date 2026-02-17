import { TrainerDefinition } from './npc_controller.js';
import { DifficultyBand, MapPoint } from './generated_map.js';
import { SeededRng } from './seeded_rng.js';

interface GenerateProceduralTrainerOptions {
  worldSeed: string;
  trainerPoints: MapPoint[];
  tileSize: number;
  width: number;
  difficultyBandByTile: DifficultyBand[];
  trainerTemplates: TrainerDefinition[];
}

const DEFAULT_NAME_POOL: Record<DifficultyBand, string[]> = {
  early: ['Ari', 'Tess', 'Milo', 'Nia', 'Eli'],
  mid: ['Rowan', 'Skye', 'Mara', 'Nolan', 'Jade'],
  late: ['Vera', 'Dax', 'Orion', 'Selene', 'Kael'],
};

const DEFAULT_SPECIES_BY_BAND: Record<DifficultyBand, string[]> = {
  early: ['leafling', 'sparko'],
  mid: ['leafling', 'sparko', 'emberfox'],
  late: ['emberfox', 'sparko', 'leafling'],
};

export function generateProceduralTrainerData(
  options: GenerateProceduralTrainerOptions
): TrainerDefinition[] {
  const {
    worldSeed,
    trainerPoints,
    tileSize,
    width,
    difficultyBandByTile,
    trainerTemplates,
  } = options;

  const fallbackTemplate: TrainerDefinition = {
    id: 'trainer-template-fallback',
    name: 'Wanderer',
    party: ['leafling'],
    behavior: 'stationary',
    x: 0,
    y: 0,
  };

  const templateSpeciesByBand = deriveTemplateSpeciesByBand(
    trainerTemplates,
    difficultyBandByTile,
    trainerPoints,
    width
  );

  return trainerPoints.map((point, index) => {
    const band = difficultyBandByTile[point.y * width + point.x] ?? 'mid';
    const seed = `${worldSeed}:trainer:${index}:${point.x},${point.y}`;
    const rng = new SeededRng(seed);

    const template =
      trainerTemplates[index % Math.max(1, trainerTemplates.length)] ??
      fallbackTemplate;

    const name = pickNameForBand(rng, band);
    const party = buildPartyForBand(rng, band, templateSpeciesByBand);
    const behavior = rng.nextFloat() < 0.65 ? 'wander' : 'stationary';
    const facingDirections: Array<NonNullable<TrainerDefinition['facing']>> = [
      'up',
      'down',
      'left',
      'right',
    ];

    return {
      ...template,
      id: buildStableTrainerId(worldSeed, index, point),
      name,
      party,
      behavior,
      facing: rng.pick(facingDirections),
      x: point.x * tileSize + tileSize / 2,
      y: point.y * tileSize + tileSize / 2,
    };
  });
}

function deriveTemplateSpeciesByBand(
  trainerTemplates: TrainerDefinition[],
  difficultyBandByTile: DifficultyBand[],
  trainerPoints: MapPoint[],
  width: number
): Record<DifficultyBand, string[]> {
  const speciesSetByBand: Record<DifficultyBand, Set<string>> = {
    early: new Set(),
    mid: new Set(),
    late: new Set(),
  };

  trainerPoints.forEach((point, index) => {
    const band = difficultyBandByTile[point.y * width + point.x] ?? 'mid';
    const template = trainerTemplates[index % Math.max(1, trainerTemplates.length)];
    (template?.party ?? []).forEach((speciesId) => speciesSetByBand[band].add(speciesId));
  });

  const speciesByBand: Record<DifficultyBand, string[]> = {
    early: speciesSetByBand.early.size > 0
      ? [...speciesSetByBand.early]
      : DEFAULT_SPECIES_BY_BAND.early,
    mid: speciesSetByBand.mid.size > 0
      ? [...speciesSetByBand.mid]
      : DEFAULT_SPECIES_BY_BAND.mid,
    late: speciesSetByBand.late.size > 0
      ? [...speciesSetByBand.late]
      : DEFAULT_SPECIES_BY_BAND.late,
  };

  for (const band of ['early', 'mid', 'late'] as const) {
    if (speciesByBand[band].length === 0) {
      speciesByBand[band] = [...DEFAULT_SPECIES_BY_BAND[band]];
    }
  }

  return speciesByBand;
}

function pickNameForBand(rng: SeededRng, band: DifficultyBand): string {
  return rng.pick(DEFAULT_NAME_POOL[band]);
}

function buildPartyForBand(
  rng: SeededRng,
  band: DifficultyBand,
  speciesByBand: Record<DifficultyBand, string[]>
): string[] {
  const sizeRangeByBand: Record<DifficultyBand, [number, number]> = {
    early: [1, 2],
    mid: [2, 3],
    late: [3, 3],
  };

  const [minSize, maxSize] = sizeRangeByBand[band];
  const desiredPartySize = rng.nextInt(minSize, maxSize);
  const pool = buildSpeciesPoolForBand(band, speciesByBand);

  const party: string[] = [];
  while (party.length < desiredPartySize && pool.length > 0) {
    const choice = rng.pick(pool);
    party.push(choice);
    const index = pool.indexOf(choice);
    if (index >= 0) {
      pool.splice(index, 1);
    }
  }

  if (party.length === 0) {
    return ['leafling'];
  }

  return party;
}


function buildSpeciesPoolForBand(
  band: DifficultyBand,
  speciesByBand: Record<DifficultyBand, string[]>
): string[] {
  const orderedBandsByPriority: Record<DifficultyBand, DifficultyBand[]> = {
    early: ['early', 'mid', 'late'],
    mid: ['mid', 'early', 'late'],
    late: ['late', 'mid', 'early'],
  };

  const pool: string[] = [];
  const addUnique = (species: string): void => {
    if (!pool.includes(species)) {
      pool.push(species);
    }
  };

  for (const priorityBand of orderedBandsByPriority[band]) {
    speciesByBand[priorityBand].forEach(addUnique);
    DEFAULT_SPECIES_BY_BAND[priorityBand].forEach(addUnique);
  }

  return pool;
}

function buildStableTrainerId(seed: string, index: number, point: MapPoint): string {
  const source = `${seed}:${index}:${point.x},${point.y}`;
  let hash = 2166136261;

  for (let charIndex = 0; charIndex < source.length; charIndex += 1) {
    hash ^= source.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }

  return `generated-trainer-${hash.toString(16)}`;
}
