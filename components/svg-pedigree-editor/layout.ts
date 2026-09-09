import { generationByPerson, parentageForChild, unionById } from './model.ts';
import type { Layout, Pedigree, Person, PositionedPerson } from './types.ts';

const marginX = 90;
const top = 100;
const nodeSize = 32;
const textLineHeight = 17;
const padding = 90;

function roman(value: number): string {
  const numerals: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remainder = value;
  let result = "";
  for (const [number, label] of numerals) {
    while (remainder >= number) { result += label; remainder -= number; }
  }
  return result;
}

export function detailLines(person: Person): string[] {
  // The generation identifier is rendered separately. Every other line is
  // opt-in, even if the corresponding structured clinical field is populated.
  return person.annotationLines
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.length > 34 ? line.match(/.{1,34}/gu) ?? [line] : [line]);
}

function familySort(pedigree: Pedigree, person: Person): number {
  const link = parentageForChild(pedigree, person.id);
  return link?.birthOrder ?? person.birthOrder;
}

function personBounds(item: PositionedPerson): { minX: number; maxX: number; minY: number; maxY: number } {
  const widestLine = Math.max(0, ...item.textLines.map((line) => [...line].length));
  const halfWidth = Math.max(nodeSize / 2, widestLine * 3.8);
  return { minX: item.x - halfWidth, maxX: item.x + halfWidth, minY: item.y - nodeSize / 2 - 28, maxY: item.y + 55 + Math.max(0, item.textLines.length - 1) * textLineHeight + 8 };
}

export function computeLayout(pedigree: Pedigree): Layout {
  const generations = generationByPerson(pedigree);
  const maxGeneration = Math.max(0, ...generations.values());
  const groups = new Map<number, Person[]>();
  for (const person of pedigree.persons) {
    const generation = generations.get(person.id) ?? 0;
    const list = groups.get(generation) ?? [];
    list.push(person);
    groups.set(generation, list);
  }
  const positions = new Map<string, PositionedPerson>();
  const rowHeights = new Map<number, number>();
  let widest = 0;
  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    const row = groups.get(generation) ?? [];
    rowHeights.set(generation, Math.max(...row.map((person) => detailLines(person).length), 1) * textLineHeight + nodeSize + 70);
    widest = Math.max(widest, row.length);
  }
  const automaticWidth = Math.max(720, marginX * 2 + Math.max(0, widest - 1) * pedigree.settings.horizontalSpacing + 240);
  const centerX = automaticWidth / 2;
  const rowY = new Map<number, number>();
  let nextY = top;
  for (let generation = 0; generation <= maxGeneration; generation += 1) { rowY.set(generation, nextY); nextY += Math.max(pedigree.settings.generationSpacing, rowHeights.get(generation) ?? 0); }
  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    const ordered = (groups.get(generation) ?? []).sort((a, b) => familySort(pedigree, a) - familySort(pedigree, b) || a.id.localeCompare(b.id));
    ordered.forEach((person, index) => {
      const offset = pedigree.settings.manualOffsets[person.id] ?? { x: 0, y: 0 };
      positions.set(person.id, {
        person,
        generation,
        number: "",
        x: centerX + (index - (ordered.length - 1) / 2) * pedigree.settings.horizontalSpacing + offset.x,
        y: (rowY.get(generation) ?? top) + offset.y,
        textLines: detailLines(person)
      });
    });
  }
  // A nuclear family with one child uses a shared vertical axis.
  for (const union of pedigree.unions) {
    const parents = [positions.get(union.partnerA), positions.get(union.partnerB)];
    const children = pedigree.parentage.filter((item) => item.unionId === union.id).map((item) => positions.get(item.childId)).filter((item): item is PositionedPerson => Boolean(item));
    if (parents[0] && parents[1] && children.length === 1 && !pedigree.settings.manualOffsets[children[0].person.id]) {
      const familyCenter = (parents[0].x + parents[1].x) / 2;
      children[0].x = familyCenter;
    }
  }
  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    [...positions.values()].filter((item) => item.generation === generation).sort((a, b) => a.x - b.x || a.person.id.localeCompare(b.person.id)).forEach((item, index) => { item.number = `${roman(generation + 1)}-${index + 1}`; });
  }
  // Partners must remain in the same generation. The calculation above already
  // enforces that; order is stable and no individual is duplicated.
  const layoutUnions = pedigree.unions.flatMap((union) => {
    const first = positions.get(union.partnerA);
    const second = positions.get(union.partnerB);
    if (!first || !second || first.generation !== second.generation) return [];
    const children = pedigree.parentage
      .filter((item) => item.unionId === union.id)
      .map((item) => positions.get(item.childId))
      .filter((item): item is PositionedPerson => Boolean(item));
    const deltaX = second.x - first.x; const deltaY = second.y - first.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const unitX = deltaX / length; const unitY = deltaY / length;
    const centerX = (first.x + second.x) / 2; const centerY = (first.y + second.y) / 2;
    const childX = children.length ? children.reduce((total, child) => total + child.x, 0) / children.length : centerX;
    const childY = children.length ? children.reduce((total, child) => total + child.y, 0) / children.length : centerY;
    return [{ ...union, x1: first.x + unitX * nodeSize / 2, y1: first.y + unitY * nodeSize / 2, x2: second.x - unitX * nodeSize / 2, y2: second.y - unitY * nodeSize / 2, centerX, centerY, normalX: -unitY, normalY: unitX, childX, childY }];
  });
  const people = [...positions.values()];
  const bounds = people.map(personBounds);
  let minX = Math.min(0, ...bounds.map((bound) => bound.minX));
  let maxX = Math.max(720, ...bounds.map((bound) => bound.maxX));
  let minY = Math.min(0, ...bounds.map((bound) => bound.minY));
  let maxY = Math.max(top, ...bounds.map((bound) => bound.maxY));
  for (const union of layoutUnions) {
    minX = Math.min(minX, union.x1, union.x2, union.centerX);
    maxX = Math.max(maxX, union.x1, union.x2, union.centerX);
    minY = Math.min(minY, union.y1, union.y2, union.centerY);
    maxY = Math.max(maxY, union.y1, union.y2, union.centerY);
  }
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const width = Math.max(720, maxX - minX + padding * 2);
  const legendY = maxY + 68;
  return {
    people,
    unions: layoutUnions,
    width,
    height: Math.max(500, legendY - viewBoxY + 96),
    viewBoxX,
    viewBoxY,
    titleY: viewBoxY + 44,
    legendY
  };
}

export function twinGroupForMember(pedigree: Pedigree, personId: string) {
  return pedigree.twinGroups.find((group) => group.memberIds.includes(personId));
}

export function descentForPerson(pedigree: Pedigree, personId: string) {
  const link = parentageForChild(pedigree, personId);
  return link ? unionById(pedigree, link.unionId) : undefined;
}
