// DTO / entity types. These mirror the backend DTOs 1:1 (see fitcoach-backend).

export type Role = 'admin' | 'coach' | 'client';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** coaches only: approval status */
  coachStatus?: 'pending' | 'approved' | 'rejected';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface CoachProfile {
  userId: string;
  name: string;
  bio: string;
  specialties: string[];
  experienceYears: number;
  status: 'pending' | 'approved' | 'rejected';
  startingPriceCents?: number;
  activeClients?: number;
}

export interface Package {
  id: string;
  coachId: string;
  title: string;
  priceCents: number;
  durationDays: number;
  features: string[];
}

export type SubStatus = 'active' | 'expired' | 'cancelled';

export interface SubscriptionRow {
  id: string;
  clientId: string;
  coachId: string;
  coachName: string;
  packageTitle: string;
  status: SubStatus;
  startDate: string;
  endDate: string;
  priceCents: number;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  restSec: number;
}
export interface WorkoutDay {
  name: string;
  focus: string;
  exercises: WorkoutExercise[];
}
export interface WorkoutPlan {
  id: string;
  coachId: string;
  clientId: string;
  title: string;
  days: WorkoutDay[];
  updatedAt: string;
}

export interface DietItem {
  food: string;
  qty: string;
  kcal: number;
  protein: number; // grams
  carbs: number;   // grams
  fat: number;     // grams
}
export interface DietMeal {
  name: string;
  time: string;
  items: DietItem[];
}
export interface DietPlan {
  id: string;
  coachId: string;
  clientId: string;
  title: string;
  targetKcal: number;
  meals: DietMeal[];
  notes: string;
  updatedAt: string;
}

export interface CheckRef { day?: number; exercise?: number; meal?: number; item?: number }

export interface PlansBundle {
  workout: WorkoutPlan | null;
  diet: DietPlan | null;
  /** Gamified check-offs (client marks exercises/meals as done). */
  workoutChecks: { day: number; exercise: number }[];
  dietChecks: { meal: number; item: number }[];
}

/** Pre-made "buffer" plan a coach keeps in their library and can assign to any client. */
export interface PlanTemplate {
  id: string;
  coachId: string;
  kind: 'workout' | 'diet';
  title: string;
  note: string;
  days?: WorkoutDay[];
  diet?: { targetKcal: number; meals: DietMeal[]; notes: string };
  updatedAt: string;
}

export interface ProgressEntry {
  id: string;
  clientId: string;
  coachId: string;
  date: string; // yyyy-MM-dd
  weightKg: number | null;
  measurements: Record<string, number>;
  photoUrls: string[];
  notes: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  coachId: string;
  clientId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ChatThreadRow {
  clientId: string;
  clientName: string;
  active: boolean;
  lastMessage: string;
  lastAt: string | null;
  unread: number;
}

export interface ChatContext {
  active: boolean;
  coachName: string;
  clientName: string;
}

export interface CoachClientRow {
  clientId: string;
  clientName: string;
  clientEmail: string;
  status: SubStatus;
  packageTitle: string;
  startDate: string;
  endDate: string;
  daysLeft: number;
  hasWorkout: boolean;
  hasDiet: boolean;
  lastProgressAt: string | null;
  unread: number;
  lastMessageAt: string | null;
}

export interface ClientDetailBundle {
  clientId: string;
  clientName: string;
  clientEmail: string;
  status: SubStatus;
  packageTitle: string;
  startDate: string;
  endDate: string;
  hasWorkout: boolean;
  hasDiet: boolean;
  /** Gamification adherence — how much of the plans the client checked off. */
  workoutChecked: number;
  workoutTotal: number;
  dietChecked: number;
  dietTotal: number;
}

export interface RevenueSummary {
  totalCents: number;
  thisMonthCents: number;
  activeClients: number;
  recent: { id: string; clientName: string; packageTitle: string; amountCents: number; createdAt: string }[];
}

export interface AdminOverview {
  stats: { users: number; coaches: number; activeSubs: number; revenueCents: number };
  pendingCoaches: { userId: string; name: string; email: string; bio: string; specialties: string[] }[];
  users: { id: string; name: string; email: string; role: Role; suspended: boolean }[];
  payments: { id: string; clientName: string; coachName: string; amountCents: number; status: string; createdAt: string }[];
}

export interface CheckoutStatus {
  status: 'pending' | 'captured' | 'failed';
  declined?: boolean;
}
