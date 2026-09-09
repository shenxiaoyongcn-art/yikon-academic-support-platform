'use client';

import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import styles from './pedigree-workspace.module.css';
import monogenicCatalog from '../data/monogenic-catalog.json';
import variantShortcuts from '../data/common-variant-shortcuts.json';

type Sex = 'male' | 'female' | 'unknown' | 'pregnancy_loss';
type Phenotype = 'unaffected' | 'affected' | 'carrier' | 'unknown';

declare global {
  interface Window {
    AndroidBridge?: { saveBase64: (fileName: string, base64Data: string, mimeType: string) => void };
  }
}

type Person = {
  id: string;
  name: string;
  sex: Sex;
  phenotype: Phenotype;
  deceased: boolean;
  proband: boolean;
  birthYear: string;
  clinicalId: string;
  diagnosis: string;
  genotype: string;
  notes: string;
  fatherId?: string;
  motherId?: string;
  spouseIds: string[];
  order: number;
  manualX?: number;
  manualY?: number;
};

type PedigreeCase = {
  id: string;
  name: string;
  disease: string;
  diseaseId: string;
  gene: string;
  inheritance: string;
  variant: string;
  variantType: string;
  updatedAt: string;
  people: Person[];
};

type PositionedPerson = Person & {
  x: number;
  y: number;
  generation: number;
  displayId: string;
};

type SnapIntent =
  | { type: 'parents'; fatherId?: string; motherId?: string; label: string }
  | { type: 'spouse'; targetId: string; label: string };

const STORAGE_KEY = 'yikon-pedigree-cases-v1';

type CatalogRecord = [string, string, string, string, string, string];
type DiseaseOption = { id: string; name: string; records: CatalogRecord[] };
type VariantShortcut = {
  diseaseGroup: string;
  gene: string;
  reference: string;
  hgvs: string;
  protein: string;
  type: string;
  classification: string;
  clinvarId: string;
};

const catalog = monogenicCatalog as unknown as {
  metadata: { releaseDate: string; relationshipCount: number; diseaseCount: number; geneCount: number };
  records: CatalogRecord[];
};

const commonVariants = variantShortcuts.records as VariantShortcut[];

const chineseGeneAliases: Record<string, string> = {
  APC: '家族性腺瘤性息肉病 结直肠癌', ATP7B: '肝豆状核变性 Wilson病', BRCA1: '遗传性乳腺癌 卵巢癌', BRCA2: '遗传性乳腺癌 卵巢癌',
  CFTR: '囊性纤维化', CYP21A2: '先天性肾上腺皮质增生', DMD: '杜氏肌营养不良 贝氏肌营养不良', F8: 'A型血友病 血友病A', F9: 'B型血友病 血友病B',
  FBN1: '马凡综合征 Marfan', FMR1: '脆性X综合征', GJB2: '遗传性耳聋 先天性耳聋 非综合征性耳聋 耳聋', HBB: '地中海贫血 β地贫 镌状细胞病', HEXA: '泰萨氏病 Tay-Sachs', HTT: '亨廷顿舞蹈病',
  LDLR: '家族性高胆固醇血症', MECP2: 'Rett综合征 雷特综合征', NF1: '1型神经纤维瘤病', PAH: '苯丙酮尿症', PKD1: '常染色体显性多囊肾', PKD2: '常染色体显性多囊肾',
  'MT-RNR1': '线粒体遗传性耳聋 氨基糖苷类药物性耳聋 耳聋', RB1: '视网膜母细胞瘤', RET: '多发性内分泌腺瘤', SLC26A4: '遗传性耳聋 大前庭导水管 Pendred综合征', SMN1: '脊髓性肌萎缩 SMA', TSC1: '结节性硬化', TSC2: '结节性硬化', VHL: 'VHL综合征 希林二氏病',
};

const diseaseOptions: DiseaseOption[] = (() => {
  const grouped = new Map<string, DiseaseOption>();
  catalog.records.forEach((record) => {
    const key = record[0] || record[1];
    const current = grouped.get(key) || { id: record[0], name: record[1], records: [] };
    current.records.push(record);
    grouped.set(key, current);
  });
  return [{
    id: 'LOCAL:HEREDITARY_HEARING_LOSS',
    name: '遗传性耳聋（常用基因与位点快捷入口）',
    records: [
      ['LOCAL:HEREDITARY_HEARING_LOSS', '遗传性耳聋（常用基因与位点快捷入口）', '', 'GJB2', 'Autosomal recessive', 'ClinVar快捷库'],
      ['LOCAL:HEREDITARY_HEARING_LOSS', '遗传性耳聋（常用基因与位点快捷入口）', '', 'SLC26A4', 'Autosomal recessive', 'ClinVar快捷库'],
      ['LOCAL:HEREDITARY_HEARING_LOSS', '遗传性耳聋（常用基因与位点快捷入口）', '', 'MT-RNR1', 'Mitochondrial inheritance', 'ClinVar快捷库'],
    ],
  }, ...Array.from(grouped.values())];
})();

const variantTypes = [
  ['single nucleotide variant', '单核苷酸变异（SNV）'],
  ['multiple nucleotide variant', '多核苷酸变异（MNV）'],
  ['Deletion', '缺失（Deletion）'],
  ['Insertion', '插入（Insertion）'],
  ['Indel', '缺失-插入（Indel/Delins）'],
  ['Duplication', '重复（Duplication）'],
  ['Inversion', '倒位（Inversion）'],
  ['Microsatellite', '重复序列/微卫星变异'],
  ['copy number loss', '拷贝数丢失（CNV loss）'],
  ['copy number gain', '拷贝数增加（CNV gain）'],
  ['mobile element insertion', '移动元件插入'],
  ['complex variant', '复杂变异/重排'],
  ['Haplotype', '单体型/复合变异集'],
  ['other', '其他/待确定'],
] as const;

function translateInheritance(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('autosomal dominant')) return '常染色体显性';
  if (normalized.includes('autosomal recessive')) return '常染色体隐性';
  if (normalized.includes('x-linked dominant')) return 'X连锁显性';
  if (normalized.includes('x-linked recessive')) return 'X连锁隐性';
  if (normalized.includes('x-linked')) return 'X连锁';
  if (normalized.includes('y-linked')) return 'Y连锁';
  if (normalized.includes('mitochondrial') || normalized.includes('maternal')) return '线粒体遗传';
  if (normalized.includes('semidominant')) return '半显性';
  if (normalized.includes('unknown')) return '待确定';
  return value || '待确定';
}

function phenotypeLabel(value: Phenotype, sex?: Sex) {
  if (sex === 'pregnancy_loss') return '妊娠丢失';
  if (value === 'unaffected') return '未患病';
  if (value === 'affected') return '患病';
  if (value === 'carrier') return '携带者';
  return '状态不明';
}

function chooseDefaultCatalogRecord(records: CatalogRecord[]) {
  const evidenceWeight: Record<string, number> = { Definitive: 8, Strong: 5, Moderate: 3, Limited: 1, 'ClinVar快捷库': 2 };
  const modes = new Map<string, { score: number; strongest: number; count: number }>();
  records.forEach((record) => {
    const mode = translateInheritance(record[4]);
    const weight = evidenceWeight[record[5]] ?? 1;
    const current = modes.get(mode) || { score: 0, strongest: 0, count: 0 };
    modes.set(mode, {
      score: current.score + weight,
      strongest: Math.max(current.strongest, weight),
      count: current.count + 1,
    });
  });
  const defaultMode = Array.from(modes.entries()).sort((a, b) =>
    b[1].score - a[1].score || b[1].strongest - a[1].strongest || b[1].count - a[1].count || a[0].localeCompare(b[0], 'zh-CN')
  )[0]?.[0];
  return [...records]
    .filter((record) => translateInheritance(record[4]) === defaultMode)
    .sort((a, b) => (evidenceWeight[b[5]] ?? 1) - (evidenceWeight[a[5]] ?? 1) || a[3].localeCompare(b[3], 'en'))[0] || records[0];
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString();
}

function cloneCase(value: PedigreeCase): PedigreeCase {
  return JSON.parse(JSON.stringify(value)) as PedigreeCase;
}

function areSiblings(people: Person[], firstId: string, secondId: string) {
  const first = people.find((person) => person.id === firstId);
  const second = people.find((person) => person.id === secondId);
  if (!first || !second) return false;
  return Boolean(
    (first.fatherId && first.fatherId === second.fatherId) ||
    (first.motherId && first.motherId === second.motherId),
  );
}

function normalizePeople(people: Person[]): Person[] {
  const normalized = people.map((person) => ({
    ...person,
    spouseIds: Array.from(new Set(person.spouseIds || [])).filter((spouseId) => spouseId !== person.id),
  }));
  const byId = new Map(normalized.map((person) => [person.id, person]));
  normalized.forEach((person) => {
    person.spouseIds = person.spouseIds.filter((spouseId) => byId.has(spouseId) && !areSiblings(normalized, person.id, spouseId));
  });
  normalized.forEach((child) => {
    if (!child.fatherId || !child.motherId) return;
    const father = byId.get(child.fatherId);
    const mother = byId.get(child.motherId);
    if (father && mother && !areSiblings(normalized, father.id, mother.id)) {
      if (!father.spouseIds.includes(mother.id)) father.spouseIds.push(mother.id);
      if (!mother.spouseIds.includes(father.id)) mother.spouseIds.push(father.id);
    }
  });
  return normalized;
}

function removePersonFromCase(current: PedigreeCase, personId: string): PedigreeCase {
  return {
    ...current,
    people: current.people
      .filter((person) => person.id !== personId)
      .map((person) => ({
        ...person,
        fatherId: person.fatherId === personId ? undefined : person.fatherId,
        motherId: person.motherId === personId ? undefined : person.motherId,
        spouseIds: person.spouseIds.filter((id) => id !== personId),
      })),
  };
}

function isAncestor(people: Person[], ancestorId: string, personId: string): boolean {
  const byId = new Map(people.map((person) => [person.id, person]));
  const pending = [personId];
  const visited = new Set<string>();
  while (pending.length) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const current = byId.get(currentId);
    for (const parentId of [current?.fatherId, current?.motherId]) {
      if (!parentId) continue;
      if (parentId === ancestorId) return true;
      pending.push(parentId);
    }
  }
  return false;
}

