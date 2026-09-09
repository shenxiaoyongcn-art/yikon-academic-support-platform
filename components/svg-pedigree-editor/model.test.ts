import test from "node:test";
import assert from "node:assert/strict";
import { addChild, addParents, addSibling, addTwin, addUnion, defaultSpouseGender, emptyPedigree, generationByPerson, initialPedigree, makeId, moveSibling, newPerson, removeParentage, removeUnion, validatePedigree } from "./model.ts";
import { computeLayout } from "./layout.ts";

test("new pedigree starts as a centered three-person family", () => {
  const initial = emptyPedigree(); const layout = computeLayout(initial);
  assert.equal(initial.persons.length, 3); assert.equal(initial.unions.length, 1); assert.equal(initial.parentage.length, 1);
  const parents = initial.unions[0]; const child = initial.parentage[0];
  assert.equal(initial.persons.find((person) => person.id === parents.partnerA)?.gender, "male");
  assert.equal(initial.persons.find((person) => person.id === parents.partnerB)?.gender, "female");
  assert.equal(initial.persons.find((person) => person.id === child.childId)?.gender, "unknown");
  const positionedChild = layout.people.find((item) => item.person.id === child.childId)!;
  const positionedUnion = layout.unions.find((item) => item.id === parents.id)!;
  assert.equal(positionedChild.number, "II-1");
  assert.equal(positionedChild.x, positionedUnion.centerX);
});

test('initial pedestal is deterministic for server and client rendering', () => {
  assert.deepEqual(initialPedigree(), initialPedigree());
  assert.deepEqual(initialPedigree().persons.map((person) => person.id), ['initial-male', 'initial-female', 'initial-child']);
});
test("parents and child receive consecutive generations", () => {
  const initial = emptyPedigree("single");
  const childId = initial.persons[0].id;
  const result = addParents(initial, childId);
  const generations = generationByPerson(result);
  assert.equal(generations.get(childId), 1);
  assert.equal(Math.max(...result.unions.map((union) => generations.get(union.partnerA) ?? 0)), 0);
});

test("twins have common parents and validate", () => {
  const initial = emptyPedigree();
  const parented = addParents(initial, initial.persons[0].id);
  const result = addTwin(parented, parented.unions[0].id, "dizygotic");
  assert.equal(result.twinGroups[0].memberIds.length, 2);
});

test("invalid duplicate person IDs are rejected", () => {
  const pedigree = emptyPedigree();
  pedigree.persons.push({ ...pedigree.persons[0] });
  assert.throws(() => validatePedigree(pedigree), /重复个体 ID/);
});

test("child relationship can be added to a union", () => {
  const base = emptyPedigree("single");
  const parented = addParents(base, base.persons[0].id);
  const union = parented.unions[0];
  const withChild = addChild(parented, union.id);
  assert.equal(withChild.parentage.length, 2);
});

test("twin group contains two siblings", () => {
  const base = emptyPedigree("single");
  const parented = addParents(base, base.persons[0].id);
  const result = addTwin(parented, parented.unions[0].id, "monozygotic");
  assert.equal(result.twinGroups[0].memberIds.length, 2);
});

test("adding sibling without parents creates a shared unknown-parent union", () => {
  const base = emptyPedigree("single");
  const result = addSibling(base, base.persons[0].id);
  assert.equal(result.persons.length, 4);
  assert.equal(result.parentage.length, 2);
});

