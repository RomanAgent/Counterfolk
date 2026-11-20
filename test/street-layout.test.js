import assert from 'node:assert/strict';
import { test } from 'node:test';
import { residentPose } from '../src/street-layout.js';

test('renders only completed stages at the selected time and keeps online events outside the store', () => {
  const resident = {
    id: 7,
    trace: {
      a: [
        { day: 2, minute: 600, type: 'exposed' },
        { day: 2, minute: 612, type: 'considered' },
        { day: 2, minute: 623, type: 'purchase' },
      ],
      b: [{ day: 3, minute: 600, type: 'exposed' }, { day: 3, minute: 635, type: 'exit' }],
    },
  };
  for (const [minute, activity] of [[599, 'street'], [600, 'entrance'], [612, 'browse'], [623, 'checkout']]) {
    assert.equal(residentPose(resident, { day: 2, minute }).activity, activity);
  }
  assert.equal(residentPose(resident, { day: 1 }).activity, 'street');
  assert.equal(residentPose(resident, { day: 2, minute: 623, channel: 'ecommerce' }).activity, 'online');
  assert.equal(residentPose(resident, { arm: 'b', day: 3, minute: 635 }).activity, 'exit');
});
