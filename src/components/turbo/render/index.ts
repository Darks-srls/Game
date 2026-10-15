// ⚽🚗 Axend Turbo — la grafica 3D del gioco (Three.js).
// createTurboScene(canvas, { lowPower }) → TurboScene: render(frame), resize, setQuality, dispose.
// Stadio identico al campo della fisica, macchine stile Octane, palla di Rocket League, effetti dagli eventi,
// telecamera come RL. Pensata per i telefoni: poche chiamate di disegno, niente ombre vere, niente allocazioni
// per fotogramma, risoluzione che si adatta se il telefono fatica, qualità "bassa" che spegne gli extra.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BIG_PADS, SMALL_PADS } from '../../../game/turbo/consts';
import type { Car } from '../../../game/turbo/car';
import { V3 } from '../../../game/turbo/math';
import { soundManager } from '../../../utils/audio';
import { TEAM_COLORS, type CreateTurboScene, type Quality, type RenderFrame, type TurboEvent, type TurboScene } from '../contract';
import { BallView } from './ballView';
import { CameraRig } from './camera';
import { CarKit, CarView, type CarCtx } from './carModel';
import { S } from './coords';
import { Fx } from './fx';
import { PadsView } from './pads';
import { Stadium } from './stadium';
import { disposeTree } from './util';

export { verticalFov } from './camera';

interface Preset {
  ratio: number; // risoluzione massima (pixel per punto CSS)
  bloom: boolean;
  budget: number; // particelle
  boostRate: number; // sbuffi del boost per fotogramma
  fancy: boolean; // scie e fumo
}
const PRESETS: Record<Quality, Preset> = {
  alta: { ratio: 2, bloom: true, budget: 1, boostRate: 1, fancy: true },
  media: { ratio: 1.5, bloom: false, budget: 0.7, boostRate: 0.6, fancy: true },
  bassa: { ratio: 1, bloom: false, budget: 0.4, boostRate: 0.35, fancy: false },
};

const TEAM = [new THREE.Color(TEAM_COLORS[0]), new THREE.Color(TEAM_COLORS[1])];
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _ball = new THREE.Vector3();
const _c = new THREE.Vector3();
const _v3 = new V3();

