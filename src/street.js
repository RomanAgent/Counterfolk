import * as THREE from '../vendor/three/three.module.js';
import { populateStreet, residentPose, streetViews } from './street-layout.js';

export { residentPose } from './street-layout.js';

const BACKGROUND = '#1a2031';
const segmentColors = { value: '#71b5aa', practical: '#a292e5', enthusiast: '#edb385' };
const skinColors = ['#edb59c', '#b9826e', '#dca579', '#774d46'];
const hairColors = ['#312936', '#473340', '#534449', '#323244'];
const activityColors = { street: '#8d9ab9', online: '#8cc8df', entrance: '#ccb3ff', browse: '#bc9eff', checkout: '#ffce88', exit: '#c3aed4' };
const maxRenderedAgents = 40;

function localGeometry(materials) {
  const geometries = new Map();
  const groups = new Map();
  const matrix = new THREE.Matrix4();
  const object = new THREE.Object3D();

  function geometry(type, sides) {
    const key = type === 'cylinder' ? `${type}:${sides}` : type;
    if (!geometries.has(key)) {
      let result;
      if (type === 'cylinder') result = new THREE.CylinderGeometry(1, 1, 1, sides);
      else if (type === 'foliage') result = new THREE.IcosahedronGeometry(0.5, 0);
      else result = new THREE.BoxGeometry(1, 1, 1);
      geometries.set(key, result);
    }
    return geometries.get(key);
  }

  function add(type, {
    at, size, radius, height, sides = 12, color, part = 'base', rotate = 0, emissive = 0, opacity = 1,
  }) {
    const key = [part, type, sides, color, emissive, opacity].join(':');
    let batch = groups.get(key);
    if (!batch) {
      batch = { part, type, sides, color, emissive, opacity, entries: [] };
      groups.set(key, batch);
    }
    batch.entries.push({ at, size: size ?? [radius, height, radius], rotate });
  }

  return {
    box: (options) => add('box', options),
    cylinder: (options) => add('cylinder', options),
    foliage: (options) => add('foliage', options),
    finish(parts) {
      for (const { part, type, sides, color, emissive, opacity, entries } of groups.values()) {
        const material = materials.standard(color, { emissive, opacity });
        const mesh = new THREE.InstancedMesh(geometry(type, sides), material, entries.length);
        for (const [index, entry] of entries.entries()) {
          object.position.set(...entry.at);
          object.rotation.y = entry.rotate;
          object.scale.set(...entry.size);
          object.updateMatrix();
          matrix.copy(object.matrix);
          mesh.setMatrixAt(index, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = opacity === 1 && entries.some(({ size }) => size[1] > 0.15);
        mesh.receiveShadow = opacity === 1;
        parts[part].add(mesh);
      }
      return [...geometries.values()];
    },
  };
}

function materialLibrary() {
  const library = new Map();

  function standard(color, { emissive = 0, opacity = 1 } = {}) {
    const key = [color, emissive, opacity].join(':');
    if (!library.has(key)) {
      const glass = opacity !== 1;
      library.set(key, new THREE.MeshStandardMaterial({
        color, flatShading: true, roughness: glass ? 0.24 : 0.83, metalness: glass ? 0.22 : 0.02,
        emissive: emissive ? color : '#000000', emissiveIntensity: emissive,
        transparent: glass, opacity, depthWrite: !glass,
      }));
    }
    return library.get(key);
  }

  return { standard, dispose: () => library.forEach((material) => material.dispose()) };
}

function textSign(parent, { at, size, color = '#f7e8d7', background = '#39304d', emblem = false }) {
  const board = document.createElement('canvas');
  board.width = 832;
  board.height = 120;
  const context = board.getContext('2d');
  const texture = new THREE.CanvasTexture(board);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(...size);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...at);
  parent.add(mesh);

  let last = '';
  function write(value) {
    const safeText = String(value ?? '').slice(0, 54);
    if (safeText === last) return;
    last = safeText;
    context.clearRect(0, 0, board.width, board.height);
    context.fillStyle = background;
    context.fillRect(2, 4, board.width - 4, board.height - 8);
    context.strokeStyle = emblem ? '#a58cdc' : '#be9a7d';
    context.lineWidth = 3;
    context.strokeRect(6, 8, board.width - 12, board.height - 16);
    if (emblem) {
      context.lineWidth = 4;
      context.beginPath();
      context.arc(67, 60, 28, 0, 2 * Math.PI);
      context.ellipse(67, 60, 13, 28, 0.52, 0, 2 * Math.PI);
      context.moveTo(40, 60);
      context.lineTo(94, 60);
      context.stroke();
    }
    const textStart = emblem ? 122 : 28;
    context.font = `650 ${emblem ? 67 : 54}px system-ui, "PingFang SC", sans-serif`;
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(safeText, textStart, 62, board.width - textStart - 24);
    texture.needsUpdate = true;
  }

  return { write, dispose() { texture.dispose(); geometry.dispose(); material.dispose(); } };
}

function streetLights(scene) {
  scene.add(new THREE.HemisphereLight('#c3d0ed', '#64566a', 2.15));
  const key = new THREE.DirectionalLight('#ffdbc3', 1.36);
  key.position.set(-9, 17, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 21, bottom: -21, near: 0.5, far: 58 });
  key.shadow.normalBias = 0.055;
  key.shadow.bias = -0.00012;
  scene.add(key);

  const rim = new THREE.DirectionalLight('#858de7', 0.75);
  rim.position.set(8, 11, -13);
  scene.add(rim);

  for (const x of [-3.6, 3.6]) {
    const interior = new THREE.PointLight('#ffd0a2', 36, 9, 2);
    interior.position.set(x, 3.07, -3.2);
    scene.add(interior);
  }
}

