import {
  MARKETPLACES, PRODUCT_CATEGORIES, WORLD_EVENT_LABELS,
  advanceLivingWorld, createLivingWorld, offerForProduct, publishProduct, residentEvents, summarizeProduct,
} from './living-world.js';
import { openCommerceStore, WorldConflictError } from './commerce-store.js';
import { createMarketplaceView } from './marketplace-view.js';
import { generateProductMarketing, testModelConnection } from './model-client.js';
import { prepareProductImages, recordProductVideo, templateMarketing } from './product-media.js';

const get = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('zh-CN');
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const basePrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const markets = Object.fromEntries(MARKETPLACES.map(({ id, name }) => [id, name]));
const categories = Object.fromEntries(PRODUCT_CATEGORIES.map(({ id, name }) => [id, name]));
const marketingPreferences = 'counterfolk-marketing-preferences';
const commerceRoutes = new Set(['commerce', 'residents', 'products', 'street']);

function fmt(value) { return Number.isFinite(value) ? number.format(value) : '—'; }
function ratio(value) { return Number.isFinite(value) ? percent.format(value) : '—'; }
function money(cents) { return Number.isFinite(cents) ? basePrice.format(cents / 100) : '—'; }

function time(minute) {
  return [Math.floor(minute / 60), minute % 60].map((value) => String(value).padStart(2, '0')).join(':');
}

