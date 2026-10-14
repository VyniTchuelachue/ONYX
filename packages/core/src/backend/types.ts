import type {
  Availability,
  Locale,
  DocumentKind,
  RequestStatus,
  Specialty,
  UserRole,
  VerificationStatus,
  CorridorId,
} from '../constants';
import type {
  CompleteInput,
  CreateRequestInput,
  ProfilePatch,
  PushDevice,
  QuoteInput,
  ReviewInput,
  SignInInput,
  SignUpInput,
  TechnicianInput,
} from '../schemas';
import type {
  AdminMetrics,
  GeoPoint,
  InboxItem,
  Payment,
  Profile,
  ProStats,
  RequestDetail,
  RequestListItem,
  Review,
  ServiceRequest,
  Technician,
  TechnicianDocument,
  TechnicianPerformance,
  TechnicianPrivate,
  TechnicianWithDistance,
} from '../types';

/**
 * The ONYX backend contract. The web app (and the future React Native app) talks only to
 * this interface; `createSupabaseBackend` is the production implementation and
 * `createDemoBackend` runs fully on-device for demos and UI work.
 */
export interface OnyxBackend {
  mode: 'supabase' | 'demo';
  auth: AuthPort;
  directory: DirectoryPort;
  requests: DriverRequestsPort;
  pro: ProPort;
  admin: AdminPort;
  notifications: NotificationsPort;
  /** Stop timers/subscriptions (tests, hot reload). */
  dispose(): void;
}

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
}

export interface DemoAccount {
  role: UserRole;
  userId: string;
  name: string;
}

export interface AuthPort {
  getSession(): Promise<Session | null>;
  onChange(listener: (session: Session | null) => void): () => void;
  signIn(input: SignInInput): Promise<Session>;
  /** `redirectPath`: where the confirmation link should land, e.g. `/pro/onboarding`. */
  signUp(input: SignUpInput, options?: { redirectPath?: string }): Promise<{ session: Session | null; needsEmailConfirmation: boolean }>;
  /** Emails a link to choose a new password. Resolves the same way whether or not the address has an account. */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password for the signed-in user (after following the reset link). */
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  /** Bearer token for calling ONYX HTTP APIs (e.g. the assistant). */
  getAccessToken(): Promise<string | null>;
  /** Demo backend only. */
  demo?: {
    accounts: DemoAccount[];
    signInAs(role: UserRole): Promise<Session>;
    reset(): Promise<void>;
  };
}

export interface NearbyQuery {
  center: GeoPoint;
  radiusKm: number;
  specialty?: Specialty | null;
  availableOnly?: boolean;
  corridor?: CorridorId | null;
  limit?: number;
}

export interface DirectoryPort {
  nearby(query: NearbyQuery): Promise<TechnicianWithDistance[]>;
  get(id: string): Promise<Technician | null>;
  reviews(technicianId: string, limit?: number): Promise<Review[]>;
  /** Everything a phone should keep for offline use around a point. */
  snapshot(center: GeoPoint, radiusKm: number): Promise<Technician[]>;
}

export interface DriverRequestsPort {
  create(input: CreateRequestInput & { placeLabel?: string | null }): Promise<ServiceRequest>;
  listMine(): Promise<RequestListItem[]>;
  get(id: string): Promise<RequestDetail | null>;
  cancel(id: string, reason: string): Promise<void>;
  respondToQuote(quoteId: string, accept: boolean): Promise<void>;
  review(input: ReviewInput): Promise<void>;
  /** Call `onChange` whenever the request, its quotes or its events change. */
  subscribe(id: string, onChange: () => void): () => void;
}

export interface ProPort {
  /** The signed-in user's technician listing, or null. */
  me(): Promise<TechnicianPrivate | null>;
  register(input: TechnicianInput): Promise<TechnicianPrivate>;
  update(input: TechnicianInput): Promise<TechnicianPrivate>;
  setAvailability(availability: Availability): Promise<void>;
  /** Mark the technician as active now (keeps "available" honest). */
  heartbeat(): Promise<void>;
  documents(): Promise<TechnicianDocument[]>;
  uploadDocument(kind: DocumentKind, file: Blob, fileName: string): Promise<TechnicianDocument>;
  inbox(): Promise<InboxItem[]>;
  jobs(scope: 'active' | 'history'): Promise<RequestListItem[]>;
  job(id: string): Promise<RequestDetail | null>;
  accept(requestId: string): Promise<void>;
  decline(requestId: string): Promise<void>;
  release(requestId: string, reason?: string): Promise<void>;
  cancel(requestId: string, reason: string): Promise<void>;
  advance(requestId: string, status: Extract<RequestStatus, 'en_route' | 'arrived' | 'in_progress'>): Promise<void>;
  saveDiagnosis(requestId: string, diagnosis: string): Promise<void>;
  sendQuote(requestId: string, input: QuoteInput): Promise<void>;
  complete(requestId: string, input: CompleteInput): Promise<void>;
  shareLocation(requestId: string, point: GeoPoint): Promise<void>;
  stats(): Promise<ProStats>;
  /** Called when new requests may be waiting. Implementations may poll. */
  subscribeInbox(onChange: () => void): () => void;
  subscribeJob(requestId: string, onChange: () => void): () => void;
}

/** Phone alerts: which devices the signed-in person wants them on. */
export interface NotificationsPort {
  /** Remember this device (a Web Push subscription) for the signed-in person. */
  saveDevice(device: PushDevice, options: { locale: Locale; userAgent?: string | null }): Promise<void>;
  /** Stop alerts on this device, e.g. before signing out. */
  forgetDevice(endpoint: string): Promise<void>;
}

export interface AdminTechnicianDetail {
  technician: TechnicianPrivate;
  documents: TechnicianDocument[];
  reviews: Review[];
  performance: TechnicianPerformance | null;
}

export interface AdminPort {
  metrics(): Promise<AdminMetrics>;
  technicians(status?: VerificationStatus | null): Promise<TechnicianPrivate[]>;
  technician(id: string): Promise<AdminTechnicianDetail | null>;
  setVerification(id: string, status: VerificationStatus, note?: string | null): Promise<void>;
  requests(filter?: RequestStatus | 'active' | null): Promise<RequestListItem[]>;
  request(id: string): Promise<RequestDetail | null>;
  cancelRequest(id: string, reason: string): Promise<void>;
  payments(): Promise<Payment[]>;
  settleCommission(paymentId: string): Promise<void>;
  reviews(): Promise<Review[]>;
  performance(): Promise<TechnicianPerformance[]>;
}
