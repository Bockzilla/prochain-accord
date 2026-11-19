import { getLocale, t } from '../i18n/i18n';
import { pcName } from '../i18n/notation';
import { h } from '../render/dom';
import { keySpelling, type Key } from '../theory/keys';
import type { AppContext } from './context';
import type { SharedMusic } from './shared';

/** Nom lisible d'une tonalité : « La mineur », « Si♭ majeur »… */
export function keyLabel(ctx: AppContext, k: Key): string {
  return `${pcName(k.tonic, ctx.settings.notation, getLocale(), keySpelling(k))} ${t(k.mode === 'major' ? 'key.major' : 'key.minor')}`;
}

/** Sélecteur de tonalité partagé : « Auto (accords joués) » ou tonique + mode choisis. */
export function keyPicker(ctx: AppContext, shared: SharedMusic): HTMLElement {
  const m = ctx.settings.music;
  const tonic = h('select', { 'aria-label': t('key.tonic') });
  for (let pc = 0; pc < 12; pc++) {
    tonic.append(h('option', { value: pc, text: pcName(pc, ctx.settings.notation, getLocale(), keySpelling({ tonic: pc, mode: shared.key.mode })), selected: pc === shared.key.tonic }));
  }
  const mode = h('select', { 'aria-label': t('key.mode') }, [
    h('option', { value: 'major', text: t('key.major'), selected: shared.key.mode === 'major' }),
    h('option', { value: 'minor', text: t('key.minor'), selected: shared.key.mode === 'minor' }),
  ]);
  const auto = h('input', { type: 'checkbox', checked: m.keyMode === 'auto' });
  const set = () => shared.setManualKey({ tonic: Number(tonic.value), mode: mode.value as Key['mode'] });
  tonic.addEventListener('change', set);
  mode.addEventListener('change', set);
  auto.addEventListener('change', () => (auto.checked ? shared.useDetected() : set()));
  const status =
    shared.source === 'detected'
      ? t('key.fromPlaying', { key: keyLabel(ctx, shared.key) })
      : shared.source === 'default' && m.keyMode === 'auto'
        ? t('key.autoWaiting')
        : '';
  return h('div', { class: 'key-picker' }, [
    h('div', { class: 'row' }, [tonic, mode]),
    h('label', { class: 'check' }, [auto, h('span', { text: t('key.auto') })]),
    status ? h('p', { class: 'small', text: status }) : null,
  ]);
}
