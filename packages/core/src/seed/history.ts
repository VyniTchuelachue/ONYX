import { commissionFor, quoteTotal } from '../domain/money';
import { generateRequestCode, seededRandom, uuid } from '../domain/codes';
import { placeLabelFor } from '../domain/geo';
import type {
  IssueCategory,
  PaymentMethod,
  RequestStatus,
  ReviewTag,
  UrgencyLevel,
  VehicleType,
} from '../constants';
import type {
  GeoPoint,
  Payment,
  Profile,
  Quote,
  QuoteItem,
  RequestEvent,
  Review,
  ServiceRequest,
  TechnicianPrivate,
} from '../types';
import { DEMO_USER_IDS, seedTechnicianId, DEMO_TECHNICIAN_N } from './technicians';

/**
 * Generates a believable month of FICTIONAL activity for the demo backend, so the
 * admin dashboard, technician stats and driver history have something to show.
 * Deterministic for a given seed.
 */

export interface DemoHistory {
  drivers: Profile[];
  requests: ServiceRequest[];
  events: RequestEvent[];
  quotes: Quote[];
  reviews: Review[];
  payments: Payment[];
}

const DRIVER_NAMES = [
  'Franck Tchatchoua',
  'Mireille Ngo Bassong',
  'Steve Kamdem',
  'Carine Mbella',
  'Junior Bikai',
  'Prisca Atangana',
  'Yannick Dikoume',
  'Sandrine Owona',
  'Boris Fopa',
  'Grace Enow',
];

const VEHICLES: { type: VehicleType; make: string; model: string; color: string }[] = [
  { type: 'car', make: 'Toyota', model: 'Corolla', color: 'gris' },
  { type: 'car', make: 'Toyota', model: 'Yaris', color: 'blanc' },
  { type: 'car', make: 'Hyundai', model: 'Accent', color: 'noir' },
  { type: 'car', make: 'Mercedes', model: 'C 200', color: 'bleu' },
  { type: 'car', make: 'Toyota', model: 'RAV4', color: 'argent' },
  { type: 'car', make: 'Nissan', model: 'Almera', color: 'rouge' },
  { type: 'car', make: 'Suzuki', model: 'Alto', color: 'blanc' },
  { type: 'motorcycle', make: 'Nanfang', model: '125', color: 'rouge' },
  { type: 'truck', make: 'Mercedes', model: 'Actros', color: 'blanc' },
];

const CATEGORY_WEIGHTS: [IssueCategory, number][] = [
  ['flat_tire', 20],
  ['battery', 18],
  ['wont_start', 15],
  ['overheating', 10],
  ['engine', 8],
  ['electrical', 7],
  ['brakes', 5],
  ['fuel', 5],
  ['warning_light', 5],
  ['clutch_gearbox', 3],
  ['accident', 2],
  ['smoke_fire', 1],
  ['other', 1],
];

const DESCRIPTIONS: Record<IssueCategory, string[]> = {
  flat_tire: ['Pneu arrière crevé, pas de roue de secours', 'Crevaison avant droit sur le boulevard'],
  battery: ['La voiture ne démarre plus, batterie à plat je pense', 'Clics au démarrage, voyant batterie allumé'],
  wont_start: ['Le moteur tourne mais ne démarre pas', 'Plus rien ne se passe quand je tourne la clé'],
  overheating: ["L'aiguille de température est dans le rouge, un peu de vapeur", 'Le moteur chauffe dans les embouteillages'],
  engine: ['Bruit de cognement moteur et perte de puissance', 'Le moteur broute au ralenti'],
  electrical: ['Les phares ne marchent plus', 'Les vitres et le tableau de bord se coupent'],
  brakes: ['La pédale de frein est molle', 'Grincement fort au freinage'],
  fuel: ['Panne sèche, jauge à zéro', "J'ai mis du gasoil dans une voiture essence"],
  clutch_gearbox: ['Les vitesses ne passent plus', "L'embrayage patine"],
  warning_light: ['Voyant moteur orange allumé', 'Voyant huile rouge allumé'],
  smoke_fire: ['Fumée blanche sous le capot'],
  accident: ['Accrochage, roue avant tordue'],
  other: ['Bruit bizarre à l’arrière'],
};

