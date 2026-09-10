import type { SourceKind, TargetFormat } from '../domain/types';
import type { AdapterRegistry, BlockAssembler, DocumentAdapter, FileDescriptor } from './types';

/** Phase 1 registriert genau einen Adapter -- aber das UI fragt nie nach PDF. */
const ACCEPT_BY_KIND: Record<SourceKind, string> = {
  pdf: 'application/pdf,.pdf',
  image: 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif',
};

export function createRegistry(): AdapterRegistry {
  const adapters: DocumentAdapter[] = [];
  const assemblers = new Map<TargetFormat, BlockAssembler>();

  return {
    register(adapter) {
      if (adapters.some((known) => known.kind === adapter.kind)) {
        throw new Error(`Adapter fuer ${adapter.kind} ist bereits registriert.`);
      }
      adapters.push(adapter);
    },
    registerAssembler(assembler) {
      assemblers.set(assembler.targetFormat, assembler);
    },
    adapterFor(file: FileDescriptor) {
      return adapters.find((adapter) => adapter.accepts(file));
    },
    adapterOfKind(kind) {
      return adapters.find((adapter) => adapter.kind === kind);
    },
    assemblerFor(format) {
      return assemblers.get(format);
    },
    acceptAttribute() {
      return adapters.map((adapter) => ACCEPT_BY_KIND[adapter.kind]).join(',');
    },
  };
}