test("five-generation synthetic pedigree of 100 people computes a complete layout", () => {
  const people = Array.from({ length: 100 }, (_, index) => newPerson({ id: `fixture_${index}`, name: `虚构个体 ${index + 1}`, birthOrder: index + 1 }));
  const unions = [];
  const parentage = [];
  for (let generation = 0; generation < 4; generation += 1) {
    const start = generation * 20;
    const next = (generation + 1) * 20;
    for (let couple = 0; couple < 10; couple += 1) {
      const unionId = `union_${generation}_${couple}`;
      unions.push({ id: unionId, partnerA: people[start + couple * 2].id, partnerB: people[start + couple * 2 + 1].id, consanguineous: false, relationshipNote: "" });
      parentage.push({ id: makeId("parentage"), childId: people[next + couple * 2].id, unionId, birthOrder: 1 });
      parentage.push({ id: makeId("parentage"), childId: people[next + couple * 2 + 1].id, unionId, birthOrder: 2 });
    }
  }
  const fixture = validatePedigree({ schemaVersion: 1, id: "fixture", name: "100人五代虚构家系", updatedAt: new Date().toISOString(), persons: people, unions, parentage, twinGroups: [], settings: { horizontalSpacing: 150, generationSpacing: 215, showUnknownDisease: true, manualOffsets: {}, symbolStyle: "traditional-teaching" } });
  const layout = computeLayout(fixture);
  assert.equal(layout.people.length, 100);
  assert.equal(new Set(layout.people.map((item) => item.number)).size, 100);
  assert.equal(Math.max(...layout.people.map((item) => item.generation)), 4);
});

test("JSON round-trip preserves relationship and annotation fields", () => {
  const base = emptyPedigree();
  const withParents = addParents(base, base.persons[0].id);
  const child = withParents.persons.find((person) => person.id === base.persons[0].id)!;
  child.variants = "GENE c.100A>G";
  child.phenotypes = "表型一\n表型二";
  child.carrier = { ar: true, xlr: true, recorded: true };
  const restored = validatePedigree(JSON.parse(JSON.stringify(withParents)));
  assert.deepEqual(restored, withParents);
});

test("new unconnected spouse aligns to an existing later generation", () => {
  const base = emptyPedigree("single");
  const withParents = addParents(base, base.persons[0].id);
  const unrelatedRoot = newPerson({ id: "unrelated-root" });
  withParents.persons.push(unrelatedRoot);
  const paired = addUnion(withParents, unrelatedRoot.id, base.persons[0].id);
  assert.equal(paired.unions.length, 2);
  assert.equal(generationByPerson(paired).get(unrelatedRoot.id), generationByPerson(paired).get(base.persons[0].id));
});

test("union within the same family at different generations is rejected", () => {
  const base = emptyPedigree();
  const withParents = addParents(base, base.persons[0].id);
  assert.throws(() => addUnion(withParents, withParents.unions[0].partnerA, base.persons[0].id), /婚配关系|跨代婚配/);
});

test("parents and their only child share a vertical axis", () => {
  const base = emptyPedigree("single"); const result = addParents(base, base.persons[0].id); const layout = computeLayout(result);
  const child = layout.people.find((item) => item.person.id === base.persons[0].id)!;
  const union = layout.unions[0];
  assert.equal(child.x, (union.x1 + union.x2) / 2);
});

test("row positions for one two and three people are centered", () => {
  const one = computeLayout(emptyPedigree("single")); assert.equal(one.people[0].x, one.viewBoxX + one.width / 2);
  const twoPedigree = emptyPedigree("single"); twoPedigree.persons.push(newPerson()); const two = computeLayout(twoPedigree); assert.equal((two.people[0].x + two.people[1].x) / 2, two.viewBoxX + two.width / 2);
  const threePedigree = emptyPedigree("single"); threePedigree.persons.push(newPerson(), newPerson()); const threeLayout = computeLayout(threePedigree); const three = threeLayout.people.sort((a, b) => a.x - b.x); assert.equal(three[1].x, threeLayout.viewBoxX + threeLayout.width / 2);
});

test("invalid JSON settings are rejected before layout", () => {
  const invalid = emptyPedigree(); delete (invalid as Partial<typeof invalid>).settings;
  assert.throws(() => validatePedigree(invalid), /布局设置/);
});

test("only user-authored annotation lines appear in the layout", () => {
  const base = emptyPedigree(); base.persons[0].phenotypes = Array.from({ length: 20 }, (_, index) => `表型${index + 1}`).join("\n");
  assert.equal(computeLayout(base).people[0].textLines.length, 0);
  base.persons[0].annotationLines = Array.from({ length: 20 }, (_, index) => `Annotation ${index + 1}`);
  assert.ok(computeLayout(base).people[0].textLines.length >= 20);
});

