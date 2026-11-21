export const LIVING_WORLD_VERSION = 1;
export const WORLD_RESIDENT_COUNT = 100;

export const MARKETPLACES = [
  { id: 'global', name: '环球货架', subtitle: 'Amazon 型综合商城', locale: 'en-US' },
  { id: 'jd', name: '星选自营', subtitle: '京东型自营商城', locale: 'zh-CN' },
];

export const PRODUCT_CATEGORIES = [
  { id: 'home', name: '智能家居', search: '室内环境' },
  { id: 'audio', name: '影音与录音', search: '会议录音' },
  { id: 'wearables', name: '智能穿戴', search: '运动记录' },
  { id: 'power', name: '充电与电源', search: '旅行充电' },
  { id: 'tracking', name: '定位与配件', search: '随身物品定位' },
];

const SEARCH_TERMS = {
  home: { en: 'indoor air quality monitor', ja: '室内環境モニター', de: 'Raumklima-Monitor' },
  audio: { en: 'portable meeting recorder', ja: '会議用ボイスレコーダー', de: 'Diktiergerät für Meetings' },
  wearables: { en: 'fitness activity tracker', ja: '活動量計', de: 'Fitness-Tracker' },
  power: { en: 'multiport travel charger', ja: '旅行用マルチポート充電器', de: 'USB-Reiseladegerät' },
  tracking: { en: 'tracker for keys and bags', ja: '鍵用スマートタグ', de: 'Schlüsselfinder' },
};

export const WORLD_EVENT_LABELS = {
  life: '日常活动', budget: '补充预算', need: '出现购物需求', search: '主动搜索', feed: '浏览推荐',
  referral: '查看推荐链接', impression: '看到商品', detail: '查看详情', compare: '比较商品',
  media: '查看商品素材', cart: '加入购物车', revisit: '回到购物车', checkout: '发起结账',
  paid: '完成模拟付款', delivery: '收到商品', refund: '申请退货并退款', defer: '暂缓购买',
  exit: '结束购物',
};

const CATALOGUE = [
  ['airloop-mini', 'AirLoop Mini 空气监测器', 'AirLoop', 'home', 6900, ['global', 'jd'], '桌面或卧室的温湿度与室内环境监测。', ['温湿度显示', '可视化读数']],
  ['echopin', 'EchoPin 便携录音器', 'EchoPin', 'audio', 9900, ['global', 'jd'], '随身记录会议与采访，适合通勤办公。', ['一键录音', '便携夹扣']],
  ['relay-plug', 'Relay 智能插座', 'Relay', 'home', 2490, ['global', 'jd'], '按作息为兼容的家电定时供电。', ['定时开关', '用电监测']],
  ['stride-band', 'Stride Band 运动手环', 'Stride', 'wearables', 5490, ['global', 'jd'], '记录步行、运动和日常活动。', ['活动提醒', '可调节表带']],
  ['homebeam', 'HomeBeam 桌面传感器', 'HomeBeam', 'home', 8590, ['global', 'jd'], '为小型桌面和书房提供环境读数。', ['桌面屏幕', '历史趋势']],
  ['charge-nest', 'ChargeNest 多口充电座', 'ChargeNest', 'power', 4290, ['global', 'jd'], '在办公桌或旅行中为多台设备充电。', ['多设备充电', '便携收纳']],
  ['sense-hub', 'Sense Hub 家居网关', 'Sense', 'home', 4590, ['global', 'jd'], '集中连接兼容的家居配件。', ['统一管理', '联动场景']],
  ['orbit-track', 'Orbit Tag 随身定位器', 'Orbit', 'tracking', 2990, ['global', 'jd'], '帮助寻找常用的随身物品。', ['挂环固定', '提醒功能']],
];

export const DEMO_CATALOGUE = CATALOGUE.map(([id, name, brand, category, priceCents, platforms, description, features]) =>
  ({ id, name, brand, category, priceCents, platforms, description, features, imageKey: id, publishedDay: 1, source: 'demo' }));

