// Operation -> REST route table for the Spring backend.
//
// Screens keep calling `request('plans.get', { coachId })`; this file is the
// single place that knows which endpoint that maps to. Adding an endpoint means
// adding a row here, not touching a screen.

export type Op =
  | 'me.get'
  | 'coaches.list'
  | 'coach.getPublic'
  | 'coach.updateProfile'
  | 'packages.mine'
  | 'package.save'
  | 'package.delete'
  | 'package.get'
  | 'subs.mine'
  | 'subs.cancel'
  | 'checkout.create'
  | 'checkout.pay'
  | 'checkout.status'
  | 'plans.get'
  | 'plan.saveWorkout'
  | 'plan.saveDiet'
  | 'templates.list'
  | 'templates.save'
  | 'templates.delete'
  | 'templates.assign'
  | 'workout.toggle'
  | 'diet.toggle'
  | 'progress.mine'
  | 'progress.client'
  | 'progress.log'
  | 'chat.context'
  | 'chat.get'
  | 'chat.send'
  | 'chat.read'
  | 'chat.threads'
  | 'chat.clientSummary'
  | 'coach.clients'
  | 'coach.clientDetail'
  | 'coach.revenue'
  | 'admin.overview'
  | 'admin.decide'
  | 'admin.setSuspended'
  | 'admin.forceLogout';

/** Loose on purpose: each row narrows the fields it actually reads. */
export type Payload = Record<string, unknown>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path (and query string) for this call. */
  path: (p: Payload) => string;
  /** JSON body, or undefined for GET/DELETE. */
  body?: (p: Payload) => unknown;
}

function query(params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Reads a required path segment; a missing id is a programming error, not a 404. */
function seg(p: Payload, key: string): string {
  const value = p[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`request() called without required "${key}"`);
  }
  return encodeURIComponent(value);
}

