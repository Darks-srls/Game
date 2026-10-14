// 🟤 Palla avvelenata: due squadre, ognuna nella sua metà campo; si lanciano polpette di gomma. Colpito al volo = fuori,
// ma chi fa lo SCATTO quando arriva la palla la prende e fa uscire chi l'ha lanciata (regole fisiche dell'arena)
import { PHYS, registerMini } from '../party3d';
import { keepSide, setMySide } from './squadre';

export const AVV = {
  halfX: 8, // campo 16 × 24: la metà dei rossi è z < 0, quella dei blu z > 0
  halfZ: 12,
  line: 0.1, // mezza larghezza della linea di metà campo (non si passa)
  balls: 4,
  ballR: 0.4,
  pickR: 1.15, // una palla a terra si prende toccandola
  speed: 17, // il lancio: velocità, spinta in su, gravità (la parabola è uguale sul telefono e sul server)
  lift: 3.8,
  gravity: 13,
  hitR: 0.75, // distanza palla-personaggio per essere colpiti
  ready: 550, // appena presa una palla non si lancia subito (niente colpi a bruciapelo all'inizio)
  reload: 450,
  maxFly: 2200, // ms: dopo tanto volo la palla non avvelena più
  assist: 0.42, // mira assistita (radianti) col mouse e col dito
  assistTouch: 0.7,
};

// la palla in volo al tempo tau (s) dal lancio: parabola esatta (il server e il telefono la calcolano uguale)
export function flyAt(f: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, tau: number) {
  return { x: f.x + f.vx * tau, y: f.y + f.vy * tau - 0.5 * AVV.gravity * tau * tau, z: f.z + f.vz * tau };
}

registerMini({
  kind: 'AVVELENATA',
  name: 'Palla avvelenata',
  tag: 'Dodgeball a squadre',
  rules:
    'Rossi contro blu, ognuno nella sua metà campo (la linea non si passa). Al centro ci sono 4 polpette di gomma: toccale per prenderle e LANCIA agli avversari. Chi viene colpito al volo è fuori… ma se in quel momento fai lo SCATTO la PRENDI e fuori ci va chi l’ha lanciata! Vince la squadra che elimina tutti gli altri (allo scadere: chi ne ha più in piedi).',
  seconds: 90,
  // sul telefono arriva la mia squadra: il mio personaggio resta nella mia metà
  sync: (ext) => setMySide(ext?.my),
  clamp: (p) => {
    const r = PHYS.radius;
    p.x = Math.max(-AVV.halfX + r, Math.min(AVV.halfX - r, p.x));
    p.z = Math.max(-AVV.halfZ + r, Math.min(AVV.halfZ - r, p.z));
    keepSide(p, AVV.line + r);
  },
});