function residentFactory(scene, materials) {
  const figures = new THREE.Group();
  scene.add(figures);
  const groups = [];
  const geometry = {
    block: new THREE.BoxGeometry(1, 1, 1),
    body: new THREE.CapsuleGeometry(0.19, 0.29, 4, 7),
    head: new THREE.IcosahedronGeometry(0.16, 1),
    marker: new THREE.RingGeometry(0.34, 0.40, 24),
    disc: new THREE.CircleGeometry(0.32, 22),
    bag: new THREE.BoxGeometry(0.22, 0.27, 0.14),
    point: new THREE.IcosahedronGeometry(0.10, 0),
  };
  const stageMaterials = Object.fromEntries(
    Object.entries(activityColors).map(([activity, color]) => [activity, new THREE.MeshBasicMaterial({
      color, toneMapped: false, side: THREE.DoubleSide,
    })])
  );
  const selected = new THREE.MeshBasicMaterial({ color: '#f4e7ff', toneMapped: false, side: THREE.DoubleSide });
  const shadow = new THREE.MeshBasicMaterial({ color: '#202536', transparent: true, opacity: 0.26, depthWrite: false });

  function bodyMesh(parent, shape, material, at, scale) {
    const mesh = new THREE.Mesh(geometry[shape], material);
    mesh.position.set(...at);
    if (scale) mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  function make(index) {
    const group = new THREE.Group();
    const shadowMesh = bodyMesh(group, 'disc', shadow, [0, 0.016, 0], [1.1, 0.80, 1]);
    shadowMesh.rotation.x = -Math.PI / 2;
    const surround = bodyMesh(group, 'marker', stageMaterials.street, [0, 0.028, 0]);
    surround.rotation.x = -Math.PI / 2;
    const vertices = new THREE.Group();
    group.add(vertices);
    const pants = materials.standard(index % 2 ? '#3d4058' : '#404d64');
    bodyMesh(vertices, 'block', pants, [-0.105, 0.30, 0], [0.138, 0.54, 0.145]);
    bodyMesh(vertices, 'block', pants, [0.105, 0.30, 0], [0.138, 0.54, 0.145]);
    for (const x of [-0.105, 0.105]) {
      bodyMesh(vertices, 'block', materials.standard('#292a3a'), [x, 0.075, 0.04], [0.154, 0.15, 0.25]);
    }
    const torso = bodyMesh(vertices, 'body', materials.standard('#b49bdb'), [0, 0.79, 0], [1, 0.97, 0.73]);
    const arms = [-0.198, 0.198].map((x, position) => {
      const sleeve = bodyMesh(vertices, 'block', materials.standard('#b49bdb'), [x, 0.78, 0], [0.105, 0.39, 0.125]);
      sleeve.rotation.z = position ? 0.14 : -0.14;
      return sleeve;
    });
    const head = bodyMesh(vertices, 'head', materials.standard(skinColors[0]), [0, 1.21, 0.03], [0.88, 1.1, 0.92]);
    const hair = bodyMesh(vertices, 'head', materials.standard(hairColors[0]), [0, 1.276, -0.012], [0.91, 0.76, 0.93]);
    const bag = bodyMesh(vertices, 'bag', materials.standard('#c99c65'), [0.27, 0.50, 0]);
    const product = bodyMesh(vertices, 'block', materials.standard('#8788ba', { emissive: 0.3 }), [-0.16, 0.85, 0.13], [0.16, 0.12, 0.028]);
    const pin = bodyMesh(vertices, 'point', stageMaterials.street, [0, 1.63, 0]);
    figures.add(group);
    return { group, surround, vertices, torso, arms, head, hair, bag, product, pin };
  }

  function update(agents, input) {
    agents.slice(0, maxRenderedAgents).forEach((agent, index) => {
      const item = (groups[index] ??= make(index));
      const pose = residentPose(agent, input);
      const { group, surround, vertices, torso, arms, head, hair, bag, product, pin } = item;
      const ground = pose.z < -0.40 ? 0.471 : 0.24;
      const isSelected = agent.id === input.selectedId;
      group.visible = true;
      group.position.set(pose.x, ground, pose.z);
      group.rotation.y = pose.rotation;
      group.userData.residentId = agent.id;
      vertices.scale.setScalar(isSelected ? 1.12 : 1);
      const shirt = materials.standard(segmentColors[agent.segment] ?? '#b49bdb');
      torso.material = shirt;
      for (const sleeve of arms) sleeve.material = shirt;
      head.material = materials.standard(skinColors[agent.id % skinColors.length]);
      hair.material = materials.standard(hairColors[(agent.id >> 2) % hairColors.length]);
      bag.visible = pose.activity === 'checkout' || (pose.activity === 'exit' && agent[input.arm]?.stage === 'purchase');
      product.visible = pose.activity === 'online' || pose.activity === 'browse';
      surround.material = isSelected ? selected : stageMaterials[pose.activity];
      surround.scale.setScalar(isSelected ? 1.38 : 0.98);
      pin.material = isSelected ? selected : stageMaterials[pose.activity];
      pin.scale.setScalar(isSelected ? 1.4 : 0.78);
      pin.visible = isSelected || pose.activity !== 'street';
    });
    for (let index = Math.min(agents.length, maxRenderedAgents); index < groups.length; index++) groups[index].group.visible = false;
  }

  return {
    update,
    rayTargets: () => groups.filter(({ group }) => group.visible).flatMap(({ torso, head, pin }) => pin.visible ? [head, torso, pin] : [head, torso]),
    dispose() {
      Object.values(geometry).forEach((resource) => resource.dispose());
      Object.values(stageMaterials).forEach((resource) => resource.dispose());
      selected.dispose();
      shadow.dispose();
    },
  };
}

function interpolate(current, goal, alpha) {
  current.azimuth = THREE.MathUtils.lerp(current.azimuth, goal.azimuth, alpha);
  current.elevation = THREE.MathUtils.lerp(current.elevation, goal.elevation, alpha);
  current.span = THREE.MathUtils.lerp(current.span, goal.span, alpha);
  for (let axis = 0; axis < 3; axis++) current.target[axis] = THREE.MathUtils.lerp(current.target[axis], goal.target[axis], alpha);
}

function copyCamera({ target, azimuth, elevation, span }) {
  return { target: [...target], azimuth, elevation, span };
}

export function createStreetScene(canvas, {
  onResidentSelect = () => {},
  onViewChange = () => {},
  onUnavailable = () => {},
} = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'default',
    });
  } catch {
    throw new Error('当前浏览器无法启动 WebGL，仍可用下方居民面板查看事件。');
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, 0.25, 170);
  const target = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const materials = materialLibrary();
  const parts = Object.fromEntries(['base', 'front', 'rear', 'side', 'roof'].map((name) => {
    const group = new THREE.Group();
    group.name = name;
    scene.add(group);
    return [name, group];
  }));

  const geometry = localGeometry(materials);
  populateStreet(geometry);
  const worldGeometry = geometry.finish(parts);
  streetLights(scene);

  const storeSign = textSign(parts.front, { at: [0, 4.225, 0.024], size: [5.65, 0.61], emblem: true });
  storeSign.write('COUNTERFOLK');
  const productSign = textSign(parts.rear, { at: [0, 2.99, -8.497], size: [4.32, 0.54], color: '#fff1e0', background: '#655055' });
  productSign.write('体验陈列');
  const doorGeometry = new THREE.BoxGeometry(2.25, 3.35, 0.02);
  const doorMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const door = new THREE.Mesh(doorGeometry, doorMaterial);
  door.position.set(0, 2.05, -0.20);
  parts.front.add(door);

  const residents = residentFactory(scene, materials);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const input = new AbortController();
  const options = { signal: input.signal };
  let state = copyCamera(streetViews.street);
  let transition;
  let view = 'street';
  let drag;
  let frame = 0;
  let width = 0;
  let height = 0;
  let ratio = 0;
  let lost = false;
  let destroyed = false;
  let applied = { agents: [], day: 1, minute: null, arm: 'a', selectedId: null, productName: '', channel: 'retail' };

  canvas.style.touchAction = 'pan-y pinch-zoom';
  canvas.style.cursor = 'grab';

  function syncCamera() {
    const aspect = width / height;
    const horizontal = aspect > 1.02 ? state.span * 0.5 : state.span * (0.35 + aspect * 0.17);
    camera.left = -horizontal;
    camera.right = horizontal;
    camera.top = horizontal / aspect;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    const distance = 47;
    const groundDistance = distance * Math.cos(state.elevation);
    target.set(...state.target);
    camera.position.set(
      target.x + groundDistance * Math.sin(state.azimuth),
      target.y + distance * Math.sin(state.elevation),
      target.z + groundDistance * Math.cos(state.azimuth),
    );
    camera.lookAt(target);
  }

  function render(time) {
    frame = 0;
    if (!width || !height || lost || document.hidden || destroyed) return;
    if (transition) {
      const phase = Math.min(1, (time - transition.start) / 310);
      const eased = 1 - (1 - phase) ** 3;
      state = copyCamera(transition.from);
      interpolate(state, transition.to, eased);
      if (phase === 1) transition = null;
    }
    syncCamera();
    renderer.render(scene, camera);
    if (transition) queueFrame();
  }

  function queueFrame() {
    if (!frame && !lost && !destroyed && !document.hidden && width && height) frame = requestAnimationFrame(render);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (width !== w || height !== h || ratio !== dpr) {
      width = w;
      height = h;
      ratio = dpr;
      if (width && height) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
      }
    }
    queueFrame();
  }

  function moveCamera(goal) {
    transition = reduced.matches ? null : { from: copyCamera(state), to: copyCamera(goal), start: performance.now() };
    if (!transition) state = copyCamera(goal);
    queueFrame();
  }

  function setView(next) {
    if (view === next) return;
    view = next;
    const exterior = next === 'street';
    for (const part of ['roof', 'front', 'side']) parts[part].visible = exterior;
    moveCamera(streetViews[view]);
    onViewChange(view);
  }

  function rotate(horizontal, vertical) {
    transition = null;
    const { azimuth } = streetViews[view];
    state.azimuth = THREE.MathUtils.clamp(state.azimuth + horizontal, azimuth - 1.06, azimuth + 1.02);
    state.elevation = THREE.MathUtils.clamp(state.elevation + vertical, 0.22, 1.18);
    queueFrame();
  }

  function zoom(factor) {
    transition = null;
    const { span } = streetViews[view];
    state.span = THREE.MathUtils.clamp(state.span * factor, span * 0.56, span * 1.45);
    queueFrame();
  }

  function pick(x, y) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.set(((x - bounds.left) / bounds.width) * 2 - 1, -((y - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(residents.rayTargets(), false);
    const [doorHit] = view === 'street' ? raycaster.intersectObject(door, false) : [];
    if (doorHit && (!hit || doorHit.distance < hit.distance)) {
      setView('store');
      return;
    }
    if (hit) {
      let object = hit.object;
      while (object && !Object.hasOwn(object.userData, 'residentId')) object = object.parent;
      if (object) onResidentSelect(object.userData.residentId);
    } else onResidentSelect(null);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  window.addEventListener('resize', resize, options);
  document.addEventListener('visibilitychange', queueFrame, options);
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, movement: 0 };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }, options);
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.movement += Math.abs(dx) + Math.abs(dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.movement > 4) rotate(-dx * 0.005, dy * 0.004);
  }, options);
  canvas.addEventListener('pointerup', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.movement <= 4) pick(event.clientX, event.clientY);
    drag = null;
    canvas.style.cursor = 'grab';
  }, options);
  canvas.addEventListener('lostpointercapture', () => {
    drag = null;
    canvas.style.cursor = 'grab';
  }, options);
  canvas.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY * 0.003, -0.25, 0.25)));
  }, { ...options, passive: false });
  canvas.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowLeft': rotate(-0.12, 0); break;
      case 'ArrowRight': rotate(0.12, 0); break;
      case 'ArrowUp': rotate(0, 0.10); break;
      case 'ArrowDown': rotate(0, -0.10); break;
      case '+': case '=': zoom(0.89); break;
      case '-': zoom(1.12); break;
      case 'Home': moveCamera(streetViews[view]); break;
      case 'Enter': setView(view === 'street' ? 'store' : 'street'); break;
      case 'Escape':
        if (view === 'street') return;
        setView('street');
        break;
      default: return;
    }
    event.preventDefault();
  }, options);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    onUnavailable('3D 连接暂时中断，居民事件仍可查看。');
  }, options);
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    queueFrame();
  }, options);

  return {
    update(next = {}) {
      applied = { ...applied, ...next };
      productSign.write(applied.productName || '体验陈列');
      residents.update(applied.agents, applied);
      queueFrame();
    },
    enterStore: () => setView('store'),
    exitStore: () => setView('street'),
    resetView: () => moveCamera(streetViews[view]),
    destroy() {
      destroyed = true;
      input.abort();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
      storeSign.dispose();
      productSign.dispose();
      doorGeometry.dispose();
      doorMaterial.dispose();
      for (const resource of worldGeometry) resource.dispose();
      residents.dispose();
      materials.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.style.removeProperty('touch-action');
      canvas.style.removeProperty('cursor');
    },
  };
}