export const QUOTE_TEMPLATES: Record<IssueCategory, QuoteItem[][]> = {
  flat_tire: [
    [
      { label: 'Réparation crevaison', kind: 'labour', quantity: 1, unitPrice: 2500 },
      { label: 'Déplacement', kind: 'travel', quantity: 1, unitPrice: 2000 },
    ],
    [
      { label: "Pneu d'occasion 185/65 R15", kind: 'part', quantity: 1, unitPrice: 22000 },
      { label: 'Montage et équilibrage', kind: 'labour', quantity: 1, unitPrice: 3000 },
    ],
  ],
  battery: [
    [
      { label: 'Batterie 70 Ah', kind: 'part', quantity: 1, unitPrice: 55000 },
      { label: 'Pose', kind: 'labour', quantity: 1, unitPrice: 3000 },
      { label: 'Déplacement', kind: 'travel', quantity: 1, unitPrice: 2000 },
    ],
    [{ label: 'Démarrage au booster', kind: 'labour', quantity: 1, unitPrice: 5000 }],
  ],
  wont_start: [
    [
      { label: 'Diagnostic démarrage', kind: 'labour', quantity: 1, unitPrice: 5000 },
      { label: 'Relais de démarreur', kind: 'part', quantity: 1, unitPrice: 8000 },
    ],
    [
      { label: 'Réparation démarreur', kind: 'labour', quantity: 1, unitPrice: 15000 },
      { label: 'Charbons de démarreur', kind: 'part', quantity: 1, unitPrice: 6000 },
    ],
  ],
  overheating: [
    [
      { label: 'Durite de radiateur', kind: 'part', quantity: 1, unitPrice: 7500 },
      { label: 'Liquide de refroidissement 4 L', kind: 'part', quantity: 1, unitPrice: 8000 },
      { label: "Main-d'œuvre", kind: 'labour', quantity: 1, unitPrice: 7000 },
    ],
  ],
  engine: [
    [
      { label: "Bougies d'allumage", kind: 'part', quantity: 4, unitPrice: 3000 },
      { label: "Main-d'œuvre", kind: 'labour', quantity: 1, unitPrice: 8000 },
    ],
  ],
  electrical: [
    [
      { label: 'Fusibles', kind: 'part', quantity: 3, unitPrice: 500 },
      { label: 'Ampoule de phare H4', kind: 'part', quantity: 2, unitPrice: 4000 },
      { label: "Main-d'œuvre", kind: 'labour', quantity: 1, unitPrice: 4000 },
    ],
  ],
  brakes: [
    [
      { label: 'Plaquettes de frein avant', kind: 'part', quantity: 1, unitPrice: 18000 },
      { label: 'Purge du circuit', kind: 'labour', quantity: 1, unitPrice: 8000 },
    ],
  ],
  fuel: [
    [
      { label: 'Carburant 10 L en bidon', kind: 'part', quantity: 1, unitPrice: 8400 },
      { label: 'Déplacement', kind: 'travel', quantity: 1, unitPrice: 3000 },
    ],
  ],
  clutch_gearbox: [
    [
      { label: "Câble d'embrayage", kind: 'part', quantity: 1, unitPrice: 9000 },
      { label: "Main-d'œuvre", kind: 'labour', quantity: 1, unitPrice: 10000 },
    ],
  ],
  warning_light: [[{ label: 'Diagnostic électronique', kind: 'labour', quantity: 1, unitPrice: 10000 }]],
  smoke_fire: [[{ label: 'Remorquage vers le garage', kind: 'travel', quantity: 1, unitPrice: 30000 }]],
  accident: [[{ label: 'Remorquage', kind: 'travel', quantity: 1, unitPrice: 35000 }]],
  other: [[{ label: 'Intervention', kind: 'labour', quantity: 1, unitPrice: 7000 }]],
};

/** What a technician typically writes after looking at the vehicle (used by the demo simulator). */
export const DIAGNOSIS_TEMPLATES: Record<IssueCategory, string> = {
  flat_tire: 'Clou dans la bande de roulement, flanc intact. Réparation possible par mèche, pression contrôlée sur les quatre roues.',
  battery: 'Batterie à 9,8 V, elle ne tient plus la charge. Alternateur correct (14,2 V moteur tournant). Remplacement de la batterie conseillé.',
  wont_start: 'Batterie correcte mais le relais de démarreur ne colle plus. Remplacement du relais, essai de démarrage à froid.',
  overheating: 'Durite inférieure du radiateur fissurée, niveau de liquide très bas. Ventilateur fonctionnel.',
  engine: "Bougies encrassées et une bobine faible : ratés d'allumage au ralenti.",
  electrical: 'Fusible des feux grillé et ampoule H4 côté conducteur hors service.',
  brakes: 'Plaquettes avant usées jusqu’au métal, disques encore utilisables.',
  fuel: 'Réservoir vide, circuit d’alimentation sans fuite.',
  clutch_gearbox: "Câble d'embrayage effiloché, sur le point de casser.",
  warning_light: 'Code défaut P0171 : mélange trop pauvre. Prise d’air sur une durite d’admission.',
  smoke_fire: 'Fuite de liquide de refroidissement sur le collecteur chaud. Véhicule à remorquer au garage.',
  accident: 'Bras de suspension avant gauche tordu, véhicule non roulant. Remorquage nécessaire.',
  other: 'Silent-bloc arrière usé, à remplacer.',
};

