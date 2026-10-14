'use client';

import { describeLocation, type CorridorId } from '@onyx/core';
import { useI18n } from './i18n';
import { useLocation } from './location';
import { useFormat } from './format';

/** "Près de Ndokoti" / "Route Douala – Yaoundé", plus how fresh the fix is. */
export function useLocationLabel() {
  const { t } = useI18n();
  const fmt = useFormat();
  const { status, position, source, manualArea } = useLocation();

  if (!position) {
    if (status === 'locating') return { label: t('location.locating'), detail: null, context: null, pending: true };
    if (status === 'denied') return { label: t('location.chooseArea'), detail: t('location.denied'), context: null, pending: false };
    return { label: t('location.chooseArea'), detail: null, context: null, pending: status === 'idle' };
  }

  const ctx = describeLocation(position);
  const place = source === 'manual' && manualArea ? manualArea : ctx.label;
  const label =
    ctx.corridor && !ctx.inDouala && source !== 'manual'
      ? t('location.onRoad', { corridor: t(`corridors.${ctx.corridor as CorridorId}`) })
      : t('location.near', { place });
  const detail =
    source === 'last'
      ? t('location.lastKnown', { time: fmt.ago(position.at) })
      : source === 'manual'
        ? null
        : !ctx.inDouala && ctx.corridor
          ? t('location.near', { place: ctx.label })
          : null;
  return { label, detail, context: ctx, pending: status === 'locating' };
}