const MARKET_GROUPS = [
  {
    market: 'cn', marketName: '中国', city: '上海', locale: 'zh-CN', count: 42, marketplaceId: 'jd',
    given: ['安然', '可欣', '子宁', '浩宇', '清越', '一诺', '沐阳', '思远', '嘉言', '明皓', '芷言'],
    family: ['陈', '周', '许', '何', '林', '宋', '谢', '杨', '方', '田', '沈'],
  },
  {
    market: 'us', marketName: '美国', city: '西雅图', locale: 'en-US', count: 24, marketplaceId: 'global',
    given: ['Avery', 'Ethan', 'Mia', 'Lucas', 'Sofia', 'Noah', 'Lena', 'Jordan'],
    family: ['Parker', 'Reed', 'Rivera', 'Brooks', 'Cole', 'Lee', 'Hayes'],
  },
  {
    market: 'gb', marketName: '英国', city: '伦敦', locale: 'en-GB', count: 12, marketplaceId: 'global',
    given: ['Isla', 'Oliver', 'Ruby', 'Theo', 'Freya', 'Jamie'],
    family: ['Clarke', 'Walker', 'Hughes', 'Wright', 'Khan'],
  },
  {
    market: 'jp', marketName: '日本', city: '东京', locale: 'ja-JP', count: 12, marketplaceId: 'global',
    given: ['遥', '結衣', '悠人', '大地', '紗季', '春樹'],
    family: ['青木', '山田', '中村', '石井', '三浦'],
  },
  {
    market: 'de', marketName: '德国', city: '柏林', locale: 'de-DE', count: 10, marketplaceId: 'global',
    given: ['Lena', 'Jonas', 'Mila', 'Leonie', 'Felix'],
    family: ['Weber', 'Klein', 'Fischer', 'Vogel', 'Schmidt'],
  },
];

const SEGMENTS = ['理性比较型', '价格敏感型', '偏好快捷型', '科技尝鲜型'];
const OCCUPATIONS = ['学生', '设计师', '运营专员', '技术人员', '销售顾问', '自由职业者', '家庭照护者', '教师'];
const NEED_TRIGGERS = ['替换旧设备', '解决日常问题', '添置兼容配件', '升级现有设备', '看到推荐后想试', '准备礼物'];
const SOURCES = ['search', 'feed', 'referral'];
const SOURCE_LABELS = { search: '主动搜索', feed: '首页推荐', referral: '推荐链接' };
const STAGES = { impression: 'exposed', detail: 'viewed', compare: 'compared', cart: 'carted', checkout: 'checkout', paid: 'buyers' };

function validWorld(world) {
  if (!world || world.version !== LIVING_WORLD_VERSION || world.residents?.length !== WORLD_RESIDENT_COUNT
    || !Number.isSafeInteger(world.day) || world.day < 0 || !Array.isArray(world.products)
    || !Array.isArray(world.history) || !Array.isArray(world.orders)) {
    throw new Error('无法读取当前居民世界。');
  }
}

function word(value, label, max, fallback = '') {
  const result = typeof value === 'string' ? value.trim() : fallback;
  if (result.length > max) throw new Error(`${label}最多 ${max} 个字符。`);
  return result;
}