function distanceToSegment(pointX: number, pointY: number, startX: number, startY: number, endX: number, endY: number) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (!deltaX && !deltaY) return Math.hypot(pointX - startX, pointY - startY);
  const position = Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / (deltaX * deltaX + deltaY * deltaY)));
  return Math.hypot(pointX - (startX + position * deltaX), pointY - (startY + position * deltaY));
}

function parentIdsForPair(first: Person, second: Person) {
  const male = [first, second].find((person) => person.sex === 'male');
  const female = [first, second].find((person) => person.sex === 'female');
  return {
    fatherId: male?.id || first.id,
    motherId: female?.id || (male?.id === first.id ? second.id : first.id),
  };
}

function orthogonalUnionPath(first: PositionedPerson, second: PositionedPerson) {
  if (Math.abs(first.y - second.y) < 1) return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
  const middleX = (first.x + second.x) / 2;
  return `M ${first.x} ${first.y} H ${middleX} V ${second.y} H ${second.x}`;
}

function distanceToUnionPath(pointX: number, pointY: number, first: PositionedPerson, second: PositionedPerson) {
  if (Math.abs(first.y - second.y) < 1) return distanceToSegment(pointX, pointY, first.x, first.y, second.x, second.y);
  const middleX = (first.x + second.x) / 2;
  return Math.min(
    distanceToSegment(pointX, pointY, first.x, first.y, middleX, first.y),
    distanceToSegment(pointX, pointY, middleX, first.y, middleX, second.y),
    distanceToSegment(pointX, pointY, middleX, second.y, second.x, second.y),
  );
}

function sampleCase(): PedigreeCase {
  const people: Person[] = [
    { id: 'p1', name: '', sex: 'male', phenotype: 'unaffected', deceased: false, proband: false, birthYear: '1952', clinicalId: '', diagnosis: '', genotype: '', notes: '', spouseIds: ['p2'], order: 1 },
    { id: 'p2', name: '', sex: 'female', phenotype: 'carrier', deceased: false, proband: false, birthYear: '1955', clinicalId: '', diagnosis: '', genotype: 'c.235delC/-', notes: '', spouseIds: ['p1'], order: 2 },
    { id: 'p3', name: '', sex: 'male', phenotype: 'unaffected', deceased: true, proband: false, birthYear: '1950', clinicalId: '', diagnosis: '', genotype: '', notes: '', spouseIds: ['p4'], order: 3 },
    { id: 'p4', name: '', sex: 'female', phenotype: 'unaffected', deceased: false, proband: false, birthYear: '1956', clinicalId: '', diagnosis: '', genotype: '', notes: '', spouseIds: ['p3'], order: 4 },
    { id: 'p5', name: '', sex: 'male', phenotype: 'carrier', deceased: false, proband: false, birthYear: '1980', clinicalId: '', diagnosis: '', genotype: 'c.235delC/-', notes: '', fatherId: 'p1', motherId: 'p2', spouseIds: ['p6'], order: 5 },
    { id: 'p6', name: '', sex: 'female', phenotype: 'carrier', deceased: false, proband: false, birthYear: '1982', clinicalId: '', diagnosis: '', genotype: 'c.299_300delAT/-', notes: '', fatherId: 'p3', motherId: 'p4', spouseIds: ['p5'], order: 6 },
    { id: 'p7', name: '', sex: 'female', phenotype: 'affected', deceased: false, proband: true, birthYear: '2012', clinicalId: 'P-001', diagnosis: '先天性感音神经性耳聋', genotype: 'c.235delC/c.299_300delAT', notes: '先证者', fatherId: 'p5', motherId: 'p6', spouseIds: [], order: 7 },
    { id: 'p8', name: '', sex: 'male', phenotype: 'unaffected', deceased: false, proband: false, birthYear: '2015', clinicalId: '', diagnosis: '', genotype: '-/-', notes: '', fatherId: 'p5', motherId: 'p6', spouseIds: [], order: 8 },
  ];

  return {
    id: 'case-demo',
    name: 'GJB2 遗传性耳聋家系',
    disease: 'autosomal recessive nonsyndromic hearing loss 1A',
    diseaseId: 'MONDO:0010711',
    gene: 'GJB2',
    inheritance: '常染色体隐性',
    variant: 'c.235delC',
    variantType: 'Deletion',
    updatedAt: isoNow(),
    people,
  };
}

function blankCase(): PedigreeCase {
  const personId = makeId('person');
  return {
    id: makeId('case'),
    name: '未命名家系',
    disease: '',
    diseaseId: '',
    gene: '',
    inheritance: '待确定',
    variant: '',
    variantType: 'other',
    updatedAt: isoNow(),
    people: [{
      id: personId,
      name: '',
      sex: 'unknown',
      phenotype: 'unknown',
      deceased: false,
      proband: true,
      birthYear: '',
      clinicalId: '',
      diagnosis: '',
      genotype: '',
      notes: '',
      spouseIds: [],
      order: 1,
    }],
  };
}

function roman(value: number) {
  const symbols = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  return symbols[value] || String(value + 1);
}

function buildLayout(people: Person[]) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const generation = new Map<string, number>();

  const resolveGeneration = (id: string, trail = new Set<string>()): number => {
    if (generation.has(id)) return generation.get(id)!;
    if (trail.has(id)) return 0;
    const person = byId.get(id);
    if (!person) return 0;
    const nextTrail = new Set(trail).add(id);
    const parentLevels = [person.fatherId, person.motherId]
      .filter(Boolean)
      .map((parentId) => resolveGeneration(parentId!, nextTrail));
    const level = parentLevels.length ? Math.max(...parentLevels) + 1 : 0;
    generation.set(id, level);
    return level;
  };

  people.forEach((person) => resolveGeneration(person.id));
  for (let pass = 0; pass < 5; pass += 1) {
    people.forEach((person) => {
      person.spouseIds.forEach((spouseId) => {
        if (!byId.has(spouseId)) return;
        const level = Math.max(generation.get(person.id) || 0, generation.get(spouseId) || 0);
        generation.set(person.id, level);
        generation.set(spouseId, level);
      });
    });
    people.forEach((person) => {
      const parentLevels = [person.fatherId, person.motherId]
        .filter(Boolean)
        .map((parentId) => generation.get(parentId!) || 0);
      if (parentLevels.length) generation.set(person.id, Math.max(generation.get(person.id) || 0, Math.max(...parentLevels) + 1));
    });
  }

  const minimum = Math.min(...Array.from(generation.values()), 0);
  const groups = new Map<number, Person[]>();
  people.forEach((person) => {
    const level = (generation.get(person.id) || 0) - minimum;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(person);
  });

  const orderedGroups = new Map<number, Person[]>();
  groups.forEach((members, level) => {
    const source = [...members].sort((a, b) => a.order - b.order);
    const memberIds = new Set(source.map((person) => person.id));
    const used = new Set<string>();
    const ordered: Person[] = [];
    source.forEach((person) => {
      if (used.has(person.id)) return;
      ordered.push(person);
      used.add(person.id);
      person.spouseIds.forEach((spouseId) => {
        if (memberIds.has(spouseId) && !used.has(spouseId)) {
          ordered.push(byId.get(spouseId)!);
          used.add(spouseId);
        }
      });
    });
    orderedGroups.set(level, ordered);
  });

  const widest = Math.max(...Array.from(orderedGroups.values()).map((group) => group.length), 1);
  const width = Math.max(920, widest * 145 + 120);
  const maxGeneration = Math.max(...Array.from(orderedGroups.keys()), 0);
  const height = Math.max(590, (maxGeneration + 1) * 165 + 120);
  const positioned: PositionedPerson[] = [];

  orderedGroups.forEach((members, level) => {
    const gap = Math.min(170, (width - 150) / Math.max(members.length - 1, 1));
    const startX = members.length === 1 ? width / 2 : (width - gap * (members.length - 1)) / 2;
    members.forEach((person, index) => {
      const automaticX = startX + index * gap;
      const automaticY = 88 + level * 165;
      positioned.push({
        ...person,
        x: person.manualX ?? automaticX,
        y: person.manualY ?? automaticY,
        generation: level,
        displayId: `${roman(level)}-${index + 1}`,
      });
    });
  });

  return { people: positioned, width, height };
}

