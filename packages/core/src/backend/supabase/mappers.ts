import type {
  Availability,
  CorridorId,
  DocumentKind,
  IssueCategory,
  Locale,
  PaymentMethod,
  PaymentStatus,
  QuoteStatus,
  RequestStatus,
  ReviewTag,
  Specialty,
  UrgencyLevel,
  UserRole,
  VehicleType,
  VerificationStatus,
} from '../../constants';
import type {
  InboxItem,
  Payment,
  Profile,
  Quote,
  QuoteItem,
  RequestEvent,
  RequestListItem,
  Review,
  ServiceRequest,
  Technician,
  TechnicianDocument,
  TechnicianPerformance,
  TechnicianPrivate,
  TechnicianWithDistance,
  Vehicle,
} from '../../types';

/** Columns anyone may read. Private columns are only returned by get_my_technician / admin_technicians. */
export const TECH_COLUMNS =
  'id,business_name,owner_name,bio,phone,whatsapp,specialties,vehicle_types,lat,lng,address,area,city,corridors,' +
  'service_radius_km,mobile_service,has_tow_truck,opening_hours,years_experience,photo_url,verification_status,' +
  'availability,availability_updated_at,last_seen_at,rating_avg,rating_count,jobs_completed,avg_response_minutes,created_at';

export const REVIEW_COLUMNS = 'id,request_id,technician_id,reviewer_name,rating,comment,tags,created_at';

/** Everything a request screen needs, in one round trip. */
export const REQUEST_DETAIL_SELECT = [
  '*',
  `technician:technicians!service_requests_technician_id_fkey(${TECH_COLUMNS})`,
  `requested:technicians!service_requests_requested_technician_id_fkey(${TECH_COLUMNS})`,
  'quotes(*)',
  'events:request_events(*)',
  `review:reviews(${REVIEW_COLUMNS})`,
  'payment:payments(*)',
].join(',');

export const REQUEST_LIST_SELECT =
  '*,technician:technicians!service_requests_technician_id_fkey(business_name,phone),quotes(total,status)';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const num = (v: unknown, fallback = 0) => (v === null || v === undefined ? fallback : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    role: r.role as UserRole,
    fullName: r.full_name ?? '',
    email: r.email ?? null,
    phone: r.phone ?? null,
    locale: (r.locale ?? 'fr') as Locale,
    defaultVehicle: (r.default_vehicle as Vehicle | null) ?? null,
    createdAt: r.created_at,
  };
}

export function mapTechnician(r: Row): Technician {
  return {
    id: r.id,
    businessName: r.business_name,
    ownerName: r.owner_name,
    bio: r.bio ?? null,
    phone: r.phone,
    whatsapp: r.whatsapp ?? null,
    specialties: (r.specialties ?? []) as Specialty[],
    vehicleTypes: (r.vehicle_types ?? []) as VehicleType[],
    location: { lat: num(r.lat), lng: num(r.lng) },
    address: r.address ?? null,
    area: r.area ?? '',
    city: r.city ?? '',
    corridors: (r.corridors ?? []) as CorridorId[],
    serviceRadiusKm: num(r.service_radius_km, 15),
    mobileService: Boolean(r.mobile_service),
    hasTowTruck: Boolean(r.has_tow_truck),
    openingHours: r.opening_hours ?? null,
    yearsExperience: numOrNull(r.years_experience),
    photoUrl: r.photo_url ?? null,
    verificationStatus: r.verification_status as VerificationStatus,
    availability: r.availability as Availability,
    availabilityUpdatedAt: r.availability_updated_at,
    lastSeenAt: r.last_seen_at ?? null,
    ratingAvg: num(r.rating_avg),
    ratingCount: num(r.rating_count),
    jobsCompleted: num(r.jobs_completed),
    avgResponseMinutes: numOrNull(r.avg_response_minutes),
    createdAt: r.created_at,
  };
}

export function mapTechnicianWithDistance(r: Row): TechnicianWithDistance {
  return { ...mapTechnician(r), distanceKm: num(r.distance_km) };
}

export function mapTechnicianPrivate(r: Row): TechnicianPrivate {
  return {
    ...mapTechnician(r),
    userId: r.user_id ?? null,
    verificationNote: r.verification_note ?? null,
    verifiedAt: r.verified_at ?? null,
  };
}

export function mapRequest(r: Row): ServiceRequest {
  return {
    id: r.id,
    code: r.code,
    driverId: r.driver_id,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    requestedTechnicianId: r.requested_technician_id ?? null,
    technicianId: r.technician_id ?? null,
    status: r.status as RequestStatus,
    category: r.category as IssueCategory,
    description: r.description ?? '',
    urgency: r.urgency as UrgencyLevel,
    aiSummary: r.ai_summary ?? null,
    vehicle: { type: 'car', ...(r.vehicle ?? {}) } as Vehicle,
    location: { lat: num(r.lat), lng: num(r.lng) },
    landmark: r.landmark,
    placeLabel: r.place_label ?? null,
    diagnosis: r.diagnosis ?? null,
    technicianLocation:
      r.technician_lat !== null && r.technician_lat !== undefined && r.technician_lng !== null && r.technician_lng !== undefined
        ? { lat: num(r.technician_lat), lng: num(r.technician_lng), at: r.technician_location_at }
        : null,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at ?? null,
    enRouteAt: r.en_route_at ?? null,
    arrivedAt: r.arrived_at ?? null,
    startedAt: r.started_at ?? null,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    cancelReason: r.cancel_reason ?? null,
    cancelledBy: (r.cancelled_by as UserRole | null) ?? null,
    updatedAt: r.updated_at,
  };
}