function hash(value) {
  let state = 2166136261;
  for (let i = 0; i < value.length; i++) {
    state ^= value.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let bits = Math.imul(state ^ (state >>> 15), state | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick(list, draw) {
  return list[Math.floor(draw * list.length)];
}

function categoryName(id) {
  return PRODUCT_CATEGORIES.find((value) => value.id === id)?.name ?? id;
}

function searchTerm(category, locale) {
  const language = locale.slice(0, 2);
  return SEARCH_TERMS[category?.id]?.[language] ?? category?.search;
}

export function createLivingWorld({ seed = 38_021 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('随机种子须为无符号 32 位整数。');
  let serial = 0;
  const residents = MARKET_GROUPS.flatMap((market) => Array.from({ length: market.count }, (_, index) => {
    const id = `resident-${String(++serial).padStart(3, '0')}`;
    const random = randomFrom(hash(`${seed}/profile/${id}`));
    const given = market.given[index % market.given.length];
    const family = market.family[Math.floor(index / market.given.length)];
    const name = ['cn', 'jp'].includes(market.market) ? family + given : `${given} ${family}`;
    const budgetCents = Math.round((38 + random() * 215) * 100);
    const interest = pick(PRODUCT_CATEGORIES, random()).id;
    return {
      id, name, market: market.market, marketName: market.marketName, city: market.city, locale: market.locale,
      marketplaceId: market.marketplaceId, marketplaceIds: market.market === 'cn' ? ['jd', 'global'] : ['global'],
      segment: pick(SEGMENTS, random()), occupation: pick(OCCUPATIONS, random()), budgetCents, remainingCents: budgetCents,
      interest, need: `关注${categoryName(interest)}`, intent: null, cart: null,
      patience: 0.3 + random() * 0.7, curiosity: 0.2 + random() * 0.8,
    };
  }));
  return {
    version: LIVING_WORLD_VERSION, seed, day: 0, residents,
    products: DEMO_CATALOGUE.map((value) => ({ ...value, platforms: [...value.platforms], features: [...value.features] })),
    history: [], orders: [],
  };
}

export function publishProduct(world, input) {
  validWorld(world);
  if (!input || typeof input !== 'object') throw new Error('请填写商品资料。');
  const id = input.id ?? `product-${world.day + 1}-${world.products.length + 1}`;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) throw new Error('商品编号格式不正确。');
  if (world.products.some((product) => product.id === id)) throw new Error('该商品编号已存在。');

  const name = word(input.name, '商品名称', 120);
  if (!name) throw new Error('请输入商品名称。');
  const category = input.category;
  if (!PRODUCT_CATEGORIES.some(({ id: candidate }) => candidate === category)) throw new Error('请选择商品类别。');
  const priceCents = input.priceCents;
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 100_000_000) {
    throw new Error('商品价格必须是大于零的有效金额。');
  }
  if (!Array.isArray(input.platforms) || !input.platforms.length ||
    input.platforms.some((id) => !MARKETPLACES.some(({ id: candidate }) => candidate === id))) {
    throw new Error('请选择至少一个电商平台。');
  }
  const features = input.features ?? [];
  if (!Array.isArray(features) || features.length > 12 || features.some((feature) => typeof feature !== 'string')) {
    throw new Error('请填写最多 12 条商品卖点。');
  }
  let creative;
  if (input.creative != null) {
    const json = JSON.stringify(input.creative);
    if (!json || json.length > 48_000) throw new Error('素材描述过长。请单独保存媒体文件。');
    creative = JSON.parse(json);
  }
  const stock = input.stock ?? 48;
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 100_000) throw new Error('请输入有效的模拟库存。');
  const product = {
    id, name, brand: word(input.brand, '品牌', 100, '独立品牌') || '独立品牌',
    description: word(input.description, '商品说明', 6000),
    category, priceCents, platforms: [...new Set(input.platforms)],
    features: features.map((feature) => word(feature, '商品卖点', 300)).filter(Boolean),
    imageKey: word(input.imageKey, '图片编号', 120), publishedDay: world.day + 1, source: 'uploaded', stock,
    ...(creative === undefined ? {} : { creative }),
  };
  return { ...world, products: [...world.products, product] };
}

export function productsAtMarketplace(world, platformId, { day = world.day + 1 } = {}) {
  return world.products.filter((product) => product.platforms.includes(platformId) && product.publishedDay <= day);
}

export function offerForProduct(product, platformId, { world } = {}) {
  if (!product?.platforms?.includes(platformId)) return null;
  const local = platformId === 'jd';
  const partner = hash(product.id) % 4 === 0;
  const originalStock = product.stock ?? (product.source === 'demo' ? 120 : 48);
  const orders = world?.orders.filter((order) =>
    order.productId === product.id && order.platformId === platformId && order.status !== 'refunded').length ?? 0;
  return {
    seller: local && !partner ? '商城自营' : `${product.brand} 店铺`,
    fulfillment: local && !partner ? '本地仓配送' : '卖家配送',
    shippingCents: product.priceCents >= (local ? 3300 : 5000) ? 0 : local ? 160 : 499,
    deliveryDays: local ? (partner ? 3 : 1) : partner ? 5 : 3,
    stock: Math.max(0, originalStock - orders),
  };
}

function chooseNeed(resident, day, random) {
  const category = random() < 0.69 ? resident.interest : pick(PRODUCT_CATEGORIES, random()).id;
  const trigger = pick(NEED_TRIGGERS, random());
  const urgency = trigger === '替换旧设备' ? 0.8 + random() * 0.2 : 0.25 + random() * 0.55;
  return { category, trigger, urgency, expires: day + 1 + Math.floor(random() * 5) };
}

function addEvent(context, resident, minute, type, note, details) {
  const { day, events } = context;
  const id = `${day}-${resident.id}-${events.length + 1}`;
  events.push({ id, residentId: resident.id, day, minute, type, note, ...details });
}

function commerceLogger(context, resident, session) {
  let offset = 0;
  return (type, note, productId, details = {}) => {
    const platformId = session.platformId;
    addEvent(context, resident, session.minute + offset * 3, type, note, {
      platformId, productId, sessionId: session.id, journeyId: session.journeyId, from: session.from, ...details,
    });
    offset++;
  };
}

function fulfilOrders(context, resident, ordersDue) {
  for (const order of ordersDue ?? []) {
    const event = { platformId: order.platformId, productId: order.productId, orderId: order.id, from: order.from };
    const product = context.productById.get(order.productId);
    if (order.status === 'paid') {
      order.status = 'delivered';
      addEvent(context, resident, 720, 'delivery', `收到 ${product.name}，由${order.fulfillment}完成交付。`, event);
    } else if (order.status === 'delivered' && order.refundDay === context.day) {
      order.status = 'refunded';
      resident.remainingCents = Math.min(resident.budgetCents, resident.remainingCents + order.paidCents);
      const inventoryId = `${order.platformId}/${order.productId}`;
      context.inventory.set(inventoryId, Math.max(0, (context.inventory.get(inventoryId) ?? 0) - 1));
      context.ownedProducts.delete(`${resident.id}/${order.productId}`);
      addEvent(context, resident, 779, 'refund', `退回 ${product.name}，额度已返还。`, { ...event, cents: order.paidCents });
    }
  }
}

function buildContext(state, day) {
  const ordersDue = new Map();
  const inventory = new Map();
  const ownedProducts = new Set();
  const orderIds = new Set();
  for (const order of state.orders) {
    orderIds.add(order.id);
    if (order.status !== 'refunded') {
      const key = `${order.platformId}/${order.productId}`;
      inventory.set(key, (inventory.get(key) ?? 0) + 1);
      ownedProducts.add(`${order.residentId}/${order.productId}`);
    }
    if ((order.status === 'paid' && day === order.deliveryDay) || (order.status === 'delivered' && day === order.refundDay)) {
      if (!ordersDue.has(order.residentId)) ordersDue.set(order.residentId, []);
      ordersDue.get(order.residentId).push(order);
    }
  }
  return {
    day, events: [], inventory, ordersDue, ownedProducts, orderIds, orders: state.orders,
    productById: new Map(state.products.map((product) => [product.id, product])),
    catalogues: new Map(MARKETPLACES.map(({ id }) => [id, productsAtMarketplace(state, id, { day })])),
  };
}

function findOffer(context, product, platformId) {
  const offer = offerForProduct(product, platformId);
  return { ...offer, stock: Math.max(0, offer.stock - (context.inventory.get(`${platformId}/${product.id}`) ?? 0)) };
}

function pickCatalogue(context, resident, platformId, source, random) {
  const category = resident.intent?.category ?? resident.interest;
  const marketWeight = platformId === 'jd' ? 0.22 : 0.06;
  return context.catalogues.get(platformId)
    .filter((product) => !context.ownedProducts.has(`${resident.id}/${product.id}`))
    .map((product) => {
      const match = product.category === category;
      const offer = findOffer(context, product, platformId);
      const fit = match ? (source === 'search' ? 1.45 : 0.78) : 0;
      const priceFit = product.priceCents + offer.shippingCents <= resident.remainingCents
        ? (resident.segment === '价格敏感型' ? 0.32 : 0.17) : 0;
      const listingQuality = product.creative ? 0.08 : 0;
      const ownStock = offer.seller === '商城自营' ? marketWeight : 0;
      return { product, offer, score: fit + priceFit + listingQuality + ownStock + random() * 0.9 };
    })
    .sort((first, second) => second.score - first.score || first.product.id.localeCompare(second.product.id))
    .slice(0, source === 'search' ? 3 : source === 'feed' ? 2 : 1);
}

function completeCheckout(context, resident, product, offer, session, log, random) {
  const price = product.priceCents + offer.shippingCents;
  log('checkout', `核对 ${product.name} 的到手价和配送方式。`, product.id, {
    cents: price, seller: offer.seller, fulfillment: offer.fulfillment,
  });
  if (offer.stock < 1 || price > resident.remainingCents) {
    log('exit', offer.stock < 1 ? '当前卖家缺货。' : '到手价超过剩余预算。', product.id);
    resident.cart = null;
    return;
  }
  const orderId = `order-${session.journeyId}`;
  if (context.orderIds.has(orderId)) {
    resident.cart = null;
    return;
  }
  const deliveryDay = context.day + offer.deliveryDays;
  const refundDay = random() < 0.087 ? deliveryDay + 1 + Math.floor(random() * 3) : null;
  const index = `${session.platformId}/${product.id}`;
  context.inventory.set(index, (context.inventory.get(index) ?? 0) + 1);
  context.ownedProducts.add(`${resident.id}/${product.id}`);
  context.orderIds.add(orderId);
  resident.remainingCents -= price;
  resident.cart = null;
  resident.intent = null;
  resident.need = `关注${categoryName(resident.interest)}`;
  context.orders.push({
    id: orderId, residentId: resident.id, productId: product.id, platformId: session.platformId,
    purchasedDay: context.day, priceCents: product.priceCents, shippingCents: offer.shippingCents, paidCents: price,
    deliveryDay, refundDay, status: 'paid', from: session.from, seller: offer.seller, fulfillment: offer.fulfillment,
  });
  log('paid', `完成 ${product.name} 的模拟付款，预计第 ${deliveryDay} 天送达。`, product.id, {
    cents: price, orderId, seller: offer.seller, fulfillment: offer.fulfillment,
  });
}

function revisitCart(context, resident, random, minute) {
  const cart = resident.cart;
  const product = context.productById.get(cart.productId);
  if (!product || context.day > cart.expires) {
    if (product) {
      addEvent(context, resident, minute, 'exit', `搁置购物车里的 ${product.name}。`, {
        platformId: cart.platformId, productId: product.id, journeyId: cart.journeyId, from: cart.from,
      });
    }
    resident.cart = null;
    return false;
  }
  if (random() > 0.62 + resident.patience * 0.19) return false;
  const session = { id: `${resident.id}-${context.day}-return`, ...cart, minute };
  const log = commerceLogger(context, resident, session);
  log('revisit', `回到购物车查看 ${product.name}，再次确认价格及配送。`, product.id);
  if (random() < 0.57 + (resident.intent?.urgency ?? 0.2) * 0.13) {
    completeCheckout(context, resident, product, findOffer(context, product, cart.platformId), session, log, random);
  } else {
    log('defer', '先保留购物车，准备之后再决定。', product.id);
  }
  return true;
}

function listingUtility(resident, { product, offer }) {
  const affordable = product.priceCents + offer.shippingCents <= resident.remainingCents;
  if (!affordable || offer.stock < 1) return -1;
  const categoryMatch = (resident.intent?.category ?? resident.interest) === product.category;
  return (categoryMatch ? 1 : 0)
    - (product.priceCents + offer.shippingCents) / resident.remainingCents * 0.55
    - offer.deliveryDays / 12 * (resident.intent?.urgency ?? 0.25);
}

function startSession(context, resident, random, minute) {
  const platformId = resident.marketplaceId === 'jd' && random() < 0.16 ? 'global' : resident.marketplaceId;
  const sourceDraw = random();
  const source = sourceDraw < (resident.intent ? (platformId === 'jd' ? 0.68 : 0.60) : 0.10) ? 'search'
    : sourceDraw < 0.90 ? 'feed' : 'referral';
  const id = `${resident.id}-${context.day}-browse`;
  const session = { id, journeyId: id, platformId, from: source, minute };
  const log = commerceLogger(context, resident, session);
  const category = PRODUCT_CATEGORIES.find(({ id }) => id === (resident.intent?.category ?? resident.interest));
  const query = source === 'search' ? searchTerm(category, resident.locale) : undefined;
  const market = MARKETPLACES.find(({ id }) => id === platformId);
  log(source, query ? `在${market.name}搜索「${query}」。` : `从「${SOURCE_LABELS[source]}」进入${market.name}。`, null,
    query ? { query } : {});
  const listing = pickCatalogue(context, resident, platformId, source, random);
  if (listing.length === 0) {
    log('exit', '暂时没有合适的备选商品。', null);
    return;
  }
  for (const { product } of listing) log('impression', `在商品列表看到 ${product.name}。`, product.id);
  const [primary, alternate] = listing;
  let { product, offer } = primary;
  const detailChance = 0.36 + (resident.intent?.category === product.category ? 0.32 : 0) + resident.curiosity * 0.21;
  if (random() > detailChance) {
    log('exit', '浏览列表后离开。', product.id);
    return;
  }
  log('detail', `打开 ${product.name} 的商品详情，查看规格与评价。`, product.id);
  const comparisonChance = (platformId === 'global' ? 0.55 : 0.39) + (resident.segment === '理性比较型' ? 0.16 : 0);
  if (alternate && random() < comparisonChance) {
    log('compare', `将 ${product.name} 与 ${alternate.product.name} 比较。`, product.id, { comparedProductId: alternate.product.id });
    log('compare', `把 ${alternate.product.name} 当作备选。`, alternate.product.id, { comparedProductId: product.id });
    if (listingUtility(resident, alternate) > listingUtility(resident, primary) + 0.08) {
      ({ product, offer } = alternate);
      log('detail', `比较后打开备选 ${product.name} 的详情。`, product.id);
    }
  }
  if (product.creative && random() < 0.73) {
    log('media', '查看商品详情中的图文、演示或使用场景。', product.id);
  }
  const price = product.priceCents + offer.shippingCents;
  const commodity = resident.remainingCents > 0 ? price / resident.remainingCents : Infinity;
  const delaySensitivity = resident.segment === '偏好快捷型' ? 1.35 : 1;
  const delayPenalty = offer.deliveryDays / 12 * (resident.intent?.urgency ?? 0.25) * delaySensitivity;
  const pricePenalty = commodity * (resident.segment === '价格敏感型' ? 0.26 : 0.18);
  const match = resident.intent?.category === product.category;
  const cartChance = 0.16 + (match ? 0.44 : 0.04) + resident.curiosity * 0.16 - pricePenalty - delayPenalty;
  if (offer.stock < 1 || price > resident.remainingCents || random() > cartChance) {
    const reason = offer.stock < 1 ? '商品暂无可用库存。'
      : price > resident.remainingCents ? '到手价超出目前预算，继续等待或寻找替代。'
        : '商品与需求仍有差距，今天先不购买。';
    log('exit', reason, product.id);
    return;
  }
  log('cart', `把 ${product.name} 加入购物车。`, product.id, { cents: price });
  if (random() < (platformId === 'jd' ? 0.62 : 0.52) + (resident.intent?.urgency ?? 0.3) * 0.14) {
    completeCheckout(context, resident, product, offer, session, log, random);
  } else {
    resident.cart = { productId: product.id, platformId, journeyId: session.journeyId, from: source, expires: context.day + 3 };
    log('defer', '留在购物车，计划回来看价格或配送。', product.id);
  }
}

function simulateResident(context, resident, seed) {
  const { day } = context;
  const random = randomFrom(hash(`${seed}/day/${day}/${resident.id}`));
  const weekend = day % 7 === 0 || day % 7 === 6;
  const activities = weekend ? ['出门采购', '居家整理', '运动或散步', '安排下周计划'] : ['开始当天工作', '通勤或准备上课', '处理日常安排', '查看今天的任务'];
  addEvent(context, resident, 495 + Math.floor(random() * 120), 'life', `${pick(activities, random())}。`);
  if (day > 1 && (day - 1) % 30 === 0) {
    resident.remainingCents = resident.budgetCents;
    addEvent(context, resident, 540, 'budget', '进入新预算周期，补充可用消费额度。', { cents: resident.budgetCents });
  }
  fulfilOrders(context, resident, context.ordersDue.get(resident.id));
  if (resident.intent?.expires < day) {
    resident.intent = null;
    resident.need = `关注${categoryName(resident.interest)}`;
  }
  const minute = 810 + Math.floor(random() * 330);
  if (resident.cart && revisitCart(context, resident, random, minute)) return;
  if (!resident.intent && random() < (weekend ? 0.26 : 0.19)) {
    resident.intent = chooseNeed(resident, day, random);
    resident.need = `${resident.intent.trigger} · ${categoryName(resident.intent.category)}`;
    addEvent(context, resident, minute - 14, 'need', resident.need);
  }
  if (resident.cart || random() > (resident.intent ? 0.44 + resident.intent.urgency * 0.35 : 0.075 + resident.curiosity * 0.08)) return;
  startSession(context, resident, random, minute);
}

export function advanceLivingWorld(world, days = 1) {
  validWorld(world);
  if (!Number.isInteger(days) || days < 1 || days > 366 || !Number.isSafeInteger(world.day + days)) {
    throw new Error('每次可以推进 1 到 366 个模拟日。');
  }
  const state = {
    ...world, history: [...world.history], residents: world.residents.map((resident) => ({ ...resident })),
    orders: world.orders.map((order) => ({ ...order })),
  };
  for (let offset = 0; offset < days; offset++) {
    const day = state.day + 1;
    const context = buildContext(state, day);
    for (const resident of state.residents) simulateResident(context, resident, state.seed);
    context.events.sort((first, second) => first.minute - second.minute || first.residentId.localeCompare(second.residentId));
    state.history.push({ day, events: context.events });
    state.day = day;
  }
  return state;
}

export function residentEvents(world, residentId, { day } = {}) {
  return world.history.filter((batch) => day == null || batch.day === Number(day))
    .flatMap(({ events }) => events.filter((event) => event.residentId === residentId));
}

function funnel() {
  return {
    exposed: new Set(), viewed: new Set(), compared: new Set(), carted: new Set(), checkout: new Set(), buyers: new Set(),
    orders: 0, refunds: 0, grossCents: 0, netCents: 0,
  };
}

function countStage(funnel, event) {
  const set = STAGES[event.type];
  if (set) funnel[set].add(event.residentId);
  if (event.type === 'paid') {
    funnel.orders++;
    funnel.grossCents += event.cents;
    funnel.netCents += event.cents;
  }
  if (event.type === 'refund') {
    funnel.refunds++;
    funnel.netCents -= event.cents;
  }
}

function funnelNumbers(stats, eligible) {
  const counts = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value instanceof Set ? value.size : value]));
  return {
    ...counts, eligible,
    conversionRate: eligible ? counts.buyers / eligible : null,
    exposureConversionRate: counts.exposed ? counts.buyers / counts.exposed : null,
  };
}

