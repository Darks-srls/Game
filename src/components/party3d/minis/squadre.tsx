// 🔴🔵 Minigiochi a squadre (telefono): casacca del colore della squadra (col numero, se serve), anello per terra,
// tabellone in alto come il calcetto e la scritta "SEI DEI ROSSI"
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { TEAM_COL, TEAM_DARK, TEAM_NAME } from '../../../data/minis/squadre';
import { canvasTex, outlined, rbox, toy, type Avatar } from '../scene';

const RING_COL = TEAM_COL.map((c) => new THREE.Color(c));
let vestGeo: THREE.BufferGeometry | null = null;
const vestMats = new Map<string, THREE.Material[]>();

// la stoffa della casacca: colore della squadra, bordo bianco e il numero grande (davanti e dietro)
function vestMaterials(team: number, num: string) {
  const key = `${team}:${num}`;
  let m = vestMats.get(key);
  if (m) return m;
  const face = canvasTex(128, 128, (c) => {
    c.fillStyle = TEAM_COL[team];
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(0, 112, 128, 16);
    if (num) {
      c.font = `900 ${num.length > 2 ? 54 : 84}px "Lilita One", "Baloo 2", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 12;
      c.strokeStyle = '#1d0f3d';
      c.strokeText(num, 64, 60);
      c.fillStyle = '#ffffff';
      c.fillText(num, 64, 60);
    } else {
      // fascia bianca e stellina: la "pettorina" da allenamento
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(0, 44, 128, 18);
      c.fillStyle = TEAM_DARK[team];
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 9 : 20;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        c.lineTo(64 + Math.cos(a) * r, 53 + Math.sin(a) * r);
      }
      c.fill();
    }
  });
  const side = toy(TEAM_COL[team], { roughness: 0.55, clearcoat: 0.2 });
  const top = toy(TEAM_DARK[team], { roughness: 0.6, clearcoat: 0.1 });
  const front = toy('#ffffff', { map: face, roughness: 0.55, clearcoat: 0.2 });
  m = [side, side, top, top, front, front];
  vestMats.set(key, m);
  return m;
}

type VestState = { g: THREE.Group; mesh: THREE.Mesh; key: string };
const VESTS = new WeakMap<Avatar, VestState>();

// la casacca segue il corpo del personaggio (piegamenti, saltelli, schiacciamento) e l'anello per terra dice la squadra
export function wearVest(av: Avatar, team: number | undefined, num = '') {
  let st = VESTS.get(av);
  if (team !== 0 && team !== 1) {
    if (st) st.g.visible = false;
    return;
  }
  if (!st || st.g.parent !== av.deco) {
    vestGeo ??= rbox(0.96, 0.6, 0.62, 0.17);
    const mesh = outlined(new THREE.Mesh(vestGeo, vestMaterials(team, num)), 1.05);
    mesh.position.y = 0.86;
    mesh.castShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    av.deco.add(g);
    st = { g, mesh, key: `${team}:${num}` };
    VESTS.set(av, st);
  }
  const key = `${team}:${num}`;
  if (st.key !== key) {
    st.mesh.material = vestMaterials(team, num);
    st.key = key;
  }
  st.g.visible = av.body.visible;
  st.g.position.copy(av.body.position);
  st.g.quaternion.copy(av.body.quaternion);
  st.g.scale.copy(av.body.scale);
  av.ring.visible = true;
  (av.ring.material as THREE.MeshBasicMaterial).color.copy(RING_COL[team]);
}

// scritta di stato col colore della squadra
export const teamPill = (team: number, text: string) => ({ text, cls: team ? 'sc-blue' : 'sc-red' });

// il tabellone in alto (come il calcetto): ROSSI 3 · BLU 2, con quello che serve sotto
export function TeamScore({ score, myTeam, sub, children }: { score: number[]; myTeam?: number; sub?: string; children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[66px] flex flex-col items-center gap-1">
      <div className="sc-chip flex items-center gap-2 overflow-hidden !p-0">
        {[0, 1].map((t) => (
          <span key={t} className={`flex items-center gap-2 px-3 py-1 font-display text-xl text-white ${t === 1 ? 'flex-row-reverse' : ''}`} style={{ background: TEAM_COL[t] }}>
            <span className="text-sm">
              {TEAM_NAME[t]}
              {myTeam === t ? ' (tu)' : ''}
            </span>
            <span className="sc-stroke-sm text-3xl tabular-nums">{score[t] ?? 0}</span>
          </span>
        ))}
      </div>
      {sub && <p className="sc-chip px-3 py-0.5 text-[11px] font-black uppercase tracking-widest text-white">{sub}</p>}
      {children}
    </div>
  );
}
