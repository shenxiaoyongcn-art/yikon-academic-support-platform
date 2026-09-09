import { ChangeEvent, PointerEvent, WheelEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addChild, addParents, addSibling, addTwin, addUnion, defaultSpouseGender, emptyPedigree, initialPedigree, makeId, moveSibling, newPerson, removeParentage, removePerson, removeUnion, validatePedigree } from "./model";
import { computeLayout } from './layout';
import { restorePedigreeDraft, SVG_PEDIGREE_STORAGE_KEY } from './persistence';
import type { CarrierStatus, Pedigree, Person, PersonType } from './types';

const symbolSize = 32;
const exportStyle = `svg{font-family:"Microsoft YaHei UI","Microsoft YaHei",Arial,sans-serif;background:#fff}.person-shape,.legend-shape{fill:#fff;stroke:#1c263e;stroke-width:2}.affected{fill:#161a25}.carrier-dot{fill:#fff;stroke:#1c263e;stroke-width:1.7}.deceased,.marker-arrow,.relationship line,.descent line,.twin line{stroke:#1e2a43;stroke-width:1.8;fill:none}.person-number{font-size:13px;fill:#14203a;font-weight:750}.person-text{font-size:12px;fill:#293956}.export-title{font-size:24px;font-weight:750;fill:#101b31}.legend{font-size:12px;fill:#273651}.legend-title{font-size:14px;font-weight:750}.relationship-note{font-size:11px;fill:#5c3c72;font-weight:700}.marker-label{font-size:11px;fill:#18243d;font-weight:700}`;
let unrecoveredDraft: string | null = null;

type Language = "cn" | "en";

