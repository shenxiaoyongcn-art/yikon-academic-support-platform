import type { CarrierStatus, Gender, Pedigree, Person, Settings, TwinGroup, Union } from './types.ts';

const letters = "0123456789abcdefghijklmnopqrstuvwxyz";

export function makeId(prefix: string): string {
  const now = Date.now().toString(36);
  const random = Array.from({ length: 8 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${prefix}_${now}_${random}`;
}

export const emptyCarrier = (): CarrierStatus => ({ ar: false, xlr: false, recorded: false });

export function defaultSpouseGender(gender: Gender): Gender {
  if (gender === "male") return "female";
  if (gender === "female") return "male";
  return "unknown";
}

export function newPerson(partial: Partial<Person> = {}): Person {
  return {
    id: makeId("p"),
    name: "",
    gender: "unknown",
    diseaseStatus: "unknown",
    carrier: emptyCarrier(),
    marker: "none",
    deceased: false,
    deathNote: "",
    type: "person",
    gestationalAge: "",
    genotype: "",
    variants: "",
    phenotypes: "",
    annotationLines: [],
    birthOrder: 0,
    ...partial
  };
}

export function emptyPedigree(initial: "standard" | "single" = "standard"): Pedigree {
  const father = newPerson({ gender: "male", birthOrder: 1 });
  const mother = newPerson({ gender: "female", birthOrder: 2 });
  const child = newPerson({ gender: "unknown", birthOrder: 1 });
  const union: Union = { id: makeId("u"), partnerA: father.id, partnerB: mother.id, consanguineous: false, relationshipNote: "" };
  const single = newPerson();
  return {
    schemaVersion: 1,
    id: makeId("pedigree"),
    name: "未命名家系图",
    updatedAt: new Date().toISOString(),
    persons: initial === "standard" ? [father, mother, child] : [single],
    unions: initial === "standard" ? [union] : [],
    parentage: initial === "standard" ? [{ id: makeId("parentage"), childId: child.id, unionId: union.id, birthOrder: 1 }] : [],
    twinGroups: [],
    settings: { horizontalSpacing: 150, generationSpacing: 215, showUnknownDisease: true, manualOffsets: {}, symbolStyle: "traditional-teaching" }
  };
}

/** A stable first render used before client-only browser storage is restored. */
export function initialPedigree(): Pedigree {
  const father = newPerson({ id: 'initial-male', gender: 'male', birthOrder: 1 });
  const mother = newPerson({ id: 'initial-female', gender: 'female', birthOrder: 2 });
  const child = newPerson({ id: 'initial-child', gender: 'unknown', birthOrder: 1 });
  const union: Union = {
    id: 'initial-union',
    partnerA: father.id,
    partnerB: mother.id,
    consanguineous: false,
    relationshipNote: '',
  };

  return {
    schemaVersion: 1,
    id: 'initial-pedigree',
    name: '未命名家系图',
    updatedAt: '1970-01-01T00:00:00.000Z',
    persons: [father, mother, child],
    unions: [union],
    parentage: [{ id: 'initial-parentage', childId: child.id, unionId: union.id, birthOrder: 1 }],
    twinGroups: [],
    settings: { horizontalSpacing: 150, generationSpacing: 215, showUnknownDisease: true, manualOffsets: {}, symbolStyle: 'traditional-teaching' },
  };
}

function personIds(pedigree: Pedigree): Set<string> {
  return new Set(pedigree.persons.map((person) => person.id));
}

export function parentageForChild(pedigree: Pedigree, childId: string) {
  return pedigree.parentage.find((item) => item.childId === childId);
}

export function unionById(pedigree: Pedigree, unionId: string): Union | undefined {
  return pedigree.unions.find((union) => union.id === unionId);
}

export function peopleInUnion(pedigree: Pedigree, unionId: string): Person[] {
  const union = unionById(pedigree, unionId);
  if (!union) return [];
  return pedigree.persons.filter((person) => person.id === union.partnerA || person.id === union.partnerB);
}

function ancestorMap(pedigree: Pedigree): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const item of pedigree.parentage) {
    const union = unionById(pedigree, item.unionId);
    if (union) result.set(item.childId, [union.partnerA, union.partnerB]);
  }
  return result;
}

function wouldCreateCycle(pedigree: Pedigree, childId: string, parentId: string): boolean {
  const parents = ancestorMap(pedigree);
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === childId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return (parents.get(id) ?? []).some(visit);
  };
  return visit(parentId);
}

export function validatePedigree(raw: unknown): Pedigree {
  if (!raw || typeof raw !== "object") throw new Error("JSON 根对象无效。");
  const pedigree = raw as Pedigree;
  if (pedigree.schemaVersion !== 1) throw new Error("不支持的家系 JSON 版本。");
  if (!Array.isArray(pedigree.persons) || !Array.isArray(pedigree.unions) || !Array.isArray(pedigree.parentage) || !Array.isArray(pedigree.twinGroups)) {
    throw new Error("JSON 缺少家系成员、婚配或亲子关系数组。");
  }
  if (!pedigree.settings || typeof pedigree.settings !== "object") throw new Error("JSON 缺少布局设置。");
  const settings = pedigree.settings as Settings;
  if (!Number.isFinite(settings.horizontalSpacing) || settings.horizontalSpacing < 80 || settings.horizontalSpacing > 600) throw new Error("横向间距无效。");
  if (!Number.isFinite(settings.generationSpacing) || settings.generationSpacing < 120 || settings.generationSpacing > 800) throw new Error("代间距无效。");
  if (typeof settings.showUnknownDisease !== "boolean") throw new Error("患病未知显示设置无效。");
  settings.manualOffsets ??= {};
  settings.symbolStyle ??= "traditional-teaching";
  if (settings.symbolStyle !== "traditional-teaching" || typeof settings.manualOffsets !== "object") throw new Error("符号或手动布局设置无效。");
  for (const [id, offset] of Object.entries(settings.manualOffsets)) {
    if (!id || !offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new Error("手动位置数据无效。");
  }
  const ids = personIds(pedigree);
  if (ids.size !== pedigree.persons.length) throw new Error("存在重复个体 ID。");
  for (const person of pedigree.persons) {
    if (!person.id || typeof person.name !== "string" || typeof person.genotype !== "string" || typeof person.variants !== "string" || typeof person.phenotypes !== "string") throw new Error("个体文本字段无效。");
    if (!["male", "female", "unknown"].includes(person.gender) || !["unknown", "unaffected", "affected"].includes(person.diseaseStatus) || !["none", "proband", "consultand"].includes(person.marker) || !["person", "sab"].includes(person.type)) throw new Error("个体枚举字段无效。");
    if (!person.carrier || typeof person.carrier.ar !== "boolean" || typeof person.carrier.xlr !== "boolean" || typeof person.carrier.recorded !== "boolean" || typeof person.deceased !== "boolean") throw new Error("个体状态字段无效。");
    // Version 1 drafts predating editable display lines remain importable. Their
    // clinical fields are retained, but nothing is automatically drawn below
    // the generation number until the user adds a display line.
    person.annotationLines ??= [];
    if (!Array.isArray(person.annotationLines) || person.annotationLines.some((line) => typeof line !== "string")) throw new Error("个体图中注释行无效。");
  }
  const unionIds = new Set<string>();
  const partnered = new Set<string>();
  for (const union of pedigree.unions) {
    if (!union.id || unionIds.has(union.id)) throw new Error("存在重复或缺失的婚配 ID。");
    unionIds.add(union.id);
    if (!ids.has(union.partnerA) || !ids.has(union.partnerB) || union.partnerA === union.partnerB) throw new Error("婚配关系引用了无效个体。");
    if (pedigree.persons.find((person) => person.id === union.partnerA)?.type === "sab" || pedigree.persons.find((person) => person.id === union.partnerB)?.type === "sab") throw new Error("自然流产记录不能建立婚配关系。");
    if (partnered.has(union.partnerA) || partnered.has(union.partnerB)) throw new Error("V1 每个个体只能有一组婚配关系。");
    partnered.add(union.partnerA); partnered.add(union.partnerB);
  }
  const children = new Set<string>();
  for (const item of pedigree.parentage) {
    if (!ids.has(item.childId) || !unionIds.has(item.unionId)) throw new Error("亲子关系引用了不存在的个体或婚配。");
    if (children.has(item.childId)) throw new Error("同一子女不能有两组父母。");
    children.add(item.childId);
    const union = unionById(pedigree, item.unionId)!;
    if (wouldCreateCycle(pedigree, item.childId, union.partnerA) || wouldCreateCycle(pedigree, item.childId, union.partnerB)) {
      throw new Error("亲子关系会形成祖先循环。");
    }
  }
  const twinMembers = new Set<string>();
  for (const group of pedigree.twinGroups) {
    if (group.memberIds.length < 2) throw new Error("双胎组至少需要两名成员。");
    const parentage = parentageForChild(pedigree, group.memberIds[0]);
    for (const memberId of group.memberIds) {
      if (!ids.has(memberId) || twinMembers.has(memberId)) throw new Error("双胎组含无效或重复成员。");
      twinMembers.add(memberId);
      if (!parentage || parentageForChild(pedigree, memberId)?.unionId !== parentage.unionId) throw new Error("双胎成员必须有同一组父母。");
    }
  }
  return structuredClone(pedigree);
}

export function generationByPerson(pedigree: Pedigree): Map<string, number> {
  const generations = new Map<string, number>(pedigree.persons.map((person) => [person.id, 0]));
  for (let pass = 0; pass <= pedigree.persons.length; pass += 1) {
    let changed = false;
    for (const item of pedigree.parentage) {
      const union = unionById(pedigree, item.unionId);
      if (!union) continue;
      const parentGeneration = Math.max(generations.get(union.partnerA) ?? 0, generations.get(union.partnerB) ?? 0);
      const target = parentGeneration + 1;
      if ((generations.get(item.childId) ?? 0) < target) {
        generations.set(item.childId, target);
        changed = true;
      }
    }
    for (const union of pedigree.unions) {
      const generation = Math.max(generations.get(union.partnerA) ?? 0, generations.get(union.partnerB) ?? 0);
      if (generations.get(union.partnerA) !== generation) { generations.set(union.partnerA, generation); changed = true; }
      if (generations.get(union.partnerB) !== generation) { generations.set(union.partnerB, generation); changed = true; }
    }
    if (!changed) return generations;
  }
  throw new Error("代次计算失败：关系存在循环或冲突。");
}

function connectedPeople(pedigree: Pedigree, firstId: string, secondId: string): boolean {
  const graph = new Map<string, Set<string>>();
  for (const id of personIds(pedigree)) graph.set(id, new Set());
  for (const union of pedigree.unions) { graph.get(union.partnerA)?.add(union.partnerB); graph.get(union.partnerB)?.add(union.partnerA); }
  for (const relation of pedigree.parentage) {
    const union = unionById(pedigree, relation.unionId);
    if (!union) continue;
    graph.get(relation.childId)?.add(union.partnerA); graph.get(relation.childId)?.add(union.partnerB);
    graph.get(union.partnerA)?.add(relation.childId); graph.get(union.partnerB)?.add(relation.childId);
  }
  const seen = new Set<string>([firstId]); const queue = [firstId];
  while (queue.length) { const id = queue.shift()!; if (id === secondId) return true; for (const next of graph.get(id) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
  return false;
}

function nextBirthOrder(pedigree: Pedigree, unionId?: string): number {
  if (!unionId) return Math.max(0, ...pedigree.persons.map((person) => person.birthOrder)) + 1;
  return Math.max(0, ...pedigree.parentage.filter((item) => item.unionId === unionId).map((item) => item.birthOrder)) + 1;
}

export function addUnion(pedigree: Pedigree, firstId: string, secondId: string, consanguineous = false): Pedigree {
  if (firstId === secondId) throw new Error("不能将同一个个体建立为婚配关系。");
  if (pedigree.unions.some((union) => union.partnerA === firstId || union.partnerB === firstId || union.partnerA === secondId || union.partnerB === secondId)) {
    throw new Error("V1 中每个个体只能有一组婚配关系。");
  }
  if (!personIds(pedigree).has(firstId) || !personIds(pedigree).has(secondId)) throw new Error("未找到要建立婚配的个体。");
  const generations = generationByPerson(pedigree);
  if (connectedPeople(pedigree, firstId, secondId) && generations.get(firstId) !== generations.get(secondId)) {
    throw new Error("V1 不支持跨代婚配；只能连接同一代的既有个体。");
  }
  const candidate = structuredClone(pedigree);
  candidate.unions.push({ id: makeId("u"), partnerA: firstId, partnerB: secondId, consanguineous, relationshipNote: "" });
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function addChild(pedigree: Pedigree, unionId: string, type: Person["type"] = "person"): Pedigree {
  const union = unionById(pedigree, unionId);
  if (!union) throw new Error("未找到可用的婚配关系。");
  const candidate = structuredClone(pedigree);
  const child = newPerson({ type, birthOrder: nextBirthOrder(candidate, unionId) });
  candidate.persons.push(child);
  candidate.parentage.push({ id: makeId("parentage"), childId: child.id, unionId, birthOrder: child.birthOrder });
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function addTwin(pedigree: Pedigree, unionId: string, twinType: TwinGroup["type"]): Pedigree {
  let candidate = addChild(pedigree, unionId);
  candidate = addChild(candidate, unionId);
  const members = candidate.parentage.filter((item) => item.unionId === unionId).sort((a, b) => b.birthOrder - a.birthOrder).slice(0, 2).map((item) => item.childId);
  const group: TwinGroup = { id: makeId("twins"), memberIds: members.reverse(), type: twinType };
  candidate.twinGroups.push(group);
  return validatePedigree(candidate);
}

export function addParents(pedigree: Pedigree, childId: string): Pedigree {
  if (parentageForChild(pedigree, childId)) throw new Error("该个体已有父母关系。");
  const candidate = structuredClone(pedigree);
  const parentA = newPerson({ name: "父母资料未详", gender: "unknown", birthOrder: nextBirthOrder(candidate) });
  const parentB = newPerson({ name: "父母资料未详", gender: "unknown", birthOrder: nextBirthOrder(candidate) + 1 });
  const union: Union = { id: makeId("u"), partnerA: parentA.id, partnerB: parentB.id, consanguineous: false, relationshipNote: "" };
  candidate.persons.push(parentA, parentB);
  candidate.unions.push(union);
  candidate.parentage.push({ id: makeId("parentage"), childId, unionId: union.id, birthOrder: 1 });
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function addSibling(pedigree: Pedigree, personId: string): Pedigree {
  const parentage = parentageForChild(pedigree, personId);
  if (!parentage) {
    const withParents = addParents(pedigree, personId);
    return addChild(withParents, withParents.parentage.find((item) => item.childId === personId)!.unionId);
  }
  return addChild(pedigree, parentage.unionId);
}

export function removePerson(pedigree: Pedigree, personId: string): Pedigree {
  const dependencies = pedigree.unions.filter((union) => union.partnerA === personId || union.partnerB === personId).length
    + pedigree.parentage.filter((item) => item.childId === personId).length
    + pedigree.parentage.filter((item) => {
      const union = unionById(pedigree, item.unionId);
      return union?.partnerA === personId || union?.partnerB === personId;
    }).length;
  if (dependencies) throw new Error("该个体仍有亲属关系。请先解除相关关系，避免自动删除亲属。");
  const candidate = structuredClone(pedigree);
  candidate.persons = candidate.persons.filter((person) => person.id !== personId);
  if (!candidate.persons.length) candidate.persons.push(newPerson());
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function removeUnion(pedigree: Pedigree, unionId: string): Pedigree {
  const union = unionById(pedigree, unionId);
  if (!union) throw new Error("未找到婚配关系。");
  const candidate = structuredClone(pedigree);
  const childIds = candidate.parentage.filter((item) => item.unionId === unionId).map((item) => item.childId);
  candidate.parentage = candidate.parentage.filter((item) => item.unionId !== unionId);
  candidate.twinGroups = candidate.twinGroups.filter((group) => !group.memberIds.some((id) => childIds.includes(id)));
  candidate.unions = candidate.unions.filter((item) => item.id !== unionId);
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function removeParentage(pedigree: Pedigree, relationId: string): Pedigree {
  const relation = pedigree.parentage.find((item) => item.id === relationId);
  if (!relation) throw new Error("未找到亲子关系。");
  const candidate = structuredClone(pedigree);
  candidate.parentage = candidate.parentage.filter((item) => item.id !== relationId);
  candidate.twinGroups = candidate.twinGroups.filter((group) => !group.memberIds.includes(relation.childId));
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}

export function moveSibling(pedigree: Pedigree, personId: string, direction: -1 | 1): Pedigree {
  const relation = parentageForChild(pedigree, personId);
  if (!relation) throw new Error("该个体没有可调整的同胞顺序。");
  const siblings = pedigree.parentage.filter((item) => item.unionId === relation.unionId).sort((a, b) => a.birthOrder - b.birthOrder);
  const group = pedigree.twinGroups.find((item) => item.memberIds.includes(personId));
  const ownIds = new Set(group?.memberIds ?? [personId]);
  const blocks = siblings.reduce<string[][]>((result, item) => { if (ownIds.has(item.childId)) { const last = result.at(-1); if (last?.every((id) => ownIds.has(id))) last.push(item.childId); else result.push([item.childId]); } else result.push([item.childId]); return result; }, []);
  const index = blocks.findIndex((block) => block.includes(personId));
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return pedigree;
  const candidate = structuredClone(pedigree);
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  blocks.flat().forEach((id, order) => { candidate.parentage.find((item) => item.childId === id && item.unionId === relation.unionId)!.birthOrder = order + 1; });
  candidate.updatedAt = new Date().toISOString();
  return validatePedigree(candidate);
}
