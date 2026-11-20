import { CHANNELS, LANGUAGES, METRICS, REGIONS, SEGMENTS } from './simulation.js';

const stageNames = { exposed: '接触商品', considered: '考虑商品', purchase: '完成购买', install: '安装 App', activation: '激活 App', paid: 'App 付费', exit: '退出漏斗' };
const findName = (catalog, id) => catalog.find((item) => item.id === id)?.name ?? id;
const number = new Intl.NumberFormat('zh-CN');

function timeLabel(minute) {
  return [Math.floor(minute / 60), minute % 60].map((value) => String(value).padStart(2, '0')).join(':');
}

export function createStreetView({ onDemo, onNotify }) {
  const get = (id) => document.getElementById(id);
  const canvas = get('street-canvas');
  const placeholder = get('street-placeholder');
  const market = get('street-market');
  const arm = get('street-arm');
  const resident = get('street-resident');
  const timeline = get('street-day');
  const play = get('street-play');
  let scene = null;
  let loading = null;
  let visible = false;
  let result = null;
  let agents = [];
  let view = 'street';
  let timer = null;
  let webglUnavailable = false;
  let currentTime = 1.75;

  function selectResident(id) {
    resident.value = id == null ? '' : String(id);
    renderFrame();
  }

  function setView(next) {
    view = next;
    get('street-location').textContent = view === 'store' ? '门店内部' : '街道视角';
    get('street-door').querySelector('span').textContent = view === 'store' ? '返回街道' : '进入门店';
  }

  function show(active, region) {
    visible = active;
    if (!visible) {
      stop();
      return;
    }
    if (result?.groups.regions.some((item) => item.id === region)) {
      market.value = region;
      updateResidents();
    }
    renderFrame();
    if (scene || loading || webglUnavailable) return;
    loading = import('./street.js').then(({ createStreetScene }) => {
      scene = createStreetScene(canvas, {
        onResidentSelect: selectResident, onViewChange: setView,
        onUnavailable: (note) => { placeholder.textContent = note; placeholder.hidden = false; get('street-overlay').hidden = true; },
      });
      placeholder.hidden = true;
      get('street-overlay').hidden = false;
      renderFrame();
    }).catch(() => {
      webglUnavailable = true;
      placeholder.textContent = '当前环境无法显示 Three.js 场景。可继续使用下方居民轨迹和时间轴。';
    });
  }

  function updateResidents() {
    const previousId = resident.value;
    agents = result.agents.filter((agent) => agent.region === market.value);
    resident.replaceChildren(
      new Option('选择居民', ''),
      ...agents.map((agent) => new Option(`#${agent.id} · ${findName(SEGMENTS, agent.segment)}`, agent.id)),
    );
    if (agents.some(({ id }) => String(id) === previousId)) resident.value = previousId;
  }

  function setResult(next) {
    const changed = !result || JSON.stringify(next.config) !== JSON.stringify(result.config);
    result = next;
    delete get('street-detail').dataset.key;
    const previousMarket = market.value;
    const previousArm = arm.value;
    market.replaceChildren(...result.groups.regions.map((group) => new Option(group.name, group.id)));
    arm.replaceChildren(...['a', 'b'].map((id) => new Option(result.config.variants[id].name, id)));
    if (result.groups.regions.some(({ id }) => id === previousMarket)) market.value = previousMarket;
    arm.value = previousArm;
    if (changed) {
      stop();
      currentTime = 1.75;
      if (result.config.variants.a.channel !== 'retail' && result.config.variants.b.channel === 'retail') arm.value = 'b';
    }
    timeline.max = result.config.days + 0.99;
    timeline.value = Math.min(currentTime, Number(timeline.max));
    get('street-demo').disabled = ['a', 'b'].every((id) => result.config.variants[id].channel === 'retail');
    get('street-demo').hidden = get('street-demo').disabled;
    updateResidents();
    if (changed && result.config.variants[arm.value].channel === 'retail') {
      const firstVisit = agents.flatMap((agent) => agent.trace?.[arm.value] ?? [])
        .find((event) => event.type === 'purchase') ?? agents.flatMap((agent) => agent.trace?.[arm.value] ?? [])
        .find((event) => event.type === 'exposed');
      if (firstVisit) {
        currentTime = firstVisit.day + (firstVisit.minute + 5) / 1440;
        timeline.value = currentTime;
      }
    }
    if (visible) renderFrame();
  }

  function renderFrame() {
    if (!result) return;
    const id = arm.value;
    const { config } = result;
    const variant = config.variants[id];
    const region = REGIONS.find((item) => item.id === market.value);
    const rawTime = Number(timeline.value);
    const day = Math.floor(rawTime);
    const minute = Math.min(1439, Math.round((rawTime - day) * 1440));
    get('street-time').textContent = `第 ${day} 天 · ${timeLabel(minute)}`;
    get('street-context').textContent = `${region?.city ?? ''} · ${config.name} · ${findName(CHANNELS, variant.channel)}`;
    const selected = agents.find((agent) => String(agent.id) === resident.value);
    scene?.update({ agents, day, minute, arm: id, selectedId: selected?.id ?? null,
      productName: config.name, channel: variant.channel });
    renderResident(selected, id, day, minute);

    const group = result.groups.regions.find((item) => item.id === market.value);
    const days = group?.daily ?? result.daily;
    const counts = days.slice(0, day).reduce((sum, item) => ({
      exposed: sum.exposed + item[id].exposed,
      considered: sum.considered + item[id].considered,
      converted: sum.converted + item[id].converted,
    }), { exposed: 0, considered: 0, converted: 0 });
    get('street-snapshot-caption').textContent = `${group?.daily ? group.name : '全部市场'} · 截至第 ${day} 天结束`;
    const snapshot = get('street-snapshot');
    if (snapshot.dataset.key !== `${id}/${counts.exposed}/${counts.considered}/${counts.converted}/${config.metric}`) {
      snapshot.dataset.key = `${id}/${counts.exposed}/${counts.considered}/${counts.converted}/${config.metric}`;
      snapshot.replaceChildren(...Object.entries({
        曝光: counts.exposed, 考虑: counts.considered, [findName(METRICS, config.metric)]: counts.converted,
      }).map(([label, total]) => {
        const card = document.createElement('div');
        const caption = document.createElement('span');
        caption.textContent = label;
        const value = document.createElement('strong');
        value.textContent = number.format(total);
        card.append(value, caption);
        return card;
      }));
    }
  }

  function renderResident(agent, id, day, minute) {
    const body = get('street-detail');
    const trace = agent?.trace?.[id]?.filter((event) => event.day < day || (event.day === day && event.minute <= minute)) ?? [];
    const key = `${agent?.id ?? ''}/${id}/${trace.length}`;
    if (body.dataset.key === key) return;
    body.dataset.key = key;
    body.replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = !agent ? '选择一位居民以查看截至当前时间的行为。'
      : `#${agent.id} · ${findName(SEGMENTS, agent.segment)} · ${findName(LANGUAGES, agent.language)}`;
    body.append(summary);
    if (!agent) return;
    if (!trace.length) {
      const empty = document.createElement('p');
      empty.textContent = '截至当前时间还没有商品接触事件。';
      body.append(empty);
      return;
    }
    const list = document.createElement('ul');
    for (const event of trace) {
      const item = document.createElement('li');
      const time = document.createElement('time');
      time.textContent = `第 ${event.day} 天 ${timeLabel(event.minute)}`;
      item.append(time, stageNames[event.type] ?? event.type);
      if (event.reason) item.append(` · ${event.reason}`);
      list.append(item);
    }
    body.append(list);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    play.setAttribute('aria-label', '播放观察时间');
    play.title = '播放观察时间';
    play.querySelector('use').setAttribute('href', '#icon-play');
  }

  play.addEventListener('click', () => {
    if (!result) return;
    if (timer) return stop();
    if (Number(timeline.value) >= Number(timeline.max) - 0.01) timeline.value = timeline.min;
    play.setAttribute('aria-label', '暂停观察时间');
    play.title = '暂停观察时间';
    play.querySelector('use').setAttribute('href', '#icon-pause');
    timer = setInterval(() => {
      currentTime = Math.min(Number(timeline.value) + 0.035, Number(timeline.max));
      timeline.value = currentTime;
      renderFrame();
      if (currentTime >= Number(timeline.max)) stop();
    }, 100);
  });
  timeline.addEventListener('input', () => { currentTime = Number(timeline.value); renderFrame(); });
  market.addEventListener('change', () => { updateResidents(); renderFrame(); });
  arm.addEventListener('change', () => { renderFrame(); });
  resident.addEventListener('change', renderFrame);
  get('street-door').addEventListener('click', () => { if (view === 'store') scene?.exitStore(); else scene?.enterStore(); });
  get('street-reset').addEventListener('click', () => scene?.resetView());
  get('street-demo').addEventListener('click', () => {
    if (!onDemo()) onNotify('已有实验运行中，请稍后重试。');
  });
  return { setResult, show };
}
