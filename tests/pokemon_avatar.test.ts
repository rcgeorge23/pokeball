import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPokemonAvatarSvgDataUri,
  getPokemonAvatarTextureKey,
} from '../src/battle/pokemon_avatar.js';

test('getPokemonAvatarTextureKey namespaces avatar textures', () => {
  assert.equal(getPokemonAvatarTextureKey('emberfox'), 'pokemon-avatar-emberfox');
});

test('createPokemonAvatarSvgDataUri is deterministic and includes pokemon name', () => {
  const pokemon = { id: 'emberfox', name: 'Emberfox', types: ['Fire'] };
  const uriA = createPokemonAvatarSvgDataUri(pokemon, 'player');
  const uriB = createPokemonAvatarSvgDataUri(pokemon, 'player');

  assert.equal(uriA, uriB);
  assert.ok(/^data:image\/svg\+xml;utf8,/.test(uriA));

  const decoded = decodeURIComponent(uriA.replace('data:image/svg+xml;utf8,', ''));
  assert.ok(/aria-label="Emberfox"/.test(decoded));
});

test('createPokemonAvatarSvgDataUri flips orientation by side', () => {
  const pokemon = { id: 'sparko', name: 'Sparko', types: ['Electric'] };

  const playerSvg = decodeURIComponent(
    createPokemonAvatarSvgDataUri(pokemon, 'player').replace(
      'data:image/svg+xml;utf8,',
      ''
    )
  );
  const opponentSvg = decodeURIComponent(
    createPokemonAvatarSvgDataUri(pokemon, 'opponent').replace(
      'data:image/svg+xml;utf8,',
      ''
    )
  );

  assert.ok(/scale\(-1 1\)/.test(playerSvg));
  assert.ok(/scale\(1 1\)/.test(opponentSvg));
});
