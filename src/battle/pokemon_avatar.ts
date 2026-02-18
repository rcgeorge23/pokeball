import { PokemonInstance } from './battle_model.js';

const TYPE_PALETTE: Record<string, { primary: string; secondary: string }> = {
  Fire: { primary: '#fb7185', secondary: '#f97316' },
  Water: { primary: '#38bdf8', secondary: '#6366f1' },
  Grass: { primary: '#4ade80', secondary: '#16a34a' },
  Electric: { primary: '#facc15', secondary: '#f59e0b' },
  Rock: { primary: '#a8a29e', secondary: '#78716c' },
  Flying: { primary: '#93c5fd', secondary: '#a78bfa' },
  Dark: { primary: '#64748b', secondary: '#334155' },
  Ice: { primary: '#67e8f9', secondary: '#22d3ee' },
  Normal: { primary: '#cbd5e1', secondary: '#94a3b8' },
};

function getTypePalette(types: string[]): { primary: string; secondary: string } {
  return TYPE_PALETTE[types[0]] ?? TYPE_PALETTE.Normal;
}

function hashSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
  }
  return seed;
}

function normalizedSeed(seed: number, shift: number): number {
  const shifted = (seed >>> shift) & 0xff;
  return shifted / 255;
}

export function getPokemonAvatarTextureKey(pokemonId: string): string {
  return `pokemon-avatar-${pokemonId}`;
}

export function createPokemonAvatarSvgDataUri(
  pokemon: Pick<PokemonInstance, 'id' | 'name' | 'types'>,
  side: 'player' | 'opponent'
): string {
  const seed = hashSeed(pokemon.id);
  const { primary, secondary } = getTypePalette(pokemon.types);
  const hueRotate = Math.round(normalizedSeed(seed, 0) * 70 - 35);
  const bodyRadius = 26 + Math.round(normalizedSeed(seed, 8) * 12);
  const earOffset = 8 + Math.round(normalizedSeed(seed, 16) * 10);
  const accentWidth = 16 + Math.round(normalizedSeed(seed, 24) * 16);
  const accentHeight = 10 + Math.round(normalizedSeed(seed, 4) * 14);
  const horizontalFlip = side === 'player' ? -1 : 1;
  const eyeOffset = 11 + Math.round(normalizedSeed(seed, 12) * 6);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${pokemon.name}">
      <defs>
        <radialGradient id="bodyGradient" cx="30%" cy="28%" r="85%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
          <stop offset="100%" stop-color="${primary}" />
        </radialGradient>
      </defs>
      <g transform="translate(48 48) scale(${horizontalFlip} 1) rotate(${hueRotate * 0.15})">
        <ellipse cx="0" cy="31" rx="30" ry="8" fill="#020617" fill-opacity="0.35" />
        <path d="M -22 -18 L ${-8 - earOffset} ${-34 - earOffset} L -4 -12 Z" fill="${secondary}" />
        <path d="M 22 -18 L ${8 + earOffset} ${-34 - earOffset} L 4 -12 Z" fill="${secondary}" />
        <circle cx="0" cy="0" r="${bodyRadius}" fill="url(#bodyGradient)" stroke="#0f172a" stroke-width="2" />
        <ellipse cx="0" cy="${Math.round(accentHeight * 0.2)}" rx="${accentWidth}" ry="${accentHeight}" fill="${secondary}" fill-opacity="0.5" />
        <circle cx="${-eyeOffset}" cy="-4" r="4" fill="#0f172a" />
        <circle cx="${eyeOffset}" cy="-4" r="4" fill="#0f172a" />
        <circle cx="${-eyeOffset + 1}" cy="-5" r="1.2" fill="#f8fafc" />
        <circle cx="${eyeOffset + 1}" cy="-5" r="1.2" fill="#f8fafc" />
        <path d="M -8 10 Q 0 ${14 + Math.round(normalizedSeed(seed, 2) * 6)} 8 10" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