function stat(label, value, note = '') {
  return `<div class="commerce-stat"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
}

function getVideoExtension(mime) {
  return mime?.includes('mp4') ? 'mp4' : 'webm';
}

export function createCommerceWorkspace({ notify, escapeHtml: esc }) {
  const upload = get('product-upload');
  const form = get('product-upload-form');
  const search = get('resident-search');
  const marketFilter = get('resident-market-filter');
  const cachedMedia = new Map();
  const videoProgress = new Map();
  const changeChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('counterfolk-commerce-changes') : null;
  let db;
  let record;
  let activeRoute = 'commerce';
  let residentId = null;
  let productId = null;
  let residentDay = 'current';
  let pathOnly = false;
  let changingWorld = false;
  let preparingProduct = false;
  let checkingModel = false;
  let auto = null;
  let videoQueue = Promise.resolve();
  let productRender = 0;
  let initialized = null;
  const marketView = createMarketplaceView({
    root: get('commerce-workspace'),
    getCatalog: () => record?.world.products ?? [],
    getMedia: publicMedia,
    getOffer: (product, platform) => offerForProduct(product, platform, { world: record?.world }),
  });

  function createInitialWorld() {
    return advanceLivingWorld(createLivingWorld(), 3);
  }

  function message(element, text, tone = '') {
    element.textContent = text;
    element.dataset.tone = tone;
  }

  function invalidateMedia(id) {
    const cached = cachedMedia.get(id);
    cachedMedia.delete(id);
    cached?.then((media) => {
      if (!media) return;
      [media.hero, ...media.aPlus, media.video].filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
    }).catch(() => {});
  }

  function publicMedia(product) {
    if (!db || !product || product.source !== 'uploaded') return Promise.resolve(null);
    if (!cachedMedia.has(product.id)) {
      cachedMedia.set(product.id, db.getMedia(product.id).then((item) => {
        if (!item) return null;
        return {
          hero: URL.createObjectURL(item.hero), aPlus: item.aPlus.map((blob) => URL.createObjectURL(blob)),
          video: item.video ? URL.createObjectURL(item.video) : null, videoMime: item.video?.type,
          videoError: item.videoError, copy: [item.marketing.assets.social.title, item.marketing.assets.social.body,
            item.marketing.assets.social.hashtags.map((tag) => '#' + tag).join(' ')].join('\n\n'),
          source: item.marketing.source, storyboard: item.marketing.assets.video.scenes,
        };
      }).catch((error) => {
        cachedMedia.delete(product.id);
        throw error;
      }));
    }
    return cachedMedia.get(product.id);
  }

  function setButtons() {
    get('market-world-day').textContent = record ? `第 ${fmt(record.world.day)} 天` : '正在载入';
    for (const button of document.querySelectorAll('[data-world-days]')) button.disabled = !record || changingWorld;
    for (const button of document.querySelectorAll('[data-open-product]')) button.disabled = !record || preparingProduct;
    get('auto-world').disabled = !record;
  }

  function show(page) {
    activeRoute = page;
    get('market-world-tools').hidden = !commerceRoutes.has(page);
    get('classic-tools').hidden = commerceRoutes.has(page);
    if (!record) return;
    if (page === 'commerce') marketView.refresh();
    if (page === 'residents') renderResidents();
    if (page === 'products') renderProducts();
  }

  function init() {
    if (initialized) return initialized;
    initialized = (async () => {
      db = await openCommerceStore();
      record = await db.loadWorld(createInitialWorld);
      const source = [...new Map(record.world.residents.map(({ market, marketName }) => [market, marketName]))];
      marketFilter.append(...source.map(([id, name]) => new Option(name, id)));
      get('commerce-workspace').setAttribute('aria-busy', 'false');
      setButtons();
      show(activeRoute);
      resumeVideos().catch(() => notify('部分待生成的视频无法恢复。'));
    })().catch(() => {
      get('commerce-workspace').setAttribute('aria-busy', 'false');
      get('commerce-workspace').innerHTML = '<p class="commerce-empty" role="alert">当前浏览器无法保存工作区。请允许站点存储后重新打开页面。</p>';
      notify('无法打开居民世界的浏览器存储。');
    });
    return initialized;
  }

  async function loadLatest() {
    if (!db) return;
    const next = await db.loadWorld(createInitialWorld);
    if (next.revision > (record?.revision ?? -1)) {
      record = next;
      setButtons();
      show(activeRoute);
    }
  }

  changeChannel?.addEventListener('message', ({ data }) => {
    if (!db || !data) return;
    if (data.type === 'world') loadLatest().catch(() => {});
    if (data.type === 'media') {
      invalidateMedia(data.id);
      if (activeRoute === 'commerce') marketView.refresh();
      if (activeRoute === 'products' && productId === data.id) renderProductDetail();
    }
  });

  async function commit(change, media) {
    if (!record || changingWorld) throw new Error('世界正在更新，请稍后重试。');
    changingWorld = true;
    setButtons();
    try {
      const world = change(record.world);
      record = await db.commitWorld(record.revision, world, media);
      if (media) invalidateMedia(media.id);
      changeChannel?.postMessage({ type: 'world' });
    } catch (error) {
      if (error instanceof WorldConflictError) await loadLatest();
      throw error;
    } finally {
      changingWorld = false;
      setButtons();
      show(activeRoute);
    }
  }

  async function advance(days, silent = false) {
    if (!record || changingWorld) return;
    try {
      await commit((world) => advanceLivingWorld(world, days));
      if (!silent) notify(`已推进至第 ${record.world.day} 天`);
    } catch (error) {
      setAuto(false);
      notify(error.message || '模拟日保存失败。');
    }
  }

  function setAuto(playing) {
    clearInterval(auto);
    auto = playing ? setInterval(() => { if (!document.hidden) advance(1, true); }, 3500) : null;
    get('auto-world').setAttribute('aria-pressed', String(Boolean(auto)));
    get('auto-world').textContent = auto ? '暂停自动推进' : '自动推进';
  }

  function initials(name) {
    return /[\u2e80-\u9fff]/u.test(name)
      ? [...name].slice(0, 2).join('')
      : name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  }

  function avatar(person) {
    return `<span class="resident-avatar" data-region="${person.market}" aria-hidden="true">${esc(initials(person.name))}</span>`;
  }

  function eventRows(events, { productLinks = false, residentLinks = false } = {}) {
    if (!events.length) return '<p class="commerce-empty">当前没有匹配的事件。</p>';
    return events.map((event) => {
      const channel = event.platformId ? markets[event.platformId] : '';
      const actor = residentLinks ? record.world.residents.find((person) => person.id === event.residentId) : null;
      const product = event.productId && productLinks ? record.world.products.find((item) => item.id === event.productId) : null;
      const extra = [
        channel,
        event.query ? `关键词 ${esc(event.query)}` : '',
        event.cents !== undefined ? money(event.cents) : '',
        actor ? `<button type="button" class="commerce-inline" data-event-resident="${actor.id}" data-event-day="${event.day}">${esc(actor.name)}</button>` : '',
        product ? `<button type="button" class="commerce-inline" data-event-product="${product.id}" data-event-market="${event.platformId || ''}">查看商品页</button>` : '',
      ].filter(Boolean).join(' · ');
      return `<div class="commerce-event"><time>第 ${fmt(event.day)} 天<span>${time(event.minute)}</span></time><div><strong>${WORLD_EVENT_LABELS[event.type] ?? '活动'}</strong><p>${esc(event.note)}</p>${extra ? `<small>${extra}</small>` : ''}</div></div>`;
    }).join('');
  }

  function renderResidents() {
    const { world } = record;
    const recent = world.history.at(-1)?.events ?? [];
    const todayShoppers = new Set(recent.filter((event) => event.platformId).map((event) => event.residentId)).size;
    const paid = recent.filter((event) => event.type === 'paid').length;
    get('resident-metrics').innerHTML = [
      stat('常驻居民', fmt(world.residents.length)), stat('覆盖市场', fmt(new Set(world.residents.map(({ market }) => market)).size)),
      stat('今日到访电商', fmt(todayShoppers)), stat('今日模拟订单', fmt(paid)),
    ].join('');
    renderDirectory();
  }

  function renderDirectory() {
    const { world } = record;
    const query = search.value.trim().toLocaleLowerCase();
    const listed = world.residents.filter((person) => (marketFilter.value === 'all' || person.market === marketFilter.value)
      && [person.name, person.id, person.occupation, person.segment, person.marketName].some((value) => String(value).toLocaleLowerCase().includes(query)));
    if (!listed.some(({ id }) => id === residentId)) residentId = listed[0]?.id ?? null;
    const container = get('resident-directory');
    const scroll = container.scrollTop;
    get('resident-count').textContent = `${fmt(listed.length)} / ${fmt(world.residents.length)} 位居民`;
    container.innerHTML = listed.map((person) => `<button type="button" class="directory-item" data-resident="${person.id}" aria-pressed="${residentId === person.id}">
      ${avatar(person)}<span><strong>${esc(person.name)}</strong><small>${esc(person.city)} · ${esc(person.occupation)}</small></span><strong>#${person.id.slice(-3)}</strong></button>`).join('')
      || '<p class="commerce-empty">没有找到居民。</p>';
    container.scrollTop = scroll;
    renderResidentDetail();
  }

  function renderResidentDetail() {
    const { world } = record;
    const person = world.residents.find(({ id }) => id === residentId);
    if (!person) {
      get('resident-detail').innerHTML = '<p class="commerce-empty">选择一位居民。</p>';
      return;
    }
    const selectedDay = residentDay === 'all' ? null : residentDay === 'current' ? world.day : Number(residentDay);
    const events = residentEvents(world, person.id, { day: selectedDay }).filter((event) => !pathOnly || event.platformId).reverse();
    const options = [...world.history].reverse().map(({ day }) =>
      `<option value="${day}"${residentDay === String(day) ? ' selected' : ''}>第 ${fmt(day)} 天</option>`).join('');
    get('resident-detail').innerHTML = `<div class="panel-header"><div class="commerce-person">${avatar(person)}<div><h2>${esc(person.name)}</h2><p>${esc(person.city)} · ${esc(person.occupation)} · #${person.id.slice(-3)}</p></div></div></div>
      <div class="commerce-profile"><span>${esc(person.segment)}</span><span>语言 ${esc(person.locale)}</span><span>可用预算 ${money(person.remainingCents)}</span><span>${esc(person.need)}</span></div>
      <div class="commerce-tabs">
        <label>时间<select id="resident-history-day"><option value="current"${residentDay === 'current' ? ' selected' : ''}>今天 · 第 ${fmt(world.day)} 天</option><option value="all"${residentDay === 'all' ? ' selected' : ''}>全部历史</option>${options}</select></label>
        <label><input id="resident-shopping-only" type="checkbox"${pathOnly ? ' checked' : ''}>只看购物路径</label>
        <small>${fmt(events.length)} 条记录</small>
      </div><div class="commerce-list">${eventRows(events, { productLinks: true })}</div>`;
  }

  function productName(product) { return esc(product.name); }
  function productPlatform(product) { return product.platforms.map((id) => markets[id]).filter(Boolean).join(' · '); }

  function renderProducts() {
    const { products } = record.world;
    if (!products.some(({ id }) => id === productId)) productId = products.at(-1)?.id ?? null;
    get('catalog-count').textContent = `${fmt(products.length)} 件商品 · ${fmt(products.filter(({ source }) => source === 'uploaded').length)} 件自上传`;
    get('product-directory').innerHTML = [...products].reverse().map((product) => `<button type="button" class="directory-item" data-product-row="${product.id}" aria-pressed="${product.id === productId}">
        <span class="resident-avatar" aria-hidden="true">${esc(initials(product.brand))}</span>
        <span><strong>${productName(product)}</strong><small>${product.source === 'uploaded' ? '自上传' : '示例商品'} · 第 ${fmt(product.publishedDay)} 天</small></span>
        <strong>${money(product.priceCents)}</strong></button>`).join('');
    renderProductDetail();
  }

  function tableCounts(rows, label, includeRate = false) {
    const counts = rows.map((row) => `<tr><td>${label(row)}</td><td>${fmt(row.exposed)}</td><td>${fmt(row.viewed)}</td><td>${fmt(row.carted)}</td><td>${fmt(row.orders)}</td><td>${fmt(row.refunds)}</td>
      ${includeRate ? `<td>${ratio(row.exposureConversionRate)}</td>` : ''}</tr>`).join('');
    return `<div class="table-wrap commerce-day-scroll"><table><thead><tr><th scope="col">分组</th><th scope="col">曝光</th><th scope="col">详情</th><th scope="col">加购</th><th scope="col">订单</th><th scope="col">退款</th>${includeRate ? '<th scope="col">曝光后转化</th>' : ''}</tr></thead><tbody>${counts}</tbody></table></div>`;
  }

  async function displayProductMedia(product, serial) {
    try {
      const media = await publicMedia(product);
      if (!media || serial !== productRender || product.id !== productId) return;
      const thumb = get('product-hero-photo');
      thumb.hidden = false;
      thumb.src = media.hero;
      const progress = videoProgress.get(product.id);
      const error = media.videoError;
      const video = media.video ? `<video class="commerce-video" controls playsinline preload="metadata" aria-label="商品竖版短视频" src="${media.video}"></video>
        <a class="button button-muted" href="${media.video}" download="${product.id}.${getVideoExtension(media.videoMime)}">下载短视频</a>` : `<p class="form-message" data-video-progress="${product.id}">${esc(error || (progress === undefined ? '等待生成短视频…' : `正在制作短视频 · ${Math.floor(progress * 100)}%`))}</p>
        ${error ? `<button type="button" class="button button-muted" data-video-retry="${product.id}">重试视频</button>` : ''}`;
      get('creative-output').innerHTML = `<h3 class="commerce-section-heading">运营素材 · ${media.source === 'ai' ? 'AI 生成' : '本地模板'}</h3><div class="commerce-media">
        ${media.aPlus.map((url, index) => `<a href="${url}" download="${product.id}-a-plus-${index + 1}.png"><img src="${url}" alt="A+ 图 ${index + 1}" loading="lazy">下载 A+ 图 ${index + 1}</a>`).join('')}
        </div><div class="commerce-creative-grid"><div>${video}<details><summary>视频分镜</summary><ol>${media.storyboard.map((item) => `<li>${esc(item.caption)} · ${item.durationSeconds} 秒</li>`).join('')}</ol></details></div>
        <div><h3>种草文案</h3><p class="commerce-creative-copy" id="product-social-copy">${esc(media.copy)}</p><button type="button" class="button button-muted" id="copy-product-social">复制文案</button></div></div>`;
    } catch {
      if (serial === productRender && get('creative-output')) get('creative-output').textContent = '无法读取此商品的素材。';
    }
  }

  function renderProductDetail() {
    const serial = ++productRender;
    const { world } = record;
    const product = world.products.find(({ id }) => id === productId);
    if (!product) return;
    const stats = summarizeProduct(world, product.id);
    const body = get('product-detail');
    body.innerHTML = `<div class="panel-header"><div><h2>${productName(product)}</h2><p>${esc(categories[product.category])} · ${esc(productPlatform(product))} · ${money(product.priceCents)}</p></div>
      <img id="product-hero-photo" class="commerce-photo" alt="${productName(product)}" hidden></div>
      <div class="commerce-product-summary"><p class="tool-note">${stats.elapsedDays ? `从第 ${fmt(product.publishedDay)} 天起累计 ${fmt(stats.elapsedDays)} 个模拟日` : `商品已展示，上架第 ${fmt(product.publishedDay)} 天开始参与居民推荐和搜索。`}</p>
        <div class="commerce-actions"><button class="button button-muted" type="button" data-event-product="${product.id}">查看电商商品页</button></div>
        <div class="commerce-metrics">
          ${stat('唯一曝光', fmt(stats.exposed), stats.elapsedDays ? `${fmt(stats.eligible)} 位符合平台条件的居民` : '等待模拟日开始')}
          ${stat('详情与比较', fmt(stats.viewed), `${fmt(stats.compared)} 位居民比较过商品`)}
          ${stat('加入购物车', fmt(stats.carted), `${fmt(stats.checkout)} 位居民发起结账`)}
          ${stat('模拟订单', fmt(stats.orders), `${fmt(stats.buyers)} 位唯一买家 · ${fmt(stats.refunds)} 单退款`)}
          ${stat('曝光后转化', ratio(stats.exposureConversionRate), '唯一买家 ÷ 唯一曝光')}
          ${stat('总体转化', ratio(stats.conversionRate), '唯一买家 ÷ 符合平台条件人数')}
        </div><p class="tool-note">模拟净收入 ${money(stats.netCents)}</p></div>
      <h3 class="commerce-section-heading">按平台</h3>${tableCounts(stats.platforms, (row) => markets[row.platformId], true)}
      <h3 class="commerce-section-heading">按发现入口</h3>${tableCounts(stats.discovery, (row) => row.name)}
      ${stats.days.length ? `<details><summary class="commerce-section-heading">逐日数据</summary>${tableCounts([...stats.days].reverse(), (row) => `第 ${fmt(row.day)} 天`)}</details>` : ''}
      ${product.source === 'uploaded' ? '<div id="creative-output"><p class="commerce-empty">正在读取运营素材…</p></div>' : ''}
      <details><summary class="commerce-section-heading">最近商品事件</summary><div class="commerce-list">${eventRows(stats.recentEvents, { residentLinks: true })}</div></details>`;
    if (product.source === 'uploaded') displayProductMedia(product, serial);
  }

  function enqueueVideo(product, media) {
    if (videoProgress.has(product.id)) return;
    videoProgress.set(product.id, 0);
    if (activeRoute === 'products' && product.id === productId) renderProductDetail();
    const encode = async () => {
      const saved = await db.getMedia(product.id);
      if (!saved || saved.video) return;
      const blob = await recordProductVideo(media.hero, product, media.marketing, (progress) => {
        videoProgress.set(product.id, progress);
        const field = get('product-detail').querySelector(`[data-video-progress="${product.id}"]`);
        if (field) field.textContent = `正在制作短视频 · ${Math.floor(progress * 100)}%`;
      });
      await db.saveVideo(product.id, blob);
    };
    videoQueue = videoQueue.catch(() => {}).then(async () => {
      try {
        if (navigator.locks) await navigator.locks.request(`counterfolk-video-${product.id}`, encode);
        else await encode();
      } catch (error) {
        await db.saveVideo(product.id, null, error.message || '短视频生成失败。').catch(() => {});
        notify('短视频生成失败，可在产品区重试。');
      } finally {
        videoProgress.delete(product.id);
        invalidateMedia(product.id);
        changeChannel?.postMessage({ type: 'media', id: product.id });
        if (activeRoute === 'commerce') marketView.refresh();
        if (activeRoute === 'products' && product.id === productId) renderProductDetail();
      }
    });
  }

  async function resumeVideos() {
    for (const product of record.world.products) {
      if (product.source !== 'uploaded') continue;
      const media = await db.getMedia(product.id);
      if (media && !media.video && !media.videoError) enqueueVideo(product, media);
    }
  }

  function readModelProfile(fields) {
    const provider = fields.get('provider');
    const model = fields.get('model').trim();
    if (!model) throw new Error('填写模型 ID 后即可调用 AI。');
    return { provider, model, baseUrl: provider === 'openai' ? '' : fields.get('baseUrl').trim(),
      apiKey: provider === 'ollama' ? '' : fields.get('apiKey').trim() };
  }

  function rememberModel() {
    const preferences = Object.fromEntries(['creativeMode', 'provider', 'model', 'baseUrl']
      .map((key) => [key, form.elements[key].value]));
    try { localStorage.setItem(marketingPreferences, JSON.stringify(preferences)); } catch { /* optional preferences */ }
    return preferences;
  }

  function restoreModel() {
    try {
      const preferences = JSON.parse(localStorage.getItem(marketingPreferences));
      for (const key of ['creativeMode', 'provider', 'model', 'baseUrl']) {
        const field = form.elements[key];
        const value = preferences?.[key];
        if (typeof value === 'string' && (!field.options || [...field.options].some((option) => option.value === value))) field.value = value;
      }
    } catch { /* optional preferences */ }
  }

  function productDraft(fields) {
    const features = fields.get('features').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (features.length > 10 || features.some((item) => item.length > 160)) throw new Error('最多可填写 10 条卖点，每条最多 160 个字符。');
    if (!fields.getAll('platforms').length) throw new Error('至少选择一个上架平台。');
    if (!fields.get('name').trim() || !fields.get('description').trim()) throw new Error('请填写商品名称与说明。');
    const id = `p-${crypto.randomUUID()}`;
    return {
      id, name: fields.get('name').trim(), brand: fields.get('brand').trim() || '独立品牌', category: fields.get('category'),
      description: fields.get('description').trim(), audience: fields.get('audience').trim(), features,
      priceCents: Math.round(Number(fields.get('price')) * 100), stock: Number(fields.get('stock')),
      platforms: fields.getAll('platforms'), imageKey: id,
    };
  }

  async function publish(event) {
    event.preventDefault();
    if (preparingProduct || checkingModel || !record) return;
    preparingProduct = true;
    get('submit-product').disabled = true;
    get('close-product').disabled = true;
    get('cancel-product').disabled = true;
    get('product-model-test').disabled = true;
    setButtons();
    const feedback = get('product-upload-status');
    try {
      const fields = new FormData(form);
      const draft = productDraft(fields);
      const image = fields.get('image');
      if (!image?.size || image.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) {
        throw new Error('请上传不超过 8 MB 的 PNG、JPEG 或 WebP 图片。');
      }
      let marketing = templateMarketing(draft);
      let fallback = false;
      if (fields.get('creativeMode') === 'ai') {
        const profile = readModelProfile(fields);
        message(feedback, '模型正在生成运营文案与分镜…');
        try {
          marketing = await generateProductMarketing({ profile, product: {
            name: draft.name, category: categories[draft.category], description: draft.description, facts: draft.features,
            audience: draft.audience, locale: 'zh-CN',
          } });
        } catch {
          fallback = true;
        }
      }
      message(feedback, '正在渲染三张 A+ 商品图…');
      const pictures = await prepareProductImages(image, draft, marketing);
      const media = { id: draft.id, ...pictures, marketing, video: null, videoError: null };
      await commit((world) => publishProduct(world, { ...draft, creative: {
        source: marketing.source, ...(marketing.model ? { model: marketing.model, promptVersion: marketing.promptVersion } : {}),
      } }), media);
      const product = record.world.products.find(({ id }) => id === draft.id);
      productId = draft.id;
      upload.close();
      const modelChoice = rememberModel();
      form.reset();
      for (const [key, value] of Object.entries(modelChoice)) form.elements[key].value = value;
      location.hash = 'products';
      const notice = get('product-publish-note');
      notice.textContent = `「${draft.name}」已上架。第 ${product.publishedDay} 天开始参与居民测试。 ${fallback ? 'AI 暂未生成可用内容，本次使用本地模板。' : 'A+ 图片和文案已生成。'}`;
      notice.hidden = false;
      enqueueVideo(product, media);
      if (activeRoute === 'products') renderProducts();
    } catch (error) {
      message(feedback, error.message || '无法上架商品。', 'error');
    } finally {
      preparingProduct = false;
      get('submit-product').disabled = false;
      get('close-product').disabled = false;
      get('cancel-product').disabled = false;
      get('product-model-test').disabled = checkingModel;
      setButtons();
    }
  }

  form.elements.category.replaceChildren(...PRODUCT_CATEGORIES.map(({ id, name }) => new Option(name, id)));
  get('product-platform-fields').innerHTML = MARKETPLACES.map(({ id, name }) =>
    `<label><input type="checkbox" name="platforms" value="${id}" checked>${name}</label>`).join('');
  restoreModel();
  form.addEventListener('submit', publish);
  upload.addEventListener('cancel', (event) => { if (preparingProduct) event.preventDefault(); });
  get('close-product').addEventListener('click', () => upload.close());
  get('cancel-product').addEventListener('click', () => upload.close());
  get('product-model-test').addEventListener('click', async () => {
    if (checkingModel || preparingProduct) return;
    checkingModel = true;
    get('product-model-test').disabled = true;
    get('submit-product').disabled = true;
    const feedback = get('product-model-status');
    message(feedback, '正在连接模型…');
    try {
      const profile = readModelProfile(new FormData(form));
      const result = await testModelConnection(profile);
      form.elements.creativeMode.value = 'ai';
      rememberModel();
      message(feedback, `连接成功 · ${result.model.model}`, 'success');
    } catch (error) {
      message(feedback, error.message, 'error');
    } finally {
      checkingModel = false;
      get('product-model-test').disabled = preparingProduct;
      get('submit-product').disabled = preparingProduct;
    }
  });
  search.addEventListener('input', () => { if (record) renderDirectory(); });
  marketFilter.addEventListener('change', () => { if (record) renderDirectory(); });
  get('resident-detail').addEventListener('change', ({ target }) => {
    if (target.id === 'resident-history-day') residentDay = target.value;
    else if (target.id === 'resident-shopping-only') pathOnly = target.checked;
    else return;
    renderResidentDetail();
    get(target.id)?.focus();
  });
  get('auto-world').addEventListener('click', () => setAuto(!auto));

  document.addEventListener('click', async ({ target }) => {
    if (!record) return;
    if (target.closest('[data-open-product]')) {
      message(get('product-upload-status'), '');
      upload.showModal();
    }
    const dayButton = target.closest('[data-world-days]');
    if (dayButton) advance(Number(dayButton.dataset.worldDays));
    const row = target.closest('[data-resident]');
    if (row) {
      residentId = row.dataset.resident;
      residentDay = 'current';
      for (const item of get('resident-directory').querySelectorAll('[data-resident]')) item.setAttribute('aria-pressed', String(item === row));
      renderResidentDetail();
    }
    const product = target.closest('[data-product-row]');
    if (product) {
      productId = product.dataset.productRow;
      for (const item of get('product-directory').querySelectorAll('[data-product-row]')) item.setAttribute('aria-pressed', String(item === product));
      renderProductDetail();
    }
    const jump = target.closest('[data-event-product]');
    if (jump) {
      location.hash = 'commerce';
      marketView.openProduct(jump.dataset.eventProduct, jump.dataset.eventMarket);
    }
    const actor = target.closest('[data-event-resident]');
    if (actor) {
      residentId = actor.dataset.eventResident;
      residentDay = actor.dataset.eventDay;
      search.value = '';
      marketFilter.value = 'all';
      location.hash = 'residents';
      renderResidents();
    }
    const retry = target.closest('[data-video-retry]');
    if (retry) {
      const product = record.world.products.find((item) => item.id === retry.dataset.videoRetry);
      if (product) {
        try {
          await db.saveVideo(product.id, null);
          invalidateMedia(product.id);
          const media = await db.getMedia(product.id);
          if (media) enqueueVideo(product, media);
        } catch { notify('暂时无法读取素材，请稍后重试。'); }
      }
    }
    if (target.closest('#copy-product-social')) {
      try {
        await navigator.clipboard.writeText(get('product-social-copy').textContent);
        notify('已复制种草文案。');
      } catch { notify('无法访问剪贴板，可以选中文案复制。'); }
    }
  });

  return { init, show };
}