// ---------------------------------------------------------------- la scena (senza renderer: si prova anche con node)
export class TurboView3D {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 900);
  rig: CameraRig;
  stadium: Stadium;
  pads: PadsView;
  kit: CarKit;
  fx: Fx;
  ball: BallView;
  private cars = new Map<string, CarView>();
  private carsGroup = new THREE.Group();
  private preset: Preset = PRESETS.media;
  private seen = new Set<string>();
  private ctx: CarCtx;
  private touchCool = 0;

  constructor(aniso: number) {
    this.stadium = new Stadium({ aniso });
    this.pads = new PadsView([...BIG_PADS.map(([x, y]) => ({ x, y, big: true, timer: 0 })), ...SMALL_PADS.map(([x, y]) => ({ x, y, big: false, timer: 0 }))]);
    this.kit = new CarKit();
    this.fx = new Fx();
    this.ball = new BallView(this.fx);
    this.rig = new CameraRig(this.camera);
    this.scene.add(this.stadium.group, this.pads.group, this.kit.group, this.carsGroup, this.ball.group, this.fx.group);
    this.ctx = { t: 0, dt: 0, fx: this.fx, kit: this.kit, me: false, name: '', camPos: this.camera.position, boostRate: 1, fancy: true };
  }

  setPreset(p: Preset, q: Quality) {
    this.preset = p;
    this.fx.setBudget(p.budget);
    this.stadium.setQuality(q, p.bloom);
  }

  update(f: RenderFrame) {
    const w = f.world;
    const dt = Math.min(0.1, Math.max(0, f.dt));
    const t = f.t;

    // ---- macchine
    const ctx = this.ctx;
    ctx.t = t;
    ctx.dt = dt;
    ctx.boostRate = this.preset.boostRate;
    ctx.fancy = this.preset.fancy;
    this.kit.setTime(t);
    this.seen.clear();
    let me: Car | undefined;
    for (let i = 0; i < w.cars.length; i++) {
      const car = w.cars[i];
      this.seen.add(car.id);
      if (car.id === f.myId) me = car;
      let v = this.cars.get(car.id);
      if (!v) {
        v = new CarView(car.id, car.team, this.kit, this.fx, this.carsGroup);
        this.cars.set(car.id, v);
      }
      ctx.me = car.id === f.myId;
      ctx.name = f.names[car.id] ?? '';
      v.update(car, f.offsets.get(car.id), ctx);
    }
    for (const [id, v] of this.cars)
      if (!this.seen.has(id)) {
        v.dispose(this.kit, this.fx);
        this.cars.delete(id);
      }
    this.kit.flush();

    // ---- palla e cuscinetti
    const bo = f.offsets.get('ball');
    _ball.set(w.ball.pos.x + (bo?.x ?? 0), w.ball.pos.y + (bo?.y ?? 0), w.ball.pos.z + (bo?.z ?? 0));
    this.ball.update(w.ball, bo, w.phase, dt, this.preset.fancy);
    this.pads.update(w.pads, t, dt);

    // ---- eventi: effetti e suoni
    this.touchCool = Math.max(0, this.touchCool - dt);
    for (const e of f.events) this.onEvent(e, f, me);

    // ---- telecamera, effetti, stadio
    this.rig.update(w, me, me ? f.offsets.get(me.id) : undefined, _ball, f.cam, f.look, t, dt);
    this.fx.update(dt, this.camera.position);
    this.stadium.setScore(w.score[0], w.score[1]);
    this.stadium.update(t, dt);
  }

  // distanza dalla telecamera (uu) → volume
  private near(p: THREE.Vector3) {
    const d = this.rig.posUU.distanceTo(_c.set(p.x / S, -p.z / S, p.y / S));
    return Math.max(0, Math.min(1, 1.25 - d / 5000));
  }

  private carPos(id: string, f: RenderFrame, out: THREE.Vector3) {
    const c = f.world.car(id);
    if (!c) return null;
    const o = f.offsets.get(id);
    return out.set((c.pos.x + (o?.x ?? 0)) * S, (c.pos.z + (o?.z ?? 0)) * S, -(c.pos.y + (o?.y ?? 0)) * S);
  }

  private onEvent(e: TurboEvent, f: RenderFrame, me: Car | undefined) {
    const myTeam = me?.team ?? -1;
    switch (e.k) {
      case 'goal': {
        // esplosione enorme del colore di chi segna, la palla sparisce
        this.fx.explosion(this.ball.pos, TEAM[e.team], 1.7, true);
        this.ball.hide();
        this.stadium.goal(e.team);
        this.rig.shake(this.near(this.ball.pos) > 0.3 ? 0.9 : 0.55);
        soundManager.playBoom();
        if (e.team === myTeam) setTimeout(() => soundManager.playSuccess(), 250);
        break;
      }
      case 'demo': {
        const mine = e.by === f.myId || e.victim === f.myId;
        const p = this.carPos(e.victim, f, _p);
        const k = mine ? 1 : p ? this.near(p) : 0;
        if (mine) this.rig.shake(e.victim === f.myId ? 0.8 : 0.45);
        else if (k > 0.5) this.rig.shake(0.25 * k);
        if (mine || k > 0.6) soundManager.playBoom();
        else if (k > 0) soundManager.playNote(70, 0.4, { type: 'sawtooth', vol: 0.12 * k, slideTo: 30 });
        break;
      }
      case 'touch': {
        const p = this.carPos(e.id, f, _p);
        if (!p) break;
        // il punto della palla verso la macchina (un po' sopra il centro della macchina)
        p.y += 0.2;
        this.ball.surfaceToward(p, _c, _n);
        this.fx.sparks(_c, _n, e.power);
        const mine = e.id === f.myId;
        if (mine && e.power > 1800) this.rig.shake(Math.min(0.35, e.power / 9000));
        if (this.touchCool <= 0) {
          this.touchCool = 0.06;
          const vol = Math.min(1, e.power / 3000) * (mine ? 1 : this.near(_c));
          if (vol > 0.04) {
            soundManager.playNote(150 - Math.min(80, e.power / 50), 0.16, { type: 'triangle', vol: 0.32 * vol, slideTo: 55 });
            if (e.power > 2600 && (mine || vol > 0.5)) soundManager.playBonk();
          }
        }
        break;
      }
      case 'bump': {
        const a = this.carPos(e.a, f, _p);
        const b = f.world.car(e.b);
        if (a && b) {
          _c.set(b.pos.x * S, b.pos.z * S, -b.pos.y * S).add(a).multiplyScalar(0.5);
          _n.set(0, 1, 0);
          this.fx.sparks(_c, _n, 1600);
        }
        if (e.a === f.myId || e.b === f.myId) {
          soundManager.playBonk();
          this.rig.shake(0.2);
        }
        break;
      }
      case 'pad': {
        this.pads.position(e.i, _p);
        const big = this.pads.isBig(e.i);
        this.fx.pad(_p, big);
        if (e.id === f.myId) {
          if (big) soundManager.playPop();
          else soundManager.playNote(1180, 0.06, { type: 'triangle', vol: 0.05, slideTo: 1500 });
        }
        break;
      }
      case 'flipreset': {
        const c = f.world.car(e.id);
        const p = this.carPos(e.id, f, _p);
        if (c && p) {
          c.up(_v3);
          _n.set(_v3.x, _v3.z, -_v3.y);
          this.fx.flipReset(p, _n);
        }
        if (e.id === f.myId) {
          soundManager.playNote(1318.5, 0.18, { type: 'triangle', vol: 0.1 });
          soundManager.playNote(1975.5, 0.22, { type: 'triangle', vol: 0.08 }, 0.07);
        }
        break;
      }
      case 'save':
      case 'shot': {
        const c = f.world.car(e.id);
        if (c) this.stadium.cheer(c.team, e.k === 'save' ? 0.5 : 0.35);
        break;
      }
      case 'end':
        if (e.winner === 0 || e.winner === 1) this.stadium.cheer(e.winner, 1);
        break;
      case 'kickoff':
        this.fx.ribbons.clearAll();
        break;
      default:
        break;
    }
  }

  dispose() {
    for (const v of this.cars.values()) v.dispose(this.kit, this.fx);
    this.cars.clear();
    disposeTree(this.scene);
  }
}

