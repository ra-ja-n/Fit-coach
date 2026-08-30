// ============================================================================
// Embedded sandbox implementation of the FitCoach backend API.
//
// This module faithfully implements the same contract as the Java Spring Boot
// service in fitcoach-backend/: JWT access (~15 min) + refresh (~30 days)
// tokens, BCrypt-style hashing, lockout after 5 failed attempts, the
// OwnershipGuard (single source of truth for coach/client scoping),
// webhook-driven idempotent payment activation, and the @Scheduled expiry
// job. In this sandbox the "network" is simulated with latency and the
// database is persisted locally; on device builds the app talks to the real
// REST/WebSocket endpoints instead.
//
// SECURITY MODEL (mirrors OwnershipGuard.java):
//  - Every private record denormalizes coach_id + client_id.
//  - Before returning anything: requester is the coach, the client, or admin.
//    Otherwise -> 404 NOT_FOUND (identical to a missing resource).
//  - Writes additionally require an ACTIVE subscription.
//  - Expired subs keep READ access (read-only), never write/messaging.
// ============================================================================
import { getDB, persist, uid, hashPassword, type DB, type UserRow } from './db';
import { ApiError } from './errors';
import { emitRealtime } from './realtime';
import type {
  AdminOverview, ChatContext, ChatMessage, ChatThreadRow, CheckoutStatus,
  ClientDetailBundle, CoachClientRow, CoachProfile, DietPlan, Package,
  PlansBundle, ProgressEntry, RevenueSummary, Role, SessionUser,
  SubscriptionRow, WorkoutPlan,
} from './types';

const SECRET = 'fitcoach-sandbox-signing-secret';
const WEBHOOK_SECRET = 'whsec_sandbox';
const ACCESS_TTL_MS = 15 * 60 * 1000; // ~15 minutes
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Token plumbing (JJWT on the real backend)
// ---------------------------------------------------------------------------
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

interface TokenPayload { sub: string; role: Role; jti: string; exp: number; typ: 'access' | 'refresh' }

function issueToken(user: UserRow, typ: 'access' | 'refresh', ttl: number): { token: string; jti: string } {
  const jti = uid();
  const payload: TokenPayload = { sub: user.id, role: user.role, jti, exp: Date.now() + ttl, typ };
  const body = encodeURIComponent(JSON.stringify(payload));
  return { token: `${body}.${djb2(body + SECRET)}`, jti };
}

export function parseToken(token: string): TokenPayload {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  const body = token.slice(0, idx);
  if (djb2(body + SECRET) !== token.slice(idx + 1)) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(decodeURIComponent(body));
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  }
  if (payload.exp < Date.now()) throw new ApiError(401, 'TOKEN_EXPIRED', 'Session expired.');
  return payload;
}

export function tokenExpiresAt(token: string): number {
  try {
    const idx = token.lastIndexOf('.');
    const payload = JSON.parse(decodeURIComponent(token.slice(0, idx))) as TokenPayload;
    return payload.exp;
  } catch {
    return 0;
  }
}

const delay = () => new Promise<void>((r) => setTimeout(r, 180 + Math.random() * 240));

function securityLog(msg: string) {
  // Security-relevant events go to logs/monitoring only — never to users.
  console.warn(`[SECURITY] ${msg}`);
}

// ---------------------------------------------------------------------------
// OwnershipGuard — the single source of truth for coach/client scoping.
// ---------------------------------------------------------------------------
function assertPairAccess(actor: UserRow, coachId: string, clientId: string) {
  if (actor.role === 'admin') return;
  if (actor.role === 'coach' && actor.id === coachId) return;
  if (actor.role === 'client' && actor.id === clientId) return;
  securityLog(`cross-tenant access blocked: user=${actor.email} role=${actor.role} attempted pair coach=${coachId} client=${clientId}`);
  // Deliberately identical to "missing" — guessed IDs reveal nothing.
  throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
}

function findActiveSub(db: DB, coachId: string, clientId: string) {
  return db.subscriptions.find((s) => s.coachId === coachId && s.clientId === clientId && s.status === 'active');
}

function requireActiveSub(db: DB, coachId: string, clientId: string) {
  const sub = findActiveSub(db, coachId, clientId);
  if (!sub) {
    const coach = db.users.find((u) => u.id === coachId);
    const anyPast = db.subscriptions.some((s) => s.coachId === coachId && s.clientId === clientId);
    throw new ApiError(
      403,
      anyPast ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIBE_REQUIRED',
      anyPast ? 'Your coaching plan has ended. Renew to continue.' : 'Subscribe to unlock this.',
      { coachId, coachName: coach?.name ?? 'your coach' }
    );
  }
  return sub;
}

function assertRole(actor: UserRow, role: Role) {
  if (actor.role !== role) throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this.');
}

async function authActor(token: string | null): Promise<UserRow> {
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  const payload = parseToken(token);
  if (payload.typ !== 'access') throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  const db = await getDB();
  const user = db.users.find((u) => u.id === payload.sub);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
  if (user.suspended) throw new ApiError(403, 'SUSPENDED', 'This account has been suspended.');
  return user;
}

