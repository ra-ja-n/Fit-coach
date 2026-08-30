// Sandbox database for the embedded API service. In production this is
// PostgreSQL (see fitcoach-backend/db/migration). Persistence here is the
// *server's* datastore — client tokens never touch AsyncStorage; they live in
// expo-secure-store (see lib/secure.ts).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatMessage,
  DietPlan,
  Package,
  PlanTemplate,
  ProgressEntry,
  WorkoutDay,
  WorkoutPlan,
} from './types';

export interface UserRow {
  id: string;
  role: 'admin' | 'coach' | 'client';
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  failedAttempts: number;
  lockedUntil: string | null;
  suspended: boolean;
}

export interface CoachProfileRow {
  userId: string;
  bio: string;
  specialties: string[];
  experienceYears: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SubscriptionRowDb {
  id: string;
  clientId: string;
  coachId: string;
  packageId: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  paymentId: string;
}

export interface PaymentRow {
  id: string;
  clientId: string;
  coachId: string;
  packageId: string;
  amountCents: number;
  status: 'pending' | 'captured' | 'failed' | 'refunded';
  createdAt: string;
}

export interface ChatThreadRowDb {
  coachId: string;
  clientId: string;
  lastReadByCoach: string;
  lastReadByClient: string;
}

export interface RefreshTokenRow {
  jti: string;
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

export interface DB {
  users: UserRow[];
  coachProfiles: CoachProfileRow[];
  packages: Package[];
  subscriptions: SubscriptionRowDb[];
  payments: PaymentRow[];
  workoutPlans: WorkoutPlan[];
  dietPlans: DietPlan[];
  progressEntries: ProgressEntry[];
  chatMessages: ChatMessage[];
  chatThreads: ChatThreadRowDb[];
  refreshTokens: RefreshTokenRow[];
  processedWebhookEvents: string[];
  planTemplates: PlanTemplate[];
  workoutCheckoffs: { clientId: string; coachId: string; day: number; exercise: number }[];
  dietCheckoffs: { clientId: string; coachId: string; meal: number; item: number }[];
}

const KEY = 'fitcoach.sandbox.db.v1';
let cache: DB | null = null;

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Deterministic demo hash. The real backend uses BCrypt (never logged).
export function hashPassword(pw: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < pw.length; i++) {
    h1 = ((h1 << 5) + h1 + pw.charCodeAt(i)) | 0;
    h2 = ((h2 << 5) - h2 + pw.charCodeAt(i) * 31) | 0;
  }
  return `bc$${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const dateOnly = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function seedPhoto(label: string, bg: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600"><rect width="480" height="600" fill="${bg}"/><rect x="20" y="20" width="440" height="560" rx="26" fill="none" stroke="${fg}" stroke-opacity="0.25" stroke-width="3"/><circle cx="240" cy="230" r="92" fill="${fg}" fill-opacity="0.16"/><path d="M150 400 q90 -60 180 0" stroke="${fg}" stroke-width="9" fill="none" stroke-linecap="round" stroke-opacity="0.45"/><text x="240" y="510" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="${fg}" text-anchor="middle" font-weight="700">${label}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function seed(): DB {
  const admin: UserRow = { id: 'u-admin', role: 'admin', name: 'FitCoach Support', email: 'admin@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(400), failedAttempts: 0, lockedUntil: null, suspended: false };
  const maya: UserRow = { id: 'u-maya', role: 'coach', name: 'Maya Torres', email: 'coach@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(300), failedAttempts: 0, lockedUntil: null, suspended: false };
  const daniel: UserRow = { id: 'u-daniel', role: 'coach', name: 'Daniel Reyes', email: 'daniel@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(250), failedAttempts: 0, lockedUntil: null, suspended: false };
  const priya: UserRow = { id: 'u-priya', role: 'coach', name: 'Priya Nair', email: 'priya@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(2), failedAttempts: 0, lockedUntil: null, suspended: false };
  const alex: UserRow = { id: 'u-alex', role: 'client', name: 'Alex Morgan', email: 'client@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(90), failedAttempts: 0, lockedUntil: null, suspended: false };
  const jordan: UserRow = { id: 'u-jordan', role: 'client', name: 'Jordan Lee', email: 'jordan@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(120), failedAttempts: 0, lockedUntil: null, suspended: false };
  const sam: UserRow = { id: 'u-sam', role: 'client', name: 'Sam Carter', email: 'sam@fitcoach.app', passwordHash: hashPassword('demo1234'), createdAt: daysAgo(60), failedAttempts: 0, lockedUntil: null, suspended: false };

  const packages: Package[] = [
    { id: 'pkg-maya-12', coachId: maya.id, title: '12-Week Transformation', priceCents: 14900, durationDays: 84, features: ['Personalised workout plan', 'Nutrition plan & weekly adjustments', 'Unlimited chat support', 'Weekly progress reviews'] },
    { id: 'pkg-maya-1', coachId: maya.id, title: 'Monthly Coaching', priceCents: 5900, durationDays: 30, features: ['Personalised workout plan', 'Nutrition guidelines', 'Chat support (Mon–Fri)'] },
    { id: 'pkg-maya-elite', coachId: maya.id, title: 'Elite 1:1 (90 days)', priceCents: 29900, durationDays: 90, features: ['Everything in Transformation', 'Priority daily check-ins', 'Form reviews on request', 'Custom supplement guidance'] },
    { id: 'pkg-dan-1', coachId: daniel.id, title: 'Strength Foundations', priceCents: 4900, durationDays: 30, features: ['3-day full-body program', 'Technique guides', 'Chat support'] },
    { id: 'pkg-dan-3', coachId: daniel.id, title: 'Powerbuilding Block', priceCents: 12900, durationDays: 84, features: ['Periodised 12-week program', 'Diet template & macros', 'Weekly check-ins'] },
  ];

  const subscriptions: SubscriptionRowDb[] = [
    { id: 'sub-alex', clientId: alex.id, coachId: maya.id, packageId: 'pkg-maya-12', status: 'active', startDate: daysAgo(64), endDate: daysAhead(20), paymentId: 'pay-alex' },
    { id: 'sub-jordan', clientId: jordan.id, coachId: maya.id, packageId: 'pkg-maya-1', status: 'expired', startDate: daysAgo(70), endDate: daysAgo(10), paymentId: 'pay-jordan' },
    { id: 'sub-sam', clientId: sam.id, coachId: daniel.id, packageId: 'pkg-dan-3', status: 'active', startDate: daysAgo(30), endDate: daysAhead(54), paymentId: 'pay-sam' },
  ];

  const payments: PaymentRow[] = [
    { id: 'pay-alex', clientId: alex.id, coachId: maya.id, packageId: 'pkg-maya-12', amountCents: 14900, status: 'captured', createdAt: daysAgo(64) },
    { id: 'pay-jordan', clientId: jordan.id, coachId: maya.id, packageId: 'pkg-maya-1', amountCents: 5900, status: 'captured', createdAt: daysAgo(70) },
    { id: 'pay-sam', clientId: sam.id, coachId: daniel.id, packageId: 'pkg-dan-3', amountCents: 12900, status: 'captured', createdAt: daysAgo(30) },
  ];

  const workout: WorkoutPlan = {
    id: 'wp-alex', coachId: maya.id, clientId: alex.id, title: 'Summer Rebuild — Block 2', updatedAt: daysAgo(3),
    days: [
      { name: 'Day 1', focus: 'Lower body — strength', exercises: [
        { name: 'Back squat', sets: 4, reps: '6', restSec: 150 },
        { name: 'Romanian deadlift', sets: 3, reps: '8', restSec: 120 },
        { name: 'Walking lunges', sets: 3, reps: '12/leg', restSec: 90 },
        { name: 'Standing calf raise', sets: 4, reps: '15', restSec: 60 },
      ]},
      { name: 'Day 2', focus: 'Upper body — push', exercises: [
        { name: 'Bench press', sets: 4, reps: '6–8', restSec: 150 },
        { name: 'Overhead press', sets: 3, reps: '8', restSec: 120 },
        { name: 'Incline DB press', sets: 3, reps: '10', restSec: 90 },
        { name: 'Cable fly', sets: 3, reps: '12', restSec: 60 },
      ]},
      { name: 'Day 3', focus: 'Upper body — pull', exercises: [
        { name: 'Weighted pull-up', sets: 4, reps: '6', restSec: 150 },
        { name: 'Barbell row', sets: 4, reps: '8', restSec: 120 },
        { name: 'Face pull', sets: 3, reps: '15', restSec: 60 },
        { name: 'Hammer curl', sets: 3, reps: '12', restSec: 60 },
      ]},
      { name: 'Day 4', focus: 'Full body + conditioning', exercises: [
        { name: 'Trap bar deadlift', sets: 4, reps: '5', restSec: 180 },
        { name: 'DB bench press', sets: 3, reps: '10', restSec: 90 },
        { name: 'Kettlebell swings', sets: 5, reps: '20', restSec: 45 },
      ]},
    ],
  };

  const diet: DietPlan = {
    id: 'dp-alex', coachId: maya.id, clientId: alex.id, title: 'Lean rebuild — 2,400 kcal', targetKcal: 2400, updatedAt: daysAgo(5),
    meals: [
      { name: 'Breakfast', time: '7:30', items: [
        { food: 'Oats with berries', qty: '80g', kcal: 380, protein: 13, carbs: 68, fat: 6 },
        { food: 'Whole eggs', qty: '3', kcal: 230, protein: 19, carbs: 1, fat: 15 },
        { food: 'Black coffee', qty: '1 cup', kcal: 5, protein: 0, carbs: 0, fat: 0 },
      ]},
      { name: 'Lunch', time: '12:30', items: [
        { food: 'Chicken breast', qty: '180g', kcal: 300, protein: 46, carbs: 0, fat: 8 },
        { food: 'Jasmine rice', qty: '200g cooked', kcal: 260, protein: 5, carbs: 57, fat: 1 },
        { food: 'Mixed greens + olive oil', qty: '1 bowl', kcal: 160, protein: 3, carbs: 8, fat: 13 },
      ]},
      { name: 'Pre-workout', time: '16:30', items: [
        { food: 'Greek yogurt', qty: '200g', kcal: 150, protein: 15, carbs: 10, fat: 2 },
        { food: 'Banana', qty: '1', kcal: 105, protein: 1, carbs: 27, fat: 0 },
      ]},
      { name: 'Dinner', time: '19:30', items: [
        { food: 'Salmon fillet', qty: '160g', kcal: 330, protein: 34, carbs: 0, fat: 20 },
        { food: 'Baby potatoes', qty: '250g', kcal: 210, protein: 5, carbs: 43, fat: 0 },
        { food: 'Roast vegetables', qty: '1 plate', kcal: 180, protein: 4, carbs: 18, fat: 10 },
      ]},
    ],
    notes: 'Drink 2.5–3L water daily. On rest days drop the pre-workout snack and add 100g of greens at dinner.',
  };

  const progress: ProgressEntry[] = [
    { id: 'pe-1', clientId: alex.id, coachId: maya.id, date: dateOnly(56), weightKg: 82.4, measurements: { waist: 92, chest: 104 }, photoUrls: [seedPhoto('Week 1', '#E1F0E9', '#0E7C5A')], notes: 'Starting point. Excited to begin.', createdAt: daysAgo(56) },
    { id: 'pe-2', clientId: alex.id, coachId: maya.id, date: dateOnly(49), weightKg: 81.6, measurements: { waist: 91 }, photoUrls: [], notes: 'Sore but good first week.', createdAt: daysAgo(49) },
    { id: 'pe-3', clientId: alex.id, coachId: maya.id, date: dateOnly(42), weightKg: 81.1, measurements: { waist: 90, chest: 104 }, photoUrls: [], notes: '', createdAt: daysAgo(42) },
    { id: 'pe-4', clientId: alex.id, coachId: maya.id, date: dateOnly(35), weightKg: 80.5, measurements: { waist: 89 }, photoUrls: [seedPhoto('Week 5', '#FBF0DB', '#B0761C')], notes: 'Belt is looser!', createdAt: daysAgo(35) },
    { id: 'pe-5', clientId: alex.id, coachId: maya.id, date: dateOnly(28), weightKg: 80.0, measurements: { waist: 88.5 }, photoUrls: [], notes: '', createdAt: daysAgo(28) },
    { id: 'pe-6', clientId: alex.id, coachId: maya.id, date: dateOnly(21), weightKg: 79.3, measurements: { waist: 87, chest: 105 }, photoUrls: [], notes: 'Squats finally feel smooth.', createdAt: daysAgo(21) },
    { id: 'pe-7', clientId: alex.id, coachId: maya.id, date: dateOnly(14), weightKg: 78.8, measurements: { waist: 86.5 }, photoUrls: [seedPhoto('Week 9', '#E7F0F8', '#3E7CB1')], notes: '', createdAt: daysAgo(14) },
    { id: 'pe-8', clientId: alex.id, coachId: maya.id, date: dateOnly(7), weightKg: 78.2, measurements: { waist: 86, chest: 105.5 }, photoUrls: [], notes: 'Best week yet. Sleep improving.', createdAt: daysAgo(7) },
  ];

  const chat: ChatMessage[] = [
    { id: 'cm-1', coachId: maya.id, clientId: alex.id, senderId: maya.id, body: 'Welcome aboard, Alex! Your plan is live — check the workout and diet tabs. Any questions, right here.', createdAt: daysAgo(63) },
    { id: 'cm-2', coachId: maya.id, clientId: alex.id, senderId: alex.id, body: 'Just went through everything. Day 2 looks brutal 😅', createdAt: daysAgo(63) },
    { id: 'cm-3', coachId: maya.id, clientId: alex.id, senderId: maya.id, body: 'It is 😄 Drop the incline press to 8kg if needed. Form over ego.', createdAt: daysAgo(63) },
    { id: 'cm-4', coachId: maya.id, clientId: alex.id, senderId: alex.id, body: 'Logged this week — down to 78.2!', createdAt: daysAgo(7) },
    { id: 'cm-5', coachId: maya.id, clientId: alex.id, senderId: maya.id, body: 'Huge. Waist down 6cm since week 1. Keep the pre-workout snack on training days only.', createdAt: daysAgo(6) },
  ];

  const templates = seedTemplates(maya.id, daniel.id);

  return {
    users: [admin, maya, daniel, priya, alex, jordan, sam],
    coachProfiles: [
      { userId: maya.id, bio: 'Strength & nutrition coach with a physiotherapy background. I build sustainable programs around your real schedule — no crash diets, no 2-hour sessions.', specialties: ['Fat loss', 'Strength', 'Nutrition'], experienceYears: 8, status: 'approved' },
      { userId: daniel.id, bio: 'Powerlifting coach focused on technique-first strength. Perfect for lifters who want to get strong without getting hurt.', specialties: ['Powerlifting', 'Hypertrophy', 'Technique'], experienceYears: 6, status: 'approved' },
      { userId: priya.id, bio: 'Mobility and post-rehab conditioning specialist.', specialties: ['Mobility', 'Rehab'], experienceYears: 4, status: 'pending' },
    ],
    packages,
    subscriptions,
    payments,
    workoutPlans: [workout],
    dietPlans: [diet],
    progressEntries: progress,
    chatMessages: chat,
    chatThreads: [{ coachId: maya.id, clientId: alex.id, lastReadByCoach: daysAgo(6), lastReadByClient: daysAgo(6) }, { coachId: maya.id, clientId: jordan.id, lastReadByCoach: daysAgo(40), lastReadByClient: daysAgo(40) }, { coachId: daniel.id, clientId: sam.id, lastReadByCoach: daysAgo(1), lastReadByClient: daysAgo(1) }],
    refreshTokens: [],
    processedWebhookEvents: [],
    planTemplates: templates,
    workoutCheckoffs: [],
    dietCheckoffs: [],
  };
}

// Pre-made "buffer" plans coaches keep in their library and assign to clients.
function seedTemplates(mayaId: string, danielId: string): PlanTemplate[] {
  const t = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  return [
    {
      id: 'tpl-maya-w1', coachId: mayaId, kind: 'workout',
      title: 'Foundation Strength (Beginner)',
      note: '3-day full-body split. Great first plan for new lifters or returning clients.',
      days: [
        { name: 'Day 1', focus: 'Full body — squat pattern', exercises: [
          { name: 'Goblet squat', sets: 3, reps: '10', restSec: 90 },
          { name: 'Push-up', sets: 3, reps: '8–12', restSec: 75 },
          { name: 'Seated cable row', sets: 3, reps: '12', restSec: 60 },
          { name: 'Plank', sets: 3, reps: '30s', restSec: 45 },
        ]},
        { name: 'Day 2', focus: 'Full body — hinge pattern', exercises: [
          { name: 'Kettlebell deadlift', sets: 3, reps: '10', restSec: 90 },
          { name: 'Dumbbell bench press', sets: 3, reps: '10', restSec: 75 },
          { name: 'Lat pulldown', sets: 3, reps: '12', restSec: 60 },
          { name: 'Side plank', sets: 3, reps: '20s/side', restSec: 45 },
        ]},
        { name: 'Day 3', focus: 'Full body — carry & core', exercises: [
          { name: 'Split squat', sets: 3, reps: '8/leg', restSec: 75 },
          { name: 'Overhead press', sets: 3, reps: '10', restSec: 75 },
          { name: 'Face pull', sets: 3, reps: '15', restSec: 45 },
          { name: 'Farmer carry', sets: 4, reps: '30m', restSec: 60 },
        ]},
      ],
      updatedAt: t(20),
    },
    {
      id: 'tpl-maya-d1', coachId: mayaId, kind: 'diet',
      title: 'Lean Rebuild — 2,200 kcal',
      note: 'Balanced high-protein template for recomposition. Adjust carbs to training days.',
      diet: {
        targetKcal: 2200,
        notes: 'Aim for 2.5L water. Swap rice for potatoes on rest days.',
        meals: [
          { name: 'Breakfast', time: '7:30', items: [
            { food: 'Greek yogurt bowl', qty: '250g', kcal: 320, protein: 24, carbs: 38, fat: 8 },
            { food: 'Mixed nuts', qty: '20g', kcal: 120, protein: 4, carbs: 4, fat: 10 },
          ]},
          { name: 'Lunch', time: '12:30', items: [
            { food: 'Grilled chicken', qty: '160g', kcal: 270, protein: 42, carbs: 0, fat: 7 },
            { food: 'Brown rice', qty: '180g cooked', kcal: 220, protein: 5, carbs: 46, fat: 2 },
            { food: 'Green salad', qty: '1 bowl', kcal: 90, protein: 2, carbs: 8, fat: 5 },
          ]},
          { name: 'Dinner', time: '19:30', items: [
            { food: 'Baked salmon', qty: '150g', kcal: 310, protein: 32, carbs: 0, fat: 19 },
            { food: 'Roast sweet potato', qty: '200g', kcal: 180, protein: 3, carbs: 41, fat: 0 },
            { food: 'Steamed broccoli', qty: '150g', kcal: 55, protein: 4, carbs: 7, fat: 1 },
          ]},
        ],
      },
      updatedAt: t(14),
    },
    {
      id: 'tpl-daniel-w1', coachId: danielId, kind: 'workout',
      title: 'Powerbuilding Base (Intermediate)',
      note: '4-day upper/lower. For clients with 6+ months of lifting who want strength + size.',
      days: [
        { name: 'Day 1', focus: 'Lower — strength', exercises: [
          { name: 'Back squat', sets: 5, reps: '5', restSec: 180 },
          { name: 'Romanian deadlift', sets: 3, reps: '8', restSec: 120 },
          { name: 'Leg press', sets: 3, reps: '12', restSec: 90 },
        ]},
        { name: 'Day 2', focus: 'Upper — strength', exercises: [
          { name: 'Bench press', sets: 5, reps: '5', restSec: 180 },
          { name: 'Barbell row', sets: 4, reps: '8', restSec: 120 },
          { name: 'Overhead press', sets: 3, reps: '8', restSec: 90 },
        ]},
        { name: 'Day 3', focus: 'Lower — hypertrophy', exercises: [
          { name: 'Front squat', sets: 4, reps: '8', restSec: 120 },
          { name: 'Walking lunges', sets: 3, reps: '12/leg', restSec: 90 },
          { name: 'Leg curl', sets: 3, reps: '15', restSec: 60 },
        ]},
        { name: 'Day 4', focus: 'Upper — hypertrophy', exercises: [
          { name: 'Incline DB press', sets: 4, reps: '10', restSec: 90 },
          { name: 'Weighted pull-up', sets: 4, reps: '8', restSec: 120 },
          { name: 'Lateral raise', sets: 3, reps: '15', restSec: 45 },
        ]},
      ],
      updatedAt: t(10),
    },
  ];
}

export async function getDB(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cache = migrate(JSON.parse(raw) as DB);
      return cache;
    }
  } catch {
    // corrupted storage -> reseed
  }
  cache = seed();
  await persist();
  return cache;
}

// Forward-migrate older persisted snapshots when new collections ship.
function migrate(d: DB): DB {
  if (!d.planTemplates || d.planTemplates.length === 0) {
    const maya = d.users.find((u) => u.email === 'coach@fitcoach.app');
    const dan = d.users.find((u) => u.email === 'daniel@fitcoach.app');
    d.planTemplates = maya && dan ? seedTemplates(maya.id, dan.id) : [];
  }
  d.workoutCheckoffs = d.workoutCheckoffs ?? [];
  d.dietCheckoffs = d.dietCheckoffs ?? [];
  return d;
}

export async function persist(): Promise<void> {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage quota (large photos) — keep working in-memory
  }
}

export async function resetDB(): Promise<void> {
  cache = seed();
  await persist();
}
