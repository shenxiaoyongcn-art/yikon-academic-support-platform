'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import styles from './pedigree-workspace.module.css';

type Sex = 'male' | 'female' | 'unknown';
type Phenotype = 'unaffected' | 'affected' | 'carrier' | 'unknown';

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
};

type PedigreeCase = {
  id: string;
  name: string;
  gene: string;
  inheritance: string;
  updatedAt: string;
  people: Person[];
};

type PositionedPerson = Person & {
  x: number;
  y: number;
  generation: number;
  displayId: string;
};

const STORAGE_KEY = 'yikon-pedigree-cases-v1';
const SVG_NODE_SIZE = 36;

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString();
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
    gene: 'GJB2',
    inheritance: '常染色体隐性',
    updatedAt: isoNow(),
    people,
  };
}

function blankCase(): PedigreeCase {
  const personId = makeId('person');
  return {
    id: makeId('case'),
    name: '未命名家系',
    gene: '',
    inheritance: '待确定',
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
  const height = Math.max(590, (maxGeneration + 1) * 190 + 120);
  const positioned: PositionedPerson[] = [];

  orderedGroups.forEach((members, level) => {
    const gap = Math.min(170, (width - 150) / Math.max(members.length - 1, 1));
    const startX = members.length === 1 ? width / 2 : (width - gap * (members.length - 1)) / 2;
    members.forEach((person, index) => {
      positioned.push({
        ...person,
        x: startX + index * gap,
        y: 88 + level * 190,
        generation: level,
        displayId: `${roman(level)}-${index + 1}`,
      });
    });
  });

  return { people: positioned, width, height };
}

function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as PedigreeCase[];
        if (Array.isArray(parsed) && parsed.length) {
          setCases(parsed);
          setActiveCaseId(parsed[0].id);
          setSelectedId(parsed[0].people.find((person) => person.proband)?.id || parsed[0].people[0]?.id || '');
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

  const filteredCases = cases.filter((item) => `${item.name} ${item.gene}`.toLowerCase().includes(query.toLowerCase()));

  const commit = (updater: (value: PedigreeCase) => PedigreeCase, message = '已保存') => {
    setCases((currentCases) => {
      const current = currentCases.find((item) => item.id === activeCaseId);
      if (!current) return currentCases;
      setHistory((items) => [...items.slice(-39), structuredClone(current)]);
      setFuture([]);
      const next = { ...updater(structuredClone(current)), updatedAt: isoNow() };
      return currentCases.map((item) => item.id === activeCaseId ? next : item);
    });
    setNotice(message);
  };

  const updatePerson = (patch: Partial<Person>) => {
    if (!selected) return;
    commit((current) => ({
      ...current,
      people: current.people.map((person) => person.id === selected.id ? { ...person, ...patch } : person),
    }));
  };

  const addRelative = (kind: 'father' | 'mother' | 'spouse' | 'son' | 'daughter' | 'sibling') => {
    if (!selected) {
      setNotice('请先选中一位成员');
      return;
    }
    if (kind === 'father' && selected.fatherId) return setNotice('该成员已有父亲记录');
    if (kind === 'mother' && selected.motherId) return setNotice('该成员已有母亲记录');
    if (kind === 'sibling' && !selected.fatherId && !selected.motherId) return setNotice('请先添加父亲或母亲，再添加同胞');

    const id = makeId('person');
    const newPerson: Person = {
      id,
      name: '',
      sex: kind === 'father' || kind === 'son' ? 'male' : kind === 'mother' || kind === 'daughter' ? 'female' : 'unknown',
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
    };

    commit((current) => {
      const target = current.people.find((person) => person.id === selected.id)!;
      if (kind === 'father') {
        target.fatherId = id;
        if (target.motherId) {
          newPerson.spouseIds = [target.motherId];
          const mother = current.people.find((person) => person.id === target.motherId);
          if (mother && !mother.spouseIds.includes(id)) mother.spouseIds.push(id);
        }
      }
      if (kind === 'mother') {
        target.motherId = id;
        if (target.fatherId) {
          newPerson.spouseIds = [target.fatherId];
          const father = current.people.find((person) => person.id === target.fatherId);
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
      if (kind === 'son' || kind === 'daughter') {
        const spouse = current.people.find((person) => target.spouseIds.includes(person.id));
        if (target.sex === 'female') newPerson.motherId = target.id;
        else newPerson.fatherId = target.id;
        if (spouse?.sex === 'female') newPerson.motherId = spouse.id;
        else if (spouse) newPerson.fatherId = spouse.id;
      }
      return { ...current, people: [...current.people, newPerson] };
    }, '新成员已添加');
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selected || activeCase.people.length === 1) return setNotice('家系至少需保留一位成员');
    const fallback = activeCase.people.find((person) => person.id !== selected.id)?.id || '';
    commit((current) => ({
      ...current,
      people: current.people
        .filter((person) => person.id !== selected.id)
        .map((person) => ({
          ...person,
          fatherId: person.fatherId === selected.id ? undefined : person.fatherId,
          motherId: person.motherId === selected.id ? undefined : person.motherId,
          spouseIds: person.spouseIds.filter((id) => id !== selected.id),
        })),
    }), '成员已删除');
    setSelectedId(fallback);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || !activeCase) return;
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [...items, structuredClone(activeCase)]);
    setCases((items) => items.map((item) => item.id === activeCaseId ? previous : item));
    setNotice('已撤销上一步');
  };

  const redo = () => {
    const next = future.at(-1);
    if (!next || !activeCase) return;
    setFuture((items) => items.slice(0, -1));
    setHistory((items) => [...items, structuredClone(activeCase)]);
    setCases((items) => items.map((item) => item.id === activeCaseId ? next : item));
    setNotice('已恢复操作');
  };

  const createCase = () => {
    const next = blankCase();
    setCases((items) => [next, ...items]);
    setActiveCaseId(next.id);
    setSelectedId(next.people[0].id);
    setHistory([]);
    setFuture([]);
    setNotice('已创建新家系');
  };

  const selectCase = (item: PedigreeCase) => {
    setActiveCaseId(item.id);
    setSelectedId(item.people.find((person) => person.proband)?.id || item.people[0]?.id || '');
    setHistory([]);
    setFuture([]);
    setZoom(1);
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
        const next = { ...parsed, id: makeId('case'), updatedAt: isoNow() };
        setCases((items) => [next, ...items]);
        setActiveCaseId(next.id);
        setSelectedId(next.people.find((person) => person.proband)?.id || next.people[0]?.id || '');
        setNotice('家系数据已导入');
      } catch {
        setNotice('导入失败：请选择本工具导出的 JSON 文件');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const parentGroups = useMemo(() => {
    const groups = new Map<string, PositionedPerson[]>();
    layout.people.forEach((person) => {
      if (!person.fatherId && !person.motherId) return;
      const key = `${person.fatherId || ''}|${person.motherId || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(person);
    });
    return Array.from(groups.entries());
  }, [layout.people]);

  if (!activeCase) return null;

  return (
    <section className={styles.pedigreeApp}>
      <header className={styles.appHeader}>
        <div>
          <p>业务工作台 / 遗传咨询 / 家系图工具</p>
          <h1>遗传家系图</h1>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.saveState}><i />{notice}</span>
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
        <label><span>目标基因</span><input value={activeCase.gene} placeholder="例：F8 / DMD / BRCA1" onChange={(event) => commit((item) => ({ ...item, gene: event.target.value }))} /></label>
        <label><span>遗传模式</span><select value={activeCase.inheritance} onChange={(event) => commit((item) => ({ ...item, inheritance: event.target.value }))}><option>待确定</option><option>常染色体显性</option><option>常染色体隐性</option><option>X连锁显性</option><option>X连锁隐性</option><option>Y连锁</option><option>线粒体遗传</option><option>多因素/未知</option></select></label>
        <div className={styles.privacyNote}><b>本地模式</b><span>病例数据仅保存在当前浏览器</span></div>
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
              <button type="button" onClick={() => addRelative('father')}><b>□</b>父亲</button>
              <button type="button" onClick={() => addRelative('mother')}><b>○</b>母亲</button>
              <button type="button" onClick={() => addRelative('spouse')}><b>∞</b>配偶</button>
              <button type="button" onClick={() => addRelative('sibling')}><b>≡</b>同胞</button>
              <button type="button" onClick={() => addRelative('son')}><b>▣</b>儿子</button>
              <button type="button" onClick={() => addRelative('daughter')}><b>◉</b>女儿</button>
            </div>
            <div className={styles.toolGroup}>
              <button type="button" disabled={!history.length} onClick={undo} aria-label="撤销">↶</button>
              <button type="button" disabled={!future.length} onClick={redo} aria-label="恢复">↷</button>
              <span className={styles.divider} />
              <button type="button" onClick={() => setZoom((value) => Math.max(.65, value - .1))} aria-label="缩小">−</button>
              <button type="button" className={styles.zoomValue} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + .1))} aria-label="放大">+</button>
            </div>
          </div>

          <div className={styles.canvasViewport}>
            <div className={styles.canvasStage} style={{ width: layout.width * zoom, height: layout.height * zoom }}>
              <svg id="pedigree-svg" className={styles.pedigreeSvg} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: layout.width * zoom, height: layout.height * zoom }} role="img" aria-label={`${activeCase.name}家系图`}>
                <defs>
                  <pattern id="pedigree-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#eef0f4" strokeWidth="1" /></pattern>
                  {layout.people.map((person) => (
                    <clipPath id={`clip-${person.id}`} key={`clip-${person.id}`}>
                      {person.sex === 'male' && <rect x={person.x - 18} y={person.y - 18} width="36" height="36" />}
                      {person.sex === 'female' && <circle cx={person.x} cy={person.y} r="18" />}
                      {person.sex === 'unknown' && <path d={`M ${person.x} ${person.y - 22} L ${person.x + 22} ${person.y} L ${person.x} ${person.y + 22} L ${person.x - 22} ${person.y} Z`} />}
                    </clipPath>
                  ))}
                </defs>
                <rect width="100%" height="100%" fill="#fff" />
                <rect width="100%" height="100%" fill="url(#pedigree-grid)" />

                <g aria-label="亲缘关系" fill="none" stroke="#344054" strokeWidth="2">
                  {layout.people.flatMap((person) => person.spouseIds
                    .filter((spouseId) => person.id < spouseId)
                    .map((spouseId) => {
                      const spouse = positionedById.get(spouseId);
                      if (!spouse) return null;
                      const left = person.x < spouse.x ? person : spouse;
                      const right = person.x < spouse.x ? spouse : person;
                      return <line key={`spouse-${person.id}-${spouseId}`} x1={left.x + SVG_NODE_SIZE / 2} y1={left.y} x2={right.x - SVG_NODE_SIZE / 2} y2={right.y} />;
                    }))}

                  {parentGroups.map(([key, children]) => {
                    const [fatherId, motherId] = key.split('|');
                    const father = positionedById.get(fatherId);
                    const mother = positionedById.get(motherId);
                    const availableParents = [father, mother].filter(Boolean) as PositionedPerson[];
                    if (!availableParents.length) return null;
                    const parentX = availableParents.reduce((sum, person) => sum + person.x, 0) / availableParents.length;
                    const parentY = Math.max(...availableParents.map((person) => person.y));
                    const sortedChildren = [...children].sort((a, b) => a.x - b.x);
                    const siblingY = sortedChildren[0].y - 68;
                    const firstX = sortedChildren[0].x;
                    const lastX = sortedChildren.at(-1)!.x;
                    return (
                      <g key={`parents-${key}`}>
                        <line x1={parentX} y1={parentY} x2={parentX} y2={siblingY} />
                        {sortedChildren.length > 1 && <line x1={firstX} y1={siblingY} x2={lastX} y2={siblingY} />}
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
                    return (
                      <g key={person.id} className={styles.personNode} role="button" tabIndex={0} aria-label={`${person.displayId} ${person.sex}`} onClick={() => setSelectedId(person.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(person.id); }}>
                        {isSelected && <circle cx={person.x} cy={person.y} r="29" fill="#f8eaf4" stroke="none" />}
                        {person.sex === 'male' && <rect x={person.x - 18} y={person.y - 18} width="36" height="36" rx="1" fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.sex === 'female' && <circle cx={person.x} cy={person.y} r="18" fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.sex === 'unknown' && <path d={`M ${person.x} ${person.y - 22} L ${person.x + 22} ${person.y} L ${person.x} ${person.y + 22} L ${person.x - 22} ${person.y} Z`} fill={baseFill} stroke={stroke} strokeWidth={strokeWidth} />}
                        {person.phenotype === 'carrier' && <rect x={person.x - 23} y={person.y - 24} width="23" height="48" fill="#687386" clipPath={`url(#clip-${person.id})`} />}
                        {person.phenotype === 'unknown' && <text x={person.x} y={person.y + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#687386">?</text>}
                        {person.deceased && <line x1={person.x - 25} y1={person.y + 25} x2={person.x + 25} y2={person.y - 25} stroke="#b4233f" strokeWidth="2.4" />}
                        {person.proband && <g fill="#a20d7b" stroke="#a20d7b"><path d={`M ${person.x - 49} ${person.y + 21} L ${person.x - 26} ${person.y + 5}`} strokeWidth="2.2" /><path d={`M ${person.x - 28} ${person.y + 4} l 2 8 l 6 -6 Z`} /></g>}
                        <text x={person.x} y={person.y + 46} textAnchor="middle" fontSize="13" fontWeight="700" fill="#253047">{person.displayId}{person.proband ? '  ←' : ''}</text>
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
                  <text x="356" y="2" fontWeight="700" fill="#a20d7b">← 先证者</text>
                </g>
              </svg>
            </div>
          </div>
          <div className={styles.canvasHint}><span>先点选成员，再添加关系</span><span>系谱编号随排版自动生成</span></div>
        </main>

        <aside className={styles.inspector}>
          <div className={styles.inspectorHeading}><div><span>成员资料</span><b>{selected ? positionedById.get(selected.id)?.displayId : '未选择'}</b></div>{selected && <button type="button" onClick={removeSelected} aria-label="删除成员">删除</button>}</div>
          {selected ? (
            <div className={styles.inspectorForm}>
              <label><span>病例编号</span><input value={selected.clinicalId} placeholder="建议使用去标识化编号" onChange={(event) => updatePerson({ clinicalId: event.target.value })} /></label>
              <label><span>姓名 / 备注名</span><input value={selected.name} placeholder="可留空" onChange={(event) => updatePerson({ name: event.target.value })} /></label>
              <fieldset><legend>性别</legend><div className={styles.segmented}>{(['male', 'female', 'unknown'] as Sex[]).map((value) => <button type="button" className={selected.sex === value ? styles.selectedSegment : ''} key={value} onClick={() => updatePerson({ sex: value })}>{value === 'male' ? '□ 男' : value === 'female' ? '○ 女' : '◇ 未知'}</button>)}</div></fieldset>
              <fieldset><legend>表型 / 携带状态</legend><div className={`${styles.segmented} ${styles.statusGrid}`}>{(['unaffected', 'affected', 'carrier', 'unknown'] as Phenotype[]).map((value) => <button type="button" className={selected.phenotype === value ? styles.selectedSegment : ''} key={value} onClick={() => updatePerson({ phenotype: value })}>{value === 'unaffected' ? '未患病' : value === 'affected' ? '患病' : value === 'carrier' ? '携带者' : '不明'}</button>)}</div></fieldset>
              <div className={styles.checkRow}><label><input type="checkbox" checked={selected.proband} onChange={(event) => {
                const checked = event.target.checked;
                commit((current) => ({ ...current, people: current.people.map((person) => ({ ...person, proband: person.id === selected.id ? checked : checked ? false : person.proband })) }));
              }} />设为先证者</label><label><input type="checkbox" checked={selected.deceased} onChange={(event) => updatePerson({ deceased: event.target.checked })} />已故</label></div>
              <div className={styles.twoColumns}><label><span>出生年</span><input inputMode="numeric" value={selected.birthYear} placeholder="YYYY" onChange={(event) => updatePerson({ birthYear: event.target.value })} /></label><label><span>年龄</span><input value={selected.birthYear && /^\d{4}$/.test(selected.birthYear) ? String(new Date().getFullYear() - Number(selected.birthYear)) : ''} disabled placeholder="自动" /></label></div>
              <label><span>临床诊断 / 表型</span><textarea rows={2} value={selected.diagnosis} placeholder="发病年龄、主要表型等" onChange={(event) => updatePerson({ diagnosis: event.target.value })} /></label>
              <label><span>基因型</span><input value={selected.genotype} placeholder="例：c.235delC/-" onChange={(event) => updatePerson({ genotype: event.target.value })} /></label>
              <label><span>遗传咨询备注</span><textarea rows={3} value={selected.notes} placeholder="检测情况、样本可获得性、关键沟通点…" onChange={(event) => updatePerson({ notes: event.target.value })} /></label>
              <div className={styles.relationSummary}><span>关系摘要</span><p>{selected.fatherId ? '已录入父亲' : '父亲未录入'} · {selected.motherId ? '已录入母亲' : '母亲未录入'} · {selected.spouseIds.length} 位配偶</p></div>
            </div>
          ) : <div className={styles.emptyInspector}><span>◇</span><p>点选图中成员后编辑资料</p></div>}
        </aside>
      </div>
    </section>
  );
}