export const ROUTES: Record<Op, Route> = {
  // ------------------------------------------------------------ users ---
  'me.get': { method: 'GET', path: () => '/api/users/me' },

  // ---------------------------------------------------------- coaches ---
  'coaches.list': { method: 'GET', path: () => '/api/coaches' },
  'coach.getPublic': { method: 'GET', path: (p) => `/api/coaches/${seg(p, 'coachId')}` },
  'coach.updateProfile': {
    method: 'PUT',
    path: () => '/api/coach/profile',
    body: (p) => ({
      bio: p.bio,
      specialties: p.specialties,
      experienceYears: p.experienceYears,
    }),
  },

  // --------------------------------------------------------- packages ---
  'packages.mine': { method: 'GET', path: () => '/api/coach/packages' },
  'package.save': {
    method: 'POST',
    path: () => '/api/coach/packages',
    body: (p) => ({
      id: p.id,
      title: p.title,
      priceCents: p.priceCents,
      durationDays: p.durationDays,
      features: p.features,
    }),
  },
  'package.delete': { method: 'DELETE', path: (p) => `/api/coach/packages/${seg(p, 'id')}` },
  'package.get': { method: 'GET', path: (p) => `/api/packages/${seg(p, 'packageId')}` },

  // ---------------------------------------------------- subscriptions ---
  'subs.mine': { method: 'GET', path: () => '/api/subscriptions' },
  'subs.cancel': { method: 'POST', path: (p) => `/api/subscriptions/${seg(p, 'subId')}/cancel` },

  // --------------------------------------------------------- checkout ---
  'checkout.create': {
    method: 'POST',
    path: () => '/api/checkout',
    body: (p) => ({ packageId: p.packageId }),
  },
  'checkout.pay': {
    method: 'POST',
    path: (p) => `/api/checkout/${seg(p, 'paymentId')}/pay`,
    body: (p) => ({ mode: p.mode ?? 'capture' }),
  },
  'checkout.status': { method: 'GET', path: (p) => `/api/checkout/${seg(p, 'paymentId')}/status` },

  // ------------------------------------------------------------ plans ---
  'plans.get': {
    method: 'GET',
    path: (p) => `/api/plans${query({ coachId: p.coachId, clientId: p.clientId })}`,
  },
  'plan.saveWorkout': {
    method: 'PUT',
    path: () => '/api/plans/workout',
    body: (p) => ({ clientId: p.clientId, title: p.title, days: p.days }),
  },
  'plan.saveDiet': {
    method: 'PUT',
    path: () => '/api/plans/diet',
    body: (p) => ({
      clientId: p.clientId,
      title: p.title,
      targetKcal: p.targetKcal,
      meals: p.meals,
      notes: p.notes,
    }),
  },

  // ------------------------------------------------- plan templates ---
  'templates.list': { method: 'GET', path: () => '/api/plan-templates' },
  'templates.save': {
    method: 'POST',
    path: () => '/api/plan-templates',
    body: (p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      note: p.note,
      days: p.days,
      diet: p.diet,
    }),
  },
  'templates.delete': { method: 'DELETE', path: (p) => `/api/plan-templates/${seg(p, 'id')}` },
  'templates.assign': {
    method: 'POST',
    path: (p) => `/api/plan-templates/${seg(p, 'templateId')}/assign`,
    body: (p) => ({ clientId: p.clientId }),
  },

  // -------------------------------------------- gamified check-offs ---
  'workout.toggle': {
    method: 'POST',
    path: () => '/api/plans/workout/check',
    body: (p) => ({ coachId: p.coachId, day: p.day, exercise: p.exercise }),
  },
  'diet.toggle': {
    method: 'POST',
    path: () => '/api/plans/diet/check',
    body: (p) => ({ coachId: p.coachId, meal: p.meal, item: p.item }),
  },

  // --------------------------------------------------------- progress ---
  'progress.mine': { method: 'GET', path: (p) => `/api/progress${query({ coachId: p.coachId })}` },
  'progress.client': { method: 'GET', path: (p) => `/api/progress/client/${seg(p, 'clientId')}` },
  'progress.log': {
    method: 'POST',
    path: () => '/api/progress',
    body: (p) => ({
      weightKg: p.weightKg,
      measurements: p.measurements,
      notes: p.notes,
      photoUrl: p.photoUrl,
    }),
  },

  // ------------------------------------------------------------- chat ---
  'chat.context': {
    method: 'GET',
    path: (p) => `/api/chat/context${query({ coachId: p.coachId, clientId: p.clientId })}`,
  },
  'chat.get': {
    method: 'GET',
    path: (p) => `/api/chat${query({ coachId: p.coachId, clientId: p.clientId })}`,
  },
  'chat.send': {
    method: 'POST',
    path: () => '/api/chat',
    body: (p) => ({ coachId: p.coachId, clientId: p.clientId, body: p.body }),
  },
  'chat.read': {
    method: 'POST',
    path: () => '/api/chat/read',
    body: (p) => ({ coachId: p.coachId, clientId: p.clientId }),
  },
  'chat.threads': { method: 'GET', path: () => '/api/chat/threads' },
  'chat.clientSummary': { method: 'GET', path: () => '/api/chat/summary' },

  // ---------------------------------------------------- coach console ---
  'coach.clients': { method: 'GET', path: () => '/api/coach/clients' },
  'coach.clientDetail': { method: 'GET', path: (p) => `/api/coach/clients/${seg(p, 'clientId')}` },
  'coach.revenue': { method: 'GET', path: () => '/api/coach/revenue' },

  // ------------------------------------------------------------ admin ---
  'admin.overview': { method: 'GET', path: () => '/api/admin/overview' },
  'admin.decide': {
    method: 'POST',
    path: (p) => `/api/admin/coaches/${seg(p, 'userId')}/${p.approve ? 'approve' : 'reject'}`,
  },
  'admin.setSuspended': {
    method: 'POST',
    path: (p) => `/api/admin/users/${seg(p, 'userId')}/${p.suspended ? 'suspend' : 'reinstate'}`,
  },
  'admin.forceLogout': {
    method: 'POST',
    path: (p) => `/api/admin/users/${seg(p, 'userId')}/force-logout`,
  },
};