const copy = {
  cn: {
    app: "家系图编辑器", subtitle: "SVG · 本地保存 · V1", pedigreeName: "家系图名称", new: "新建", sample: "载入示例", importJson: "导入 JSON", exportJson: "导出 JSON", exportSvg: "导出 SVG", exportPng: "导出 PNG", undo: "撤销", redo: "重做", fit: "适应", canvas: "家系图画布", unnamed: "未命名家系图", legend: "图例", male: "男", female: "女", unknownGender: "性别不详", affected: "患病", arCarrier: "AR 携带（半黑）", xlrCarrier: "XLR 携带（圆点）", legendNote: "传统教学画法：AR 半黑，X 连锁隐性携带者圆点；组合状态见文字标注。",
    editor: "个体编辑", selectPerson: "点击画布中的个体进行编辑。", selectRelationship: "关系线可点击编辑近亲婚配及说明。", stableId: "稳定 ID", name: "姓名/备注名", gender: "性别", personType: "个体类型", normalPerson: "普通个体", miscarriage: "自然流产", diseaseStatus: "患病状态", diseaseUnknown: "不详", unaffected: "未患病", marker: "身份标记", none: "无", proband: "先证者", consultand: "咨询者", gestationalAge: "孕周", carrier: "携带状态", ar: "AR 隐性携带", xlr: "X 连锁隐性携带", carrierNone: "未记录携带状态；这不代表检测阴性。", deceased: "已死亡", deathNote: "死亡年龄/年份", genotype: "基因型", variants: "变异", phenotypes: "其他表型（可多行）", annotationLines: "图中注释行", annotationHelp: "仅这些行显示在自动编号下方。姓名、死亡、孕周、基因型、变异和表型均不会自动显示。", addLine: "添加一行", removeLine: "删除", emptyLine: "在图中显示的内容", warning: "先证者通常应为患者；当前记录保留原值，请核对是否应改为“咨询者”。", addRelatives: "添加亲属", addSpouse: "添加配偶", connectExisting: "连接已有个体", addParents: "添加父母", addSibling: "添加兄弟姐妹", addChild: "添加子女", addMiscarriage: "添加自然流产", addMonozygotic: "添加同卵双胎", addDizygotic: "添加异卵双胎", addTwinUnknown: "添加双胎（卵性不详）", siblingLeft: "同胞左移", siblingRight: "同胞右移", removeParentage: "解除父母关系", removeUnion: "解除婚配关系", removePerson: "删除无关系个体", layout: "画布布局", horizontalSpacing: "横向间距", generationSpacing: "代间距", restoreLayout: "恢复自动布局",
    saved: "已自动保存到当前浏览器。", draft: "草稿保存在当前浏览器。", saveFailed: "浏览器草稿保存失败，请立即导出 JSON。", updated: "已更新。", personUpdated: "个体资料已更新。", annotationUpdated: "图中注释行已更新。", language: "EN", consultandMark: "咨询者", relationshipPrompt: "近亲婚配说明（留空表示无说明）：", relationshipUpdated: "已更新婚配关系。", newConfirm: "新建会替换当前草稿。是否继续？", sampleConfirm: "载入示例会替换当前草稿。是否继续？", importConfirm: "导入将替换当前草稿。建议先导出 JSON。是否继续？", newCreated: "已创建新家系图。", sampleLoaded: "已载入虚构示例。", undoDone: "已撤销。", redoDone: "已重做。", draftBroken: "检测到无法恢复的 SVG 编辑器草稿，尚未覆盖。", downloadBroken: "下载原始草稿", discardBroken: "放弃并继续", brokenDiscarded: "已放弃损坏草稿，可继续保存新图。", legacyDraft: "检测到旧版平台家系图草稿。新编辑器不会覆盖它；请下载保存后再继续。", downloadLegacy: "下载旧版草稿", dismissLegacy: "暂时隐藏提示"
  },
  en: {
    app: "Pedigree Editor", subtitle: "SVG · Local draft · V1", pedigreeName: "Pedigree title", new: "New", sample: "Load example", importJson: "Import JSON", exportJson: "Export JSON", exportSvg: "Export SVG", exportPng: "Export PNG", undo: "Undo", redo: "Redo", fit: "Fit", canvas: "Pedigree canvas", unnamed: "Untitled pedigree", legend: "Legend", male: "Male", female: "Female", unknownGender: "Sex unknown", affected: "Affected", arCarrier: "AR carrier (half-filled)", xlrCarrier: "X-linked carrier (dot)", legendNote: "Traditional teaching notation: AR carriers are half-filled; X-linked recessive carriers have a central dot.",
    editor: "Person editor", selectPerson: "Select a person on the canvas to edit.", selectRelationship: "Select a relationship line to edit consanguinity and its note.", stableId: "Stable ID", name: "Name / internal note", gender: "Sex", personType: "Person type", normalPerson: "Person", miscarriage: "Spontaneous miscarriage", diseaseStatus: "Disease status", diseaseUnknown: "Unknown", unaffected: "Unaffected", marker: "Identity marker", none: "None", proband: "Proband", consultand: "Consultand", gestationalAge: "Gestational age", carrier: "Carrier status", ar: "AR carrier", xlr: "X-linked recessive carrier", carrierNone: "No carrier status recorded; this does not mean a negative test.", deceased: "Deceased", deathNote: "Age / year of death", genotype: "Genotype", variants: "Variant(s)", phenotypes: "Other phenotypes (multiline)", annotationLines: "Displayed annotation lines", annotationHelp: "Only these lines appear below the automatic generation number. Name, death, gestational age, genotype, variants, and phenotypes are never displayed automatically.", addLine: "Add line", removeLine: "Remove", emptyLine: "Text shown on the pedigree", warning: "A proband is usually affected. This record is retained; confirm whether Consultand is more appropriate.", addRelatives: "Add relatives", addSpouse: "Add spouse", connectExisting: "Connect existing person", addParents: "Add parents", addSibling: "Add sibling", addChild: "Add child", addMiscarriage: "Add miscarriage", addMonozygotic: "Add monozygotic twins", addDizygotic: "Add dizygotic twins", addTwinUnknown: "Add twins (zygosity unknown)", siblingLeft: "Move sibling left", siblingRight: "Move sibling right", removeParentage: "Remove parentage", removeUnion: "Remove union", removePerson: "Delete unrelated person", layout: "Canvas layout", horizontalSpacing: "Horizontal spacing", generationSpacing: "Generation spacing", restoreLayout: "Restore automatic layout",
    saved: "Saved automatically in this browser.", draft: "Draft stored in this browser.", saveFailed: "Browser draft could not be saved. Export JSON now.", updated: "Updated.", personUpdated: "Person details updated.", annotationUpdated: "Displayed annotation lines updated.", language: "CN", consultandMark: "Consultand", relationshipPrompt: "Consanguinity note (leave empty for none):", relationshipUpdated: "Relationship updated.", newConfirm: "Creating a new pedigree replaces the current draft. Continue?", sampleConfirm: "Loading the example replaces the current draft. Continue?", importConfirm: "Import replaces the current draft. Export JSON first if needed. Continue?", newCreated: "New pedigree created.", sampleLoaded: "Fictional example loaded.", undoDone: "Undone.", redoDone: "Redone.", draftBroken: "An unrecoverable SVG editor draft was found and has not been overwritten.", downloadBroken: "Download original draft", discardBroken: "Discard and continue", brokenDiscarded: "Damaged draft discarded. You can save a new pedigree.", legacyDraft: "A legacy platform pedigree draft was found. The new editor will not overwrite it; download it before continuing.", downloadLegacy: "Download legacy draft", dismissLegacy: "Hide this notice"
  }
} as const;

function deepCopy<T>(value: T): T { return structuredClone(value); }

function persistDraft(pedigree: Pedigree): boolean {
  if (unrecoveredDraft) return true;
  try {
    localStorage.setItem(SVG_PEDIGREE_STORAGE_KEY, JSON.stringify(pedigree));
    return true;
  } catch {
    return false;
  }
}

function safeFilename(value: string): string {
  const clean = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return clean || "家系图";
}

function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const element = document.createElement("a");
  element.href = url; element.download = name; element.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function carrierText(person: Person, language: Language) {
  const values: string[] = [];
  if (person.carrier.ar) values.push(language === "en" ? "AR carrier" : "AR携带");
  if (person.carrier.xlr) values.push(language === "en" ? "XLR carrier" : "XLR携带");
  return values.join(language === "en" ? "; " : "；");
}

function defaultZoomForViewport() {
  return window.innerWidth <= 760 ? 0.5 : 1;
}

