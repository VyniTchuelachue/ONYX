import type {
  Availability,
  CorridorId,
  DocumentKind,
  IssueCategory,
  Locale,
  PaymentMethod,
  PaymentStatus,
  QuoteItemKind,
  QuoteStatus,
  RequestStatus,
  ReviewTag,
  Specialty,
  UrgencyLevel,
  UserRole,
  VehicleType,
  VerificationStatus,
} from './constants';

/** ISO-8601 timestamp string. */
export type Timestamp = string;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Vehicle {
  type: VehicleType;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  color?: string | null;
}

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string | null;
  phone: string | null;
  locale: Locale;
  defaultVehicle: Vehicle | null;
  createdAt: Timestamp;
}

/** Public directory entry. Only verified technicians are listed to drivers. */
export interface Technician {
  id: string;
  businessName: string;
  ownerName: string;
  bio: string | null;
  phone: string;
  whatsapp: string | null;
  specialties: Specialty[];
  vehicleTypes: VehicleType[];
  location: GeoPoint;
  address: string | null;
  area: string;
  city: string;
  corridors: CorridorId[];
  serviceRadiusKm: number;
  mobileService: boolean;
  hasTowTruck: boolean;
  openingHours: string | null;
  yearsExperience: number | null;
  photoUrl: string | null;
  verificationStatus: VerificationStatus;
  availability: Availability;
  availabilityUpdatedAt: Timestamp;
  lastSeenAt: Timestamp | null;
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
  avgResponseMinutes: number | null;
  createdAt: Timestamp;
}

export interface TechnicianWithDistance extends Technician {
  distanceKm: number;
}

/** What the technician themself and admins can see. */
export interface TechnicianPrivate extends Technician {
  userId: string | null;
  verificationNote: string | null;
  verifiedAt: Timestamp | null;
}

export interface TechnicianDocument {
  id: string;
  technicianId: string;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  /** Short-lived URL to view the file, when available. */
  url: string | null;
  createdAt: Timestamp;
}

export interface ServiceRequest {
  id: string;
  code: string;
  driverId: string;
  contactName: string;
  contactPhone: string;
  requestedTechnicianId: string | null;
  technicianId: string | null;
  status: RequestStatus;
  category: IssueCategory;
  description: string;
  urgency: UrgencyLevel;
  aiSummary: string | null;
  vehicle: Vehicle;
  location: GeoPoint;
  landmark: string;
  placeLabel: string | null;
  diagnosis: string | null;
  technicianLocation: (GeoPoint & { at: Timestamp }) | null;
  createdAt: Timestamp;
  acceptedAt: Timestamp | null;
  enRouteAt: Timestamp | null;
  arrivedAt: Timestamp | null;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  cancelReason: string | null;
  cancelledBy: UserRole | null;
  updatedAt: Timestamp;
}

export const REQUEST_EVENT_TYPES = [
  'created',
  'accepted',
  'declined',
  'released',
  'en_route',
  'arrived',
  'diagnosis',
  'quote_sent',
  'quote_accepted',
  'quote_declined',
  'started',
  'completed',
  'cancelled',
  'reviewed',
] as const;
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];

export interface RequestEvent {
  id: string;
  requestId: string;
  type: RequestEventType;
  actorRole: UserRole | null;
  message: string | null;
  data: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface QuoteItem {
  label: string;
  kind: QuoteItemKind;
  quantity: number;
  /** Unit price in XAF (integer). */
  unitPrice: number;
}

export interface Quote {
  id: string;
  requestId: string;
  technicianId: string;
  items: QuoteItem[];
  /** Total in XAF, always computed server-side. */
  total: number;
  note: string | null;
  status: QuoteStatus;
  createdAt: Timestamp;
  respondedAt: Timestamp | null;
}

export interface Review {
  id: string;
  requestId: string;
  technicianId: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  tags: ReviewTag[];
  createdAt: Timestamp;
}

export interface Payment {
  id: string;
  requestId: string;
  requestCode: string | null;
  quoteId: string | null;
  technicianId: string;
  technicianName: string | null;
  amount: number;
  commission: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Timestamp | null;
  commissionSettledAt: Timestamp | null;
  createdAt: Timestamp;
}

/** A request in a list, with the few joined fields lists need. */
export interface RequestListItem extends ServiceRequest {
  technicianName: string | null;
  technicianPhone: string | null;
  acceptedTotal: number | null;
}

export interface RequestDetail {
  request: ServiceRequest;
  technician: Technician | null;
  requestedTechnician: Technician | null;
  quotes: Quote[];
  events: RequestEvent[];
  review: Review | null;
  payment: Payment | null;
}

/**
 * A request offered to a technician before acceptance. Contact details and the exact
 * position are withheld until the technician accepts.
 */
export interface InboxItem {
  id: string;
  code: string;
  category: IssueCategory;
  description: string;
  urgency: UrgencyLevel;
  aiSummary: string | null;
  vehicle: Vehicle;
  placeLabel: string | null;
  approxLocation: GeoPoint;
  distanceKm: number;
  isDirect: boolean;
  createdAt: Timestamp;
}

export interface ProStats {
  activeJobs: number;
  jobsThisMonth: number;
  revenueThisMonth: number;
  commissionDue: number;
  jobsCompleted: number;
  ratingAvg: number;
  ratingCount: number;
  avgResponseMinutes: number | null;
}

export interface DailyCount {
  /** YYYY-MM-DD in Douala time. */
  date: string;
  created: number;
  completed: number;
  cancelled: number;
}

export interface AdminMetrics {
  generatedAt: Timestamp;
  requests: {
    today: number;
    last7d: number;
    last30d: number;
    active: number;
    completed30d: number;
    cancelled30d: number;
    /** completed / (completed + cancelled) over 30 days, 0..1 */
    completionRate: number | null;
  };
  avgResponseMinutes: number | null;
  avgArrivalMinutes: number | null;
  rating: {
    avg: number | null;
    count: number;
    /** Share of 4–5 star reviews, 0..1 */
    csat: number | null;
    /** Counts for 1..5 stars. */
    distribution: [number, number, number, number, number];
  };
  revenue: {
    gmv30d: number;
    commission30d: number;
    commissionUnsettled: number;
  };
  technicians: {
    verified: number;
    pending: number;
    availableNow: number;
  };
  daily: DailyCount[];
  byCategory: { category: IssueCategory; count: number }[];
}

export interface TechnicianPerformance {
  technicianId: string;
  businessName: string;
  area: string;
  verificationStatus: VerificationStatus;
  jobsCompleted30d: number;
  jobsCancelled30d: number;
  completionRate: number | null;
  avgResponseMinutes: number | null;
  ratingAvg: number;
  ratingCount: number;
  revenue30d: number;
}
