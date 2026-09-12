import type { Locale, MessageFragment } from './types';
import { app } from './messages/app';
import { header } from './messages/header';
import { exportUi } from './messages/export';
import { preview } from './messages/preview';
import { workspace } from './messages/workspace';
import { sources } from './messages/sources';
import { common } from './messages/common';

const fragments: MessageFragment[] = [app, header, exportUi, preview, workspace, sources, common];

function merge(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fragment of fragments) Object.assign(out, fragment[locale]);
  return out;
}

export const messages: Record<Locale, Record<string, string>> = {
  en: merge('en'),
  de: merge('de'),
};