function downloadFile(name: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  if (window.AndroidBridge) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(',')[1] || '';
      window.AndroidBridge?.saveBase64(name, base64, type);
    };
    reader.readAsDataURL(blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function PedigreeWorkspace() {
  const [cases, setCases] = useState<PedigreeCase[]>([sampleCase()]);
  const [activeCaseId, setActiveCaseId] = useState('case-demo');
  const [selectedId, setSelectedId] = useState('p7');
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<PedigreeCase[]>([]);
  const [future, setFuture] = useState<PedigreeCase[]>([]);
  const [notice, setNotice] = useState('已自动保存到本机');
  const [storageReady, setStorageReady] = useState(false);
  const [diseaseQuery, setDiseaseQuery] = useState(sampleCase().disease);
  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [snapHint, setSnapHint] = useState('');
  const [dragDeleteReady, setDragDeleteReady] = useState(false);
  const [alignmentGuide, setAlignmentGuide] = useState<{ x?: number; y?: number } | null>(null);
  const [selectedUnionKey, setSelectedUnionKey] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const pinchRef = useRef<{
    distance: number;
    startZoom: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    snapshot: PedigreeCase;
    deleteCandidate: boolean;
    snapIntent: SnapIntent | null;
    viewportScrollLeft: number;
    viewportScrollTop: number;
    pageScrollX: number;
    pageScrollY: number;
  } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const startPinch = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      const pendingDrag = dragRef.current;
      if (pendingDrag?.moved) {
        setCases((currentCases) => currentCases.map((item) => item.id === activeCaseId ? pendingDrag.snapshot : item));
      }
      dragRef.current = null;
      setSnapHint('');
      setAlignmentGuide(null);
      setDragDeleteReady(false);
      const first = event.touches[0];
      const second = event.touches[1];
      const rect = viewport.getBoundingClientRect();
      const centerX = (first.clientX + second.clientX) / 2 - rect.left;
      const centerY = (first.clientY + second.clientY) / 2 - rect.top;
      const currentZoom = zoomRef.current;
      pinchRef.current = {
        distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) || 1,
        startZoom: currentZoom,
        contentX: (viewport.scrollLeft + centerX) / currentZoom,
        contentY: (viewport.scrollTop + centerY) / currentZoom,
      };
    };

    const movePinch = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();
      const first = event.touches[0];
      const second = event.touches[1];
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) || 1;
      const nextZoom = Math.max(.1, Math.min(2, pinch.startZoom * distance / pinch.distance));
      const rect = viewport.getBoundingClientRect();
      const centerX = (first.clientX + second.clientX) / 2 - rect.left;
      const centerY = (first.clientY + second.clientY) / 2 - rect.top;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = pinch.contentX * nextZoom - centerX;
        viewport.scrollTop = pinch.contentY * nextZoom - centerY;
      });
    };

    const endPinch = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };

    viewport.addEventListener('touchstart', startPinch, { passive: false });
    viewport.addEventListener('touchmove', movePinch, { passive: false });
    viewport.addEventListener('touchend', endPinch, { passive: false });
    viewport.addEventListener('touchcancel', endPinch, { passive: false });
    return () => {
      viewport.removeEventListener('touchstart', startPinch);
      viewport.removeEventListener('touchmove', movePinch);
      viewport.removeEventListener('touchend', endPinch);
      viewport.removeEventListener('touchcancel', endPinch);
    };
  }, [activeCaseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as PedigreeCase[];
        if (Array.isArray(parsed) && parsed.length) {
          const migrated = parsed.map((item) => ({
            ...item,
            disease: item.disease || '',
            diseaseId: item.diseaseId || '',
            variant: item.variant || '',
            variantType: item.variantType || 'other',
            people: normalizePeople(item.people || []),
          }));
          setCases(migrated);
          setActiveCaseId(migrated[0].id);
          setSelectedId(migrated[0].people.find((person) => person.proband)?.id || migrated[0].people[0]?.id || '');
          setDiseaseQuery(migrated[0].disease || '');
        }
      } catch {
        setNotice('本地数据读取失败，已加载示例');
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    } catch {
      window.setTimeout(() => setNotice('本地存储空间不足，请及时导出备份'), 0);
    }
  }, [cases, storageReady]);

  const activeCase = cases.find((item) => item.id === activeCaseId) || cases[0];
  const selected = activeCase?.people.find((person) => person.id === selectedId);
  const layout = useMemo(() => buildLayout(activeCase?.people || []), [activeCase]);
  const positionedById = useMemo(() => new Map(layout.people.map((person) => [person.id, person])), [layout.people]);

  const catalogResults = useMemo(() => {
    const queryValue = diseaseQuery.trim().toLowerCase();
    const scored = diseaseOptions.flatMap((option) => {
      const genes = Array.from(new Set(option.records.map((record) => record[3])));
      const aliases = genes.map((gene) => chineseGeneAliases[gene] || '').join(' ').toLowerCase();
      const name = option.name.toLowerCase();
      const geneText = genes.join(' ').toLowerCase();
      if (!queryValue) return aliases ? [{ option, score: 4 }] : [];
      if (!name.includes(queryValue) && !option.id.toLowerCase().includes(queryValue) && !geneText.includes(queryValue) && !aliases.includes(queryValue)) return [];
      const score = option.id.startsWith('LOCAL:') && name.includes(queryValue) ? -1 : name.startsWith(queryValue) ? 0 : geneText.split(' ').includes(queryValue) ? 1 : aliases.includes(queryValue) ? 2 : 3;
      return [{ option, score }];
    });
    return scored.sort((a, b) => a.score - b.score || a.option.name.localeCompare(b.option.name, 'en')).slice(0, 40).map((item) => item.option);
  }, [diseaseQuery]);

  const selectedDisease = diseaseOptions.find((option) => option.id === activeCase?.diseaseId || option.name === activeCase?.disease);
  const geneOptions = useMemo(() => {
    if (!selectedDisease) return [];
    const unique = new Map<string, CatalogRecord>();
    selectedDisease.records.forEach((record) => {
      const key = `${record[3]}|${record[4]}`;
      if (!unique.has(key)) unique.set(key, record);
    });
    return Array.from(unique.values()).sort((a, b) => a[3].localeCompare(b[3], 'en'));
  }, [selectedDisease]);

  const variantOptions = commonVariants.filter((variant) => variant.gene === activeCase?.gene);
  const selectedVariant = variantOptions.find((variant) => variant.hgvs === activeCase?.variant);

  const filteredCases = cases.filter((item) => `${item.name} ${item.disease || ''} ${item.gene}`.toLowerCase().includes(query.toLowerCase()));

  const commit = (updater: (value: PedigreeCase) => PedigreeCase, message = '已保存') => {
    setCases((currentCases) => {
      const current = currentCases.find((item) => item.id === activeCaseId);
      if (!current) return currentCases;
      setHistory((items) => [...items.slice(-39), cloneCase(current)]);
      setFuture([]);
      const updated = updater(cloneCase(current));
      const next = { ...updated, people: normalizePeople(updated.people), updatedAt: isoNow() };
      return currentCases.map((item) => item.id === activeCaseId ? next : item);
    });
    setNotice(message);
  };

  const updatePerson = (patch: Partial<Person>, message = '已保存') => {
    if (!selected) return;
    commit((current) => ({
      ...current,
      people: current.people.map((person) => person.id === selected.id ? { ...person, ...patch } : person),
    }), message);
  };

  const correctSelectedSymbol = (sex: Sex) => {
    updatePerson({ sex, ...(sex === 'pregnancy_loss' ? { phenotype: 'unknown', deceased: false } : {}) }, '成员图例已直接更正');
  };

  const chooseDisease = (option: DiseaseOption) => {
    const preferred = chooseDefaultCatalogRecord(option.records);
    const preferredVariants = commonVariants.filter((variant) => variant.gene === preferred?.[3]);
    const defaultVariant = preferredVariants[0];
    setDiseaseQuery(option.name);
    setDiseaseOpen(false);
    commit((current) => ({
      ...current,
      disease: option.name,
      diseaseId: option.id,
      gene: preferred?.[3] || '',
      inheritance: translateInheritance(preferred?.[4] || ''),
      variant: defaultVariant?.hgvs || '',
      variantType: defaultVariant?.type || 'other',
    }), defaultVariant ? '已带出默认遗传模式、常用位点与变异类型，请确认' : '已按证据权重带出默认基因与遗传模式');
  };

  const chooseGene = (value: string) => {
    const [gene, inheritance] = value.split('|');
    const geneVariants = commonVariants.filter((variant) => variant.gene === gene);
    const defaultVariant = geneVariants[0];
    commit((current) => ({ ...current, gene, inheritance: translateInheritance(inheritance), variant: defaultVariant?.hgvs || '', variantType: defaultVariant?.type || 'other' }), defaultVariant ? '已带出该基因常用位点与变异类型，请确认' : '目标基因与默认遗传模式已更新');
  };

  const chooseVariant = (value: string) => {
    const known = commonVariants.find((variant) => variant.gene === activeCase.gene && variant.hgvs === value.trim());
    commit((current) => ({ ...current, variant: value, variantType: known?.type || 'other' }), known ? '已带入标准位点与变异类型' : '已保存手工位点，请确认变异类型');
  };

  const useManualDisease = () => {
    const disease = diseaseQuery.trim();
    if (!disease) return;
    setDiseaseOpen(false);
    commit((current) => ({ ...current, disease, diseaseId: '' }), '已保存手工疾病名称');
  };

  const pointerCoordinates = (event: ReactPointerEvent<SVGGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  };

  const beginDrag = (event: ReactPointerEvent<SVGGElement>, person: PositionedPerson) => {
    if (event.button !== 0) return;
    if (event.pointerType === 'touch' && dragRef.current) return;
    const point = pointerCoordinates(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(person.id);
    setSelectedUnionKey(null);
    const viewport = viewportRef.current;
    dragRef.current = {
      id: person.id,
      startX: point.x,
      startY: point.y,
      originX: person.x,
      originY: person.y,
      moved: false,
      snapshot: cloneCase(activeCase),
      deleteCandidate: false,
      snapIntent: null,
      viewportScrollLeft: viewport?.scrollLeft || 0,
      viewportScrollTop: viewport?.scrollTop || 0,
      pageScrollX: window.scrollX,
      pageScrollY: window.scrollY,
    };
    setSnapHint('');
    setAlignmentGuide(null);
    setDragDeleteReady(false);
  };

  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = drag.viewportScrollLeft;
      viewport.scrollTop = drag.viewportScrollTop;
    }
    if (window.scrollX !== drag.pageScrollX || window.scrollY !== drag.pageScrollY) window.scrollTo(drag.pageScrollX, drag.pageScrollY);
    const point = pointerCoordinates(event);
    if (!point) return;
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) drag.moved = true;
    const viewportRect = viewport?.getBoundingClientRect();
    const outside = Boolean(viewportRect && drag.moved && (
      event.clientX < viewportRect.left - 18 || event.clientX > viewportRect.right + 18 ||
      event.clientY < viewportRect.top - 18 || event.clientY > viewportRect.bottom + 18
    ));
    drag.deleteCandidate = outside && activeCase.people.length > 1;
    setDragDeleteReady(drag.deleteCandidate);

    let nextX = Math.max(45, Math.min(layout.width - 45, drag.originX + deltaX));
    let nextY = Math.max(45, Math.min(layout.height - 90, drag.originY + deltaY));
    drag.snapIntent = null;
    let hint = drag.deleteCandidate ? '' : '自由调整位置';
    let nextGuide: { x?: number; y?: number } | null = null;

    if (!outside) {
      let bestParents: { distance: number; fatherId?: string; motherId?: string; x: number; y: number; label: string } | null = null;

      for (const [, pair] of unionPairs) {
        const [first, second] = pair;
        if (first.id === drag.id || second.id === drag.id) continue;
        if (isAncestor(activeCase.people, drag.id, first.id) || isAncestor(activeCase.people, drag.id, second.id)) continue;
        const distance = distanceToUnionPath(point.x, point.y, first, second);
        if (distance > 34 || (bestParents && distance >= bestParents.distance)) continue;
        const parentIds = parentIdsForPair(first, second);
        bestParents = {
          distance,
          ...parentIds,
          x: Math.max(45, Math.min(layout.width - 45, (first.x + second.x) / 2)),
          y: Math.max(first.y, second.y) + 145,
          label: `松手接入 ${first.displayId}－${second.displayId} 的子代线`,
        };
      }

      for (const [key, children] of parentGroups) {
        const [fatherId, motherId] = key.split('|');
        const father = positionedById.get(fatherId);
        const mother = positionedById.get(motherId);
        const parents = [father, mother].filter(Boolean) as PositionedPerson[];
        const otherChildren = children.filter((child) => child.id !== drag.id).sort((a, b) => a.x - b.x);
        if (!parents.length || !otherChildren.length) continue;
        if (parents.some((parent) => isAncestor(activeCase.people, drag.id, parent.id))) continue;
        const parentX = parents.reduce((sum, parent) => sum + parent.x, 0) / parents.length;
        const parentY = parents.reduce((sum, parent) => sum + parent.y, 0) / parents.length;
        const siblingY = otherChildren[0].y - 68;
        const startX = Math.min(parentX, otherChildren[0].x);
        const endX = Math.max(parentX, otherChildren[otherChildren.length - 1].x);
        const horizontalDistance = distanceToSegment(point.x, point.y, startX, siblingY, endX, siblingY);
        const verticalDistance = distanceToSegment(point.x, point.y, parentX, parentY, parentX, siblingY);
        const distance = Math.min(horizontalDistance, verticalDistance);
        if (distance > 30 || (bestParents && distance >= bestParents.distance)) continue;
        bestParents = {
          distance,
          fatherId: fatherId || undefined,
          motherId: motherId || undefined,
          x: Math.max(45, Math.min(layout.width - 45, point.x)),
          y: otherChildren.reduce((sum, child) => sum + child.y, 0) / otherChildren.length,
          label: '松手接入该父母支线并与同胞自动对齐',
        };
      }

      if (bestParents) {
        nextX = bestParents.x;
        nextY = Math.max(45, Math.min(layout.height - 90, bestParents.y));
        drag.snapIntent = { type: 'parents', fatherId: bestParents.fatherId, motherId: bestParents.motherId, label: bestParents.label };
        hint = bestParents.label;
        nextGuide = { x: nextX };
      } else {
        const currentPerson = positionedById.get(drag.id);
        const siblingNear = layout.people.find((person) => person.id !== drag.id && areSiblings(activeCase.people, drag.id, person.id) && Math.hypot(point.x - person.x, point.y - person.y) < 125 && Math.abs(point.y - person.y) < 52);
        const spouseTarget = layout.people
          .filter((person) => person.id !== drag.id && person.sex !== 'pregnancy_loss')
          .filter((person) => !isAncestor(activeCase.people, drag.id, person.id) && !isAncestor(activeCase.people, person.id, drag.id))
          .filter((person) => !areSiblings(activeCase.people, drag.id, person.id))
          .map((person) => ({ person, distance: Math.hypot(point.x - person.x, point.y - person.y) }))
          .filter(({ person, distance }) => distance < 125 && Math.abs(point.y - person.y) < 52)
          .sort((a, b) => a.distance - b.distance)[0];

        if (spouseTarget && currentPerson?.sex !== 'pregnancy_loss') {
          const target = spouseTarget.person;
          nextY = target.y;
          nextX = Math.max(45, Math.min(layout.width - 45, target.x + (point.x >= target.x ? 170 : -170)));
          drag.snapIntent = { type: 'spouse', targetId: target.id, label: `松手与 ${target.displayId} 建立配偶线` };
          hint = drag.snapIntent.label;
          nextGuide = { y: target.y };
        } else {
          const verticalSnapThreshold = Math.max(24, Math.min(46, layout.width * .05));
          const horizontalSnapThreshold = Math.max(18, Math.min(30, layout.height * .05));
          const verticalAnchors = [
            ...layout.people
              .filter((person) => person.id !== drag.id)
              .map((person) => ({ x: person.x, label: person.displayId })),
            ...unionPairs
              .filter(([, pair]) => !pair.some((person) => person.id === drag.id))
              .map(([, pair]) => ({ x: (pair[0].x + pair[1].x) / 2, label: `${pair[0].displayId}－${pair[1].displayId} 连线中点` })),
          ];
          const verticalTarget = verticalAnchors
            .filter((anchor) => Math.abs(nextX - anchor.x) <= verticalSnapThreshold)
            .sort((a, b) => Math.abs(nextX - a.x) - Math.abs(nextX - b.x))[0];
          if (verticalTarget) {
            nextX = verticalTarget.x;
            hint = `已与 ${verticalTarget.label} 纵向强制拉直`;
            nextGuide = { ...nextGuide, x: verticalTarget.x };
          }
          const horizontalTarget = layout.people
            .filter((person) => person.id !== drag.id && Math.abs(nextY - person.y) <= horizontalSnapThreshold)
            .sort((a, b) => Math.abs(nextY - a.y) - Math.abs(nextY - b.y))[0];
          if (horizontalTarget) {
            nextY = horizontalTarget.y;
            hint = `已与 ${horizontalTarget.displayId} 横向对齐`;
            nextGuide = { ...nextGuide, y: horizontalTarget.y };
          }
          if (siblingNear) hint = `已与 ${siblingNear.displayId} 对齐；同胞之间禁止建立配偶线`;
        }
      }
    }

    setSnapHint(drag.moved ? hint : '');
    setAlignmentGuide(drag.moved ? nextGuide : null);
    setCases((currentCases) => currentCases.map((item) => item.id === activeCaseId ? {
      ...item,
      people: item.people.map((person) => person.id === drag.id ? { ...person, manualX: nextX, manualY: nextY } : person),
    } : item));
  };

  const endDrag = (event: ReactPointerEvent<SVGGElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setSnapHint('');
    setAlignmentGuide(null);
    setDragDeleteReady(false);
    if (cancelled) {
      if (drag.moved) setCases((currentCases) => currentCases.map((item) => item.id === activeCaseId ? drag.snapshot : item));
      return;
    }
    if (!drag.moved) return;
    setHistory((items) => [...items.slice(-39), drag.snapshot]);
    setFuture([]);
    if (drag.deleteCandidate) {
      const fallback = drag.snapshot.people.find((person) => person.id !== drag.id)?.id || '';
      setCases((currentCases) => currentCases.map((item) => item.id === activeCaseId ? { ...removePersonFromCase(item, drag.id), updatedAt: isoNow() } : item));
      setSelectedId(fallback);
      setNotice('成员已拖出画布删除，可撤销恢复');
      return;
    }
    setCases((currentCases) => currentCases.map((item) => {
      if (item.id !== activeCaseId) return item;
      let people = item.people;
      if (drag.snapIntent?.type === 'parents') {
        people = people.map((person) => person.id === drag.id ? {
          ...person,
          fatherId: drag.snapIntent?.type === 'parents' ? drag.snapIntent.fatherId : person.fatherId,
          motherId: drag.snapIntent?.type === 'parents' ? drag.snapIntent.motherId : person.motherId,
        } : person);
        people = normalizePeople(people);
      } else if (drag.snapIntent?.type === 'spouse') {
        const targetId = drag.snapIntent.targetId;
        if (areSiblings(people, drag.id, targetId)) return { ...item, people: normalizePeople(people), updatedAt: isoNow() };
        people = people.map((person) => {
          if (person.id === drag.id && !person.spouseIds.includes(targetId)) return { ...person, spouseIds: [...person.spouseIds, targetId] };
          if (person.id === targetId && !person.spouseIds.includes(drag.id)) return { ...person, spouseIds: [...person.spouseIds, drag.id] };
          return person;
        });
      }
      return { ...item, people, updatedAt: isoNow() };
    }));
    setNotice(drag.snapIntent?.label ? drag.snapIntent.label.replace('松手', '已') : '成员位置已调整，画布保持固定');
  };

  const autoArrange = () => {
    commit((current) => ({
      ...current,
      people: current.people.map((person) => ({ ...person, manualX: undefined, manualY: undefined })),
    }), '已恢复自动排版');
  };

  const revealCanvasPoint = (pointX: number, pointY: number) => {
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const currentZoom = zoomRef.current;
      const screenX = pointX * currentZoom;
      const screenY = pointY * currentZoom;
      const margin = 72;
      if (screenX < viewport.scrollLeft + margin) viewport.scrollLeft = Math.max(0, screenX - margin);
      else if (screenX > viewport.scrollLeft + viewport.clientWidth - margin) viewport.scrollLeft = Math.max(0, screenX - viewport.clientWidth + margin);
      if (screenY < viewport.scrollTop + margin) viewport.scrollTop = Math.max(0, screenY - margin);
      else if (screenY > viewport.scrollTop + viewport.clientHeight - margin) viewport.scrollTop = Math.max(0, screenY - viewport.clientHeight + margin);
    });
  };

  const fitWholePedigree = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = Math.max(.1, Math.min(1, (viewport.clientWidth - 24) / layout.width, (viewport.clientHeight - 24) / layout.height));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
    setNotice('已缩放到可查看完整家系图');
  };

  const addRelative = (kind: 'father' | 'mother' | 'spouse' | 'son' | 'daughter' | 'unknown_child' | 'pregnancy_loss' | 'sibling') => {
    const childKinds = ['son', 'daughter', 'unknown_child', 'pregnancy_loss'] as const;
    const addToSelectedUnion = Boolean(selectedUnionKey && childKinds.includes(kind as typeof childKinds[number]));
    if (!selected) {
      setNotice('请先选中一位成员');
      return;
    }
    if (kind === 'father' && selected.fatherId) return setNotice('该成员已有父亲记录');
    if (kind === 'mother' && selected.motherId) return setNotice('该成员已有母亲记录');
    if (kind === 'sibling' && !selected.fatherId && !selected.motherId) return setNotice('请先添加父亲或母亲，再添加同胞');

    const targetPosition = positionedById.get(selected.id);
    if (!targetPosition) return setNotice('当前成员位置读取失败，请重新点选');
    const clampX = (value: number) => Math.max(45, Math.min(layout.width - 45, value));
    const staggerOffset = (count: number) => count === 0 ? 0 : (count % 2 ? -1 : 1) * Math.ceil(count / 2) * 105;
    let shiftExistingY = 0;
    let nextX = targetPosition.x;
    let nextY = targetPosition.y;

    if (addToSelectedUnion && selectedUnionPair) {
      const [first, second] = selectedUnionPair;
      const parentIds = new Set([first.id, second.id]);
      const children = layout.people.filter((person) => parentIds.has(person.fatherId || '') && parentIds.has(person.motherId || ''));
      nextX = (first.x + second.x) / 2 + staggerOffset(children.length);
      nextY = Math.max(first.y, second.y) + 145;
    } else if (kind === 'father' || kind === 'mother') {
      const otherParentId = kind === 'father' ? selected.motherId : selected.fatherId;
      const otherParent = otherParentId ? positionedById.get(otherParentId) : undefined;
      if (otherParent) {
        nextX = otherParent.x + (kind === 'father' ? -115 : 115);
        nextY = otherParent.y;
      } else {
        const partnerPosition = layout.people.find((person) => selected.spouseIds.includes(person.id));
        const familyDirection = partnerPosition ? (targetPosition.x <= partnerPosition.x ? -1 : 1) : 0;
        const familyCenterX = targetPosition.x + familyDirection * 70;
        shiftExistingY = targetPosition.y < 205 ? 145 : 0;
        nextX = familyCenterX + (kind === 'father' ? -58 : 58);
        nextY = Math.max(55, targetPosition.y + shiftExistingY - 145);
      }
    } else if (kind === 'spouse') {
      const distance = 170 * (Math.floor(selected.spouseIds.length / 2) + 1);
      const direction = selected.spouseIds.length % 2 ? -1 : targetPosition.x < layout.width / 2 ? 1 : -1;
      nextX = targetPosition.x + direction * distance;
      nextY = targetPosition.y;
    } else if (kind === 'sibling') {
      const siblings = layout.people.filter((person) => person.id !== selected.id && (
        (selected.fatherId && person.fatherId === selected.fatherId) ||
        (selected.motherId && person.motherId === selected.motherId)
      ));
      const family = [targetPosition, ...siblings];
      const right = Math.max(...family.map((person) => person.x)) + 110;
      const left = Math.min(...family.map((person) => person.x)) - 110;
      nextX = right <= layout.width - 45 ? right : left;
      nextY = targetPosition.y;
    } else {
      const spouse = layout.people.find((person) => selected.spouseIds.includes(person.id));
      const parents = spouse ? [targetPosition, spouse] : [targetPosition];
      const parentIds = new Set(parents.map((person) => person.id));
      const children = layout.people.filter((person) =>
        [person.fatherId, person.motherId].filter(Boolean).every((parentId) => parentIds.has(parentId!)) &&
        [person.fatherId, person.motherId].some((parentId) => parentIds.has(parentId || ''))
      );
      nextX = parents.reduce((sum, person) => sum + person.x, 0) / parents.length + staggerOffset(children.length);
      nextY = Math.max(...parents.map((person) => person.y)) + 145;
    }

    nextX = clampX(nextX);
    nextY = Math.max(55, nextY);

    const id = makeId('person');
    const newPerson: Person = {
      id,
      name: '',
      sex: kind === 'father' || kind === 'son' ? 'male' : kind === 'mother' || kind === 'daughter' ? 'female' : kind === 'pregnancy_loss' ? 'pregnancy_loss' : 'unknown',
      phenotype: 'unknown',
      deceased: false,
      proband: false,
      birthYear: '',
      clinicalId: '',
      diagnosis: '',
      genotype: '',
      notes: '',
      spouseIds: [],
      order: Math.max(...activeCase.people.map((person) => person.order), 0) + 1,
      manualX: nextX,
      manualY: nextY,
    };

    commit((current) => {
      const people = current.people.map((person) => {
        const position = positionedById.get(person.id);
        return position ? { ...person, manualX: position.x, manualY: position.y + shiftExistingY } : person;
      });
      const target = people.find((person) => person.id === selected.id)!;
      if (addToSelectedUnion && selectedUnionKey) {
        const [firstId, secondId] = selectedUnionKey.split('|');
        const first = people.find((person) => person.id === firstId);
        const second = people.find((person) => person.id === secondId);
        if (first && second) {
          const parentIds = parentIdsForPair(first, second);
          newPerson.fatherId = parentIds.fatherId;
          newPerson.motherId = parentIds.motherId;
          return { ...current, people: normalizePeople([...people, newPerson]) };
        }
      }
      if (kind === 'father') {
        target.fatherId = id;
        if (target.motherId) {
          newPerson.spouseIds = [target.motherId];
          const mother = people.find((person) => person.id === target.motherId);
          if (mother && !mother.spouseIds.includes(id)) mother.spouseIds.push(id);
        }
      }
      if (kind === 'mother') {
        target.motherId = id;
        if (target.fatherId) {
          newPerson.spouseIds = [target.fatherId];
          const father = people.find((person) => person.id === target.fatherId);
          if (father && !father.spouseIds.includes(id)) father.spouseIds.push(id);
        }
      }
      if (kind === 'spouse') {
        target.spouseIds = [...new Set([...target.spouseIds, id])];
        newPerson.spouseIds = [target.id];
        newPerson.sex = target.sex === 'male' ? 'female' : target.sex === 'female' ? 'male' : 'unknown';
      }
      if (kind === 'sibling') {
        newPerson.fatherId = target.fatherId;
        newPerson.motherId = target.motherId;
      }
      if (kind === 'son' || kind === 'daughter' || kind === 'unknown_child' || kind === 'pregnancy_loss') {
        const spouse = people.find((person) => target.spouseIds.includes(person.id));
        if (target.sex === 'female') newPerson.motherId = target.id;
        else newPerson.fatherId = target.id;
        if (spouse?.sex === 'female') newPerson.motherId = spouse.id;
        else if (spouse) newPerson.fatherId = spouse.id;
      }
      return { ...current, people: [...people, newPerson] };
    }, addToSelectedUnion ? '同胞已在父母线下方就近生成，可继续拖动微调' : kind === 'father' || kind === 'mother' ? '父母已在该成员一侧独立展开，不与配偶父母混接' : '新成员已在当前成员附近生成');
    setSelectedId(kind === 'father' || kind === 'mother' ? selected.id : id);
    if (!addToSelectedUnion) setSelectedUnionKey(null);
    revealCanvasPoint(nextX, nextY);
  };

  const removeSelected = () => {
    if (!selected || activeCase.people.length === 1) return setNotice('家系至少需保留一位成员');
    const fallback = activeCase.people.find((person) => person.id !== selected.id)?.id || '';
    commit((current) => removePersonFromCase(current, selected.id), '成员已删除，可点撤销恢复');
    setSelectedId(fallback);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous || !activeCase) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [...items, cloneCase(activeCase)]);
    setCases((items) => items.map((item) => item.id === activeCaseId ? { ...previous, people: normalizePeople(previous.people) } : item));
    setNotice('已撤销上一步');
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next || !activeCase) return;
    setFuture((items) => items.slice(0, -1));
    setHistory((items) => [...items, cloneCase(activeCase)]);
    setCases((items) => items.map((item) => item.id === activeCaseId ? { ...next, people: normalizePeople(next.people) } : item));
    setNotice('已恢复操作');
  };

  const createCase = () => {
    const next = blankCase();
    setCases((items) => [next, ...items]);
    setActiveCaseId(next.id);
    setSelectedId(next.people[0].id);
    setDiseaseQuery('');
    setHistory([]);
    setFuture([]);
    setNotice('已创建新家系');
  };

  const selectCase = (item: PedigreeCase) => {
    setActiveCaseId(item.id);
    setSelectedId(item.people.find((person) => person.proband)?.id || item.people[0]?.id || '');
    setDiseaseQuery(item.disease || '');
    setHistory([]);
    setFuture([]);
    setZoom(1);
    setSelectedUnionKey(null);
  };

  const exportJson = () => {
    downloadFile(`${activeCase.name || '家系图'}.json`, JSON.stringify(activeCase, null, 2), 'application/json');
    setNotice('结构化数据已导出');
  };

  const exportSvg = () => {
    const source = document.getElementById('pedigree-svg') as SVGSVGElement | null;
    if (!source) return;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(layout.width));
    clone.setAttribute('height', String(layout.height));
    const css = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    css.textContent = 'text{font-family:Arial,"PingFang SC",sans-serif}';
    clone.insertBefore(css, clone.firstChild);
    downloadFile(`${activeCase.name || '家系图'}.svg`, new XMLSerializer().serializeToString(clone), 'image/svg+xml;charset=utf-8');
    setNotice('SVG 矢量图已导出');
  };

  const exportPng = () => {
    const source = document.getElementById('pedigree-svg') as SVGSVGElement | null;
    if (!source) return;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(layout.width));
    clone.setAttribute('height', String(layout.height));
    const white = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    white.setAttribute('width', '100%');
    white.setAttribute('height', '100%');
    white.setAttribute('fill', '#ffffff');
    clone.insertBefore(white, clone.firstChild);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = layout.width * 2;
      canvas.height = layout.height * 2;
      const context = canvas.getContext('2d');
      context?.scale(2, 2);
      context?.drawImage(image, 0, 0);
      canvas.toBlob((png) => {
        if (png) downloadFile(`${activeCase.name || '家系图'}.png`, png, 'image/png');
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    image.src = url;
    setNotice('PNG 图片已导出');
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PedigreeCase;
        if (!parsed.name || !Array.isArray(parsed.people)) throw new Error('invalid');
        const next = {
          ...parsed,
          id: makeId('case'),
          disease: parsed.disease || '',
          diseaseId: parsed.diseaseId || '',
          variant: parsed.variant || '',
          variantType: parsed.variantType || 'other',
          people: normalizePeople(parsed.people),
          updatedAt: isoNow(),
        };
        setCases((items) => [next, ...items]);
        setActiveCaseId(next.id);
        setSelectedId(next.people.find((person) => person.proband)?.id || next.people[0]?.id || '');
        setDiseaseQuery(next.disease);
        setNotice('家系数据已导入');
      } catch {
        setNotice('导入失败：请选择本工具导出的 JSON 文件');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const parentGroups = (() => {
    const groups = new Map<string, PositionedPerson[]>();
    layout.people.forEach((person) => {
      if (!person.fatherId && !person.motherId) return;
      const key = `${person.fatherId || ''}|${person.motherId || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(person);
    });
    return Array.from(groups.entries());
  })();

  const unionPairs = (() => {
    const pairs = new Map<string, [PositionedPerson, PositionedPerson]>();
    const addPair = (firstId?: string, secondId?: string) => {
      if (!firstId || !secondId || firstId === secondId) return;
      if (areSiblings(activeCase.people, firstId, secondId)) return;
      const first = positionedById.get(firstId);
      const second = positionedById.get(secondId);
      if (!first || !second) return;
      const key = [firstId, secondId].sort().join('|');
      if (!pairs.has(key)) pairs.set(key, [first, second]);
    };
    layout.people.forEach((person) => {
      person.spouseIds.forEach((spouseId) => addPair(person.id, spouseId));
      addPair(person.fatherId, person.motherId);
    });
    return Array.from(pairs.entries());
  })();

  const selectedUnionPair = unionPairs.find(([key]) => key === selectedUnionKey)?.[1];

  if (!activeCase) return null;

  const variantTypeLabel = variantTypes.find(([value]) => value === activeCase.variantType)?.[1] || '其他/待确定';
  const pedigreeSummary = `疾病：${activeCase.disease || '待选择'} · 基因：${activeCase.gene || '待选择'} · 位点：${activeCase.variant || '待录入'}（${variantTypeLabel}）`;
  const shortPedigreeSummary = pedigreeSummary.length > 82 ? `${pedigreeSummary.slice(0, 80)}…` : pedigreeSummary;

  return (
    <section className={styles.pedigreeApp} data-app-ready="true">
      <header className={styles.appHeader}>
        <div>
          <p>业务工作台 / 遗传咨询 / 家系图工具</p>
          <h1>遗传家系图</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.saveState}><i />{notice}</span>
          <button type="button" onClick={() => setShowGuide(true)}>图例 / 用法</button>
          <button type="button" onClick={() => importRef.current?.click()}>导入</button>
          <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json,.json" onChange={importJson} />
          <div className={styles.exportMenu}>
            <button type="button" className={styles.exportButton}>导出 ▾</button>
            <div><button type="button" onClick={exportPng}>PNG 图片</button><button type="button" onClick={exportSvg}>SVG 矢量图</button><button type="button" onClick={exportJson}>JSON 数据</button></div>
          </div>
        </div>
      </header>

      <div className={styles.caseMeta}>
        <label><span>家系名称</span><input value={activeCase.name} onChange={(event) => commit((item) => ({ ...item, name: event.target.value }))} /></label>
        <label className={styles.diseasePicker}><span>单基因病</span><input value={diseaseQuery} placeholder="输入疾病、基因或 MONDO 编号" onFocus={() => setDiseaseOpen(true)} onChange={(event) => { setDiseaseQuery(event.target.value); setDiseaseOpen(true); }} onBlur={() => window.setTimeout(() => setDiseaseOpen(false), 120)} />
          {diseaseOpen && <div className={styles.diseaseResults}>
            <div className={styles.catalogSummary}>GenCC {catalog.metadata.releaseDate} · {catalog.metadata.diseaseCount.toLocaleString()} 种疾病</div>
            {catalogResults.length ? catalogResults.map((option) => {
              const genes = Array.from(new Set(option.records.map((record) => record[3])));
              const chineseLabels = Array.from(new Set(genes.map((gene) => chineseGeneAliases[gene]).filter(Boolean)));
              return <button type="button" key={option.id || option.name} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseDisease(option)}><strong>{option.name}</strong><small>{option.id || '无标准ID'} · {genes.slice(0, 5).join(' / ')}{genes.length > 5 ? ` +${genes.length - 5}` : ''}{chineseLabels.length ? ` · ${chineseLabels.join(' / ')}` : ''}</small></button>;
            }) : <p>未找到匹配条目</p>}
            {diseaseQuery.trim() && !catalogResults.some((option) => option.name.toLowerCase() === diseaseQuery.trim().toLowerCase() || option.id.toLowerCase() === diseaseQuery.trim().toLowerCase()) && <button type="button" className={styles.manualDisease} onMouseDown={(event) => event.preventDefault()} onClick={useManualDisease}><strong>使用手工名称</strong><small>{diseaseQuery.trim()}</small></button>}
          </div>}
        </label>
        <label><span>目标基因</span><select value={geneOptions.find((record) => record[3] === activeCase.gene && translateInheritance(record[4]) === activeCase.inheritance) ? `${activeCase.gene}|${geneOptions.find((record) => record[3] === activeCase.gene && translateInheritance(record[4]) === activeCase.inheritance)![4]}` : ''} onChange={(event) => chooseGene(event.target.value)}>
          {!geneOptions.length && <option value="">{activeCase.gene || '请先选择疾病'}</option>}
          {geneOptions.length > 0 && !geneOptions.some((record) => record[3] === activeCase.gene && translateInheritance(record[4]) === activeCase.inheritance) && <option value="">{activeCase.gene || '请选择'}</option>}
          {geneOptions.map((record) => <option value={`${record[3]}|${record[4]}`} key={`${record[3]}-${record[4]}`}>{record[3]} · {translateInheritance(record[4])} · {record[5]}</option>)}
        </select></label>
        <label><span>遗传模式（证据优先默认，可修改）</span><select value={activeCase.inheritance} onChange={(event) => commit((item) => ({ ...item, inheritance: event.target.value }))}><option>待确定</option><option>常染色体显性</option><option>常染色体隐性</option><option>X连锁显性</option><option>X连锁隐性</option><option>Y连锁</option><option>线粒体遗传</option><option>半显性</option><option>多因素/未知</option></select></label>
        <label className={styles.variantPicker}><span>目标变异位点</span><input list={`variant-options-${activeCase.id}`} value={activeCase.variant || ''} placeholder={variantOptions.length ? `可选 ${variantOptions.length} 个常见位点` : '输入标准 HGVS 位点'} onChange={(event) => chooseVariant(event.target.value)} />
          <datalist id={`variant-options-${activeCase.id}`}>{variantOptions.map((variant) => <option value={variant.hgvs} key={`${variant.gene}-${variant.hgvs}`}>{variant.reference} · {variant.protein} · {variant.classification}</option>)}</datalist>
          <small className={styles.variantEvidence}>{selectedVariant ? `${selectedVariant.reference} · ${selectedVariant.protein} · ${selectedVariant.classification}` : variantOptions.length ? '可输入 109、235 等关键词筛选；最终按 HGVS 复核' : '暂无快捷位点，可手工输入'}</small>
        </label>
        <label><span>变异类型（选择快捷位点后自动带出）</span><select value={activeCase.variantType || 'other'} onChange={(event) => commit((item) => ({ ...item, variantType: event.target.value }))}>{variantTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <div className={styles.privacyNote}><b>本地模式 · GenCC + ClinVar快捷位点</b><span>疾病关系 {catalog.metadata.relationshipCount.toLocaleString()} 条；位点仅辅助录入，临床/PGT使用前必须复核</span></div>
      </div>

      <div className={styles.mainGrid}>
        <aside className={styles.caseRail}>
          <div className={styles.railHeading}><div><span>家系库</span><b>{cases.length}</b></div><button type="button" onClick={createCase}>+新建</button></div>
          <div className={styles.caseSearch}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索家系 / 基因" /></div>
          <div className={styles.caseList}>
            {filteredCases.map((item) => (
              <button type="button" className={item.id === activeCaseId ? styles.activeCase : ''} key={item.id} onClick={() => selectCase(item)}>
                <span>{item.gene || '未定基因'}</span>
                <strong>{item.name}</strong>
                <small>{item.people.length} 位成员 · {item.inheritance}</small>
              </button>
            ))}
          </div>
          <div className={styles.railFoot}><span>◈</span><p><b>数据可携带</b><small>JSON 可备份、迁移与再编辑</small></p></div>
        </aside>

        <main className={styles.canvasPanel}>
          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
              <button type="button" onClick={() => addRelative('father')} title="为当前选中成员添加父亲，并在上一层就近生成"><b>□</b>父亲</button>
              <button type="button" onClick={() => addRelative('mother')} title="为当前选中成员添加母亲，并与已有父亲水平对齐"><b>○</b>母亲</button>
              <button type="button" onClick={() => addRelative('spouse')} title="为当前选中成员添加配偶，并在同一水平层就近生成"><b>∞</b>配偶</button>
              <button type="button" onClick={() => addRelative('sibling')} title="添加与当前成员共享父母的同胞，不建立同胞配偶线"><b>≡</b>同胞</button>
              <button type="button" onClick={() => addRelative('son')} title="为当前成员及其配偶添加男性子代"><b>▣</b>儿子</button>
              <button type="button" onClick={() => addRelative('daughter')} title="为当前成员及其配偶添加女性子代"><b>◉</b>女儿</button>
              <button type="button" onClick={() => addRelative('unknown_child')} title="添加性别不详的子代（菱形）"><b>◇</b>不详子代</button>
              <button type="button" onClick={() => addRelative('pregnancy_loss')} title="添加妊娠丢失记录（倒三角）"><b>▽</b>妊娠丢失</button>
              <button type="button" onClick={autoArrange} title="清除手工位置并按世代重新自动排版"><b>✦</b>自动排版</button>
              <button type="button" onClick={() => setShowGuide(true)} title="查看每个图例和工具按钮的用途"><b>?</b>工具说明</button>
              <span className={styles.divider} />
              <button type="button" className={styles.deleteTool} disabled={!selected || activeCase.people.length <= 1 || Boolean(selectedUnionKey)} onClick={removeSelected} aria-label="删除所选成员" title="删除当前选中成员（可撤销）"><b>⌫</b>删除所选</button>
            </div>
            <div className={`${styles.toolGroup} ${styles.symbolCorrection}`} aria-label="更正当前成员图例">
              <span>更正图例</span>
              {(['male', 'female', 'unknown', 'pregnancy_loss'] as Sex[]).map((value) => (
                <button type="button" key={value} className={selected?.sex === value ? styles.activeSymbolTool : ''} disabled={!selected} onClick={() => correctSelectedSymbol(value)} aria-label={`更正为${value === 'male' ? '男性' : value === 'female' ? '女性' : value === 'unknown' ? '性别不详' : '妊娠丢失'}`} title={`将当前成员图例更正为${value === 'male' ? '男性方形' : value === 'female' ? '女性圆形' : value === 'unknown' ? '性别不详菱形' : '妊娠丢失倒三角'}`}>
                  <b>{value === 'male' ? '□' : value === 'female' ? '○' : value === 'unknown' ? '◇' : '▽'}</b>
                </button>
              ))}
            </div>
            <div className={`${styles.toolGroup} ${styles.phenotypeCorrection}`} aria-label="标注当前成员患病状态">
              <span>个体状态</span>
              {(['unaffected', 'affected', 'carrier', 'unknown'] as Phenotype[]).map((value) => (
                <button type="button" key={value} className={selected?.phenotype === value ? styles.activePhenotypeTool : ''} disabled={!selected || selected.sex === 'pregnancy_loss'} onClick={() => updatePerson({ phenotype: value }, `已在图中标注：${phenotypeLabel(value)}`)} title={`将当前成员标注为${phenotypeLabel(value)}`}>
                  {phenotypeLabel(value)}
                </button>
              ))}
            </div>
            <div className={styles.toolGroup}>
              <button type="button" disabled={!history.length} onClick={undo} aria-label="撤销" title="撤销上一步操作"><b>↶</b>撤销</button>
              <button type="button" disabled={!future.length} onClick={redo} aria-label="恢复" title="恢复刚撤销的操作"><b>↷</b>恢复</button>
              <span className={styles.divider} />
              <button type="button" onClick={() => setZoom((value) => Math.max(.1, value - .1))} aria-label="缩小" title="缩小画布，最低可缩至10%"><b>−</b>缩小</button>
              <button type="button" className={styles.zoomValue} onClick={() => setZoom(1)} title="点击恢复100%比例">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZoom((value) => Math.min(2, value + .1))} aria-label="放大" title="放大画布，最高可放至200%"><b>＋</b>放大</button>
              <button type="button" onClick={fitWholePedigree} title="自动缩放至当前画布可以看到完整家系图"><b>▣</b>适应全图</button>
            </div>
          </div>

          {snapHint && !dragDeleteReady && <div className={styles.snapHint}>{snapHint}</div>}
          {dragDeleteReady && <div className={styles.deleteDropZone}>已拖出画布边框，松手删除（可撤销）</div>}
          {selectedUnionPair && !snapHint && !dragDeleteReady && <div className={styles.lineContextPanel}>
            <span>已选 {selectedUnionPair[0].displayId}－{selectedUnionPair[1].displayId} 父母线</span>
            <button type="button" onClick={() => addRelative('son')}><b>□</b>男性同胞</button>
            <button type="button" onClick={() => addRelative('daughter')}><b>○</b>女性同胞</button>
            <button type="button" onClick={() => addRelative('unknown_child')}><b>◇</b>不详同胞</button>
            <button type="button" className={styles.closeLineSelection} onClick={() => setSelectedUnionKey(null)} aria-label="取消父母线选择">×</button>
          </div>}
          <div ref={viewportRef} className={`${styles.canvasViewport} ${dragDeleteReady ? styles.deleteArmed : ''}`} aria-label="家系画布，支持双指捏合缩放">
            <div className={styles.canvasStage} style={{ width: layout.width * zoom, height: layout.height * zoom }}>
              <svg id="pedigree-svg" className={styles.pedigreeSvg} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: layout.width * zoom, height: layout.height * zoom }} role="img" aria-label={`${activeCase.name}家系图`}>
                <defs>
                  <pattern id="pedigree-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#eef0f4" strokeWidth="1" /></pattern>
                  {layout.people.map((person) => (
                    <clipPath id={`clip-${person.id}`} key={`clip-${person.id}`}>
                      {person.sex === 'male' && <rect x={person.x - 18} y={person.y - 18} width="36" height="36" />}
                      {person.sex === 'female' && <circle cx={person.x} cy={person.y} r="18" />}
                      {person.sex === 'unknown' && <path d={`M ${person.x} ${person.y - 22} L ${person.x + 22} ${person.y} L ${person.x} ${person.y + 22} L ${person.x - 22} ${person.y} Z`} />}
                      {person.sex === 'pregnancy_loss' && <path d={`M ${person.x - 20} ${person.y - 16} L ${person.x + 20} ${person.y - 16} L ${person.x} ${person.y + 20} Z`} />}
                    </clipPath>
                  ))}
                </defs>
                <rect width="100%" height="100%" fill="#fff" />
                <rect width="100%" height="100%" fill="url(#pedigree-grid)" />
                <g aria-label="病例遗传信息" transform="translate(24 14)" pointerEvents="none">
                  <rect width={Math.min(layout.width - 48, 840)} height="45" rx="10" fill="#fbf1f7" stroke="#e7cddd" />
                  <text x="13" y="17" fontSize="11" fontWeight="800" fill="#8f176f">遗传模式：{activeCase.inheritance || '待确定'}</text>
                  <text x="13" y="34" fontSize="9" fill="#6f5b69">{shortPedigreeSummary}</text>
                </g>
                {alignmentGuide?.x !== undefined && <line x1={alignmentGuide.x} y1="18" x2={alignmentGuide.x} y2={layout.height - 86} className={styles.alignmentGuide} />}
                {alignmentGuide?.y !== undefined && <line x1="18" y1={alignmentGuide.y} x2={layout.width - 18} y2={alignmentGuide.y} className={styles.alignmentGuide} />}

                <g aria-label="亲缘关系" fill="none" stroke="#344054" strokeWidth="2">
                  {unionPairs.map(([key, pair]) => {
                    const [first, second] = pair;
                    const path = orthogonalUnionPath(first, second);
                    const selectedLine = selectedUnionKey === key;
                    return <g key={`union-${key}`} className={styles.unionControl} onClick={(event) => {
                      event.stopPropagation();
                      setSelectedUnionKey(key);
                      setSelectedId(first.id);
                      setNotice('父母连线已选中，可在上方直接增加男性、女性或不详同胞');
                    }}>
                      <path d={path} className={selectedLine ? styles.unionSelected : undefined} />
                      <path d={path} className={styles.unionHit} pointerEvents="stroke" />
                    </g>;
                  })}

                  {parentGroups.map(([key, children]) => {
                    const [fatherId, motherId] = key.split('|');
                    const father = positionedById.get(fatherId);
                    const mother = positionedById.get(motherId);
                    const availableParents = [father, mother].filter(Boolean) as PositionedPerson[];
                    if (!availableParents.length) return null;
                    const parentX = availableParents.reduce((sum, person) => sum + person.x, 0) / availableParents.length;
                    const parentY = availableParents.reduce((sum, person) => sum + person.y, 0) / availableParents.length;
                    const sortedChildren = [...children].sort((a, b) => a.x - b.x);
                    const siblingY = sortedChildren[0].y - 68;
                    const firstX = sortedChildren[0].x;
                    const lastX = sortedChildren[sortedChildren.length - 1].x;
                    const branchStartX = Math.min(parentX, firstX);
                    const branchEndX = Math.max(parentX, lastX);
                    return (
                      <g key={`parents-${key}`} pointerEvents="none">
                        <line x1={parentX} y1={parentY} x2={parentX} y2={siblingY} />
                        <line x1={branchStartX} y1={siblingY} x2={branchEndX} y2={siblingY} />
                        {sortedChildren.map((child) => <line key={`child-${child.id}`} x1={child.x} y1={siblingY} x2={child.x} y2={child.y - 22} />)}
                      </g>
                    );
                  })}
                </g>

                <g aria-label="家系成员">
                  {layout.people.map((person) => {
                    const isSelected = person.id === selectedId;
                    const baseFill = person.phenotype === 'affected' ? '#243047' : '#ffffff';
                    const stroke = isSelected ? '#a20d7b' : '#243047';
                    const strokeWidth = isSelected ? 3.5 : 2.2;
                    const statusLabel = phenotypeLabel(person.phenotype, person.sex);
                    const statusColor = person.phenotype === 'affected' ? '#b4233f' : person.phenotype === 'carrier' ? '#8f176f' : person.phenotype === 'unaffected' ? '#257965' : '#687386';
                    return (
                      <g key={person.id} className={styles.personNode} role="button" tabIndex={0} aria-label={`${person.displayId} ${person.sex} ${statusLabel}`} onClick={() => { setSelectedId(person.id); setSelectedUnionKey(null); }} onPointerDown={(event) => beginDrag(event, person)} onPointerMove={moveDrag} onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { setSelectedId(person.id); setSelectedUnionKey(null); } }}>
                        {isSelected && <circle cx={person.x} cy={person.y} r="29" fill="#f8eaf4" stroke="none" />}
                        {person.sex === 'male' && <rect x={person.x - 18} y={person.y - 18} width="36" height="36" rx="1" fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.sex === 'female' && <circle cx={person.x} cy={person.y} r="18" fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.sex === 'unknown' && <path d={`M ${person.x} ${person.y - 22} L ${person.x + 22} ${person.y} L ${person.x} ${person.y + 22} L ${person.x - 22} ${person.y} Z`} fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.sex === 'pregnancy_loss' && <path d={`M ${person.x - 20} ${person.y - 16} L ${person.x + 20} ${person.y - 16} L ${person.x} ${person.y + 20} Z`} fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.phenotype === 'carrier' && <rect x={person.x - 23} y={person.y - 24} width="23" height="48" fill="#687386" clipPath={`url(#clip-${person.id})`} />}
                        {person.phenotype === 'unknown' && person.sex !== 'pregnancy_loss' && <text x={person.x} y={person.y + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#687386">?</text>}
                        {person.deceased && person.sex !== 'pregnancy_loss' && <line x1={person.x - 25} y1={person.y + 25} x2={person.x + 25} y2={person.y - 25} stroke="#b4233f" strokeWidth="2.4" />}
                        {person.proband && <g fill="#a20d7b" stroke="#a20d7b"><path d={`M ${person.x - 49} ${person.y + 21} L ${person.x - 26} ${person.y + 5}`} strokeWidth="2.2" /><path d={`M ${person.x - 28} ${person.y + 4} l 2 8 l 6 -6 Z`} /></g>}
                        <text x={person.x} y={person.y + 46} textAnchor="middle" fontSize="12" fontWeight="800" fill={statusColor}>{person.displayId} · {statusLabel}{person.proband ? '  ←' : ''}</text>
                        <text x={person.x} y={person.y + 63} textAnchor="middle" fontSize="10" fill="#697386">{person.clinicalId || person.birthYear || '未录入'}</text>
                        {person.genotype && <text x={person.x} y={person.y + 78} textAnchor="middle" fontSize="9" fill="#8a526f">{person.genotype.length > 22 ? `${person.genotype.slice(0, 20)}…` : person.genotype}</text>}
                      </g>
                    );
                  })}
                </g>

                <g transform={`translate(34 ${layout.height - 54})`} fontSize="10" fill="#596273">
                  <rect x="0" y="-13" width="20" height="20" fill="#fff" stroke="#243047" strokeWidth="2" /><text x="28" y="2">男性</text>
                  <circle cx="91" cy="-3" r="10" fill="#fff" stroke="#243047" strokeWidth="2" /><text x="109" y="2">女性</text>
                  <rect x="169" y="-13" width="20" height="20" fill="#243047" /><text x="197" y="2">患病</text>
                  <rect x="254" y="-13" width="20" height="20" fill="#fff" stroke="#243047" strokeWidth="2" /><rect x="254" y="-13" width="10" height="20" fill="#687386" /><text x="282" y="2">携带者</text>
                  <path d="M 356 -13 L 366 -3 L 356 7 L 346 -3 Z" fill="#fff" stroke="#243047" strokeWidth="2" /><text x="374" y="2">性别不详</text>
                  <path d="M 448 -12 L 466 -12 L 457 6 Z" fill="#fff" stroke="#243047" strokeWidth="2" /><text x="474" y="2">妊娠丢失</text>
                  <text x="548" y="2" fontWeight="700" fill="#a20d7b">← 先证者</text>
                </g>
              </svg>
            </div>
          </div>
          <div className={styles.canvasHint}><span>新增成员会在当前关系附近出现，不再跳到画布底部</span><span>最低缩至10%；点“适应全图”可一键查看完整家系</span></div>
        </main>

        <aside className={styles.inspector}>
          <div className={styles.inspectorHeading}><div><span>成员资料</span><b>{selected ? positionedById.get(selected.id)?.displayId : '未选择'}</b></div>{selected && <button type="button" onClick={removeSelected} aria-label="删除成员">删除</button>}</div>
          {selected ? (
            <div className={styles.inspectorForm}>
              <label><span>病例编号</span><input value={selected.clinicalId} placeholder="建议使用去标识化编号" onChange={(event) => updatePerson({ clinicalId: event.target.value })} /></label>
              <label><span>姓名 / 备注名</span><input value={selected.name} placeholder="可留空" onChange={(event) => updatePerson({ name: event.target.value })} /></label>
              <fieldset><legend>个体符号（无需删除，点一下直接更正）</legend><div className={`${styles.segmented} ${styles.symbolGrid}`}>{(['male', 'female', 'unknown', 'pregnancy_loss'] as Sex[]).map((value) => <button type="button" className={selected.sex === value ? styles.selectedSegment : ''} key={value} onClick={() => correctSelectedSymbol(value)}>{value === 'male' ? '□ 男' : value === 'female' ? '○ 女' : value === 'unknown' ? '◇ 性别不详' : '▽ 妊娠丢失'}</button>)}</div></fieldset>
              <fieldset><legend>表型 / 携带状态（直接显示在图中）</legend><div className={`${styles.segmented} ${styles.statusGrid}`}>{(['unaffected', 'affected', 'carrier', 'unknown'] as Phenotype[]).map((value) => <button type="button" className={selected.phenotype === value ? styles.selectedSegment : ''} key={value} onClick={() => updatePerson({ phenotype: value }, `已在图中标注：${phenotypeLabel(value)}`)}>{phenotypeLabel(value)}</button>)}</div></fieldset>
              <div className={styles.geneticsNote}><span>遗传模式 ≠ 个体状态</span><p>上方“显性/隐性”属于本病例的疾病－基因遗传模式；这里的“患病、未患病、携带者”属于每位成员，需结合临床表型、合子状态和家系验证人工确认，不能只凭位点名称自动判定。</p></div>
              <div className={styles.checkRow}><label><input type="checkbox" checked={selected.proband} onChange={(event) => {
                const checked = event.target.checked;
                commit((current) => ({ ...current, people: current.people.map((person) => ({ ...person, proband: person.id === selected.id ? checked : checked ? false : person.proband })) }));
              }} />设为先证者</label><label><input type="checkbox" checked={selected.deceased} disabled={selected.sex === 'pregnancy_loss'} onChange={(event) => updatePerson({ deceased: event.target.checked })} />已故</label></div>
              <div className={styles.twoColumns}><label><span>出生年</span><input inputMode="numeric" value={selected.birthYear} placeholder="YYYY" onChange={(event) => updatePerson({ birthYear: event.target.value })} /></label><label><span>年龄</span><input value={selected.birthYear && /^\d{4}$/.test(selected.birthYear) ? String(new Date().getFullYear() - Number(selected.birthYear)) : ''} disabled placeholder="自动" /></label></div>
              <label><span>临床诊断 / 表型</span><textarea rows={2} value={selected.diagnosis} placeholder="发病年龄、主要表型等" onChange={(event) => updatePerson({ diagnosis: event.target.value })} /></label>
              <label><span>基因型</span><input value={selected.genotype} placeholder="例：c.235delC/-" onChange={(event) => updatePerson({ genotype: event.target.value })} /></label>
              <label><span>遗传咨询备注</span><textarea rows={3} value={selected.notes} placeholder="检测情况、样本可获得性、关键沟通点…" onChange={(event) => updatePerson({ notes: event.target.value })} /></label>
              <div className={styles.relationSummary}><span>关系摘要</span><p>{selected.fatherId ? '已录入父亲' : '父亲未录入'} · {selected.motherId ? '已录入母亲' : '母亲未录入'} · {selected.spouseIds.length} 位配偶。关系不对时，将成员拖到正确配偶线或父母支线附近松手即可重接。</p></div>
            </div>
          ) : <div className={styles.emptyInspector}><span>◇</span><p>点选图中成员后编辑资料</p></div>}
        </aside>
      </div>
      {showGuide && <div className={styles.guideBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGuide(false); }}>
        <section className={styles.guideDialog} role="dialog" aria-modal="true" aria-labelledby="pedigree-guide-title">
          <header><div><span>家系图符号与操作</span><h2 id="pedigree-guide-title">先认符号，再建关系</h2></div><button type="button" onClick={() => setShowGuide(false)} aria-label="关闭说明">×</button></header>
          <div className={styles.guideSymbols}>
            <div><i className={`${styles.guideShape} ${styles.guideMale}`} /><p><b>男性</b><small>方形 □</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideFemale}`} /><p><b>女性</b><small>圆形 ○</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideUnknown}`} /><p><b>性别不详</b><small>菱形 ◇</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideLoss}`} /><p><b>妊娠丢失</b><small>倒三角 ▽</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideAffected}`} /><p><b>患病个体</b><small>符号全填充</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideCarrier}`} /><p><b>携带者</b><small>符号半填充</small></p></div>
            <div><i className={`${styles.guideShape} ${styles.guideDeceased}`} /><p><b>已故</b><small>斜线贯穿符号</small></p></div>
            <div><i className={styles.guideProband}>←</i><p><b>先证者</b><small>箭头指向个体</small></p></div>
          </div>
          <div className={styles.guideTools} aria-label="顶部工具按钮说明">
            <div><b>□ 父亲 / ○ 母亲</b><small>为当前成员增加上一代父母；夫妻双方父母会分别向左右独立展开，不自动混接。</small></div>
            <div><b>∞ 配偶</b><small>在当前成员同一层就近增加配偶并建立配偶线。</small></div>
            <div><b>≡ 同胞</b><small>增加共享同一父母的兄弟姐妹，不建立同胞配偶线。</small></div>
            <div><b>▣ 儿子 / ◉ 女儿</b><small>为当前成员及其配偶增加下一代子女。</small></div>
            <div><b>◇ 不详 / ▽ 妊娠丢失</b><small>增加性别不详子代或妊娠丢失记录。</small></div>
            <div><b>✦ 排版 / ⌫ 删除 / ▣ 全图</b><small>恢复自动排版、删除所选成员，或一键查看完整图谱。</small></div>
          </div>
          <div className={styles.guideSteps}>
            <div><b>1. 建立关系</b><p>先点选成员，再点“父亲、母亲、配偶、儿子、女儿”等文字按钮；新增成员会在当前关系附近逐层出现。点父母中间连线可快速增加同胞。</p></div>
            <div><b>2. 调整与查看</b><p>拖成员时画布锁定，纵向偏差约5%以内强制拉直。双指或加减按钮缩放范围为10%–200%；“适应全图”可自动缩放到完整图谱。</p></div>
            <div><b>3. 遗传模式与个体状态</b><p>选择疾病后按 GenCC 证据默认显性/隐性遗传模式，并把基因、位点显示在图内。再点选每位成员，用顶部“个体状态”标注患病、未患病、携带者或不明。</p></div>
          </div>
          <footer><span>提示：“236位点”等口头简称必须核对，系统统一按标准 HGVS 显示，例如 GJB2 c.235delC。</span><button type="button" onClick={() => setShowGuide(false)}>知道了</button></footer>
        </section>
      </div>}
    </section>
  );
}