const REVIEW_TEXT: Record<number, string[]> = {
  5: [
    'Arrivé en 20 minutes, travail propre et prix correct.',
    "Très professionnel, il m'a expliqué la panne avant de commencer.",
    'Batterie changée sur place. Je recommande !',
    'Came fast and fixed the problem on the spot.',
    'Excellent diagnostic, la voiture roule parfaitement.',
    '',
  ],
  4: [
    'Bon travail, un peu en retard mais il a prévenu.',
    'Prix honnête, intervention rapide.',
    'Fair price and clear explanation.',
    '',
  ],
  3: ['Le travail est fait mais il a fallu attendre longtemps.', 'Correct, sans plus.'],
  2: ['Prix plus élevé que prévu au départ.', 'Arrivé avec 1 h de retard.'],
  1: ["Il n'avait pas la bonne pièce, j'ai dû rappeler un autre technicien."],
};

function pickWeighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[items.length - 1]![0];
}

const pick = <T>(rand: () => number, items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;

function offsetPoint(rand: () => number, p: GeoPoint, maxKm: number): GeoPoint {
  const r = maxKm * Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  return {
    lat: Math.round((p.lat + (r / 111.32) * Math.cos(a)) * 1e5) / 1e5,
    lng: Math.round((p.lng + (r / (111.32 * Math.cos((p.lat * Math.PI) / 180))) * Math.sin(a)) * 1e5) / 1e5,
  };
}

const addMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

const urgencyFor = (c: IssueCategory): UrgencyLevel =>
  c === 'smoke_fire' || c === 'accident' ? 'critical' : c === 'brakes' || c === 'overheating' ? 'high' : c === 'electrical' || c === 'warning_light' ? 'low' : 'medium';

export function generateDemoHistory(technicians: TechnicianPrivate[], now: Date = new Date(), seed = 237): DemoHistory {
  const rand = seededRandom(seed);
  const id = () => uuid(rand);
  const verified = technicians.filter((t) => t.verificationStatus === 'verified');
  const douala = verified.filter((t) => t.city === 'Douala');

  const drivers: Profile[] = DRIVER_NAMES.map((name, i) => ({
    id: `00000000-0000-4000-9000-${(i + 1).toString(16).padStart(12, '0')}`,
    role: 'driver',
    fullName: name,
    email: null,
    phone: `+237600001${(i + 1).toString().padStart(3, '0')}`,
    locale: i % 4 === 3 ? 'en' : 'fr',
    defaultVehicle: null,
    createdAt: addMin(now.toISOString(), -60 * 24 * (40 + i)),
  }));

  const out: DemoHistory = { drivers, requests: [], events: [], quotes: [], reviews: [], payments: [] };

  const event = (r: ServiceRequest, type: RequestEvent['type'], at: string, actorRole: RequestEvent['actorRole'], data: RequestEvent['data'] = null) =>
    out.events.push({ id: id(), requestId: r.id, type, actorRole, message: null, data, createdAt: at });

  const makeRequest = (opts: {
    createdAt: string;
    status: RequestStatus;
    technician: TechnicianPrivate | null;
    driver: Profile;
    category?: IssueCategory;
    requested?: TechnicianPrivate | null;
    reviewRating?: number | null;
  }) => {
    const category = opts.category ?? pickWeighted(rand, CATEGORY_WEIGHTS);
    const base = opts.technician ?? opts.requested ?? pick(rand, douala);
    const location = offsetPoint(rand, base.location, base.city === 'Douala' ? 3.5 : 8);
    const v = pick(rand, VEHICLES);
    const r: ServiceRequest = {
      id: id(),
      code: generateRequestCode(rand),
      driverId: opts.driver.id,
      contactName: opts.driver.fullName,
      contactPhone: opts.driver.phone ?? '+237600001999',
      requestedTechnicianId: opts.requested?.id ?? null,
      technicianId: null,
      status: 'pending',
      category,
      description: pick(rand, DESCRIPTIONS[category]),
      urgency: urgencyFor(category),
      aiSummary: null,
      vehicle: { type: v.type, make: v.make, model: v.model, color: v.color, plate: null, year: null },
      location,
      landmark: pick(rand, ['Devant la station-service', 'Face à la pharmacie', 'Au carrefour, à côté du marché', 'Près de l’école publique', 'Entrée du quartier, sous le panneau']),
      placeLabel: placeLabelFor(location),
      diagnosis: null,
      technicianLocation: null,
      createdAt: opts.createdAt,
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
      cancelledBy: null,
      updatedAt: opts.createdAt,
    };
    event(r, 'created', r.createdAt, 'driver');

    const steps: RequestStatus[] = ['accepted', 'en_route', 'arrived', 'quoted', 'in_progress', 'completed'];
    const target = opts.status;
    let at = r.createdAt;
    const tech = opts.technician;

    if (target === 'cancelled') {
      // Half are cancelled while pending, half after acceptance.
      if (tech && rand() < 0.5) {
        r.technicianId = tech.id;
        at = addMin(at, 4 + Math.floor(rand() * 10));
        r.acceptedAt = at;
        event(r, 'accepted', at, 'technician', { technicianName: tech.businessName });
      }
      at = addMin(at, 5 + Math.floor(rand() * 20));
      r.status = 'cancelled';
      r.cancelledAt = at;
      r.cancelledBy = 'driver';
      r.cancelReason = pick(rand, ['Le problème est réglé', "J'ai trouvé quelqu'un d'autre", "C'est trop long"]);
      r.updatedAt = at;
      event(r, 'cancelled', at, 'driver', { reason: r.cancelReason });
      out.requests.push(r);
      return r;
    }

    const targetIndex = target === 'pending' ? -1 : steps.indexOf(target);
    let quote: Quote | null = null;
    for (let i = 0; i <= targetIndex; i++) {
      const step = steps[i]!;
      if (!tech) break;
      switch (step) {
        case 'accepted':
          at = addMin(at, 3 + Math.floor(rand() * 15));
          r.technicianId = tech.id;
          r.acceptedAt = at;
          event(r, 'accepted', at, 'technician', { technicianName: tech.businessName });
          break;
        case 'en_route':
          at = addMin(at, 1 + Math.floor(rand() * 4));
          r.enRouteAt = at;
          event(r, 'en_route', at, 'technician');
          break;
        case 'arrived':
          at = addMin(at, 8 + Math.floor(rand() * 30));
          r.arrivedAt = at;
          event(r, 'arrived', at, 'technician');
          break;
        case 'quoted': {
          at = addMin(at, 6 + Math.floor(rand() * 10));
          const items = pick(rand, QUOTE_TEMPLATES[r.category]);
          r.diagnosis = 'Diagnostic confirmé sur place. ' + items.map((it) => it.label).join(', ') + '.';
          event(r, 'diagnosis', at, 'technician');
          quote = {
            id: id(),
            requestId: r.id,
            technicianId: tech.id,
            items,
            total: quoteTotal(items),
            note: null,
            status: 'pending',
            createdAt: at,
            respondedAt: null,
          };
          out.quotes.push(quote);
          event(r, 'quote_sent', at, 'technician', { total: quote.total });
          break;
        }
        case 'in_progress':
          at = addMin(at, 2 + Math.floor(rand() * 6));
          if (quote) {
            quote.status = 'accepted';
            quote.respondedAt = at;
            event(r, 'quote_accepted', at, 'driver', { total: quote.total });
          }
          r.startedAt = at;
          break;
        case 'completed': {
          at = addMin(at, 15 + Math.floor(rand() * 70));
          r.completedAt = at;
          event(r, 'completed', at, 'technician');
          const amount = quote?.total ?? 7000;
          const method: PaymentMethod = pickWeighted(rand, [
            ['cash', 55],
            ['mtn_momo', 30],
            ['orange_money', 15],
          ]);
          const ageDays = (now.getTime() - new Date(at).getTime()) / 86_400_000;
          out.payments.push({
            id: id(),
            requestId: r.id,
            requestCode: r.code,
            quoteId: quote?.id ?? null,
            technicianId: tech.id,
            technicianName: tech.businessName,
            amount,
            commission: commissionFor(amount),
            method,
            status: 'paid',
            paidAt: at,
            commissionSettledAt: ageDays > 7 && rand() < 0.8 ? addMin(at, 60 * 24 * 5) : null,
            createdAt: at,
          });
          break;
        }
      }
      r.status = step;
    }
    r.updatedAt = at;

    if (r.status === 'completed' && opts.reviewRating !== null) {
      const rating =
        opts.reviewRating ??
        pickWeighted(rand, [
          [5, 55],
          [4, 28],
          [3, 10],
          [2, 5],
          [1, 2],
        ]);
      // Never date a review in the future.
      const reviewAt = addMin(at, 10 + Math.floor(rand() * 120));
      if ((opts.reviewRating !== undefined || rand() < 0.82) && reviewAt < now.toISOString()) {
        const tags: ReviewTag[] =
          rating >= 4
            ? (['punctual', 'fair_price', 'professional', 'clear_explanation', 'quality_work'] as ReviewTag[]).filter(() => rand() < 0.4)
            : [];
        const comment = pick(rand, REVIEW_TEXT[rating]!);
        out.reviews.push({
          id: id(),
          requestId: r.id,
          technicianId: tech!.id,
          reviewerName: `${opts.driver.fullName.split(' ')[0]} ${opts.driver.fullName.split(' ').slice(-1)[0]![0]}.`,
          rating,
          comment: comment || null,
          tags,
          createdAt: reviewAt,
        });
        event(r, 'reviewed', reviewAt, 'driver', { rating });
      }
    }
    out.requests.push(r);
    return r;
  };

  // A month of finished jobs.
  for (let i = 0; i < 70; i++) {
    const daysAgo = 1 + Math.floor(rand() * 29);
    const hour = 6 + Math.floor(rand() * 16);
    const created = new Date(now.getTime() - daysAgo * 86_400_000);
    created.setUTCHours(hour - 1, Math.floor(rand() * 60), 0, 0);
    const tech = pickWeighted(rand, verified.map((t) => [t, 5 + t.jobsCompleted / 20] as [TechnicianPrivate, number]));
    makeRequest({
      createdAt: created.toISOString(),
      status: rand() < 0.84 ? 'completed' : 'cancelled',
      technician: tech,
      driver: pick(rand, drivers),
    });
  }

  // Today so far — started early enough that every step is already in the past.
  for (let i = 0; i < 5; i++) {
    const tech = pick(rand, douala);
    makeRequest({
      createdAt: addMin(now.toISOString(), -(240 + Math.floor(rand() * 240))),
      status: i === 4 ? 'cancelled' : 'completed',
      technician: tech,
      driver: pick(rand, drivers),
    });
  }

  const demoTech = technicians.find((t) => t.id === seedTechnicianId(DEMO_TECHNICIAN_N))!;
  const demoDriver: Profile = {
    id: DEMO_USER_IDS.driver,
    role: 'driver',
    fullName: 'Arielle Ekambi',
    email: 'arielle@demo.onyx',
    phone: '+237600002001',
    locale: 'fr',
    defaultVehicle: { type: 'car', make: 'Toyota', model: 'Yaris', color: 'blanc', plate: 'LT 482 KD', year: 2014 },
    createdAt: addMin(now.toISOString(), -60 * 24 * 60),
  };

  // The demo driver's own history.
  const byId = (n: number) => technicians.find((t) => t.id === seedTechnicianId(n))!;
  makeRequest({ createdAt: addMin(now.toISOString(), -60 * 24 * 12), status: 'completed', technician: byId(3), driver: demoDriver, category: 'flat_tire', reviewRating: 5 });
  makeRequest({ createdAt: addMin(now.toISOString(), -60 * 24 * 26), status: 'completed', technician: byId(8), driver: demoDriver, category: 'battery', reviewRating: 4 });
  makeRequest({ createdAt: addMin(now.toISOString(), -60 * 24 * 19), status: 'cancelled', technician: null, driver: demoDriver, category: 'overheating' });

  // Live work for the demo technician: one request waiting for them, one job on the way.
  const franck = drivers[0]!;
  const carine = drivers[3]!;
  makeRequest({ createdAt: addMin(now.toISOString(), -3), status: 'pending', technician: null, requested: demoTech, driver: franck, category: 'battery' });
  makeRequest({ createdAt: addMin(now.toISOString(), -22), status: 'en_route', technician: demoTech, driver: carine, category: 'warning_light' });

  out.requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  out.events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  out.drivers.push(demoDriver);
  return out;
}