export function summarizeProduct(world, productId) {
  const product = world.products.find((item) => item.id === productId);
  if (!product) return null;
  const totals = funnel();
  const byPlatform = new Map(product.platforms.map((id) => [id, funnel()]));
  const bySource = new Map(SOURCES.map((source) => [source, funnel()]));
  const days = [];
  const recentEvents = [];
  for (const batch of world.history) {
    if (batch.day < product.publishedDay) continue;
    const daily = funnel();
    for (const event of batch.events) {
      if (event.productId !== productId) continue;
      countStage(totals, event);
      countStage(daily, event);
      const platform = byPlatform.get(event.platformId);
      if (platform) countStage(platform, event);
      const source = bySource.get(event.from);
      if (source) countStage(source, event);
      recentEvents.push(event);
      if (recentEvents.length > 30) recentEvents.shift();
    }
    days.push({ day: batch.day, ...funnelNumbers(daily, 0) });
  }
  const elapsedDays = Math.max(0, world.day - product.publishedDay + 1);
  const eligible = (platforms) => elapsedDays === 0 ? 0 : world.residents.filter((resident) =>
    resident.marketplaceIds.some((platformId) => platforms.includes(platformId))).length;
  return {
    productId, elapsedDays, publishedDay: product.publishedDay, ...funnelNumbers(totals, eligible(product.platforms)),
    platforms: [...byPlatform].map(([platformId, stats]) => ({ platformId, ...funnelNumbers(stats, eligible([platformId])) })),
    discovery: [...bySource].map(([entry, stats]) => ({ entry, name: SOURCE_LABELS[entry], ...funnelNumbers(stats, 0) })),
    days, recentEvents: recentEvents.reverse(),
  };
}