test("legacy JSON imports without display lines and does not force clinical annotations", () => {
  const legacy = emptyPedigree(); legacy.persons[0].deceased = true; legacy.persons[0].deathNote = "d. 2007";
  delete (legacy.persons[0] as Partial<typeof legacy.persons[0]>).annotationLines;
  const restored = validatePedigree(JSON.parse(JSON.stringify(legacy)));
  assert.deepEqual(restored.persons[0].annotationLines, []);
  assert.deepEqual(computeLayout(restored).people[0].textLines, []);
});

test("twin members move as one sibling block", () => {
  const base = emptyPedigree(); const parented = addParents(base, base.persons[0].id); const twins = addTwin(parented, parented.unions[0].id, "dizygotic");
  const withSibling = addChild(twins, twins.unions[0].id); const moved = moveSibling(withSibling, twins.twinGroups[0].memberIds[0], 1);
  const order = moved.parentage.filter((item) => item.unionId === moved.unions[0].id).sort((a, b) => a.birthOrder - b.birthOrder).map((item) => item.childId);
  const twinIndexes = twins.twinGroups[0].memberIds.map((id) => order.indexOf(id)).sort(); assert.equal(twinIndexes[1] - twinIndexes[0], 1);
});

test("relationship removal preserves individuals and clears dependent links", () => {
  const base = emptyPedigree("single"); const parented = addParents(base, base.persons[0].id);
  const detached = removeParentage(parented, parented.parentage[0].id); assert.equal(detached.persons.length, parented.persons.length); assert.equal(detached.parentage.length, 0);
  const unionRemoved = removeUnion(parented, parented.unions[0].id); assert.equal(unionRemoved.persons.length, parented.persons.length); assert.equal(unionRemoved.unions.length, 0);
});

test("manual visual offset persists through JSON and affects only layout position", () => {
  const base = emptyPedigree(); const id = base.persons[0].id; const before = computeLayout(base).people[0];
  base.settings.manualOffsets[id] = { x: 45, y: 20 };
  const restored = validatePedigree(JSON.parse(JSON.stringify(base))); const after = computeLayout(restored).people[0];
  assert.equal(after.x, before.x + 45); assert.equal(after.y, before.y + 20); assert.equal(after.generation, before.generation);
});

test("new spouse defaults to the opposite known sex and preserves unknown", () => {
  assert.equal(defaultSpouseGender("male"), "female");
  assert.equal(defaultSpouseGender("female"), "male");
  assert.equal(defaultSpouseGender("unknown"), "unknown");
});

test("marriage endpoints follow independently moved partners", () => {
  const base = emptyPedigree("single"); base.persons[0].gender = "male";
  const spouse = newPerson({ id: "free-spouse", gender: "female" }); base.persons.push(spouse);
  const paired = addUnion(base, base.persons[0].id, spouse.id, true);
  paired.settings.manualOffsets[spouse.id] = { x: 180, y: 340 };
  const layout = computeLayout(paired); const first = layout.people.find((item) => item.person.id === base.persons[0].id)!; const second = layout.people.find((item) => item.person.id === spouse.id)!; const union = layout.unions[0];
  assert.notEqual(union.y1, union.y2);
  assert.equal(Math.round((union.y1 + union.y2) / 2), Math.round((first.y + second.y) / 2));
  assert.ok(Math.hypot(union.x1 - union.x2, union.y1 - union.y2) > 0);
});

test("unbounded manual offsets expand the viewBox without changing generation", () => {
  const base = emptyPedigree(); const id = base.persons[0].id; base.settings.manualOffsets[id] = { x: -1200, y: -900 };
  const upperLeft = computeLayout(validatePedigree(JSON.parse(JSON.stringify(base)))); const person = upperLeft.people[0];
  assert.ok(upperLeft.viewBoxX < person.x - 16); assert.ok(upperLeft.viewBoxY < person.y - 16); assert.equal(person.generation, 0);
  base.settings.manualOffsets[id] = { x: 1500, y: 1200 };
  const lowerRight = computeLayout(base); assert.ok(lowerRight.viewBoxX + lowerRight.width > lowerRight.people[0].x + 16); assert.ok(lowerRight.viewBoxY + lowerRight.height > lowerRight.people[0].y + 16);
});
