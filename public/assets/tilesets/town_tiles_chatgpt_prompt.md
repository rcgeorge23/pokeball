# Prompt to generate `town_tiles.png`

Use this prompt with ChatGPT (or another image-capable model) to recreate the missing tileset file.

## Copy/paste prompt

Create a **pixel-art tileset PNG** named **`town_tiles.png`** with the following exact specs:

- Canvas size: **64x32 px**
- Transparent background: **no** (fully opaque image)
- Layout: **2 tiles horizontally**, each tile **32x32 px**
- Style: simple top-down JRPG / retro monster-battler map prototype, clean and readable
- Tile 1 (left, x=0..31): **grass tile**
  - Base color around muted green (`#588157` or similar)
  - Add subtle checker variation/noise for texture
- Tile 2 (right, x=32..63): **dirt path tile**
  - Base color around warm brown (`#A16246` or similar)
  - Add subtle checker variation/noise for texture
- Keep both tiles flat and tileable (seamless at edges)
- No outlines, no objects, no shadows crossing tile boundaries
- Export as a **PNG file** exactly named `town_tiles.png`

If possible, include a second version with slightly higher contrast while preserving the same dimensions and layout.

