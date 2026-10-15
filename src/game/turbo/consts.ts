// ⚽🚗 Axend Turbo — costanti della fisica di Rocket League (valori di RocketSim, misurati dal gioco vero).
// Unità: uu (1 uu = 1 cm), uu/s, secondi. Il gioco gira a 120 passi al secondo come Rocket League.

export const TICK_RATE = 120;
export const DT = 1 / TICK_RATE;
export const GRAVITY = 650; // uu/s² verso il basso

// ---------------------------------------------------------------- campo (Soccar standard)
export const ARENA = {
  extentX: 4096, // muri laterali
  extentY: 5120, // muri di fondo (linea di porta)
  height: 2044, // soffitto
  cornerSum: 8064, // angoli smussati a 45°: |x| + |y| = 8064
  wallFillet: 256, // raccordo curvo tra pavimento/soffitto e muri
  edgeFillet: 200, // raccordo tra muro laterale e angolo
  goalHalfW: 892.755, // porta: larga 1785,5
  goalHeight: 642.775,
  goalDepth: 880, // fino a |y| = 6000
  goalScoreY: 5124.25, // la palla deve superare questa quota + il raggio
};

// ---------------------------------------------------------------- palla
export const BALL = {
  radius: 91.25,
  mass: 30,
  restZ: 93.15,
  drag: 0.03, // smorzamento lineare (Bullet): v *= (1 - 0.03)^dt
  maxSpeed: 6000,
  maxAngSpeed: 6,
  // rimbalzo sul campo (modello misurato sul gioco): restituzione, attrito, rotazione
  restitution: 0.6,
  friction: 0.285,
  frictionY: 2,
  spinA: 0.0003,
};

// ---------------------------------------------------------------- macchina (Octane)
export const CAR = {
  mass: 180,
  maxSpeed: 2300,
  maxAngSpeed: 5.5,
  restZ: 17, // altezza dell'origine a riposo sul pavimento
  hitboxSize: [120.507, 86.6994, 38.6591] as const,
  hitboxOffset: [13.8757, 0, 20.755] as const,
  // ruote: [x, y] di attacco, raggio, lunghezza a riposo della sospensione
  wheels: [
    { x: 51.25, y: 25.9, radius: 12.5, rest: 38.755, front: true },
    { x: 51.25, y: -25.9, radius: 12.5, rest: 38.755, front: true },
    { x: -33.75, y: 29.5, radius: 15, rest: 37.055, front: false },
    { x: -33.75, y: -29.5, radius: 15, rest: 37.055, front: false },
  ],
  suspensionTravel: 6, // ± uu
  // molla e smorzatori (convertiti in accelerazioni uu/s² per uu di compressione / per uu/s)
  springFront: 99.3,
  springBack: 150.75,
  dampCompFront: 4.97,
  dampRelaxFront: 7.94,
  dampCompBack: 7.54,
  dampRelaxBack: 12.06,

  throttleAccel: 400, // per ruota (4 ruote = 1600 uu/s² a velocità zero)
  brakeAccel: 875, // per ruota (4 ruote = 3500 uu/s²)
  coastingBrakeFactor: 0.15, // 525 uu/s² quando non si accelera
  stoppingForwardVel: 25,
  airThrottleAccel: 200 / 3,

  boostMax: 100,
  boostPerSecond: 100 / 3,
  boostMinTime: 0.1,
  boostAccelGround: 2975 / 3,
  boostAccelAir: 3175 / 3,
  boostSpawn: 100 / 3,

  supersonicStart: 2200,
  supersonicMaintainMin: 2100,
  supersonicMaintainTime: 1,

  powerslideRise: 5,
  powerslideFall: 2,

  jumpAccel: 4375 / 3,
  jumpImmediate: 875 / 3,
  jumpMinTime: 0.025,
  jumpMaxTime: 0.2,
  jumpResetPad: 1 / 40,
  doubleJumpMaxDelay: 1.25,
  dodgeDeadzone: 0.5,

  flipZDamp120: 0.35,
  flipZDampStart: 0.15,
  flipZDampEnd: 0.21,
  flipTorqueTime: 0.65,
  flipPitchlockExtra: 0.3,
  flipInitialVel: 500,
  flipForwardScale: 1,
  flipSideScale: 1.9,
  flipBackwardScale: 2.5,
  flipBackwardScaleX: 16 / 15,
  // accelerazione angolare della capriola (rad/s²): coppia della capriola convertita come il controllo in aria
  flipAlphaPitch: 224 * (12.14599781908070 / 130),
  flipAlphaRoll: 260 * (36.07956616966136 / 400),

  // controllo in aria (accelerazioni angolari misurate, rad/s²)
  airTorqueRoll: 36.07956616966136,
  airTorquePitch: 12.14599781908070,
  airTorqueYaw: 8.91962804287785,
  airDampRoll: 4.47166302201591,
  airDampPitch: 2.798194258050845,
  airDampYaw: 1.886491900437232,

  autoflipImpulse: 200,
  autoflipTorque: 50,
  autoflipTime: 0.4,
  autoflipNormZ: Math.SQRT1_2,
  autoflipRollThresh: 2.8,
  autorollAccel: 100,
  autorollTorque: 9,

  respawnTime: 3,
  bumpCooldown: 0.25,
  bumpMinForward: 40, // il colpo deve arrivare dal muso
};

