// ⚽🚗 Axend Turbo — piccoli aiuti per la grafica: texture disegnate al volo, colori, pezzi di shader.
import * as THREE from 'three';

// texture da un canvas (niente file da scaricare)
// (text: true → si ridisegna quando il font del gioco è caricato, così le scritte non restano nel font di riserva)
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, opts: { repeat?: boolean; srgb?: boolean; aniso?: number; text?: boolean } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
  if (opts.text && fonts && !fonts.check('40px "Lilita One"'))
    fonts
      .load('40px "Lilita One"')
      .then(() => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, w, h);
        draw(g, w, h);
        t.needsUpdate = true;
      })
      .catch(() => {});
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// rumore deterministico (sempre uguale)
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// colore lineare (come lo vuole lo shader) da un esadecimale sRGB
export const lin = (hex: string) => new THREE.Color(hex);
export function mixHex(a: string, b: string, k: number) {
  return new THREE.Color(a).lerp(new THREE.Color(b), k);
}

// fine di ogni fragment shader: tone mapping e spazio colore come i materiali di three
export const FRAG_OUT = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';

// testo con contorno (scritte su canvas)
export function strokeText(g: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke: string, lw: number) {
  g.lineJoin = 'round';
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export const FONT = '"Lilita One", "Baloo 2", "Arial Black", sans-serif';

// libera geometrie, materiali e texture di un albero di oggetti
export function disposeTree(root: THREE.Object3D) {
  const seen = new Set<unknown>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !seen.has(m.geometry)) {
      seen.add(m.geometry);
      m.geometry.dispose();
    }
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture && !seen.has(v)) (seen.add(v), v.dispose());
      const u = (mat as THREE.ShaderMaterial).uniforms;
      if (u) for (const k in u) if (u[k].value instanceof THREE.Texture && !seen.has(u[k].value)) (seen.add(u[k].value), u[k].value.dispose());
      mat.dispose();
    }
  });
}