// ---------------------------------------------------------------- il renderer
export const createTurboScene: CreateTurboScene = (canvas, opts) => {
  const lowPower = !!opts?.lowPower;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance', stencil: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor('#0b1028');
  const aniso = Math.min(lowPower ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const view = new TurboView3D(aniso);
  // riflessi morbidi su vernice e palla (una stanza luminosa finta, calcolata una volta)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  view.scene.environment = env;
  view.scene.environmentIntensity = 0.6;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  let quality: Quality = lowPower ? 'media' : 'alta';
  let preset = PRESETS[quality];
  let width = 1;
  let height = 1;
  let dyn = 1; // risoluzione dinamica (scende se il telefono fatica)
  let ratio = 1;
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let slowT = 0;
  let fastT = 0;
  let avg = 1 / 60;

  const maxRatio = () => Math.min(dpr, preset.ratio * (lowPower ? 0.85 : 1));
  const applySize = () => {
    ratio = Math.max(0.6, maxRatio() * dyn);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
    }
    view.rig.setAspect(width / Math.max(1, height));
  };
  const makeComposer = () => {
    if (composer) return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(view.scene, view.camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.42, 0.9);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  };
  const dropComposer = () => {
    if (!composer) return;
    bloomPass?.dispose();
    composer.dispose();
    composer = null;
    bloomPass = null;
  };
  const setQuality = (q: Quality) => {
    quality = PRESETS[q] ? q : 'media';
    preset = PRESETS[quality];
    dyn = 1;
    slowT = fastT = 0;
    if (preset.bloom) makeComposer();
    else dropComposer();
    view.setPreset(preset, quality);
    applySize();
  };
  setQuality(quality);

  const scene: TurboScene = {
    render(f) {
      if (f.quality && f.quality !== quality) setQuality(f.quality);
      view.update(f);
      // risoluzione dinamica: sotto i ~38 fps per un po' si scende (al massimo del 25%), sopra i 57 si risale piano
      const dt = Math.min(0.25, Math.max(0, f.dt));
      avg += (dt - avg) * 0.05;
      if (avg > 1 / 38) {
        slowT += dt;
        fastT = 0;
        if (slowT > 2 && dyn > 0.75) {
          dyn = Math.max(0.75, dyn - 0.1);
          slowT = 0;
          applySize();
        }
      } else if (avg < 1 / 57) {
        fastT += dt;
        slowT = 0;
        if (fastT > 5 && dyn < 1) {
          dyn = Math.min(1, dyn + 0.05);
          fastT = 0;
          applySize();
        }
      } else slowT = fastT = 0;
      if (composer) composer.render(dt);
      else renderer.render(view.scene, view.camera);
    },
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      applySize();
    },
    setQuality,
    dispose() {
      view.dispose();
      dropComposer();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
  return scene;
};

export default createTurboScene;