// Attrito laterale (RocketSim): impulso "bilaterale" smorzato a 0,2, moltiplicato per massa/3 e dt
export const LAT_FRICTION_K = CAR.mass / 3;
// Freno "a rotolamento" vicino a velocità zero (113,74 in unità Bullet = /50)
export const ROLLING_K = 113.73963 / 50;

// ---------------------------------------------------------------- curve (x: y)
export const STEER_ANGLE_FROM_SPEED: [number, number][] = [
  [0, 0.53356],
  [500, 0.3193],
  [1000, 0.18203],
  [1500, 0.1057],
  [1750, 0.08507],
  [3000, 0.03454],
];
export const POWERSLIDE_STEER_FROM_SPEED: [number, number][] = [
  [0, 0.39235],
  [2500, 0.1261],
];
export const DRIVE_SPEED_TORQUE_FACTOR: [number, number][] = [
  [0, 1],
  [1400, 0.1],
  [1410, 0],
];
export const NON_STICKY_FRICTION: [number, number][] = [
  [0, 0.1],
  [0.7075, 0.5],
  [1, 1],
];
export const LAT_FRICTION: [number, number][] = [
  [0, 1],
  [1, 0.2],
];
export const HANDBRAKE_LAT_FACTOR: [number, number][] = [[0, 0.1]];
export const HANDBRAKE_LONG_FACTOR: [number, number][] = [
  [0, 0.5],
  [1, 0.9],
];
export const BALL_CAR_EXTRA_IMPULSE: [number, number][] = [
  [0, 0.65],
  [500, 0.65],
  [2300, 0.55],
  [4600, 0.3],
];
export const BALL_CAR_EXTRA = { zScale: 0.35, forwardScale: 0.65, maxDeltaVel: 4600 };
export const BUMP_VEL_GROUND: [number, number][] = [
  [0, 5 / 6],
  [1400, 1100],
  [2200, 1530],
];
export const BUMP_VEL_AIR: [number, number][] = [
  [0, 5 / 6],
  [1400, 1390],
  [2200, 1945],
];
export const BUMP_UPWARD_VEL: [number, number][] = [
  [0, 1 / 3],
  [1400, 278],
  [2200, 417],
];

// attriti/restituzioni dei contatti
export const CONTACT = {
  carBallFriction: 2,
  carBallRestitution: 0,
  carWorldFriction: 0.3,
  carWorldRestitution: 0.3,
  carCarFriction: 0.09,
  carCarRestitution: 0.1,
};

// ---------------------------------------------------------------- cuscinetti del boost
export const PADS = {
  bigRadius: 208,
  smallRadius: 144,
  height: 95,
  bigCooldown: 10,
  smallCooldown: 4,
  bigAmount: 100,
  smallAmount: 12,
};
export const BIG_PADS: [number, number][] = [
  [-3584, 0],
  [3584, 0],
  [-3072, 4096],
  [3072, 4096],
  [-3072, -4096],
  [3072, -4096],
];
export const SMALL_PADS: [number, number][] = [
  [0, -4240], [-1792, -4184], [1792, -4184], [-940, -3308], [940, -3308], [0, -2816], [-3584, -2484], [3584, -2484],
  [-1788, -2300], [1788, -2300], [-2048, -1036], [0, -1024], [2048, -1036], [-1024, 0], [1024, 0], [-2048, 1036],
  [0, 1024], [2048, 1036], [-1788, 2300], [1788, 2300], [-3584, 2484], [3584, 2484], [0, 2816], [-940, 3308],
  [940, 3308], [-1792, 4184], [1792, 4184], [0, 4240],
];

// ---------------------------------------------------------------- partenze (squadra blu; l'arancione è specchiata)
// [x, y, yaw] — yaw 0 = verso +x, π/2 = verso +y (la porta avversaria per i blu)
export const KICKOFF_SPAWNS: [number, number, number][] = [
  [-2048, -2560, 0.7854],
  [2048, -2560, 2.3562],
  [-256, -3840, 1.5708],
  [256, -3840, 1.5708],
  [0, -4608, 1.5708],
];
// quali partenze si usano per 1, 2 o 3 giocatori a squadra (come in Rocket League)
export const KICKOFF_SETS: Record<number, number[]> = { 1: [4], 2: [2, 3], 3: [0, 1, 4] };
export const RESPAWNS: [number, number, number][] = [
  [-2304, -4608, 1.5708],
  [-2688, -4608, 1.5708],
  [2304, -4608, 1.5708],
  [2688, -4608, 1.5708],
];

export const MATCH = {
  seconds: 300, // 5 minuti
  countdown: 3, // 3, 2, 1, VIA!
  goalPause: 3, // festa del gol prima della ripartenza
};