export function mapRequestListItem(r: Row): RequestListItem {
  const tech = one<Row>(r.technician);
  const accepted = (r.quotes as Row[] | undefined)?.find((q) => q.status === 'accepted');
  return {
    ...mapRequest(r),
    technicianName: tech?.business_name ?? null,
    technicianPhone: tech?.phone ?? null,
    acceptedTotal: accepted ? num(accepted.total) : null,
  };
}

export function mapQuote(r: Row): Quote {
  return {
    id: r.id,
    requestId: r.request_id,
    technicianId: r.technician_id,
    items: (r.items ?? []) as QuoteItem[],
    total: num(r.total),
    note: r.note ?? null,
    status: r.status as QuoteStatus,
    createdAt: r.created_at,
    respondedAt: r.responded_at ?? null,
  };
}

export function mapEvent(r: Row): RequestEvent {
  return {
    id: String(r.id),
    requestId: r.request_id,
    type: r.type,
    actorRole: (r.actor_role as UserRole | null) ?? null,
    message: r.message ?? null,
    data: (r.data as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at,
  };
}

export function mapReview(r: Row): Review {
  return {
    id: r.id,
    requestId: r.request_id,
    technicianId: r.technician_id,
    reviewerName: r.reviewer_name ?? '',
    rating: num(r.rating),
    comment: r.comment ?? null,
    tags: (r.tags ?? []) as ReviewTag[],
    createdAt: r.created_at,
  };
}

export function mapPayment(r: Row): Payment {
  return {
    id: r.id,
    requestId: r.request_id,
    requestCode: one<Row>(r.request)?.code ?? null,
    quoteId: r.quote_id ?? null,
    technicianId: r.technician_id,
    technicianName: one<Row>(r.technician)?.business_name ?? null,
    amount: num(r.amount),
    commission: num(r.commission),
    method: r.method as PaymentMethod,
    status: r.status as PaymentStatus,
    paidAt: r.paid_at ?? null,
    commissionSettledAt: r.commission_settled_at ?? null,
    createdAt: r.created_at,
  };
}

export function mapDocument(r: Row, url: string | null = null): TechnicianDocument {
  return {
    id: r.id,
    technicianId: r.technician_id,
    kind: r.kind as DocumentKind,
    fileName: r.file_name,
    storagePath: r.storage_path,
    url,
    createdAt: r.created_at,
  };
}

export function mapInboxItem(r: Row): InboxItem {
  return {
    id: r.id,
    code: r.code,
    category: r.category as IssueCategory,
    description: r.description ?? '',
    urgency: r.urgency as UrgencyLevel,
    aiSummary: r.ai_summary ?? null,
    vehicle: { type: 'car', ...(r.vehicle ?? {}) } as Vehicle,
    placeLabel: r.place_label ?? null,
    approxLocation: { lat: num(r.approx_lat), lng: num(r.approx_lng) },
    distanceKm: num(r.distance_km),
    isDirect: Boolean(r.is_direct),
    createdAt: r.created_at,
  };
}

export function mapPerformance(r: Row): TechnicianPerformance {
  return {
    technicianId: r.technician_id,
    businessName: r.business_name,
    area: r.area ?? '',
    verificationStatus: r.verification_status as VerificationStatus,
    jobsCompleted30d: num(r.jobs_completed_30d),
    jobsCancelled30d: num(r.jobs_cancelled_30d),
    completionRate: numOrNull(r.completion_rate),
    avgResponseMinutes: numOrNull(r.avg_response_minutes),
    ratingAvg: num(r.rating_avg),
    ratingCount: num(r.rating_count),
    revenue30d: num(r.revenue_30d),
  };
}

export function mapDetailRow(r: Row) {
  const quotes = ((r.quotes as Row[] | null) ?? []).map(mapQuote).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = ((r.events as Row[] | null) ?? [])
    .map(mapEvent)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || Number(a.id) - Number(b.id));
  const tech = one<Row>(r.technician);
  const requested = one<Row>(r.requested);
  const review = one<Row>(r.review);
  const payment = one<Row>(r.payment);
  return {
    request: mapRequest(r),
    technician: tech ? mapTechnician(tech) : null,
    requestedTechnician: requested ? mapTechnician(requested) : null,
    quotes,
    events,
    review: review ? mapReview(review) : null,
    payment: payment ? mapPayment(payment) : null,
  };
}