function toSessionUser(db: DB, u: UserRow): SessionUser {
  const base: SessionUser = { id: u.id, role: u.role, name: u.name, email: u.email };
  if (u.role === 'coach') {
    const p = db.coachProfiles.find((c) => c.userId === u.id);
    base.coachStatus = p?.status ?? 'pending';
  }
  return base;
}

function ensureThread(db: DB, coachId: string, clientId: string) {
  let t = db.chatThreads.find((x) => x.coachId === coachId && x.clientId === clientId);
  if (!t) {
    t = { coachId, clientId, lastReadByCoach: new Date(0).toISOString(), lastReadByClient: new Date(0).toISOString() };
    db.chatThreads.push(t);
  }
  return t;
}

function unreadFor(db: DB, coachId: string, clientId: string, role: 'coach' | 'client'): number {
  const t = db.chatThreads.find((x) => x.coachId === coachId && x.clientId === clientId);
  const cutoff = role === 'coach' ? t?.lastReadByCoach : t?.lastReadByClient;
  return db.chatMessages.filter(
    (m) => m.coachId === coachId && m.clientId === clientId && m.senderId !== (role === 'coach' ? coachId : clientId) && (!cutoff || m.createdAt > cutoff)
  ).length;
}

// ---------------------------------------------------------------------------
// Webhook-driven payment activation (idempotent, signature-verified).
// ---------------------------------------------------------------------------
function handlePaymentWebhook(eventId: string, signature: string, payload: { paymentId: string }) {
  getDB().then(async (db) => {
    const expected = djb2(eventId + payload.paymentId + WEBHOOK_SECRET);
    if (signature !== expected) {
      securityLog(`webhook rejected: bad signature for event ${eventId}`);
      return;
    }
    if (db.processedWebhookEvents.includes(eventId)) return; // duplicate delivery — idempotent
    const payment = db.payments.find((p) => p.id === payload.paymentId);
    if (!payment || payment.status === 'captured') {
      db.processedWebhookEvents.push(eventId);
      await persist();
      return;
    }
    const pkg = db.packages.find((p) => p.id === payment.packageId);
    if (!pkg) return;
    payment.status = 'captured';
    const now = new Date();
    const end = new Date(now.getTime() + pkg.durationDays * 86400000);
    // UNIQUE(client_id, coach_id) WHERE status='active' — enforced here.
    const existingActive = findActiveSub(db, payment.coachId, payment.clientId);
    if (existingActive) {
      existingActive.endDate = end.toISOString(); // extend rather than duplicate
      existingActive.packageId = pkg.id;
      existingActive.paymentId = payment.id;
    } else {
      db.subscriptions.push({
        id: uid(), clientId: payment.clientId, coachId: payment.coachId, packageId: pkg.id,
        status: 'active', startDate: now.toISOString(), endDate: end.toISOString(), paymentId: payment.id,
      });
    }
    db.processedWebhookEvents.push(eventId);
    await persist();
    emitRealtime({ type: 'subscription', coachId: payment.coachId, clientId: payment.clientId });
  });
}

// ---------------------------------------------------------------------------
// @Scheduled expiry job — runs on app boot and every minute in the sandbox.
// ---------------------------------------------------------------------------
export async function runExpiryJob(): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  let changed = false;
  for (const s of db.subscriptions) {
    if (s.status === 'active' && new Date(s.endDate).getTime() < now) {
      s.status = 'expired';
      changed = true;
      emitRealtime({ type: 'subscription', coachId: s.coachId, clientId: s.clientId });
    }
  }
  for (const t of db.refreshTokens) {
    if (!t.revoked && t.expiresAt < now) t.revoked = true;
  }
  if (changed) await persist();
}

// ---------------------------------------------------------------------------
// Endpoint dispatch
// ---------------------------------------------------------------------------
export type Op =
  | 'me.get' | 'auth.logout'
  | 'coaches.list' | 'coach.getPublic' | 'coach.updateProfile'
  | 'packages.mine' | 'package.save' | 'package.delete' | 'package.get'
  | 'subs.mine' | 'subs.cancel'
  | 'checkout.create' | 'checkout.pay' | 'checkout.status'
  | 'plans.get' | 'plan.saveWorkout' | 'plan.saveDiet'
  | 'templates.list' | 'templates.save' | 'templates.delete' | 'templates.assign'
  | 'workout.toggle' | 'diet.toggle'
  | 'progress.mine' | 'progress.client' | 'progress.log'
  | 'chat.context' | 'chat.get' | 'chat.send' | 'chat.read' | 'chat.threads' | 'chat.clientSummary'
  | 'coach.clients' | 'coach.clientDetail' | 'coach.revenue'
  | 'admin.overview' | 'admin.decide' | 'admin.setSuspended' | 'admin.forceLogout';

