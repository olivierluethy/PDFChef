import type { NodeId, SourceId } from '../../domain/types';

export type SelectionScope =
  | { kind: 'source'; sourceId: SourceId }
  | { kind: 'output'; outputId: NodeId };

/**
 * `ids` sind Zeichenketten: im Quellraster der Blockindex als Text, im
 * Output-Raster die ItemId. Ein einziger Typ genuegt damit fuer beide Raster.
 * Nicht-zusammenhaengende Selektionen sind ausdruecklich erlaubt.
 */
export interface SelectionState {
  scope: SelectionScope | null;
  anchor: string | null;
  ids: string[];
}

/** Die History speichert genau diesen Wert vor und nach jedem Command. */
export type SelectionSnapshot = SelectionState;

export const EMPTY_SELECTION: SelectionState = { scope: null, anchor: null, ids: [] };

export function sameScope(a: SelectionScope | null, b: SelectionScope | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'source'
    ? a.sourceId === (b as { sourceId: string }).sourceId
    : a.outputId === (b as { outputId: string }).outputId;
}

export function rangeBetween(order: string[], anchor: string, target: string): string[] {
  const from = order.indexOf(anchor);
  const to = order.indexOf(target);
  // Ohne gueltigen Anker ist "vom Anker bis hier" bedeutungslos: nur das Ziel.
  if (from === -1 || to === -1) return [target];
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return order.slice(lo, hi + 1);
}

export function applySelect(
  _state: SelectionState,
  scope: SelectionScope,
  id: string,
  _order: string[],
): SelectionState {
  return { scope, anchor: id, ids: [id] };
}

export function applyExtend(
  state: SelectionState,
  scope: SelectionScope,
  id: string,
  order: string[],
): SelectionState {
  if (!sameScope(state.scope, scope) || state.anchor === null) {
    return { scope, anchor: id, ids: [id] };
  }
  return { scope, anchor: state.anchor, ids: rangeBetween(order, state.anchor, id) };
}

export function applyToggle(
  state: SelectionState,
  scope: SelectionScope,
  id: string,
): SelectionState {
  if (!sameScope(state.scope, scope)) {
    return { scope, anchor: id, ids: [id] };
  }
  if (state.ids.includes(id)) {
    const ids = state.ids.filter((known) => known !== id);
    // Der Anker wandert auf die letzte noch bestehende Id, damit ein
    // folgendes Shift eine sinnvolle Strecke aufspannt.
    return { scope, anchor: ids.at(-1) ?? null, ids };
  }
  return { scope, anchor: id, ids: [...state.ids, id] };
}

export function applyReplace(
  state: SelectionState,
  scope: SelectionScope,
  ids: string[],
  anchor: string | null,
  additive: boolean,
): SelectionState {
  if (!additive || !sameScope(state.scope, scope)) {
    return { scope, anchor, ids: [...ids] };
  }
  const merged = [...state.ids];
  for (const id of ids) if (!merged.includes(id)) merged.push(id);
  return { scope, anchor, ids: merged };
}

export function applySelectAll(scope: SelectionScope, order: string[]): SelectionState {
  return { scope, anchor: order[0] ?? null, ids: [...order] };
}

export function isSelected(state: SelectionState, scope: SelectionScope, id: string): boolean {
  return sameScope(state.scope, scope) && state.ids.includes(id);
}

export function selectionCount(state: SelectionState): number {
  return state.ids.length;
}