function PersonSymbol({ person, x, y, selected, onSelect, onDragStart, language }: { person: Person; x: number; y: number; selected: boolean; onSelect: () => void; onDragStart: (event: PointerEvent<SVGGElement>) => void; language: Language }) {
  const clipId = `clip-${person.id}`;
  const shape = person.type === "sab"
    ? <path d={`M ${x} ${y - 15} L ${x - 15} ${y + 14} L ${x + 15} ${y + 14} Z`} />
    : person.gender === "male"
      ? <rect x={x - 16} y={y - 16} width="32" height="32" />
      : person.gender === "female"
        ? <circle cx={x} cy={y} r="16" />
        : <path d={`M ${x} ${y - 18} L ${x + 18} ${y} L ${x} ${y + 18} L ${x - 18} ${y} Z`} />;
  const isAffected = person.diseaseStatus === "affected";
  return <g className={selected ? "person selected" : "person"} onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerDown={onDragStart} role="button" tabIndex={0}>
    <rect className="person-hitbox" x={x - 25} y={y - 25} width="50" height="50" />
    <clipPath id={clipId}>{shape}</clipPath>
    <g clipPath={`url(#${clipId})`}>
      {isAffected && <rect className="affected" fill="#161a25" x={x - 20} y={y - 20} width="40" height="40" />}
      {!isAffected && person.carrier.ar && <rect className="affected" fill="#161a25" x={x - 20} y={y - 20} width="20" height="40" />}
    </g>
    <g className="person-shape">{shape}</g>
    {person.carrier.xlr && <circle className="carrier-dot" cx={x} cy={y} r="4.5" />}
    {isAffected && (person.carrier.ar || person.carrier.xlr) && <text className="carrier-note" x={x + 23} y={y - 20}>{person.carrier.ar ? "AR" : ""}{person.carrier.ar && person.carrier.xlr ? "+" : ""}{person.carrier.xlr ? "XLR" : ""}</text>}
    {person.deceased && person.type !== "sab" && <line className="deceased" x1={x - 23} y1={y + 23} x2={x + 23} y2={y - 23} />}
    {person.marker !== "none" && <>
      <path className="marker-arrow" markerEnd="url(#arrowhead)" d={`M ${x - 42} ${y + 42} L ${x - 8} ${y + 8}`} />
      <text className="marker-label" x={x - 47} y={y + 49}>{person.marker === "proband" ? "P" : language === "en" ? "C" : "咨询者"}</text>
    </>}
  </g>;
}

function buildExample(): Pedigree {
  const p = (name: string, gender: Person["gender"], birthOrder: number, patch: Partial<Person> = {}) => newPerson({ name, gender, birthOrder, diseaseStatus: "unaffected", ...patch });
  const grandfather = p("祖父", "male", 1);
  const grandmother = p("祖母", "female", 2, { carrier: { ar: true, xlr: false, recorded: true } });
  const father = p("父亲", "male", 1, { carrier: { ar: true, xlr: false, recorded: true }, genotype: "杂合变异" });
  const aunt = p("姑母", "female", 2);
  const uncle = p("姑父", "male", 1);
  const mother = p("母亲（表亲）", "female", 1, { carrier: { ar: false, xlr: true, recorded: true } });
  const childA = p("先证者", "female", 1, { diseaseStatus: "affected", marker: "proband", variants: "GENE c.123A>G", phenotypes: "示例表型一\n示例表型二" });
  const childB = p("同卵双胎A", "male", 2, { deceased: true, deathNote: "d. 4月" });
  const childC = p("同卵双胎B", "male", 3);
  const loss = p("", "female", 4, { type: "sab", gestationalAge: "8周", diseaseStatus: "unknown" });
  const union1 = { id: makeId("u"), partnerA: grandfather.id, partnerB: grandmother.id, consanguineous: false, relationshipNote: "" };
  const unionAunt = { id: makeId("u"), partnerA: aunt.id, partnerB: uncle.id, consanguineous: false, relationshipNote: "" };
  const union2 = { id: makeId("u"), partnerA: father.id, partnerB: mother.id, consanguineous: true, relationshipNote: "表亲" };
  return {
    schemaVersion: 1, id: makeId("pedigree"), name: "虚构示例家系", updatedAt: new Date().toISOString(),
    persons: [grandfather, grandmother, father, aunt, uncle, mother, childA, childB, childC, loss],
    unions: [union1, unionAunt, union2],
    parentage: [
      { id: makeId("parentage"), childId: father.id, unionId: union1.id, birthOrder: 1 },
      { id: makeId("parentage"), childId: aunt.id, unionId: union1.id, birthOrder: 2 },
      { id: makeId("parentage"), childId: mother.id, unionId: unionAunt.id, birthOrder: 1 },
      { id: makeId("parentage"), childId: childA.id, unionId: union2.id, birthOrder: 1 },
      { id: makeId("parentage"), childId: childB.id, unionId: union2.id, birthOrder: 2 },
      { id: makeId("parentage"), childId: childC.id, unionId: union2.id, birthOrder: 3 },
      { id: makeId("parentage"), childId: loss.id, unionId: union2.id, birthOrder: 4 }
    ],
    twinGroups: [{ id: makeId("twins"), memberIds: [childB.id, childC.id], type: "monozygotic" }],
    settings: { horizontalSpacing: 175, generationSpacing: 245, showUnknownDisease: true, manualOffsets: {}, symbolStyle: "traditional-teaching" }
  };
}