export async function handle(token: string | null, op: Op, payload: any = {}): Promise<any> {
  await delay();
  await runExpiryJob();
  const db = await getDB();

  switch (op) {
    // ------------------------------------------------------------- auth ---
    case 'me.get': {
      const actor = await authActor(token);
      return toSessionUser(db, actor);
    }

    case 'auth.logout': {
      // payload.refreshToken — revoke server-side (also used for force-logout)
      const row = db.refreshTokens.find((t) => t.jti === payload.jti);
      if (row) row.revoked = true;
      await persist();
      return { ok: true };
    }

    // ---------------------------------------------------------- coaches ---
    case 'coaches.list': {
      await authActor(token);
      const list: CoachProfile[] = db.coachProfiles
        .filter((p) => p.status === 'approved')
        .map((p) => {
          const u = db.users.find((x) => x.id === p.userId)!;
          const pkgs = db.packages.filter((k) => k.coachId === p.userId);
          return {
            userId: p.userId, name: u.name, bio: p.bio, specialties: p.specialties,
            experienceYears: p.experienceYears, status: p.status,
            startingPriceCents: pkgs.length ? Math.min(...pkgs.map((k) => k.priceCents)) : undefined,
            activeClients: db.subscriptions.filter((s) => s.coachId === p.userId && s.status === 'active').length,
          };
        });
      return list;
    }

    case 'coach.getPublic': {
      await authActor(token);
      const p = db.coachProfiles.find((x) => x.userId === payload.coachId && x.status === 'approved');
      const u = db.users.find((x) => x.id === payload.coachId);
      if (!p || !u) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const profile: CoachProfile = { userId: p.userId, name: u.name, bio: p.bio, specialties: p.specialties, experienceYears: p.experienceYears, status: p.status };
      const packages = db.packages.filter((k) => k.coachId === p.userId);
      return { profile, packages };
    }

    case 'coach.updateProfile': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const p = db.coachProfiles.find((x) => x.userId === actor.id);
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      p.bio = payload.bio;
      p.specialties = payload.specialties;
      p.experienceYears = payload.experienceYears;
      await persist();
      return { ok: true };
    }

    // --------------------------------------------------------- packages ---
    case 'packages.mine': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      return db.packages.filter((k) => k.coachId === actor.id);
    }

    case 'package.get': {
      await authActor(token);
      const pkg = db.packages.find((k) => k.id === payload.packageId);
      if (!pkg) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const coach = db.users.find((u) => u.id === pkg.coachId);
      return { pkg, coachName: coach?.name ?? '' };
    }

    case 'package.save': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      if (payload.id) {
        const pkg = db.packages.find((k) => k.id === payload.id && k.coachId === actor.id);
        if (!pkg) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
        Object.assign(pkg, { title: payload.title, priceCents: payload.priceCents, durationDays: payload.durationDays, features: payload.features });
      } else {
        db.packages.push({ id: uid(), coachId: actor.id, title: payload.title, priceCents: payload.priceCents, durationDays: payload.durationDays, features: payload.features });
      }
      await persist();
      return { ok: true };
    }

    case 'package.delete': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const used = db.subscriptions.some((s) => s.packageId === payload.id);
      if (used) throw new ApiError(409, 'PACKAGE_IN_USE', 'This package has active or past subscribers and cannot be deleted. Edit it instead.');
      db.packages = db.packages.filter((k) => !(k.id === payload.id && k.coachId === actor.id));
      await persist();
      return { ok: true };
    }

    // ---------------------------------------------------- subscriptions ---
    case 'subs.mine': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const rows: SubscriptionRow[] = db.subscriptions
        .filter((s) => s.clientId === actor.id)
        .map((s) => {
          const coach = db.users.find((u) => u.id === s.coachId);
          const pkg = db.packages.find((k) => k.id === s.packageId);
          return {
            id: s.id, clientId: s.clientId, coachId: s.coachId, coachName: coach?.name ?? '',
            packageTitle: pkg?.title ?? 'Coaching plan', status: s.status,
            startDate: s.startDate, endDate: s.endDate, priceCents: pkg?.priceCents ?? 0,
          };
        })
        .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : b.endDate.localeCompare(a.endDate)));
      return rows;
    }

    case 'subs.cancel': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const s = db.subscriptions.find((x) => x.id === payload.subId && x.clientId === actor.id && x.status === 'active');
      if (!s) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      s.status = 'cancelled';
      s.endDate = new Date().toISOString();
      await persist();
      emitRealtime({ type: 'subscription', coachId: s.coachId, clientId: s.clientId });
      return { ok: true };
    }

    // --------------------------------------------------------- checkout ---
    case 'checkout.create': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const pkg = db.packages.find((k) => k.id === payload.packageId);
      if (!pkg) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const otherActive = db.subscriptions.find((s) => s.clientId === actor.id && s.status === 'active' && s.coachId !== pkg.coachId);
      if (otherActive) throw new ApiError(409, 'ONE_COACH', 'You already have an active coaching plan. Cancel it before starting with a new coach.');
      const sameActive = findActiveSub(db, pkg.coachId, actor.id);
      if (sameActive) throw new ApiError(409, 'ALREADY_ACTIVE', 'You already have an active plan with this coach.');
      const payment = { id: uid(), clientId: actor.id, coachId: pkg.coachId, packageId: pkg.id, amountCents: pkg.priceCents, status: 'pending' as const, createdAt: new Date().toISOString() };
      db.payments.push(payment);
      await persist();
      return { paymentId: payment.id };
    }

    case 'checkout.pay': {
      // Simulates the payment provider (Stripe). The provider redirects back,
      // then *the provider calls our webhook*. Activation happens ONLY in the
      // webhook handler above — never from this client-reported call.
      const actor = await authActor(token);
      const payment = db.payments.find((p) => p.id === payload.paymentId && p.clientId === actor.id);
      if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      if (payload.mode === 'decline') {
        payment.status = 'failed';
        await persist();
        return { declined: true };
      }
      const eventId = `evt_${payment.id}`;
      const signature = djb2(eventId + payment.id + WEBHOOK_SECRET);
      setTimeout(() => handlePaymentWebhook(eventId, signature, { paymentId: payment.id }), 1100);
      // Simulate a duplicate delivery too — must be idempotent.
      setTimeout(() => handlePaymentWebhook(eventId, signature, { paymentId: payment.id }), 2300);
      return { processing: true };
    }

    case 'checkout.status': {
      const actor = await authActor(token);
      const payment = db.payments.find((p) => p.id === payload.paymentId && p.clientId === actor.id);
      if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const status: CheckoutStatus = { status: payment.status === 'captured' ? 'captured' : payment.status === 'failed' ? 'failed' : 'pending' };
      return status;
    }

    // ------------------------------------------------------------ plans ---
    case 'plans.get': {
      // Client reading their pair's plans (read-only after expiry is fine).
      const actor = await authActor(token);
      const coachId: string = payload.coachId;
      const clientId: string = actor.role === 'client' ? actor.id : payload.clientId;
      if (!clientId) throw new ApiError(400, 'VALIDATION', 'Invalid request');
      assertPairAccess(actor, coachId, clientId);
      const bundle: PlansBundle = {
        workout: db.workoutPlans.find((w) => w.coachId === coachId && w.clientId === clientId) ?? null,
        diet: db.dietPlans.find((d) => d.coachId === coachId && d.clientId === clientId) ?? null,
        workoutChecks: db.workoutCheckoffs
          .filter((c) => c.coachId === coachId && c.clientId === clientId)
          .map((c) => ({ day: c.day, exercise: c.exercise })),
        dietChecks: db.dietCheckoffs
          .filter((c) => c.coachId === coachId && c.clientId === clientId)
          .map((c) => ({ meal: c.meal, item: c.item })),
      };
      return bundle;
    }

    case 'plan.saveWorkout': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const clientId: string = payload.clientId;
      // Security-critical path: single indexed lookup on (coach_id, client_id).
      const hasAny = db.subscriptions.some((s) => s.coachId === actor.id && s.clientId === clientId);
      if (!hasAny) {
        securityLog(`plan create attempted for non-subscribed client: coach=${actor.email} client=${clientId}`);
      }
      requireActiveSub(db, actor.id, clientId);
      const existing = db.workoutPlans.find((w) => w.coachId === actor.id && w.clientId === clientId);
      const plan: WorkoutPlan = { id: existing?.id ?? uid(), coachId: actor.id, clientId, title: payload.title, days: payload.days, updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, plan);
      else db.workoutPlans.push(plan);
      await persist();
      emitRealtime({ type: 'plan', coachId: actor.id, clientId });
      return { ok: true };
    }

    case 'plan.saveDiet': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const clientId: string = payload.clientId;
      requireActiveSub(db, actor.id, clientId);
      const existing = db.dietPlans.find((d) => d.coachId === actor.id && d.clientId === clientId);
      const plan: DietPlan = { id: existing?.id ?? uid(), coachId: actor.id, clientId, title: payload.title, targetKcal: payload.targetKcal, meals: payload.meals, notes: payload.notes, updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, plan);
      else db.dietPlans.push(plan);
      await persist();
      emitRealtime({ type: 'plan', coachId: actor.id, clientId });
      return { ok: true };
    }

    // ------------------------------------------------- plan templates ---
    case 'templates.list': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      return db.planTemplates
        .filter((t) => t.coachId === actor.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    case 'templates.save': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      if (payload.id) {
        const t = db.planTemplates.find((x) => x.id === payload.id && x.coachId === actor.id);
        if (!t) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
        t.title = payload.title;
        t.note = payload.note ?? '';
        if (payload.days) t.days = payload.days;
        if (payload.diet) t.diet = payload.diet;
        t.updatedAt = new Date().toISOString();
      } else {
        db.planTemplates.push({
          id: uid(), coachId: actor.id, kind: payload.kind, title: payload.title,
          note: payload.note ?? '', days: payload.days, diet: payload.diet,
          updatedAt: new Date().toISOString(),
        });
      }
      await persist();
      return { ok: true };
    }

    case 'templates.delete': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      db.planTemplates = db.planTemplates.filter((t) => !(t.id === payload.id && t.coachId === actor.id));
      await persist();
      return { ok: true };
    }

    case 'templates.assign': {
      // Assigning a template copies its content into the client's live plan.
      // Requires an ACTIVE subscription (writes are never allowed on lapsed pairs).
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const t = db.planTemplates.find((x) => x.id === payload.templateId && x.coachId === actor.id);
      if (!t) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      requireActiveSub(db, actor.id, payload.clientId);
      const now = new Date().toISOString();
      if (t.kind === 'workout' && t.days) {
        const existing = db.workoutPlans.find((w) => w.coachId === actor.id && w.clientId === payload.clientId);
        const plan: WorkoutPlan = { id: existing?.id ?? uid(), coachId: actor.id, clientId: payload.clientId, title: t.title, days: JSON.parse(JSON.stringify(t.days)), updatedAt: now };
        if (existing) Object.assign(existing, plan);
        else db.workoutPlans.push(plan);
        db.workoutCheckoffs = db.workoutCheckoffs.filter((c) => !(c.coachId === actor.id && c.clientId === payload.clientId));
      } else if (t.kind === 'diet' && t.diet) {
        const existing = db.dietPlans.find((d) => d.coachId === actor.id && d.clientId === payload.clientId);
        const plan: DietPlan = { id: existing?.id ?? uid(), coachId: actor.id, clientId: payload.clientId, title: t.title, targetKcal: t.diet.targetKcal, meals: JSON.parse(JSON.stringify(t.diet.meals)), notes: t.diet.notes, updatedAt: now };
        if (existing) Object.assign(existing, plan);
        else db.dietPlans.push(plan);
        db.dietCheckoffs = db.dietCheckoffs.filter((c) => !(c.coachId === actor.id && c.clientId === payload.clientId));
      } else {
        throw new ApiError(400, 'VALIDATION', 'Template has no content');
      }
      await persist();
      emitRealtime({ type: 'plan', coachId: actor.id, clientId: payload.clientId });
      return { ok: true };
    }

    // -------------------------------------------- gamified check-offs ---
    case 'workout.toggle': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      assertPairAccess(actor, payload.coachId, actor.id);
      requireActiveSub(db, payload.coachId, actor.id);
      const plan = db.workoutPlans.find((w) => w.coachId === payload.coachId && w.clientId === actor.id);
      if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const day = plan.days[payload.day];
      if (!day || !day.exercises[payload.exercise]) throw new ApiError(400, 'VALIDATION', 'Invalid exercise');
      const idx = db.workoutCheckoffs.findIndex((c) => c.coachId === payload.coachId && c.clientId === actor.id && c.day === payload.day && c.exercise === payload.exercise);
      const done = idx === -1;
      if (done) db.workoutCheckoffs.push({ clientId: actor.id, coachId: payload.coachId, day: payload.day, exercise: payload.exercise });
      else db.workoutCheckoffs.splice(idx, 1);
      await persist();
      const pairChecks = db.workoutCheckoffs.filter((c) => c.coachId === payload.coachId && c.clientId === actor.id);
      const dayDone = pairChecks.filter((c) => c.day === payload.day).length;
      const total = plan.days.reduce((a, d) => a + d.exercises.length, 0);
      emitRealtime({ type: 'plan', coachId: payload.coachId, clientId: actor.id });
      return {
        done,
        dayComplete: done && dayDone === day.exercises.length,
        planComplete: done && pairChecks.length === total,
      };
    }

    case 'diet.toggle': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      assertPairAccess(actor, payload.coachId, actor.id);
      requireActiveSub(db, payload.coachId, actor.id);
      const plan = db.dietPlans.find((d) => d.coachId === payload.coachId && d.clientId === actor.id);
      if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const meal = plan.meals[payload.meal];
      if (!meal || !meal.items[payload.item]) throw new ApiError(400, 'VALIDATION', 'Invalid item');
      const idx = db.dietCheckoffs.findIndex((c) => c.coachId === payload.coachId && c.clientId === actor.id && c.meal === payload.meal && c.item === payload.item);
      const done = idx === -1;
      if (done) db.dietCheckoffs.push({ clientId: actor.id, coachId: payload.coachId, meal: payload.meal, item: payload.item });
      else db.dietCheckoffs.splice(idx, 1);
      await persist();
      const pairChecks = db.dietCheckoffs.filter((c) => c.coachId === payload.coachId && c.clientId === actor.id);
      const total = plan.meals.reduce((a, m) => a + m.items.length, 0);
      emitRealtime({ type: 'plan', coachId: payload.coachId, clientId: actor.id });
      return { done, dayComplete: done && pairChecks.length === total };
    }

    // --------------------------------------------------------- progress ---
    case 'progress.mine': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const entries = db.progressEntries
        .filter((e) => e.clientId === actor.id && e.coachId === payload.coachId)
        .sort((a, b) => b.date.localeCompare(a.date));
      // Guard: the pair must have existed (a guessed coachId returns nothing,
      // identical to an empty history).
      const pairExists = db.subscriptions.some((s) => s.clientId === actor.id && s.coachId === payload.coachId);
      return pairExists ? entries : [];
    }

    case 'progress.client': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      assertPairAccess(actor, actor.id, payload.clientId);
      const pairExists = db.subscriptions.some((s) => s.clientId === payload.clientId && s.coachId === actor.id);
      if (!pairExists) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      return db.progressEntries
        .filter((e) => e.clientId === payload.clientId && e.coachId === actor.id)
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    case 'progress.log': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const sub = db.subscriptions.find((s) => s.clientId === actor.id && s.status === 'active');
      if (!sub) {
        const anyPast = db.subscriptions.some((s) => s.clientId === actor.id);
        const coach = db.users.find((u) => u.id === db.subscriptions.find((s) => s.clientId === actor.id)?.coachId);
        throw new ApiError(403, anyPast ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIBE_REQUIRED',
          anyPast ? 'Your coaching plan has ended. Renew to keep logging progress.' : 'Subscribe to a coach to start tracking.',
          { coachId: coach?.id, coachName: coach?.name ?? 'a coach' });
      }
      const today = new Date().toISOString().slice(0, 10);
      let entry = db.progressEntries.find((e) => e.clientId === actor.id && e.coachId === sub.coachId && e.date === today);
      if (!entry) {
        entry = { id: uid(), clientId: actor.id, coachId: sub.coachId, date: today, weightKg: null, measurements: {}, photoUrls: [], notes: '', createdAt: new Date().toISOString() };
        db.progressEntries.push(entry);
      }
      if (payload.weightKg != null) entry.weightKg = payload.weightKg;
      if (payload.measurements) entry.measurements = { ...entry.measurements, ...payload.measurements };
      if (payload.notes != null) entry.notes = payload.notes;
      if (payload.photoUrl) entry.photoUrls = [...entry.photoUrls, payload.photoUrl].slice(-12);
      entry.createdAt = new Date().toISOString();
      await persist();
      emitRealtime({ type: 'progress', coachId: sub.coachId, clientId: actor.id });
      return entry;
    }

    // ------------------------------------------------------------- chat ---
    case 'chat.context': {
      const actor = await authActor(token);
      assertPairAccess(actor, payload.coachId, payload.clientId);
      const coach = db.users.find((u) => u.id === payload.coachId);
      const client = db.users.find((u) => u.id === payload.clientId);
      const pairExists = db.subscriptions.some((s) => s.coachId === payload.coachId && s.clientId === payload.clientId);
      if (!pairExists) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const ctx: ChatContext = { active: !!findActiveSub(db, payload.coachId, payload.clientId), coachName: coach?.name ?? '', clientName: client?.name ?? '' };
      return ctx;
    }

    case 'chat.get': {
      const actor = await authActor(token);
      assertPairAccess(actor, payload.coachId, payload.clientId);
      const msgs: ChatMessage[] = db.chatMessages
        .filter((m) => m.coachId === payload.coachId && m.clientId === payload.clientId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return msgs;
    }

    case 'chat.send': {
      const actor = await authActor(token);
      assertPairAccess(actor, payload.coachId, payload.clientId);
      requireActiveSub(db, payload.coachId, payload.clientId);
      const body = String(payload.body ?? '').trim();
      if (!body) throw new ApiError(400, 'VALIDATION', 'Message cannot be empty');
      if (body.length > 2000) throw new ApiError(400, 'VALIDATION', 'Message is too long');
      const msg: ChatMessage = { id: uid(), coachId: payload.coachId, clientId: payload.clientId, senderId: actor.id, body, createdAt: new Date().toISOString() };
      db.chatMessages.push(msg);
      const t = ensureThread(db, payload.coachId, payload.clientId);
      if (actor.role === 'coach') t.lastReadByCoach = msg.createdAt;
      else t.lastReadByClient = msg.createdAt;
      await persist();
      emitRealtime({ type: 'chat', coachId: payload.coachId, clientId: payload.clientId });
      return msg;
    }

    case 'chat.read': {
      const actor = await authActor(token);
      assertPairAccess(actor, payload.coachId, payload.clientId);
      const t = ensureThread(db, payload.coachId, payload.clientId);
      const now = new Date().toISOString();
      if (actor.id === payload.coachId) t.lastReadByCoach = now;
      if (actor.id === payload.clientId) t.lastReadByClient = now;
      await persist();
      return { ok: true };
    }

    case 'chat.threads': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const rows: ChatThreadRow[] = db.subscriptions
        .filter((s) => s.coachId === actor.id)
        .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : b.endDate.localeCompare(a.endDate)))
        .map((s) => {
          const client = db.users.find((u) => u.id === s.clientId);
          const msgs = db.chatMessages.filter((m) => m.coachId === actor.id && m.clientId === s.clientId);
          const last = msgs[msgs.length - 1];
          return {
            clientId: s.clientId, clientName: client?.name ?? '', active: s.status === 'active',
            lastMessage: last ? last.body : 'No messages yet', lastAt: last?.createdAt ?? null,
            unread: unreadFor(db, actor.id, s.clientId, 'coach'),
          };
        });
      return rows;
    }

    case 'chat.clientSummary': {
      const actor = await authActor(token);
      assertRole(actor, 'client');
      const sub = db.subscriptions.find((s) => s.clientId === actor.id && s.status === 'active')
        ?? [...db.subscriptions.filter((s) => s.clientId === actor.id)].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
      if (!sub) return { hasThread: false, unread: 0, coachId: null };
      return { hasThread: true, unread: unreadFor(db, sub.coachId, actor.id, 'client'), coachId: sub.coachId };
    }

    // ---------------------------------------------------- coach console ---
    case 'coach.clients': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const rows: CoachClientRow[] = db.subscriptions
        .filter((s) => s.coachId === actor.id)
        .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : b.endDate.localeCompare(a.endDate)))
        .map((s) => {
          const client = db.users.find((u) => u.id === s.clientId);
          const pkg = db.packages.find((k) => k.id === s.packageId);
          const progress = db.progressEntries.filter((e) => e.clientId === s.clientId && e.coachId === actor.id);
          const msgs = db.chatMessages.filter((m) => m.coachId === actor.id && m.clientId === s.clientId);
          return {
            clientId: s.clientId, clientName: client?.name ?? '', clientEmail: client?.email ?? '',
            status: s.status, packageTitle: pkg?.title ?? 'Coaching plan',
            startDate: s.startDate, endDate: s.endDate,
            daysLeft: Math.ceil((new Date(s.endDate).getTime() - Date.now()) / 86400000),
            hasWorkout: db.workoutPlans.some((w) => w.coachId === actor.id && w.clientId === s.clientId),
            hasDiet: db.dietPlans.some((d) => d.coachId === actor.id && d.clientId === s.clientId),
            lastProgressAt: progress.length ? progress[progress.length - 1].createdAt : null,
            unread: unreadFor(db, actor.id, s.clientId, 'coach'),
            lastMessageAt: msgs.length ? msgs[msgs.length - 1].createdAt : null,
          };
        });
      return rows;
    }

    case 'coach.clientDetail': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      assertPairAccess(actor, actor.id, payload.clientId);
      const s = [...db.subscriptions.filter((x) => x.coachId === actor.id && x.clientId === payload.clientId)]
        .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
      if (!s) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      const client = db.users.find((u) => u.id === payload.clientId);
      const pkg = db.packages.find((k) => k.id === s.packageId);
      const bundle: ClientDetailBundle = {
        clientId: s.clientId, clientName: client?.name ?? '', clientEmail: client?.email ?? '',
        status: s.status, packageTitle: pkg?.title ?? 'Coaching plan',
        startDate: s.startDate, endDate: s.endDate,
        hasWorkout: db.workoutPlans.some((w) => w.coachId === actor.id && w.clientId === payload.clientId),
        hasDiet: db.dietPlans.some((d) => d.coachId === actor.id && d.clientId === payload.clientId),
        workoutChecked: db.workoutCheckoffs.filter((c) => c.coachId === actor.id && c.clientId === payload.clientId).length,
        workoutTotal: db.workoutPlans.find((w) => w.coachId === actor.id && w.clientId === payload.clientId)?.days.reduce((a, d) => a + d.exercises.length, 0) ?? 0,
        dietChecked: db.dietCheckoffs.filter((c) => c.coachId === actor.id && c.clientId === payload.clientId).length,
        dietTotal: db.dietPlans.find((d) => d.coachId === actor.id && d.clientId === payload.clientId)?.meals.reduce((a, m) => a + m.items.length, 0) ?? 0,
      };
      return bundle;
    }

    case 'coach.revenue': {
      const actor = await authActor(token);
      assertRole(actor, 'coach');
      const captured = db.payments.filter((p) => p.coachId === actor.id && p.status === 'captured');
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const rev: RevenueSummary = {
        totalCents: captured.reduce((a, p) => a + p.amountCents, 0),
        thisMonthCents: captured.filter((p) => new Date(p.createdAt) >= monthStart).reduce((a, p) => a + p.amountCents, 0),
        activeClients: db.subscriptions.filter((s) => s.coachId === actor.id && s.status === 'active').length,
        recent: captured
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 5)
          .map((p) => ({ id: p.id, clientName: db.users.find((u) => u.id === p.clientId)?.name ?? '', packageTitle: db.packages.find((k) => k.id === p.packageId)?.title ?? '', amountCents: p.amountCents, createdAt: p.createdAt })),
      };
      return rev;
    }

    // ------------------------------------------------------------ admin ---
    case 'admin.overview': {
      const actor = await authActor(token);
      assertRole(actor, 'admin');
      const overview: AdminOverview = {
        stats: {
          users: db.users.length,
          coaches: db.users.filter((u) => u.role === 'coach').length,
          activeSubs: db.subscriptions.filter((s) => s.status === 'active').length,
          revenueCents: db.payments.filter((p) => p.status === 'captured').reduce((a, p) => a + p.amountCents, 0),
        },
        pendingCoaches: db.coachProfiles.filter((p) => p.status === 'pending').map((p) => {
          const u = db.users.find((x) => x.id === p.userId)!;
          return { userId: p.userId, name: u.name, email: u.email, bio: p.bio, specialties: p.specialties };
        }),
        users: db.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, suspended: u.suspended })),
        payments: [...db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map((p) => ({
          id: p.id, clientName: db.users.find((u) => u.id === p.clientId)?.name ?? '',
          coachName: db.users.find((u) => u.id === p.coachId)?.name ?? '',
          amountCents: p.amountCents, status: p.status, createdAt: p.createdAt,
        })),
      };
      return overview;
    }

    case 'admin.decide': {
      const actor = await authActor(token);
      assertRole(actor, 'admin');
      const p = db.coachProfiles.find((x) => x.userId === payload.userId);
      if (!p) throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      p.status = payload.approve ? 'approved' : 'rejected';
      await persist();
      return { ok: true };
    }

    case 'admin.setSuspended': {
      const actor = await authActor(token);
      assertRole(actor, 'admin');
      const u = db.users.find((x) => x.id === payload.userId);
      if (!u || u.role === 'admin') throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      u.suspended = payload.suspended;
      if (payload.suspended) {
        // suspending invalidates sessions on next refresh
        db.refreshTokens.filter((t) => t.userId === u.id).forEach((t) => { t.revoked = true; });
      }
      await persist();
      return { ok: true };
    }

    case 'admin.forceLogout': {
      const actor = await authActor(token);
      assertRole(actor, 'admin');
      db.refreshTokens.filter((t) => t.userId === payload.userId).forEach((t) => { t.revoked = true; });
      await persist();
      return { ok: true };
    }

    default:
      throw new ApiError(400, 'UNKNOWN_OP', 'Invalid request');
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints (login / register / refresh) — no access token required.
// ---------------------------------------------------------------------------
export async function authLogin(email: string, password: string) {
  await delay();
  const db = await getDB();
  const normalized = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);

  if (user) {
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      throw new ApiError(423, 'LOCKED', `Too many failed attempts. Try again in ${mins} min.`);
    }
  }

  // Generic error — never reveal which field is wrong.
  const fail = () => {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
        user.failedAttempts = 0;
        securityLog(`account locked after ${MAX_FAILED_ATTEMPTS} failed attempts: ${user.email}`);
        persist();
        throw new ApiError(423, 'LOCKED', 'Too many failed attempts. Account locked for 15 minutes.');
      }
      persist();
    }
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  };

  if (!user || user.passwordHash !== hashPassword(password)) return fail();
  if (user.suspended) throw new ApiError(403, 'SUSPENDED', 'This account has been suspended. Contact support.');

  user.failedAttempts = 0;
  user.lockedUntil = null;
  const access = issueToken(user, 'access', ACCESS_TTL_MS);
  const refresh = issueToken(user, 'refresh', REFRESH_TTL_MS);
  db.refreshTokens.push({ jti: refresh.jti, userId: user.id, expiresAt: Date.now() + REFRESH_TTL_MS, revoked: false });
  await persist();
  return { accessToken: access.token, refreshToken: refresh.token, user: toSessionUser(db, user) };
}

