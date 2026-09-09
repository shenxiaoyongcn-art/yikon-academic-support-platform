export type SiblingLayoutNode = {
  id: string;
  fatherId?: string;
  motherId?: string;
  order: number;
  manualX?: number;
  manualY?: number;
};

export type SiblingLayoutPoint = { x: number; y: number };

export function belongsToParentGroup(node: SiblingLayoutNode, fatherId?: string, motherId?: string) {
  return Boolean(fatherId || motherId) && node.fatherId === fatherId && node.motherId === motherId;
}

/**
 * Places one sibling group on a shared row at an exact centre-to-centre gap.
 * Birth order controls left-to-right order so pedigree numbering stays visual.
 */
export function distributeSiblingGroup<T extends SiblingLayoutNode>(
  nodes: T[],
  positions: ReadonlyMap<string, SiblingLayoutPoint>,
  fatherId: string | undefined,
  motherId: string | undefined,
  requestedSpacing: number,
  preferredY?: number,
): T[] {
  const siblings = nodes
    .filter((node) => belongsToParentGroup(node, fatherId, motherId))
    .sort((first, second) => first.order - second.order || first.id.localeCompare(second.id));
  if (!siblings.length) return nodes;

  const spacing = Math.max(60, Math.min(200, Math.round(requestedSpacing)));
  const parents = [fatherId, motherId]
    .filter((id): id is string => Boolean(id))
    .map((id) => positions.get(id))
    .filter((point): point is SiblingLayoutPoint => Boolean(point));
  const parentCenterX = parents.length
    ? parents.reduce((sum, point) => sum + point.x, 0) / parents.length
    : siblings.reduce((sum, sibling) => sum + (positions.get(sibling.id)?.x ?? sibling.manualX ?? 0), 0) / siblings.length;
  const halfSpan = spacing * (siblings.length - 1) / 2;
  const groupCenterX = Math.max(55 + halfSpan, parentCenterX);
  const existingRows = siblings
    .map((sibling) => positions.get(sibling.id)?.y ?? sibling.manualY)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const fallbackY = parents.length ? Math.max(...parents.map((point) => point.y)) + 145 : 235;
  const rowY = preferredY ?? (existingRows.length
    ? existingRows.reduce((sum, value) => sum + value, 0) / existingRows.length
    : fallbackY);
  const siblingIndex = new Map(siblings.map((sibling, index) => [sibling.id, index]));

  return nodes.map((node) => {
    const index = siblingIndex.get(node.id);
    if (index === undefined) return node;
    return {
      ...node,
      manualX: groupCenterX - halfSpan + index * spacing,
      manualY: rowY,
    };
  });
}