export function App() {
  const [pedigree, setPedigreeState] = useState<Pedigree>(initialPedigree);
  const [language, setLanguage] = useState<Language>("cn");
  const [past, setPast] = useState<Pedigree[]>([]);
  const [future, setFuture] = useState<Pedigree[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(copy.cn.draft);
  const [legacyDraft, setLegacyDraft] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; centerX: number; centerY: number; zoom: number; panX: number; panY: number } | null>(null);
  const personDrag = useRef<{ id: string; x: number; y: number; base: { x: number; y: number } } | null>(null);
  const [previewOffsets, setPreviewOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const renderedPedigree = useMemo(() => ({ ...pedigree, settings: { ...pedigree.settings, manualOffsets: { ...pedigree.settings.manualOffsets, ...previewOffsets } } }), [pedigree, previewOffsets]);
  const layout = useMemo(() => computeLayout(renderedPedigree), [renderedPedigree]);
  const selected = pedigree.persons.find((person) => person.id === selectedId) ?? null;
  const t = copy[language];

  useEffect(() => {
    const restored = restorePedigreeDraft(window.localStorage);
    unrecoveredDraft = restored.unrecoveredDraft;
    startTransition(() => {
      setPedigreeState(restored.pedigree);
      setLegacyDraft(restored.legacyDraft);
      setStatus(restored.legacyDraft ? copy.cn.legacyDraft : copy.cn.draft);
      setZoom(defaultZoomForViewport());
    });
  }, [startTransition]);

  function change(next: Pedigree, message: string = t.updated) {
    setPast((items) => [...items.slice(-49), deepCopy(pedigree)]);
    setFuture([]);
    const updated = { ...next, updatedAt: new Date().toISOString() };
    const saved = persistDraft(updated);
    setPedigreeState(updated);
    setStatus(saved ? message : copy[language].saveFailed);
  }

  function apply(action: () => Pedigree, message: string) {
    try { change(action(), message); } catch (error) { setStatus(error instanceof Error ? error.message : "操作失败。"); }
  }

  function updatePerson(patch: Partial<Person>) {
    if (!selected) return;
    const next = deepCopy(pedigree);
    const person = next.persons.find((item) => item.id === selected.id)!;
    Object.assign(person, patch);
    change(validatePedigree(next), t.personUpdated);
  }

  function updateAnnotationLine(index: number, value: string) {
    if (!selected) return;
    const annotationLines = [...selected.annotationLines];
    annotationLines[index] = value;
    updatePerson({ annotationLines });
  }

  function addAnnotationLine() {
    if (!selected) return;
    updatePerson({ annotationLines: [...selected.annotationLines, ""] });
  }

  function removeAnnotationLine(index: number) {
    if (!selected) return;
    updatePerson({ annotationLines: selected.annotationLines.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateCarrier(patch: Partial<CarrierStatus>) {
    if (!selected) return;
    updatePerson({ carrier: { ...selected.carrier, ...patch, recorded: patch.ar || patch.xlr ? true : selected.carrier.recorded } });
  }

  function addSpouse(existing = false) {
    if (!selected || selected.type === "sab") return;
    if (pedigree.unions.some((union) => union.partnerA === selected.id || union.partnerB === selected.id)) return setStatus("该个体已有婚配关系；V1 不支持再婚。");
    if (existing) {
      const candidates = pedigree.persons.filter((person) => person.id !== selected.id && person.type === "person" && !pedigree.unions.some((union) => union.partnerA === person.id || union.partnerB === person.id));
      const answer = window.prompt(`输入要连接的个体 ID（可选：\n${candidates.map((person) => `${person.name || "未命名"} — ${person.id}`).join("\n")}）`);
      if (!answer) return;
      apply(() => addUnion(pedigree, selected.id, answer.trim()), "已连接已有个体为配偶。");
      return;
    }
    const next = deepCopy(pedigree);
    const partner = newPerson({ name: "配偶", gender: defaultSpouseGender(selected.gender), birthOrder: next.persons.length + 1 });
    next.persons.push(partner);
    apply(() => addUnion(next, selected.id, partner.id), "已添加配偶。");
  }

  function addChildForSelected(type: PersonType = "person") {
    if (!selected || selected.type === "sab") return;
    const union = pedigree.unions.find((item) => item.partnerA === selected.id || item.partnerB === selected.id);
    if (!union) {
      if (!window.confirm("该个体尚无配偶。是否新建配偶并添加子女？")) return;
      const next = deepCopy(pedigree); const partner = newPerson({ name: "配偶", gender: defaultSpouseGender(selected.gender), birthOrder: next.persons.length + 1 }); next.persons.push(partner);
      apply(() => { const married = addUnion(next, selected.id, partner.id); return addChild(married, married.unions.find((item) => item.partnerA === selected.id || item.partnerB === selected.id)!.id, type); }, type === "sab" ? "已新建配偶并添加自然流产记录。" : "已新建配偶并添加子女。");
      return;
    }
    apply(() => addChild(pedigree, union.id, type), type === "sab" ? "已添加自然流产记录。" : "已添加子女。");
  }

  function svgMarkup(): string {
    const svg = svgRef.current;
    if (!svg) throw new Error("未找到导出画布。");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll(".selected").forEach((element) => element.classList.remove("selected"));
    clone.querySelectorAll(".person-hitbox").forEach((element) => element.remove());
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style"); style.textContent = exportStyle; clone.insertBefore(style, clone.firstChild);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(layout.width));
    clone.setAttribute("height", String(layout.height));
    return new XMLSerializer().serializeToString(clone);
  }

  function exportSvg() {
    try { download(svgMarkup(), `${safeFilename(pedigree.name)}.svg`, "image/svg+xml;charset=utf-8"); setStatus("SVG 已导出。"); } catch (error) { setStatus(error instanceof Error ? error.message : "SVG 导出失败。"); }
  }

  async function exportPng(scale = 2) {
    try {
      await document.fonts?.ready;
      const svg = svgMarkup();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("SVG 无法栅格化。")); image.src = url; });
      if (layout.width * scale > 16384 || layout.height * scale > 16384) throw new Error("图像过大，请降低 PNG 倍率或导出 SVG。");
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * scale; canvas.height = layout.height * scale;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持 PNG 导出。");
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("PNG 编码失败。");
      download(png, `${safeFilename(pedigree.name)}.png`, "image/png");
      setStatus(`PNG 已按 ${scale} 倍导出。`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "PNG 导出失败。"); }
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!window.confirm("导入将替换当前草稿。建议先导出 JSON。是否继续？")) return;
        const parsed = validatePedigree(JSON.parse(String(reader.result)));
        change(parsed, "JSON 已导入并通过关系校验。");
        setSelectedId(null);
      } catch (error) { setStatus(error instanceof Error ? `导入失败：${error.message}` : "导入失败。当前草稿未改变。"); }
    };
    reader.onerror = () => setStatus("无法读取所选 JSON 文件。");
    reader.readAsText(file, "utf-8");
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const next = Math.max(.3, Math.min(2.6, zoom * (event.deltaY < 0 ? 1.1 : .9)));
    setZoom(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as Element).closest(".person, .relationship")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    activePointers.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...activePointers.current.values()];
    if (points.length === 1) {
      drag.current = { x: points[0].x, y: points[0].y, panX: pan.x, panY: pan.y };
      pinch.current = null;
      return;
    }
    if (points.length === 2) {
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      pinch.current = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        centerX,
        centerY,
        zoom,
        panX: pan.x,
        panY: pan.y,
      };
      drag.current = null;
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (personDrag.current) {
      const current = personDrag.current;
      setPreviewOffsets({ [current.id]: { x: current.base.x + (event.clientX - current.x) / zoom, y: current.base.y + (event.clientY - current.y) / zoom } });
      return;
    }
    if (activePointers.current.has(event.pointerId)) {
      const bounds = event.currentTarget.getBoundingClientRect();
      activePointers.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }
    const points = [...activePointers.current.values()];
    if (pinch.current && points.length >= 2) {
      const currentDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinch.current.distance <= 0) return;
      const nextZoom = Math.max(.3, Math.min(2.6, pinch.current.zoom * currentDistance / pinch.current.distance));
      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;
      const contentX = (pinch.current.centerX - pinch.current.panX) / pinch.current.zoom;
      const contentY = (pinch.current.centerY - pinch.current.panY) / pinch.current.zoom;
      setZoom(nextZoom);
      setPan({ x: centerX - contentX * nextZoom, y: centerY - contentY * nextZoom });
      return;
    }
    if (!drag.current) return;
    const point = activePointers.current.get(event.pointerId);
    if (!point) return;
    setPan({ x: drag.current.panX + point.x - drag.current.x, y: drag.current.panY + point.y - drag.current.y });
  }

  function unionForSelected() { return selected ? pedigree.unions.find((item) => item.partnerA === selected.id || item.partnerB === selected.id) : undefined; }
  function parentageForSelected() { return selected ? pedigree.parentage.find((item) => item.childId === selected.id) : undefined; }
  function startPersonDrag(event: PointerEvent<SVGGElement>, id: string) {
    event.stopPropagation(); if (event.button !== 0) return; setSelectedId(id);
    personDrag.current = { id, x: event.clientX, y: event.clientY, base: pedigree.settings.manualOffsets[id] ?? { x: 0, y: 0 } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function finishPointer(event?: PointerEvent<HTMLDivElement>) {
    if (personDrag.current) {
      const { id } = personDrag.current; const offset = previewOffsets[id]; personDrag.current = null;
      if (offset) change({ ...pedigree, settings: { ...pedigree.settings, manualOffsets: { ...pedigree.settings.manualOffsets, [id]: offset } } }, "已保存个体手动位置。");
      setPreviewOffsets({}); return;
    }
    if (event) activePointers.current.delete(event.pointerId);
    pinch.current = null;
    const remaining = [...activePointers.current.values()];
    drag.current = remaining.length === 1 ? { x: remaining[0].x, y: remaining[0].y, panX: pan.x, panY: pan.y } : null;
  }

  return <main>
    <header className="toolbar">
      <div className="brand"><span>{t.app}</span><small>{t.subtitle}</small></div>
      <label className="title-field">{t.pedigreeName}<input value={pedigree.name} onChange={(event) => change({ ...pedigree, name: event.target.value }, t.updated)} /></label>
      <div className="actions">
        <button onClick={() => { if (window.confirm(t.newConfirm)) { change(emptyPedigree(), t.newCreated); setSelectedId(null); } }}>{t.new}</button>
        <button onClick={() => { if (window.confirm(t.sampleConfirm)) { change(buildExample(), t.sampleLoaded); setSelectedId(null); } }}>{t.sample}</button>
        <button onClick={() => fileInput.current?.click()}>{t.importJson}</button>
        <button onClick={() => download(JSON.stringify(pedigree, null, 2), `${safeFilename(pedigree.name)}.json`, "application/json")}>{t.exportJson}</button>
        <button onClick={exportSvg}>{t.exportSvg}</button>
        <button onClick={() => void exportPng(2)}>{t.exportPng}</button>
        <button disabled={!past.length} onClick={() => { const last = past.at(-1)!; setPast((items) => items.slice(0, -1)); setFuture((items) => [deepCopy(pedigree), ...items]); const saved = persistDraft(last); setPedigreeState(last); setStatus(saved ? t.undoDone : t.saveFailed); }}>{t.undo}</button>
        <button disabled={!future.length} onClick={() => { const next = future[0]; setFuture((items) => items.slice(1)); setPast((items) => [...items, deepCopy(pedigree)]); const saved = persistDraft(next); setPedigreeState(next); setStatus(saved ? t.redoDone : t.saveFailed); }}>{t.redo}</button>
      </div>
      <button className="language-toggle" onClick={() => setLanguage(language === "cn" ? "en" : "cn")}>{t.language}</button>
      <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={importJson} />
    </header>
    <section className="workspace">
      <div className="canvas-panel">
        <div className="canvas-toolbar">
          <span>{status}</span>
          <div><button onClick={() => setZoom(Math.max(.3, zoom - .1))}>−</button><span className="zoom">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(Math.min(2.6, zoom + .1))}>＋</button><button onClick={() => { setZoom(defaultZoomForViewport()); setPan({ x: 0, y: 0 }); }}>{t.fit}</button></div>
        </div>
        {unrecoveredDraft && <div className="draft-recovery">{t.draftBroken}<button onClick={() => download(unrecoveredDraft!, "pedigree_unrecovered_draft.json", "application/json")}>{t.downloadBroken}</button><button onClick={() => { unrecoveredDraft = null; setStatus(t.brokenDiscarded); }}>{t.discardBroken}</button></div>}
        {legacyDraft && <div className="draft-recovery">{t.legacyDraft}<button onClick={() => download(legacyDraft, "yikon_legacy_pedigree_cases.json", "application/json")}>{t.downloadLegacy}</button><button onClick={() => setLegacyDraft(null)}>{t.dismissLegacy}</button></div>}
        <div className="canvas-scroll" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onPointerLeave={() => { if (!personDrag.current && activePointers.current.size === 0) drag.current = null; }}>
          <div className="svg-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <svg ref={svgRef} id="pedigree-svg" width={layout.width} height={layout.height} viewBox={`${layout.viewBoxX} ${layout.viewBoxY} ${layout.width} ${layout.height}`} aria-label={t.canvas} onClick={() => setSelectedId(null)}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#18243d" /></marker>
              </defs>
              <rect x={layout.viewBoxX} y={layout.viewBoxY} width={layout.width} height={layout.height} fill="#fff" />
              <text className="export-title" x={layout.viewBoxX + layout.width / 2} y={layout.titleY} textAnchor="middle">{pedigree.name || t.unnamed}</text>
              {layout.unions.map((union) => <g className="relationship" key={union.id} onClick={(event) => { event.stopPropagation(); const note = window.prompt(t.relationshipPrompt, union.relationshipNote); if (note === null) return; const next = deepCopy(pedigree); const target = next.unions.find((item) => item.id === union.id)!; target.relationshipNote = note; target.consanguineous = window.confirm(language === "en" ? "Mark this union as consanguineous?" : "确定此婚配为近亲婚配吗？"); change(validatePedigree(next), t.relationshipUpdated); }}>
                <line x1={union.x1 - union.normalX * (union.consanguineous ? 3 : 0)} y1={union.y1 - union.normalY * (union.consanguineous ? 3 : 0)} x2={union.x2 - union.normalX * (union.consanguineous ? 3 : 0)} y2={union.y2 - union.normalY * (union.consanguineous ? 3 : 0)} />
                {union.consanguineous && <line x1={union.x1 + union.normalX * 3} y1={union.y1 + union.normalY * 3} x2={union.x2 + union.normalX * 3} y2={union.y2 + union.normalY * 3} />}
                {union.relationshipNote && <text className="relationship-note" x={union.centerX - union.normalX * 14} y={union.centerY - union.normalY * 14} textAnchor="middle">{union.relationshipNote}</text>}
              </g>)}
              {pedigree.unions.map((modelUnion) => {
                const union = layout.unions.find((item) => item.id === modelUnion.id);
                if (!union) return null;
                const relations = pedigree.parentage.filter((item) => item.unionId === modelUnion.id);
                const children = relations.map((relation) => layout.people.find((item) => item.person.id === relation.childId)).filter((item): item is NonNullable<typeof item> => Boolean(item));
                if (!children.length) return null;
                const averageChildY = children.reduce((total, child) => total + child.y, 0) / children.length;
                const barY = union.centerY + (averageChildY >= union.centerY ? 52 : -52); const descentX = union.centerX;
                const minX = Math.min(descentX, ...children.map((child) => child.x)); const maxX = Math.max(descentX, ...children.map((child) => child.x));
                return <g className="descent" key={`descent-${modelUnion.id}`}>
                  <line x1={descentX} y1={union.centerY} x2={descentX} y2={barY} /><line x1={minX} y1={barY} x2={maxX} y2={barY} />
                  {children.map((child) => <line key={child.person.id} x1={child.x} y1={barY} x2={child.x} y2={child.y - symbolSize / 2} />)}
                </g>;
              })}
              {false && pedigree.parentage.map((relation) => {
                const union = layout.unions.find((item) => item.id === relation.unionId);
                const child = layout.people.find((item) => item.person.id === relation.childId);
                if (!union || !child) return null;
                const siblings = pedigree.parentage.filter((item) => item.unionId === relation.unionId);
                const barY = union.centerY + 52;
                const minX = Math.min(...siblings.map((item) => layout.people.find((person) => person.person.id === item.childId)?.x ?? union.childX));
                const maxX = Math.max(...siblings.map((item) => layout.people.find((person) => person.person.id === item.childId)?.x ?? union.childX));
                return <g className="descent" key={relation.id}>
                  <line x1={union.centerX} y1={union.centerY} x2={union.centerX} y2={barY} />
                  <line x1={minX} y1={barY} x2={maxX} y2={barY} />
                  <line x1={child.x} y1={barY} x2={child.x} y2={child.y - symbolSize / 2} />
                </g>;
              })}
              {pedigree.twinGroups.map((group) => {
                const members = group.memberIds.map((id) => layout.people.find((item) => item.person.id === id)).filter(Boolean);
                if (members.length < 2) return null;
                const topY = members[0]!.y - symbolSize / 2 - 32;
                const minX = Math.min(...members.map((member) => member!.x));
                const maxX = Math.max(...members.map((member) => member!.x));
                return <g className="twin" key={group.id}>
                  <line x1={(minX + maxX) / 2} y1={topY - 8} x2={minX} y2={topY + 12} /><line x1={(minX + maxX) / 2} y1={topY - 8} x2={maxX} y2={topY + 12} />
                  {group.type === "monozygotic" && <line x1={minX + 5} y1={topY + 5} x2={maxX - 5} y2={topY + 5} />}
                  {group.type === "unknown" && <text x={(minX + maxX) / 2} y={topY - 4} textAnchor="middle">?</text>}
                </g>;
              })}
              {layout.people.map(({ person, x, y, number, textLines }) => <g key={person.id}>
                <PersonSymbol person={person} x={x} y={y} selected={selectedId === person.id} onSelect={() => setSelectedId(person.id)} onDragStart={(event) => startPersonDrag(event, person.id)} language={language} />
                <text className="person-number" x={x} y={y + 38} textAnchor="middle">{number}</text>
                <text className="person-text" x={x} y={y + 55} textAnchor="middle">
                  {textLines.map((line, index) => <tspan key={`${person.id}-${index}`} x={x} dy={index ? 17 : 0}>{line}</tspan>)}
                </text>
              </g>)}
              <g className="legend" transform={`translate(${layout.viewBoxX + 44} ${layout.legendY})`}>
                <text className="legend-title" x="0" y="0">{t.legend}</text>
                <rect className="legend-shape" x="0" y="16" width="20" height="20" /><text x="28" y="31">{t.male}</text>
                <circle className="legend-shape" cx="92" cy="26" r="10" /><text x="108" y="31">{t.female}</text>
                <path className="legend-shape" d="M178 15 L189 26 L178 37 L167 26 Z" /><text x="198" y="31">{t.unknownGender}</text>
                <rect x="294" y="16" width="20" height="20" fill="#161a25" /><text x="322" y="31">{t.affected}</text>
                <rect className="legend-shape" x="390" y="16" width="20" height="20" /><rect x="390" y="16" width="10" height="20" fill="#161a25" /><text x="418" y="31">{t.arCarrier}</text>
                <rect className="legend-shape" x="540" y="16" width="20" height="20" /><circle className="carrier-dot" cx="550" cy="26" r="4" /><text x="568" y="31">{t.xlrCarrier}</text>
                <text x="0" y="58">{t.legendNote}</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
      <aside className="editor">
        <h2>{t.editor}</h2>
        {!selected ? <div className="empty-editor">{t.selectPerson}<br />{t.selectRelationship}</div> : <>
          <p className="id">{t.stableId}: {selected.id}</p>
          <label>{t.name}<textarea value={selected.name} onChange={(event) => updatePerson({ name: event.target.value })} /></label>
          <div className="field-grid">
            <label>{t.gender}<select value={selected.gender} onChange={(event) => updatePerson({ gender: event.target.value as Person["gender"] })}><option value="male">{t.male}</option><option value="female">{t.female}</option><option value="unknown">{t.diseaseUnknown}</option></select></label>
            <label>{t.personType}<select value={selected.type} onChange={(event) => updatePerson({ type: event.target.value as PersonType })}><option value="person">{t.normalPerson}</option><option value="sab">{t.miscarriage}</option></select></label>
            <label>{t.diseaseStatus}<select value={selected.diseaseStatus} onChange={(event) => updatePerson({ diseaseStatus: event.target.value as Person["diseaseStatus"] })}><option value="unknown">{t.diseaseUnknown}</option><option value="unaffected">{t.unaffected}</option><option value="affected">{t.affected}</option></select></label>
            <label>{t.marker}<select value={selected.marker} onChange={(event) => updatePerson({ marker: event.target.value as Person["marker"] })}><option value="none">{t.none}</option><option value="proband">{t.proband}</option><option value="consultand">{t.consultand}</option></select></label>
          </div>
          {selected.type === "sab" && <label>{t.gestationalAge}<input value={selected.gestationalAge} placeholder={language === "en" ? "e.g. 8 weeks" : "例如：8周"} onChange={(event) => updatePerson({ gestationalAge: event.target.value })} /></label>}
          <fieldset><legend>{t.carrier}</legend>
            <label className="check"><input type="checkbox" checked={selected.carrier.ar} onChange={(event) => updateCarrier({ ar: event.target.checked })} /> {t.ar}</label>
            <label className="check"><input type="checkbox" checked={selected.carrier.xlr} onChange={(event) => updateCarrier({ xlr: event.target.checked })} /> {t.xlr}</label>
            <small>{carrierText(selected, language) || t.carrierNone}</small>
          </fieldset>
          <label className="check"><input type="checkbox" checked={selected.deceased} onChange={(event) => updatePerson({ deceased: event.target.checked })} /> {t.deceased}</label>
          {selected.deceased && <label>{t.deathNote}<input value={selected.deathNote} placeholder={language === "en" ? "e.g. d. 2007 / 4 months" : "例如：d. 2007 / 4月"} onChange={(event) => updatePerson({ deathNote: event.target.value })} /></label>}
          <label>{t.genotype}<textarea value={selected.genotype} onChange={(event) => updatePerson({ genotype: event.target.value })} /></label>
          <label>{t.variants}<textarea value={selected.variants} onChange={(event) => updatePerson({ variants: event.target.value })} /></label>
          <label>{t.phenotypes}<textarea rows={4} value={selected.phenotypes} onChange={(event) => updatePerson({ phenotypes: event.target.value })} /></label>
          <fieldset><legend>{t.annotationLines}</legend><small>{t.annotationHelp}</small>
            {selected.annotationLines.map((line, index) => <div className="annotation-line" key={`${selected.id}-${index}`}><input value={line} placeholder={t.emptyLine} onChange={(event) => updateAnnotationLine(index, event.target.value)} /><button type="button" aria-label={t.removeLine} onClick={() => removeAnnotationLine(index)}>×</button></div>)}
            <button type="button" onClick={addAnnotationLine}>{t.addLine}</button>
          </fieldset>
          {selected.marker === "proband" && selected.diseaseStatus !== "affected" && <div className="warning">{t.warning}</div>}
          <hr />
          <h3>{t.addRelatives}</h3>
          <div className="relation-actions">
            <button disabled={selected.type === "sab"} onClick={() => addSpouse(false)}>{t.addSpouse}</button>
            <button disabled={selected.type === "sab"} onClick={() => addSpouse(true)}>{t.connectExisting}</button>
            <button onClick={() => apply(() => addParents(pedigree, selected.id), t.updated)}>{t.addParents}</button>
            <button disabled={selected.type === "sab"} onClick={() => apply(() => addSibling(pedigree, selected.id), t.updated)}>{t.addSibling}</button>
            <button disabled={selected.type === "sab"} onClick={() => addChildForSelected("person")}>{t.addChild}</button>
            <button disabled={selected.type === "sab"} onClick={() => addChildForSelected("sab")}>{t.addMiscarriage}</button>
            <button disabled={selected.type === "sab"} onClick={() => { const union = unionForSelected(); if (!union) setStatus(language === "en" ? "Add a spouse before adding twins." : "请先添加配偶，再添加双胎。"); else apply(() => addTwin(pedigree, union.id, "monozygotic"), t.updated); }}>{t.addMonozygotic}</button>
            <button disabled={selected.type === "sab"} onClick={() => { const union = unionForSelected(); if (!union) setStatus(language === "en" ? "Add a spouse before adding twins." : "请先添加配偶，再添加双胎。"); else apply(() => addTwin(pedigree, union.id, "dizygotic"), t.updated); }}>{t.addDizygotic}</button>
            <button disabled={selected.type === "sab"} onClick={() => { const union = unionForSelected(); if (!union) setStatus(language === "en" ? "Add a spouse before adding twins." : "请先添加配偶，再添加双胎。"); else apply(() => addTwin(pedigree, union.id, "unknown"), t.updated); }}>{t.addTwinUnknown}</button>
          </div>
          <div className="relation-actions compact">
            <button onClick={() => apply(() => moveSibling(pedigree, selected.id, -1), t.updated)}>{t.siblingLeft}</button>
            <button onClick={() => apply(() => moveSibling(pedigree, selected.id, 1), t.updated)}>{t.siblingRight}</button>
            <button className="danger" onClick={() => { if (window.confirm(language === "en" ? "This works only when the person has no relationships. Continue?" : "仅当该个体没有关系时才会移除。是否继续？")) apply(() => removePerson(pedigree, selected.id), t.updated); }}>{t.removePerson}</button>
            {parentageForSelected() && <button className="danger" onClick={() => { const relation = parentageForSelected()!; if (window.confirm(language === "en" ? "Remove this person's parentage? The person is retained." : "解除该个体与父母的关系？个体会保留。")) apply(() => removeParentage(pedigree, relation.id), t.updated); }}>{t.removeParentage}</button>}
            {unionForSelected() && <button className="danger" onClick={() => { const union = unionForSelected()!; if (window.confirm(language === "en" ? "Remove this union? Both people and children are retained." : "解除该婚配关系？子女和双方个体会保留。")) apply(() => removeUnion(pedigree, union.id), t.updated); }}>{t.removeUnion}</button>}
          </div>
        </>}
        <hr />
        <h3>{t.layout}</h3>
        <label>{t.horizontalSpacing}<input type="range" min="110" max="280" value={pedigree.settings.horizontalSpacing} onChange={(event) => change({ ...pedigree, settings: { ...pedigree.settings, horizontalSpacing: Number(event.target.value) } }, t.updated)} /></label>
        <label>{t.generationSpacing}<input type="range" min="160" max="360" value={pedigree.settings.generationSpacing} onChange={(event) => change({ ...pedigree, settings: { ...pedigree.settings, generationSpacing: Number(event.target.value) } }, t.updated)} /></label>
        <button onClick={() => change({ ...pedigree, settings: { ...pedigree.settings, manualOffsets: {} } }, t.updated)} disabled={!Object.keys(pedigree.settings.manualOffsets).length}>{t.restoreLayout}</button>
      </aside>
    </section>
  </main>;
}
