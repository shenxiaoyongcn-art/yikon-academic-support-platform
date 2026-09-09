import assert from 'node:assert/strict';
import test from 'node:test';
import { belongsToParentGroup, distributeSiblingGroup, type SiblingLayoutNode } from './pedigree-sibling-layout.ts';

const nodes: SiblingLayoutNode[] = [
  { id: 'father', order: 1 },
  { id: 'mother', order: 2 },
  { id: 'third', fatherId: 'father', motherId: 'mother', order: 5, manualX: 810, manualY: 420 },
  { id: 'first', fatherId: 'father', motherId: 'mother', order: 3, manualX: 460, manualY: 405 },
  { id: 'second', fatherId: 'father', motherId: 'mother', order: 4, manualX: 610, manualY: 435 },
];
const positions = new Map([
  ['father', { x: 420, y: 220 }],
  ['mother', { x: 660, y: 220 }],
  ['first', { x: 460, y: 405 }],
  ['second', { x: 610, y: 435 }],
  ['third', { x: 810, y: 420 }],
]);

test('sibling group is centred below parents, ordered and evenly spaced', () => {
  const result = distributeSiblingGroup(nodes, positions, 'father', 'mother', 112);
  const siblings = result.filter((node) => node.fatherId).sort((a, b) => a.order - b.order);
  assert.deepEqual(siblings.map((node) => node.manualX), [428, 540, 652]);
  assert.ok(siblings.every((node) => node.manualY === 420));
});

test('spacing supports one-pixel precision and clamps unsafe extremes', () => {
  const precise = distributeSiblingGroup(nodes, positions, 'father', 'mother', 97, 400)
    .filter((node) => node.fatherId)
    .sort((a, b) => a.order - b.order);
  assert.equal(precise[1].manualX! - precise[0].manualX!, 97);
  assert.equal(precise[2].manualX! - precise[1].manualX!, 97);
  assert.ok(precise.every((node) => node.manualY === 400));

  const clamped = distributeSiblingGroup(nodes, positions, 'father', 'mother', 500)
    .filter((node) => node.fatherId)
    .sort((a, b) => a.order - b.order);
  assert.equal(clamped[1].manualX! - clamped[0].manualX!, 200);
});

test('half-siblings are not mixed into an exact parent group', () => {
  assert.equal(belongsToParentGroup({ id: 'half', fatherId: 'father', order: 9 }, 'father', 'mother'), false);
});
