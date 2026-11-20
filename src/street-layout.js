const retailStages = new Set(['exposed', 'considered', 'purchase', 'install', 'activation', 'paid']);
const transactionStages = new Set(['purchase', 'paid']);

function noise(id, salt) {
  const value = Math.sin(id * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

export function residentPose(agent, { day = 1, minute = null, arm = 'a', channel = 'retail' } = {}) {
  const event = agent[arm];
  const trace = agent.trace?.[arm];
  let stage = 'unexposed';
  if (Array.isArray(trace)) {
    for (const entry of trace) {
      if (entry.day !== day || (minute !== null && entry.minute > minute)) continue;
      if (entry.type === 'exit') stage = 'exit';
      else if (retailStages.has(entry.type)) stage = entry.type;
    }
  } else if (event?.day === day && retailStages.has(event.stage)) {
    stage = event.stage;
  }
  const spread = noise(agent.id, 1);
  const phase = noise(agent.id, 2);
  const rotation = noise(agent.id, 3) * Math.PI * 2;
  const motion = minute === null ? null : minute * Math.PI / 720 + rotation;
  const sidewalk = {
    x: (spread - 0.5) * 31 + (motion === null ? 0 : Math.sin(motion) * 1.85),
    z: phase > 0.35 ? 1.35 + phase * 1.55 : 12.0 + phase * 1.55,
    rotation: motion === null ? rotation : Math.sign(Math.cos(motion)) * Math.PI / 2,
    activity: 'street',
    stage,
  };
  if (stage === 'unexposed') return sidewalk;
  if (channel !== 'retail') return { ...sidewalk, x: 8.5 + (spread - 0.5) * 3.0, z: 2.5 + (phase - 0.5) * 1.8, activity: 'online' };
  if (stage === 'exit') return { ...sidewalk, x: (spread - 0.5) * 6, z: 0.65 + phase * 2.2, activity: 'exit' };
  if (transactionStages.has(stage)) return { x: 3.2 + spread * 1.25, z: -4.35 + phase, rotation: Math.PI, activity: 'checkout', stage };
  if (stage === 'exposed') return { x: -0.8 + spread * 1.8, z: 0.05 - phase * 1.2, rotation: Math.PI, activity: 'entrance', stage };
  return { x: -2.6 + spread * 4.0, z: -2.6 - phase * 2.55, rotation, activity: 'browse', stage };
}

export const streetViews = {
  street: { target: [0, 0.7, -0.6], azimuth: 0.48, elevation: 0.51, span: 41 },
  store: { target: [0.1, 0.55, -3.9], azimuth: 0.30, elevation: 0.67, span: 15.5 },
};

const PALETTE = {
  base: '#273246',
  baseEdge: '#161e2b',
  asphalt: '#2f394b',
  paving: '#606879',
  seam: '#515c6d',
  curb: '#7d8795',
  white: '#d9d9ce',
  yellow: '#c0a269',
  post: '#242e3c',
  postLight: '#555b67',
  canopy: '#252b49',
  storeDark: '#333550',
  storeLight: '#80809a',
  storeFrame: '#645e87',
  floor: '#b59880',
  tile: '#997e72',
  wall: '#787d8a',
  glass: '#a9baf1',
  lit: '#ffd5a5',
  shelf: '#615252',
  product: '#775eb4',
  leafA: '#426a6d',
  leafB: '#547c74',
  leafC: '#6b8a75',
  bark: '#504953',
};

export function populateStreet(model) {
  const { box, cylinder, foliage } = model;
  const { base, baseEdge, asphalt, paving, seam, curb, white, yellow, post, postLight } = PALETTE;
  box({ at: [0, -0.53, 0.5], size: [50.4, 0.7, 39.5], color: baseEdge });
  box({ at: [0, -0.16, 0.5], size: [50, 0.18, 39], color: base });
  box({ at: [0, -0.045, 7.95], size: [49, 0.1, 7.8], color: asphalt });
  box({ at: [0, -0.047, -16], size: [49, 0.1, 4.4], color: asphalt });
  for (const x of [-21.2, 21.2]) {
    box({ at: [x, -0.04, -6], size: [6.1, 0.1, 21.8], color: asphalt });
    for (const z of [-14, -9.8, -5.6, -1.4, 2.7]) {
      box({ at: [x, 0.016, z], size: [0.1, 0.025, 1.5], color: yellow });
    }
  }

  box({ at: [0, 0.08, 1.92], size: [36.5, 0.29, 4.36], color: paving });
  box({ at: [0, 0.075, 13.32], size: [49.1, 0.28, 2.95], color: paving });
  box({ at: [0, 0.14, 4.17], size: [36.8, 0.24, 0.15], color: curb });
  box({ at: [0, 0.14, 11.86], size: [49.2, 0.24, 0.15], color: curb });
  box({ at: [0, 0.095, -7.25], size: [36, 0.32, 14.24], color: '#454d60' });
  for (let x = -23; x <= 23; x += 1.6) {
    box({ at: [x, 0.222, 13.35], size: [0.025, 0.012, 2.9], color: seam });
    if (Math.abs(x) < 18.2) box({ at: [x, 0.231, 1.92], size: [0.025, 0.012, 4.32], color: seam });
  }
  for (const z of [0.53, 2.02, 3.49, 12.78, 13.89]) {
    const streetSide = z > 10;
    box({ at: [0, streetSide ? 0.222 : 0.231, z], size: [streetSide ? 49 : 36.7, 0.012, 0.025], color: seam });
  }

  for (let x = -22; x < 23; x += 3.6) {
    if (x > -12.7 && x < -7.2) continue;
    box({ at: [x, 0.014, 8.03], size: [1.8, 0.025, 0.072], color: yellow });
  }
  for (const x of [-11.15, 13.5]) {
    for (let z = 4.72; z < 11.7; z += 0.68) {
      box({ at: [x, 0.022, z], size: [2.46, 0.025, 0.31], color: white });
    }
    box({ at: [x - 1.67, 0.026, 6.1], size: [0.085, 0.025, 2.5], color: white });
  }

  for (const x of [-16, -8.25, 6.8, 14.2]) lamp(model, x, 3.75);
  for (const x of [-18.5, -7.1, 4.55, 16]) lamp(model, x, 13.7);
  for (const x of [-14, -5, 7.75, 15.5]) tree(model, x, x < 0 ? 3.06 : 1.8);
  for (const x of [-16.7, -2.2, 10.6, 20.5]) tree(model, x, 13.68);
  for (const x of [-15.9, 15.75]) tree(model, x, -12.55);

  bench(model, -3.8, 3.21);
  bench(model, 10.83, 2.63);
  bench(model, 7.86, 13.5);
  for (const [x, z] of [[-3.1, 3.62], [9.3, 3.62], [-9.6, 0.4], [12.6, 13.91]]) {
    cylinder({ at: [x, 0.59, z], radius: 0.19, height: 0.68, color: post, sides: 10 });
    cylinder({ at: [x, 0.94, z], radius: 0.20, height: 0.075, color: postLight, sides: 10 });
  }
  for (const x of [-1.6, 1.6, -10.1, 12.3]) {
    cylinder({ at: [x, 0.52, 3.55], radius: 0.086, height: 0.56, color: post, sides: 9 });
    cylinder({ at: [x, 0.75, 3.55], radius: 0.09, height: 0.08, color: yellow, sides: 9 });
  }

  buildings(model);
  storefront(model);
  box({ at: [-11.8, 0.238, 2.62], size: [0.8, 0.025, 0.5], color: '#a39671' });
  box({ at: [13.52, 0.238, 2.62], size: [0.8, 0.025, 0.5], color: '#a39671' });

  for (const [x, z] of [[-5.7, -10], [4.8, -10], [-13.7, -1.7], [12.86, -0.7]]) {
    foliage({ at: [x, 0.48, z], size: [0.55, 0.6, 0.46], color: PALETTE.leafA });
  }
}

function lamp({ box, cylinder }, x, z) {
  const { post, postLight, lit } = PALETTE;
  cylinder({ at: [x, 0.38, z], radius: 0.21, height: 0.29, color: post, sides: 8 });
  cylinder({ at: [x, 1.83, z], radius: 0.058, height: 3.16, color: post, sides: 8 });
  box({ at: [x + 0.25, 3.4, z], size: [0.53, 0.075, 0.09], color: postLight });
  box({ at: [x + 0.55, 3.39, z], size: [0.58, 0.13, 0.29], color: post });
  box({ at: [x + 0.55, 3.313, z], size: [0.49, 0.028, 0.22], color: lit, emissive: 1.6 });
}

function tree({ box, cylinder, foliage }, x, z) {
  const { bark, leafA, leafB, leafC } = PALETTE;
  const height = 1.7 + noise(x * 70, 2) * 0.55;
  box({ at: [x, 0.18, z], size: [1.31, 0.2, 1.2], color: '#293e46' });
  box({ at: [x, 0.285, z], size: [1.19, 0.025, 1.09], color: '#827669' });
  cylinder({ at: [x, 0.27 + height / 2, z], radius: 0.087, height, color: bark, sides: 7 });
  foliage({ at: [x, height + 0.5, z], size: [1.92, 1.48, 1.63], color: leafA, rotate: 0.5 });
  foliage({ at: [x - 0.43, height + 0.94, z], size: [1.43, 1.63, 1.4], color: leafB, rotate: 0.15 });
  foliage({ at: [x + 0.34, height + 0.91, z + 0.29], size: [1.25, 1.42, 1.29], color: leafC, rotate: 1.15 });
}

function bench({ box }, x, z) {
  const slab = '#a18475';
  const legs = '#3a414d';
  for (const side of [-0.61, 0.61]) {
    box({ at: [x + side, 0.46, z], size: [0.08, 0.42, 0.51], color: legs });
    box({ at: [x + side, 0.74, z - 0.24], size: [0.08, 0.6, 0.075], color: legs });
  }
  for (const offset of [-0.16, 0, 0.16]) {
    box({ at: [x, 0.65, z + offset], size: [1.63, 0.075, 0.14], color: slab });
  }
  for (const y of [0.83, 0.98]) {
    box({ at: [x, y, z - 0.25], size: [1.63, 0.105, 0.065], color: slab });
  }
}

function buildings({ box }) {
  const blocks = [
    { x: -12.2, z: -5.0, width: 7.1, depth: 7.8, floors: 2, color: '#63778a', trim: '#8da0a6' },
    { x: -12.75, z: -10.3, width: 6.3, depth: 4.6, floors: 3, color: '#57687b', trim: '#7b929d' },
    { x: 10.39, z: -5.5, width: 5.1, depth: 7.8, floors: 3, color: '#7b636f', trim: '#a38084' },
    { x: 15.48, z: -6.69, width: 4.61, depth: 7.4, floors: 2, color: '#526985', trim: '#6f8395' },
    { x: -4.8, z: -12.59, width: 5.85, depth: 3.8, floors: 2, color: '#5a6078', trim: '#7f8298' },
    { x: 1.71, z: -12.87, width: 6.47, depth: 3.95, floors: 3, color: '#535e7a', trim: '#6e7791' },
    { x: 8.23, z: -12.17, width: 5.61, depth: 3.32, floors: 2, color: '#657989', trim: '#8496a0' },
    { x: 14.52, z: -12.82, width: 5.31, depth: 4.1, floors: 3, color: '#515c75', trim: '#65788f' },
  ];
  for (const [index, item] of blocks.entries()) {
    const { x, z, width, depth, floors, color, trim } = item;
    const height = 2.32 * floors;
    const face = z + depth / 2;
    box({ at: [x, 0.26 + height / 2, z], size: [width, height, depth], color });
    box({ at: [x, height + 0.34, z], size: [width + 0.28, 0.24, depth + 0.28], color: '#394557' });
    box({ at: [x, height + 0.55, face], size: [width + 0.25, 0.19, 0.15], color: trim });
    box({ at: [x, height + 0.73, z - 0.41], size: [1.6, 0.57, 1.14], color: '#465468' });
    box({ at: [x, height + 1.03, z - 0.41], size: [1.73, 0.10, 1.28], color: '#63727d' });

    const columns = Math.floor(width / 1.21);
    for (let floor = 0; floor < floors; floor++) {
      const y = 1.47 + floor * 2.25;
      box({ at: [x, y - 0.94, face + 0.037], size: [width + 0.09, 0.12, 0.16], color: trim });
      for (let column = 0; column < columns; column++) {
        const left = x + (column - (columns - 1) / 2) * 1.12;
        const lightsOn = noise(index * 10 + column, floor + 1) > 0.67;
        const recess = lightsOn ? '#d5a775' : '#37465b';
        box({ at: [left, y, face + 0.043], size: [0.82, 1.24, 0.12], color: trim });
        box({ at: [left, y, face + 0.109], size: [0.66, 1.05, 0.065], color: recess, emissive: lightsOn ? 0.36 : 0 });
        box({ at: [left, y, face + 0.15], size: [0.041, 1.06, 0.07], color: trim });
        box({ at: [left, y - 0.583, face + 0.139], size: [0.99, 0.105, 0.24], color: trim });
      }
      for (const edge of [-1, 1]) {
        const sideX = x + edge * (width / 2 + 0.015);
        for (let depthOffset = -depth / 2 + 0.92; depthOffset < depth / 2 - 0.26; depthOffset += 1.35) {
          const lightsOn = noise(index + depthOffset, floor + 3) > 0.76;
          box({ at: [sideX, y, z + depthOffset], size: [0.12, 1.18, 0.8], color: trim });
          box({ at: [sideX + edge * 0.072, y, z + depthOffset], size: [0.06, 0.98, 0.63], color: lightsOn ? '#b29275' : '#344356', emissive: lightsOn ? 0.34 : 0 });
        }
      }
    }
  }
}

function storefront({ box, cylinder }) {
  const { canopy, storeDark, storeLight, storeFrame, floor, tile, wall, glass, lit, shelf, product, post } = PALETTE;
  const width = 13.2;
  const depth = 8.25;
  const edgeZ = -0.39;
  const insideZ = edgeZ - depth / 2;
  const backZ = edgeZ - depth;
  const side = width / 2;
  const ceiling = 4.5;

  box({ at: [0, 0.205, insideZ], size: [width + 0.4, 0.4, depth + 0.35], color: post });
  box({ at: [0, 0.419, insideZ], size: [width, 0.08, depth], color: floor });
  box({ at: [0, 0.306, -0.07], size: [3.25, 0.16, 0.60], color: storeLight });
  box({ at: [0, 0.393, -0.03], size: [1.81, 0.065, 0.6], color: '#4f4f6b' });
  for (let x = -6; x < 7; x += 1) box({ at: [x, 0.463, insideZ], size: [0.02, 0.009, depth - 0.02], color: tile });
  for (let z = -8.2; z < edgeZ; z += 0.94) box({ at: [0, 0.463, z], size: [width, 0.009, 0.02], color: tile });

  box({ at: [0, 2.43, backZ], size: [width, 4.1, 0.24], color: wall, part: 'rear' });
  for (const direction of [-1, 1]) {
    const x = direction * side;
    box({ at: [x, 2.41, insideZ], size: [0.26, 4.0, depth], color: storeDark, part: direction > 0 ? 'side' : 'rear' });
    box({ at: [x - direction * 0.16, 0.81, insideZ], size: [0.08, 0.72, depth], color: '#8f7f7e', part: direction > 0 ? 'side' : 'rear' });
  }

  box({ at: [0, ceiling + 0.2, insideZ], size: [width + 0.48, 0.34, depth + 0.55], color: canopy, part: 'roof' });
  box({ at: [0, ceiling + 0.392, insideZ], size: [width - 0.26, 0.12, depth - 0.25], color: '#41475c', part: 'roof' });
  box({ at: [-4, ceiling + 0.56, -6.15], size: [2.47, 0.25, 1.23], color: storeLight, part: 'roof' });
  for (const x of [-4.78, -3.31]) {
    cylinder({ at: [x, ceiling + 0.71, -6.15], radius: 0.48, height: 0.13, sides: 16, color: '#2c374b', part: 'roof' });
  }

  box({ at: [0, 4.22, edgeZ + 0.17], size: [width + 0.02, 0.45, 0.43], color: storeDark, part: 'front' });
  box({ at: [0, 3.76, edgeZ + 0.56], size: [width + 0.57, 0.22, 1.00], color: canopy, part: 'front' });
  box({ at: [0, 3.641, edgeZ + 0.75], size: [width - 0.24, 0.031, 0.052], color: lit, emissive: 0.7, part: 'front' });
  for (const x of [-6.52, -3.9, -1.25, 1.25, 3.9, 6.52]) {
    box({ at: [x, 2.04, edgeZ], size: [0.152, 3.26, 0.24], color: storeFrame, part: 'front' });
  }
  for (const x of [-5.22, -2.57, 2.57, 5.22]) {
    box({ at: [x, 0.59, edgeZ], size: [2.54, 0.30, 0.18], color: storeDark, part: 'front' });
    box({ at: [x, 2.14, edgeZ], size: [2.51, 2.82, 0.028], color: glass, opacity: 0.2, part: 'front' });
    box({ at: [x, 2.06, edgeZ + 0.033], size: [2.57, 0.066, 0.095], color: storeFrame, part: 'front' });
  }
  for (const x of [-1.12, 1.12]) {
    box({ at: [x, 1.8, edgeZ - 0.24], size: [0.063, 2.77, 0.40], color: glass, opacity: 0.22, part: 'front' });
  }

  for (const x of [-4.8, -3.0, 2.6, 4.5]) {
    box({ at: [x, 1.01, -7.7], size: [1.47, 1.12, 0.51], color: shelf });
    box({ at: [x, 1.60, -7.7], size: [1.51, 0.075, 0.55], color: '#c5a58c' });
    for (const shift of [-0.42, 0, 0.42]) {
      box({ at: [x + shift, 1.74, -7.63], size: [0.21, 0.23, 0.24], color: shift === 0 ? '#d6a97e' : product });
    }
    box({ at: [x, 2.08, -8.12], size: [1.14, 0.066, 0.03], color: lit, emissive: 1.14, part: 'rear' });
  }

  for (const x of [-3.38, -0.84]) {
    box({ at: [x, 0.90, -3.55], size: [0.09, 0.87, 0.67], color: shelf });
  }
  box({ at: [-2.10, 1.385, -3.55], size: [2.78, 0.135, 1.25], color: '#d0a18a' });
  box({ at: [-2.11, 1.573, -3.63], size: [0.63, 0.22, 0.40], color: '#6952a7' });
  box({ at: [-2.09, 1.7, -3.65], size: [0.46, 0.057, 0.31], color: '#ad98ea', emissive: 0.26 });
  box({ at: [4.12, 1.00, -5.18], size: [2.40, 1.15, 0.87], color: shelf });
  box({ at: [4.12, 1.61, -5.18], size: [2.56, 0.13, 1.03], color: '#d0a18a' });
  box({ at: [4.66, 1.86, -5.31], size: [0.57, 0.36, 0.13], color: '#4c4c6a', rotate: -0.13 });
  box({ at: [4.66, 1.86, -5.234], size: [0.44, 0.25, 0.025], color: '#90a0e7', emissive: 0.32, rotate: -0.13 });
  box({ at: [4.13, 1.52, -4.72], size: [2.14, 0.035, 0.03], color: lit, emissive: 0.5 });
  for (const x of [-3.72, -1.21, 1.21, 3.72]) {
    box({ at: [x, 4.31, -4.1], size: [0.075, 0.10, 5.98], color: '#fcddba', emissive: 2, part: 'roof' });
  }
}