export async function authRegister(input: { role: 'client' | 'coach'; name: string; email: string; password: string }) {
  await delay();
  const db = await getDB();
  const normalized = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  const user: UserRow = {
    id: uid(), role: input.role, name: input.name.trim(), email: normalized,
    passwordHash: hashPassword(input.password), createdAt: new Date().toISOString(),
    failedAttempts: 0, lockedUntil: null, suspended: false,
  };
  db.users.push(user);
  if (input.role === 'coach') {
    db.coachProfiles.push({ userId: user.id, bio: 'New FitCoach profile — bio coming soon.', specialties: ['General fitness'], experienceYears: 1, status: 'pending' });
  }
  const access = issueToken(user, 'access', ACCESS_TTL_MS);
  const refresh = issueToken(user, 'refresh', REFRESH_TTL_MS);
  db.refreshTokens.push({ jti: refresh.jti, userId: user.id, expiresAt: Date.now() + REFRESH_TTL_MS, revoked: false });
  await persist();
  return { accessToken: access.token, refreshToken: refresh.token, user: toSessionUser(db, user) };
}

export async function authRefresh(refreshToken: string) {
  const db = await getDB();
  let payload: TokenPayload;
  try {
    payload = parseToken(refreshToken);
  } catch {
    throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
  }
  if (payload.typ !== 'refresh') throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
  const row = db.refreshTokens.find((t) => t.jti === payload.jti);
  if (!row || row.revoked || row.expiresAt < Date.now()) {
    throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
  }
  const user = db.users.find((u) => u.id === payload.sub);
  if (!user || user.suspended) throw new ApiError(401, 'REFRESH_INVALID', 'Session expired. Please sign in again.');
  // Rotate: revoke old refresh token, issue a fresh pair.
  row.revoked = true;
  const access = issueToken(user, 'access', ACCESS_TTL_MS);
  const refresh = issueToken(user, 'refresh', REFRESH_TTL_MS);
  db.refreshTokens.push({ jti: refresh.jti, userId: user.id, expiresAt: Date.now() + REFRESH_TTL_MS, revoked: false });
  await persist();
  return { accessToken: access.token, refreshToken: refresh.token, user: toSessionUser(db, user) };
}

export async function authLogout(refreshToken: string | null) {
  try {
    if (!refreshToken) return;
    const payload = parseToken(refreshToken);
    const db = await getDB();
    const row = db.refreshTokens.find((t) => t.jti === payload.jti);
    if (row) row.revoked = true;
    await persist();
  } catch {
    // best effort
  }
}
