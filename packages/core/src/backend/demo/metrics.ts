import { ISSUE_CATEGORIES } from '../../constants';
import { isActive } from '../../domain/status';
import { doualaDate, minutesBetween } from '../../domain/time';
import type { AdminMetrics, DailyCount, ProStats, TechnicianPerformance, TechnicianPrivate } from '../../types';
import type { DemoDb } from './store';

const DAY = 86_400_000;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Same definitions as `public.admin_metrics()` in SQL. */
export function computeAdminMetrics(db: DemoDb, now: Date = new Date()): AdminMetrics {
  const since = (days: number) => now.getTime() - days * DAY;
  const today = doualaDate(now);
  const in30 = db.requests.filter((r) => new Date(r.createdAt).getTime() >= since(30));
  const completed30 = in30.filter((r) => r.status === 'completed');
  const cancelled30 = in30.filter((r) => r.status === 'cancelled');
  const reviews = db.reviews;
  const distribution: AdminMetrics['rating']['distribution'] = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[r.rating - 1]! += 1;
  const payments30 = db.payments.filter((p) => p.status === 'paid' && new Date(p.paidAt ?? p.createdAt).getTime() >= since(30));

  const daily: DailyCount[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = doualaDate(new Date(now.getTime() - i * DAY));
    const rs = db.requests.filter((r) => doualaDate(r.createdAt) === date);
    daily.push({
      date,
      created: rs.length,
      completed: rs.filter((r) => r.status === 'completed').length,
      cancelled: rs.filter((r) => r.status === 'cancelled').length,
    });
  }

  const byCategory = ISSUE_CATEGORIES.map((category) => ({
    category,
    count: in30.filter((r) => r.category === category).length,
  }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const finished = completed30.length + cancelled30.length;
  return {
    generatedAt: now.toISOString(),
    requests: {
      today: db.requests.filter((r) => doualaDate(r.createdAt) === today).length,
      last7d: db.requests.filter((r) => new Date(r.createdAt).getTime() >= since(7)).length,
      last30d: in30.length,
      active: db.requests.filter((r) => isActive(r.status)).length,
      completed30d: completed30.length,
      cancelled30d: cancelled30.length,
      completionRate: finished ? completed30.length / finished : null,
    },
    avgResponseMinutes: avg(in30.map((r) => minutesBetween(r.createdAt, r.acceptedAt)).filter((x): x is number => x !== null)),
    avgArrivalMinutes: avg(in30.map((r) => minutesBetween(r.acceptedAt, r.arrivedAt)).filter((x): x is number => x !== null)),
    rating: {
      avg: avg(reviews.map((r) => r.rating)),
      count: reviews.length,
      csat: reviews.length ? reviews.filter((r) => r.rating >= 4).length / reviews.length : null,
      distribution,
    },
    revenue: {
      gmv30d: payments30.reduce((s, p) => s + p.amount, 0),
      commission30d: payments30.reduce((s, p) => s + p.commission, 0),
      commissionUnsettled: db.payments.filter((p) => p.status === 'paid' && !p.commissionSettledAt).reduce((s, p) => s + p.commission, 0),
    },
    technicians: {
      verified: db.technicians.filter((t) => t.verificationStatus === 'verified').length,
      pending: db.technicians.filter((t) => t.verificationStatus === 'pending').length,
      availableNow: db.technicians.filter((t) => t.verificationStatus === 'verified' && t.availability === 'available').length,
    },
    daily,
    byCategory,
  };
}

export function computePerformance(db: DemoDb, t: TechnicianPrivate, now: Date = new Date()): TechnicianPerformance {
  const since = now.getTime() - 30 * DAY;
  const mine = db.requests.filter((r) => r.technicianId === t.id && new Date(r.createdAt).getTime() >= since);
  const completed = mine.filter((r) => r.status === 'completed').length;
  const cancelled = mine.filter((r) => r.status === 'cancelled').length;
  return {
    technicianId: t.id,
    businessName: t.businessName,
    area: t.area,
    verificationStatus: t.verificationStatus,
    jobsCompleted30d: completed,
    jobsCancelled30d: cancelled,
    completionRate: completed + cancelled ? completed / (completed + cancelled) : null,
    avgResponseMinutes: t.avgResponseMinutes,
    ratingAvg: t.ratingAvg,
    ratingCount: t.ratingCount,
    revenue30d: db.payments
      .filter((p) => p.technicianId === t.id && p.status === 'paid' && new Date(p.paidAt ?? p.createdAt).getTime() >= since)
      .reduce((s, p) => s + p.amount, 0),
  };
}

export function computeProStats(db: DemoDb, t: TechnicianPrivate, now: Date = new Date()): ProStats {
  const month = doualaDate(now).slice(0, 7);
  const mine = db.requests.filter((r) => r.technicianId === t.id);
  const paid = db.payments.filter((p) => p.technicianId === t.id && p.status === 'paid');
  return {
    activeJobs: mine.filter((r) => isActive(r.status)).length,
    jobsThisMonth: mine.filter((r) => r.status === 'completed' && r.completedAt && doualaDate(r.completedAt).startsWith(month)).length,
    revenueThisMonth: paid.filter((p) => doualaDate(p.paidAt ?? p.createdAt).startsWith(month)).reduce((s, p) => s + p.amount, 0),
    commissionDue: paid.filter((p) => !p.commissionSettledAt).reduce((s, p) => s + p.commission, 0),
    jobsCompleted: t.jobsCompleted,
    ratingAvg: t.ratingAvg,
    ratingCount: t.ratingCount,
    avgResponseMinutes: t.avgResponseMinutes,
  };
}
