import { describe, expect, it } from 'vitest';
import { IDS, makeItem, makeWorkspace } from './__fixtures__/workspace';
import { assertWorkspaceInvariants, checkWorkspaceInvariants } from './invariants';
import type { OutputDocument } from './types';

function output(ws: ReturnType<typeof makeWorkspace>, id: string): OutputDocument {
  const node = ws.nodes[id];
  if (!node || node.type !== 'output') throw new Error(`Fixture kaputt: ${id}`);
  return node;
}

describe('checkWorkspaceInvariants', () => {
  it('meldet fuer die Fixture nichts', () => {
    expect(checkWorkspaceInvariants(makeWorkspace())).toEqual([]);
  });

  it('meldet ein Item, das in zwei Outputs steht (Invariante 2)', () => {
    const ws = makeWorkspace();
    output(ws, IDS.outInsurance).items.push('i-c4');
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('i-c4');
  });

  it('meldet ein Item ohne Output (Invariante 2)', () => {
    const ws = makeWorkspace();
    ws.items['i-waise'] = makeItem('i-waise', IDS.bank, 1);
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('i-waise');
  });

  it('meldet ein Item mit unbekannter Quelle (Invariante 3)', () => {
    const ws = makeWorkspace();
    ws.items['i-c4'].sourceId = 'src-weg';
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('src-weg');
  });

  it('meldet einen blockIndex ausserhalb des Dokuments (Invariante 4)', () => {
    const ws = makeWorkspace();
    ws.items['i-b17'].blockIndex = 50;
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('blockIndex 50');
  });

  it('meldet eine Node, die in childOrder fehlt (Invariante 5)', () => {
    const ws = makeWorkspace();
    ws.childOrder[IDS.tax] = ws.childOrder[IDS.tax].filter((id) => id !== IDS.folderBank);
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain(IDS.folderBank);
  });

  it('meldet einen Ordner, der sein eigener Vorfahre ist (Invariante 6)', () => {
    const ws = makeWorkspace();
    ws.nodes[IDS.tax].parentId = IDS.folderBank;
    ws.childOrder[IDS.folderBank] = [IDS.tax];
    ws.childOrder['root'] = [];
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('ancestor');
  });

  it('meldet eine Node, die in einem Output statt in einem Ordner liegt (Invariante 1)', () => {
    const ws = makeWorkspace();
    ws.nodes[IDS.folderBank].parentId = IDS.outInsurance;
    ws.childOrder[IDS.tax] = ws.childOrder[IDS.tax].filter((id) => id !== IDS.folderBank);
    ws.childOrder[IDS.outInsurance] = [IDS.folderBank];
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('is not a folder');
  });
});

describe('assertWorkspaceInvariants', () => {
  it('wirft mit allen Verletzungen im Text', () => {
    const ws = makeWorkspace();
    ws.items['i-c4'].blockIndex = 999;
    expect(() => assertWorkspaceInvariants(ws)).toThrow(/Workspace invariants violated/);
  });

  it('wirft nicht fuer einen gesunden Workspace', () => {
    expect(() => assertWorkspaceInvariants(makeWorkspace())).not.toThrow();
  });
});
