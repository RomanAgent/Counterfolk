import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  WORLD_RESIDENT_COUNT, advanceLivingWorld, createLivingWorld, offerForProduct, productsAtMarketplace,
  publishProduct, residentEvents, summarizeProduct,
} from '../src/living-world.js';

const uploaded = {
  id: 'sleep-monitor', name: '夜间环境监测仪', category: 'home', priceCents: 3890, platforms: ['jd'],
  brand: 'Sleep Desk', description: '记录卧室温湿度。', features: ['保留读数'],
  imageKey: 'upload-sleep-monitor', creative: { caption: '看看夜里的房间变化' },
};

test('resident identities persist through day progression and JSON rehydration', () => {
  const initial = createLivingWorld({ seed: 128 });
  assert.equal(initial.residents.length, WORLD_RESIDENT_COUNT);
  assert.equal(new Set(initial.residents.map(({ id }) => id)).size, WORLD_RESIDENT_COUNT);
  assert.equal(new Set(initial.residents.map(({ name }) => name)).size, WORLD_RESIDENT_COUNT);
  const resumable = JSON.parse(JSON.stringify(advanceLivingWorld(initial, 2)));
  const continued = advanceLivingWorld(resumable, 4);
  assert.deepEqual(continued, advanceLivingWorld(initial, 6));
  assert.equal(initial.day, 0);
  assert.equal(initial.history.length, 0);
  assert.equal(resumable.day, 2);
  for (const resident of continued.residents) {
    const original = initial.residents.find(({ id }) => id === resident.id);
    assert.equal(resident.name, original.name);
    assert.equal(resident.market, original.market);
    assert.equal(resident.budgetCents, original.budgetCents);
    const day = residentEvents(continued, resident.id, { day: 5 });
    assert.ok(day.some(({ type }) => type === 'life'));
    assert.ok(day.every((event) => event.day === 5 && event.residentId === resident.id));
    assert.ok(residentEvents(continued, resident.id).every((event) => !event.platformId || resident.marketplaceIds.includes(event.platformId)));
  }
});

test('published products join the next available shelf and earn only organic traffic', () => {
  const baseline = advanceLivingWorld(createLivingWorld(), 4);
  const world = publishProduct(baseline, uploaded);
  assert.equal(baseline.products.some(({ id }) => id === uploaded.id), false);
  assert.equal(world.products.at(-1).publishedDay, 5);
  assert.equal(productsAtMarketplace(world, 'global').some(({ id }) => id === uploaded.id), false);
  assert.equal(productsAtMarketplace(world, 'jd', { day: 4 }).some(({ id }) => id === uploaded.id), false);
  assert.equal(productsAtMarketplace(world, 'jd').some(({ id }) => id === uploaded.id), true);
  const pending = summarizeProduct(world, uploaded.id);
  assert.equal(pending.elapsedDays, 0);
  assert.equal(pending.conversionRate, null);
  assert.equal(pending.exposureConversionRate, null);

  const result = advanceLivingWorld(world, 14);
  const summary = summarizeProduct(result, uploaded.id);
  assert.equal(summary.elapsedDays, 14);
  assert.equal(summary.days[0].day, 5);
  assert.deepEqual(summary.platforms.map(({ platformId }) => platformId), ['jd']);
  assert.equal(summary.eligible, result.residents.filter(({ marketplaceIds }) => marketplaceIds.includes('jd')).length);
  assert.ok(summary.exposed > 0 && summary.exposed < summary.eligible);
  assert.ok(summary.buyers > 0 && summary.buyers <= summary.exposed);
  assert.equal(summary.conversionRate, summary.buyers / summary.eligible);
  assert.equal(summary.exposureConversionRate, summary.buyers / summary.exposed);
  assert.equal(summary.days.reduce((sum, day) => sum + day.orders, 0), summary.orders);
  assert.equal(summary.days.reduce((sum, day) => sum + day.refunds, 0), summary.refunds);
  assert.ok(summary.recentEvents.every((event) => event.day >= 5 && event.platformId === 'jd'));
  assert.ok(result.history.flatMap(({ events }) => events)
    .some(({ type, productId }) => type === 'media' && productId === uploaded.id));
});

test('orders debit budgets once, and refund, delivery, and cart events remain attributable', () => {
  const world = advanceLivingWorld(createLivingWorld(), 24);
  const events = world.history.flatMap(({ events }) => events);
  const purchases = events.filter(({ type }) => type === 'paid');
  const refunds = events.filter(({ type }) => type === 'refund');
  assert.ok(purchases.length > 0);
  assert.ok(refunds.length > 0);
  assert.ok(events.some(({ type }) => type === 'revisit'));
  assert.equal(purchases.length, world.orders.length);
  assert.equal(new Set(purchases.map(({ orderId }) => orderId)).size, purchases.length);
  assert.ok(purchases.every((payment) => events.some((event) => event.type === 'cart'
    && event.journeyId === payment.journeyId && event.productId === payment.productId)));
  for (const resident of world.residents) {
    const spent = purchases.filter(({ residentId }) => residentId === resident.id).reduce((sum, { cents }) => sum + cents, 0);
    const returned = refunds.filter(({ residentId }) => residentId === resident.id).reduce((sum, { cents }) => sum + cents, 0);
    assert.equal(resident.remainingCents, resident.budgetCents - spent + returned);
    assert.ok(resident.remainingCents >= 0);
  }
  assert.ok(world.orders.every((order) => order.deliveryDay > order.purchasedDay));
  assert.ok(world.orders.some((order) => order.status === 'delivered'));
  const net = purchases.reduce((sum, { cents }) => sum + cents, 0) - refunds.reduce((sum, { cents }) => sum + cents, 0);
  assert.equal(world.products.reduce((sum, product) => sum + summarizeProduct(world, product.id).netCents, 0), net);
});

test('the two marketplace offers carry distinct shipping mechanics and enforce stock', () => {
  const initial = createLivingWorld();
  const demo = initial.products.find(({ id }) => id === 'relay-plug');
  const global = offerForProduct(demo, 'global');
  const jd = offerForProduct(demo, 'jd');
  assert.ok(global.shippingCents > jd.shippingCents);
  assert.ok(global.deliveryDays > jd.deliveryDays);
  const world = publishProduct(initial, { ...uploaded, stock: 0 });
  const result = advanceLivingWorld(world, 10);
  assert.equal(offerForProduct(world.products.at(-1), 'global'), null);
  assert.equal(offerForProduct(world.products.at(-1), 'jd', { world: result }).stock, 0);
  assert.ok(summarizeProduct(result, uploaded.id).exposed > 0);
  assert.equal(summarizeProduct(result, uploaded.id).orders, 0);
});

test('publishing validates product identity and compact serialized metadata', () => {
  const world = createLivingWorld();
  assert.throws(() => publishProduct(world, { ...uploaded, id: world.products[0].id }), /已存在/);
  assert.throws(() => publishProduct(world, { ...uploaded, platforms: ['other'] }), /平台/);
  assert.throws(() => publishProduct(world, { ...uploaded, creative: { text: 'x'.repeat(48000) } }), /过长/);
  assert.throws(() => publishProduct(world, { ...uploaded, priceCents: 1.5 }), /价格/);
});
