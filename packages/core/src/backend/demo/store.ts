import type {
  Payment,
  Profile,
  Quote,
  RequestEvent,
  Review,
  ServiceRequest,
  TechnicianDocument,
  TechnicianPrivate,
} from '../../types';
import { DEMO_TECHNICIAN_N, DEMO_USER_IDS, SEED_TECHNICIANS, seedTechnicianId, seedToTechnician } from '../../seed/technicians';
import { generateDemoHistory } from '../../seed/history';
import { uuid } from '../../domain/codes';
import type { KeyValueStorage } from '../storage';
import { STORAGE_KEYS } from '../storage';

export const DEMO_DB_VERSION = 4;

export interface DemoDb {
  version: typeof DEMO_DB_VERSION;
  createdAt: string;
  profiles: Profile[];
  technicians: TechnicianPrivate[];
  requests: ServiceRequest[];
  events: RequestEvent[];
  quotes: Quote[];
  reviews: Review[];
  payments: Payment[];
  declines: { requestId: string; technicianId: string }[];
  documents: TechnicianDocument[];
  sessionUserId: string | null;
}

export function createSeedDb(now: Date = new Date()): DemoDb {
  const technicians = SEED_TECHNICIANS.map((s) => seedToTechnician(s, now));
  const demoTech = technicians.find((t) => t.id === seedTechnicianId(DEMO_TECHNICIAN_N))!;
  demoTech.userId = DEMO_USER_IDS.technician;

  const history = generateDemoHistory(technicians, now);
  const profiles: Profile[] = [
    ...history.drivers,
    {
      id: DEMO_USER_IDS.technician,
      role: 'technician',
      fullName: demoTech.ownerName,
      email: 'jeanpaul@demo.onyx',
      phone: demoTech.phone,
      locale: 'fr',
      defaultVehicle: null,
      createdAt: demoTech.createdAt,
    },
    {
      id: DEMO_USER_IDS.admin,
      role: 'admin',
      fullName: 'Équipe ONYX',
      email: 'admin@demo.onyx',
      phone: null,
      locale: 'fr',
      defaultVehicle: null,
      createdAt: new Date(now.getTime() - 300 * 86_400_000).toISOString(),
    },
  ];

  const documents: TechnicianDocument[] = technicians
    .filter((t) => t.verificationStatus !== 'verified' || t.id === demoTech.id)
    .flatMap((t) =>
      (['id_card', 'garage_photo'] as const).map((kind) => ({
        id: uuid(),
        technicianId: t.id,
        kind,
        fileName: kind === 'id_card' ? 'cni-recto-verso.jpg' : 'atelier.jpg',
        storagePath: `${t.id}/${kind}.jpg`,
        url: null,
        createdAt: t.createdAt,
      })),
    );

  return {
    version: DEMO_DB_VERSION,
    createdAt: now.toISOString(),
    profiles,
    technicians,
    requests: history.requests,
    events: history.events,
    quotes: history.quotes,
    reviews: history.reviews,
    payments: history.payments,
    declines: [],
    documents,
    sessionUserId: null,
  };
}

/** In-memory database persisted to key-value storage, with change notifications. */
export class DemoStore {
  db: DemoDb;
  private listeners = new Set<() => void>();
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private storage: KeyValueStorage,
    db: DemoDb,
  ) {
    this.db = db;
  }

  static async open(storage: KeyValueStorage): Promise<DemoStore> {
    const saved = parse(await storage.getItem(STORAGE_KEYS.demoDb));
    const db = saved ? bringToNow(saved) : createSeedDb();
    const store = new DemoStore(storage, db);
    store.persist();
    return store;
  }

  /** Re-read storage (another tab changed it). */
  async reload(): Promise<void> {
    const next = parse(await this.storage.getItem(STORAGE_KEYS.demoDb));
    if (next) {
      this.db = next;
      this.emit();
    }
  }

  mutate<T>(fn: (db: DemoDb) => T): T {
    const result = fn(this.db);
    this.persist();
    this.emit();
    return result;
  }

  reset(keepSession = true): void {
    const sessionUserId = keepSession ? this.db.sessionUserId : null;
    this.db = createSeedDb();
    this.db.sessionUserId = sessionUserId;
    this.persist(true);
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private persist(immediate = false) {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    const write = () => {
      this.writeTimer = null;
      void this.storage.setItem(STORAGE_KEYS.demoDb, JSON.stringify(this.db));
    };
    if (immediate) write();
    else this.writeTimer = setTimeout(write, 60);
  }

  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
      void this.storage.setItem(STORAGE_KEYS.demoDb, JSON.stringify(this.db));
    }
  }
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const PAUSE_AFTER_MS = 15 * 60_000;

/**
 * The demo world is generated once and kept on the device. So that it never looks
 * abandoned (technicians unseen for days, nothing happening today), every timestamp moves
 * forward by the time since the story last moved on, as if the phone had only just been
 * put down. Relative times are kept, and nothing ends up in the future.
 */
export function bringToNow(db: DemoDb, now: number = Date.now()): DemoDb {
  // The story is the requests and what happened to them. Presence pings don't count, or an
  // open technician dashboard would stop the clock from ever moving.
  const latest = Math.max(
    Date.parse(db.createdAt),
    ...db.requests.map((r) => Date.parse(r.updatedAt)),
    ...db.events.map((e) => Date.parse(e.createdAt)),
  );
  const shift = now - latest;
  if (!(shift >= PAUSE_AFTER_MS)) return db;
  return JSON.parse(JSON.stringify(db), (_key, value: unknown) =>
    typeof value === 'string' && ISO_TIMESTAMP.test(value)
      ? new Date(Math.min(Date.parse(value) + shift, now)).toISOString()
      : value,
  ) as DemoDb;
}

function parse(raw: string | null): DemoDb | null {
  if (!raw) return null;
  try {
    const db = JSON.parse(raw) as DemoDb;
    return db?.version === DEMO_DB_VERSION ? db : null;
  } catch {
    return null;
  }
}
