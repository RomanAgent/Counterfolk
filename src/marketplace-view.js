import { MARKETPLACES, PRODUCT_CATEGORIES, offerForProduct } from './living-world.js';

const MARKETS = {
  global: {
    type: '国际综合电商',
    headline: '第一次挑智能硬件？',
    subtitle: '从居家环境、随身设备到桌面电源，比较卖家、到手价与配送。',
    figure: '环球货架智能硬件目录',
  },
  jd: {
    type: '本地自营电商',
    headline: '当天需要，先查送达',
    subtitle: '集中查看锋巷目录里各款智能硬件的模拟库存与配送时效。',
    figure: '星选智能硬件目录',
  },
};

const displayExchangeRate = 7.2;
const currencies = {
  global: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  jd: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
};
const iconPaths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  cart: '<path d="M3 4h2l2.5 12h11l2-8H6"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
  delivery: '<path d="M3 6h12v11H3zM15 9h4l2 4v4h-6"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cube: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8"/>',
  spark: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="m14 5-7 7 7 7M7 12h13"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]}</svg>`;
}

function text(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function mediaUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'blob:' || url.origin === location.origin && /^https?:$/.test(url.protocol)) return url.href;
  } catch {
    // Ignore invalid catalogue media links.
  }
  return null;
}

function trimmed(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
}

function categoryOf(product) {
  return PRODUCT_CATEGORIES.find(({ id }) => id === product.category)?.name ?? '智能硬件';
}

function brandOf(product) {
  return product.brand || 'Counterfolk';
}

function mediaTile(product, eager = false) {
  const styleClass = product.imageKey === 'airloop-mini' || product.id === 'airloop-mini' ? 'airloop'
    : product.imageKey === 'stride-band' || product.id === 'stride-band' ? 'stride'
      : ['home', 'audio', 'wearables', 'power', 'tracking'].includes(product.category) ? product.category : 'home';
  return `<div class="mk-media mk-media--${styleClass}" data-mk-media="${text(product.id)}" data-eager="${eager}">
    <span class="mk-media-fallback" aria-label="${text(product.name)}，商品示意图" role="img">
      <i></i><b></b><span>${text(brandOf(product))}</span>
    </span>
  </div>`;
}

function browseSettings() {
  return { query: '', category: 'all', sort: 'recommended', ready: false, cart: new Map() };
}

export function createMarketplaceView({
  root, getCatalog, getOffer = offerForProduct, getMedia = () => null, onView, initialMarket = 'global', formatMoney,
}) {
  const settings = { global: browseSettings(), jd: browseSettings() };
  let market = Object.hasOwn(MARKETS, initialMarket) ? initialMarket : 'global';
  let mode = 'browse';
  let productId = null;
  let renderId = 0;
  let order = null;
  let sequence = 0;
  let notice;
  let noticeTimer;
  const mediaRequests = new Map();

  root.classList.add('market-preview');

  function money(cents) {
    if (formatMoney) return formatMoney(cents, market);
    const price = cents / 100 * (market === 'jd' ? displayExchangeRate : 1);
    return currencies[market].format(price);
  }

  function marketProducts() {
    return getCatalog().filter((product) => product.platforms?.includes(market));
  }

  function offer(product) {
    return getOffer(product, market);
  }

  function purchaseLabel(product) {
    const row = offer(product);
    if (row.stock === 0) return '暂时缺货';
    const freight = row.shippingCents === 0 ? '包邮' : `运费 ${money(row.shippingCents)}`;
    return row.deliveryDays
      ? `${freight} · ${row.deliveryDays} 天送达`
      : freight;
  }

  function cartItems() {
    const products = new Map(marketProducts().map((product) => [product.id, product]));
    const cart = settings[market].cart;
    return [...cart].flatMap(([id, quantity]) => {
      const product = products.get(id);
      if (!product) return [];
      const available = Math.min(quantity, offer(product).stock);
      return [{ product, quantity, available }];
    });
  }

  function cartSize() {
    return cartItems().reduce((total, row) => total + row.quantity, 0);
  }

  function cartSummary(rows) {
    const subtotal = rows.reduce((total, { product, quantity }) => total + product.priceCents * quantity, 0);
    const freight = rows.reduce((total, { product }) => total + offer(product).shippingCents, 0);
    return { subtotal, freight, total: subtotal + freight };
  }

  function searchProducts() {
    const { query, category, sort, ready } = settings[market];
    const words = trimmed(query).split(/\s+/).filter(Boolean);
    const filtered = marketProducts().filter((product) => {
      if (category !== 'all' && product.category !== category) return false;
      if (ready) {
        const listing = offer(product);
        if (!listing.stock || market === 'jd' && listing.deliveryDays > 1) return false;
      }
      const haystack = trimmed([product.name, brandOf(product), categoryOf(product), product.description, ...(product.features ?? [])].join(' '));
      return words.every((word) => haystack.includes(word));
    });
    if (sort === 'latest') return filtered.sort((a, b) => b.publishedDay - a.publishedDay);
    if (sort === 'price-low') return filtered.sort((a, b) => a.priceCents + offer(a).shippingCents - b.priceCents - offer(b).shippingCents);
    if (sort === 'price-high') return filtered.sort((a, b) => b.priceCents + offer(b).shippingCents - a.priceCents - offer(a).shippingCents);
    if (market === 'jd') return filtered.sort((a, b) => offer(a).deliveryDays - offer(b).deliveryDays);
    return filtered;
  }

  function header() {
    const { query } = settings[market];
    return `<div class="mk-channel-switch" aria-label="虚拟电商平台">
      ${MARKETPLACES.map(({ id, name }) => `
        <button type="button" class="mk-channel" data-mk-action="platform" data-value="${id}" aria-pressed="${id === market}">
          <span class="mk-channel-logo mk-channel-logo--${id}">${icon(id === 'global' ? 'spark' : 'cube')}</span>
          <span><strong>${text(name)}</strong><small>${MARKETS[id].type}</small></span>
        </button>`).join('')}
    </div>
    <div class="mk-shell">
      <div class="mk-masthead">
        <button type="button" class="mk-wordmark" data-mk-action="browse">${icon(market === 'global' ? 'spark' : 'cube')}${text(MARKETPLACES.find(({ id }) => id === market).name)}</button>
        <form class="mk-search" data-mk-search role="search" aria-label="搜索商城">
          <label class="sr-only" for="cf-market-query">搜索商品</label>
          ${icon('search')}<input type="search" id="cf-market-query" name="query" value="${text(query)}" autocomplete="off" placeholder="搜索商品、品牌或关键词">
          <button type="submit">搜索</button>
        </form>
        <button type="button" class="mk-cart-trigger" data-mk-action="cart">${icon('cart')}<span>购物车</span><b>${cartSize()}</b></button>
      </div>
      <div class="mk-notice" role="status" hidden></div>`;
  }

  function catalogTile(product) {
    const listing = offer(product);
    return `<article class="mk-product">
      <button class="mk-card-button" type="button" data-mk-action="product" data-value="${text(product.id)}">
        ${mediaTile(product)}
        <div class="mk-card-text">
          <small>${text(brandOf(product))} · ${text(categoryOf(product))}</small>
          <h4>${text(product.name)}</h4>
          <strong>${text(money(product.priceCents))}</strong>
        </div>
      </button>
      <div class="mk-card-shipping">
        <span title="${text(listing.seller)}">${text(listing.seller)}</span>
        <span>${text(purchaseLabel(product))}</span>
      </div>
    </article>`;
  }

  function browse() {
    const { category, query, sort, ready } = settings[market];
    const categories = [{ id: 'all', name: '全部商品' }, ...PRODUCT_CATEGORIES];
    const results = searchProducts();
    return `${!query && category === 'all' ? `<div class="mk-hero" aria-label="${MARKETS[market].figure}">
        <div><h2>${MARKETS[market].headline}</h2><p>${MARKETS[market].subtitle}</p>
          <button class="mk-primary" type="button" data-mk-action="shelf">浏览商品</button>
        </div>
      </div>` : ''}
      <section class="mk-shelf" aria-labelledby="mk-shelf-title">
        <div class="mk-shelf-heading">
          <div><h2 id="mk-shelf-title">${query ? `“${text(query)}”的搜索结果` : '商品目录'}</h2><p>${results.length} 件商品</p></div>
          <label class="mk-sort">排序<select data-mk-sort aria-label="商品排序">
            ${[['recommended', '默认顺序'], ['latest', '最新上架'], ['price-low', '到手价从低到高'], ['price-high', '到手价从高到低']]
              .map(([id, name]) => `<option value="${id}" ${id === sort ? 'selected' : ''}>${name}</option>`).join('')}
          </select></label>
        </div>
        <div class="mk-shelf-filters">
          <div class="mk-category-list" aria-label="商品分类">
            ${categories.map((item) => `<button type="button" data-mk-action="category" data-value="${text(item.id)}" aria-pressed="${item.id === category}">${text(item.name)}</button>`).join('')}
          </div>
          <label class="mk-stock-filter"><input type="checkbox" data-mk-ready ${ready ? 'checked' : ''}>${market === 'jd' ? '次日可送' : '只看有货'}</label>
        </div>
        ${results.length ? `<div class="mk-products">${results.map(catalogTile).join('')}</div>` : `
          <div class="mk-empty"><h3>没有找到匹配商品</h3><p>试试另一个关键词或切换分类。</p><button type="button" class="mk-secondary" data-mk-action="clear">清除筛选</button></div>`}
      </section>`;
  }

  function detail(product) {
    const listing = offer(product);
    const features = (product.features ?? []).filter(Boolean);
    const dispatch = listing.fulfillment ? `<dd>${text(listing.fulfillment)}</dd>` : '<dd>模拟配送</dd>';
    return `<section class="mk-detail" aria-labelledby="mk-detail-title">
      <button type="button" class="mk-return" data-mk-action="browse">${icon('back')}返回商品目录</button>
      <div class="mk-detail-grid">
        ${mediaTile(product, true)}
        <div class="mk-detail-copy">
          <small>${text(brandOf(product))} · ${text(categoryOf(product))}</small>
          <h2 id="mk-detail-title">${text(product.name)}</h2>
          <strong class="mk-detail-price">${text(money(product.priceCents))}</strong>
          <p>${text(product.description)}</p>
          ${features.length ? `<ul>${features.map((feature) => `<li>${text(feature)}</li>`).join('')}</ul>` : ''}
          <dl class="mk-offer">
            <div><dt>卖家</dt><dd>${text(listing.seller)}</dd></div>
            <div><dt>履约</dt>${dispatch}</div>
            <div><dt>配送</dt><dd>${text(purchaseLabel(product))}</dd></div>
            <div><dt>到手价</dt><dd>${text(money(product.priceCents + listing.shippingCents))}</dd></div>
          </dl>
          <div class="mk-detail-actions">
            <button type="button" class="mk-primary" data-mk-action="add" data-value="${text(product.id)}" ${listing.stock === 0 ? 'disabled' : ''}>${icon('plus')}加入购物车</button>
            <button type="button" class="mk-secondary" data-mk-action="cart">查看购物车</button>
          </div>
        </div>
      </div>
      <div class="mk-story" data-mk-story hidden></div>
    </section>`;
  }

  function cart(checkout = false) {
    const rows = cartItems();
    const summary = cartSummary(rows);
    if (rows.length === 0) return `<section class="mk-empty"><h2 id="mk-checkout-title">购物车是空的</h2><button type="button" class="mk-primary" data-mk-action="browse">浏览商品</button></section>`;
    const stockChanged = rows.some((row) => row.quantity > row.available);
    return `<section class="mk-checkout" aria-labelledby="mk-checkout-title">
      <button type="button" class="mk-return" data-mk-action="${checkout ? 'cart' : 'browse'}">${icon('back')}${checkout ? '返回购物车' : '继续购物'}</button>
      <h2 id="mk-checkout-title">${checkout ? '确认模拟订单' : '购物车'}</h2>
      <div class="mk-checkout-grid">
        <ul class="mk-cart-items">${rows.map(({ product, quantity, available }) => `<li>
          ${mediaTile(product)}
          <div class="mk-cart-item-name"><button type="button" class="mk-product-link" data-mk-action="product" data-value="${text(product.id)}">${text(product.name)}</button>
            <small>${text(offer(product).seller)} · ${text(purchaseLabel(product))}</small>
            ${quantity > available ? '<small class="mk-stock-note">库存不足，请减少数量</small>' : ''}
          </div>
          ${checkout ? `<span>× ${quantity}</span>` : `<div class="mk-quantity">
            <button type="button" data-mk-action="decrease" data-value="${text(product.id)}" aria-label="减少 ${text(product.name)} 数量">${icon('minus')}</button>
            <output>${quantity}</output>
            <button type="button" data-mk-action="increase" data-value="${text(product.id)}" aria-label="增加 ${text(product.name)} 数量" ${quantity >= Math.min(99, offer(product).stock) ? 'disabled' : ''}>${icon('plus')}</button>
          </div>`}
          <strong>${text(money(product.priceCents * quantity))}</strong>
          ${checkout ? '' : `<button type="button" class="mk-remove" data-mk-action="remove" data-value="${text(product.id)}" aria-label="移除 ${text(product.name)}">${icon('close')}</button>`}
        </li>`).join('')}</ul>
        <div class="mk-totals">
          <h3>订单费用</h3>
          <dl><div><dt>商品小计</dt><dd>${text(money(summary.subtotal))}</dd></div><div><dt>模拟运费</dt><dd>${text(money(summary.freight))}</dd></div><div><dt>合计</dt><dd>${text(money(summary.total))}</dd></div></dl>
          ${checkout ? '<p>当前为访客预览。订单仅记录在此会话中。</p>' : ''}
          <button type="button" class="mk-primary" data-mk-action="${checkout ? 'submit' : 'checkout'}" ${stockChanged ? 'disabled' : ''}>${checkout ? '提交模拟订单' : '去结算'}</button>
        </div>
      </div>
    </section>`;
  }

  function confirmation() {
    return `<section class="mk-confirmation" aria-labelledby="mk-order-title">
      <div class="mk-confirm-icon">${icon('check')}</div>
      <h2 id="mk-order-title">模拟订单已提交</h2>
      <p>${text(order.number)} · ${order.items} 件商品 · ${text(money(order.total))}</p>
      <p>访客预览订单与居民测试数据独立。</p>
      <button type="button" class="mk-primary" data-mk-action="browse">返回商品目录</button>
    </section>`;
  }

  function gallery(media, product) {
    if (!media) return;
    const aPlus = (Array.isArray(media.aPlus) ? media.aPlus : []).map(mediaUrl).filter(Boolean);
    const video = mediaUrl(media.video);
    const copy = typeof media.copy === 'string' ? media.copy : '';
    if (!aPlus.length && !video && !copy) return;
    const output = root.querySelector('[data-mk-story]');
    if (!output) return;
    output.hidden = false;
    output.innerHTML = `<h3>商品内容</h3>
      ${aPlus.length ? `<div class="mk-a-plus">${aPlus.map((src, index) => `<img src="${text(src)}" alt="${text(product.name)} 卖点图 ${index + 1}" loading="lazy">`).join('')}</div>` : ''}
      ${video ? `<div class="mk-video"><h4>产品短视频</h4><video controls playsinline preload="metadata" aria-label="${text(product.name)} 产品短视频"><source src="${text(video)}"${media.videoMime ? ` type="${text(media.videoMime)}"` : ''}></video></div>`
        : aPlus.length || copy ? '<p class="mk-story-note">短视频将在素材准备后显示。</p>' : ''}
      ${copy ? `<div class="mk-social-copy"><h4>产品介绍</h4><p>${text(copy)}</p></div>` : ''}`;
  }

  function hydrateMedia(version, products, detailProduct) {
    const nodes = new Map();
    for (const tile of root.querySelectorAll('[data-mk-media]')) {
      const tiles = nodes.get(tile.dataset.mkMedia) ?? [];
      tiles.push(tile);
      nodes.set(tile.dataset.mkMedia, tiles);
    }
    async function fill(product) {
      const tiles = nodes.get(product.id);
      if (!tiles?.length && detailProduct?.id !== product.id) return;
      let request = mediaRequests.get(product.id);
      if (!request) {
        request = Promise.resolve().then(() => getMedia(product)).catch(() => null);
        mediaRequests.set(product.id, request);
      }
      const media = await request;
      if (renderId !== version) return;
      const hero = mediaUrl(media?.hero);
      if (hero && tiles) {
        for (const tile of tiles) {
          const image = document.createElement('img');
          image.src = hero;
          image.alt = product.name;
          if (tile.dataset.eager !== 'true') image.loading = 'lazy';
          image.addEventListener('load', () => tile.classList.add('mk-media-ready'), { once: true });
          tile.append(image);
          if (image.complete && image.naturalWidth > 0) tile.classList.add('mk-media-ready');
        }
      }
      if (detailProduct?.id === product.id) gallery(media, product);
    }
    for (const product of products) void fill(product);
  }

  function render(focus) {
    renderId += 1;
    const products = marketProducts();
    let selected = products.find((product) => product.id === productId);
    if (mode === 'detail' && !selected) mode = 'browse';
    if (mode !== 'detail') selected = null;
    root.dataset.marketplace = market;
    const body = mode === 'detail' ? detail(selected)
      : mode === 'cart' ? cart()
        : mode === 'checkout' ? cart(true)
          : mode === 'order' && order ? confirmation() : browse();
    root.innerHTML = `${header()}${body}<footer class="mk-footer">
      <span>Counterfolk 电商预览</span><span>${market === 'jd' ? '人民币按固定模拟汇率展示' : '价格以模拟美元显示'}</span>
    </footer></div>`;
    notice = root.querySelector('.mk-notice');
    hydrateMedia(renderId, products, selected);
    if (focus) {
      const target = root.querySelector(focus);
      const isHeading = target?.matches('h2,h3');
      if (isHeading) target.tabIndex = -1;
      target?.focus({ preventScroll: !isHeading });
    }
  }

  function showNotice(message) {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.hidden = false;
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 3700);
  }

  function openMarket(id) {
    if (!Object.hasOwn(MARKETS, id)) return false;
    market = id;
    mode = 'browse';
    productId = null;
    render(`[data-mk-action="platform"][data-value="${id}"]`);
    onView?.({ market, mode });
    return true;
  }

  function openProduct(id, preferredMarket = market) {
    if (!Object.hasOwn(MARKETS, preferredMarket)) preferredMarket = market;
    const product = getCatalog().find((item) => item.id === id);
    if (!product?.platforms?.length) return false;
    market = product.platforms.includes(preferredMarket) ? preferredMarket : product.platforms.find((item) => Object.hasOwn(MARKETS, item)) ?? market;
    if (!marketProducts().some((item) => item.id === id)) return false;
    mode = 'detail';
    productId = id;
    render('#mk-detail-title');
    onView?.({ market, mode, productId });
    return true;
  }

  function changeQuantity(id, by, focus) {
    const product = marketProducts().find((item) => item.id === id);
    if (!product) return;
    const current = settings[market].cart.get(id) ?? 0;
    const remaining = offer(product).stock;
    if (by > 0 && current >= Math.min(99, remaining)) {
      showNotice('已达到该商品的可用库存。');
      return;
    }
    if (current + by > 0) settings[market].cart.set(id, current + by);
    else settings[market].cart.delete(id);
    if (focus === 'add') {
      root.querySelector('.mk-cart-trigger b').textContent = cartSize();
      showNotice(`已加入购物车 · ${product.name}`);
      return;
    }
    const selector = `[data-mk-action="${focus}"][data-value="${CSS.escape(id)}"]`;
    render(focus === 'remove' || current + by <= 0 ? '#mk-checkout-title' : selector);
  }

  function completeOrder() {
    const rows = cartItems();
    if (!rows.length || rows.some(({ quantity, available }) => quantity > available)) {
      mode = 'cart';
      render('#mk-checkout-title');
      showNotice('请确认购物车库存后再提交。');
      return;
    }
    const { total } = cartSummary(rows);
    order = { number: `CF-${String(++sequence).padStart(4, '0')}`, total, items: cartSize() };
    settings[market].cart.clear();
    mode = 'order';
    render('#mk-order-title');
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('button[data-mk-action]');
    if (!action || !root.contains(action)) return;
    const { mkAction, value } = action.dataset;
    switch (mkAction) {
      case 'platform': openMarket(value); break;
      case 'product': openProduct(value); break;
      case 'cart': mode = 'cart'; render('#mk-checkout-title'); break;
      case 'checkout': mode = 'checkout'; render('#mk-checkout-title'); break;
      case 'submit': completeOrder(); break;
      case 'add': changeQuantity(value, 1, 'add'); break;
      case 'increase': changeQuantity(value, 1, 'increase'); break;
      case 'decrease': changeQuantity(value, -1, 'decrease'); break;
      case 'remove': changeQuantity(value, -(settings[market].cart.get(value) || 0), 'remove'); break;
      case 'category':
        settings[market].category = value;
        mode = 'browse';
        render(`[data-mk-action="category"][data-value="${CSS.escape(value)}"]`);
        break;
      case 'clear':
        settings[market].query = '';
        settings[market].category = 'all';
        settings[market].ready = false;
        mode = 'browse';
        render('#cf-market-query');
        break;
      case 'shelf':
        root.querySelector('#mk-shelf-title').tabIndex = -1;
        root.querySelector('#mk-shelf-title').focus();
        break;
      case 'browse': mode = 'browse'; render('#mk-shelf-title'); break;
    }
  });

  root.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-mk-search]')) return;
    event.preventDefault();
    const query = new FormData(event.target).get('query');
    settings[market].query = String(query ?? '').trim().slice(0, 150);
    settings[market].category = 'all';
    mode = 'browse';
    render('#mk-shelf-title');
  });

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-mk-ready]')) {
      settings[market].ready = event.target.checked;
      render('[data-mk-ready]');
    } else if (event.target.matches('[data-mk-sort]')) {
      settings[market].sort = event.target.value;
      render('[data-mk-sort]');
    }
  });

  render();
  return {
    refresh() {
      mediaRequests.clear();
      render();
    },
    openMarket,
    openProduct,
  };
}
