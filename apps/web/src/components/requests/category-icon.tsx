import {
  BatteryLow,
  CarFront,
  CircleQuestionMark,
  CircleStop,
  Cog,
  Flame,
  Fuel,
  Gauge,
  KeyRound,
  LifeBuoy,
  Settings2,
  ThermometerSun,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IssueCategory } from '@onyx/core';
import { cn } from '@/lib/utils';

export const CATEGORY_ICONS: Record<IssueCategory, LucideIcon> = {
  wont_start: KeyRound,
  flat_tire: LifeBuoy,
  battery: BatteryLow,
  overheating: ThermometerSun,
  engine: Cog,
  brakes: CircleStop,
  electrical: Zap,
  fuel: Fuel,
  clutch_gearbox: Settings2,
  warning_light: Gauge,
  smoke_fire: Flame,
  accident: CarFront,
  other: CircleQuestionMark,
};

export function CategoryIcon({ category, className }: { category: IssueCategory; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={cn('size-5', className)} aria-hidden="true" />;
}
