// Zod schemas — these mirror the backend DTO validation (jakarta.validation
// annotations in fitcoach-backend). Invalid input surfaces as specific inline
// field errors, never a generic failure.
import { z } from 'zod';

const intBetween = (v: string, min: number, max: number) => {
  if (v.trim() === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max;
};

const numStr = (label: string, min: number, max: number) =>
  z
    .string()
    .refine(
      (v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max),
      `${label} must be between ${min} and ${max}`
    );

export const SignInSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type SignInForm = z.infer<typeof SignInSchema>;

export const SignUpSchema = z.object({
  role: z.enum(['client', 'coach']),
  name: z.string().min(2, 'Enter your full name').max(80, 'Name is too long'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').max(100),
});
export type SignUpForm = z.infer<typeof SignUpSchema>;

export const ProgressSchema = z.object({
  weight: numStr('Weight', 20, 400),
  waist: numStr('Waist', 30, 300),
  chest: numStr('Chest', 30, 300),
  hips: numStr('Hips', 30, 300),
  notes: z.string().max(500, 'Keep notes under 500 characters'),
});
export type ProgressForm = z.infer<typeof ProgressSchema>;

const ExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required'),
  sets: z.string().refine((v) => intBetween(v, 1, 20), 'Sets: 1–20'),
  reps: z.string().min(1, 'Reps required'),
  rest: z.string().refine((v) => intBetween(v, 0, 600), 'Rest: 0–600s'),
});
const DaySchema = z.object({
  name: z.string().min(1, 'Day name is required'),
  focus: z.string(),
  exercises: z.array(ExerciseSchema).min(1, 'Add at least one exercise'),
});
export const WorkoutPlanSchema = z.object({
  title: z.string().min(3, 'Give the plan a title'),
  days: z.array(DaySchema).min(1, 'Add at least one training day'),
});
export type WorkoutPlanForm = z.infer<typeof WorkoutPlanSchema>;

const DietItemSchema = z.object({
  food: z.string().min(1, 'Food is required'),
  qty: z.string().min(1, 'Qty required'),
  kcal: z.string().refine((v) => intBetween(v, 0, 3000), 'kcal: 0–3000'),
  protein: numStr('Protein', 0, 1000),
  carbs: numStr('Carbs', 0, 1000),
  fat: numStr('Fat', 0, 1000),
});
const MealSchema = z.object({
  name: z.string().min(1, 'Meal name is required'),
  time: z.string(),
  items: z.array(DietItemSchema).min(1, 'Add at least one food'),
});
export const DietPlanSchema = z.object({
  title: z.string().min(3, 'Give the plan a title'),
  targetKcal: z.string().refine((v) => intBetween(v, 800, 8000), 'Target: 800–8000 kcal'),
  meals: z.array(MealSchema).min(1, 'Add at least one meal'),
  notes: z.string().max(1000, 'Keep notes under 1000 characters'),
});
export type DietPlanForm = z.infer<typeof DietPlanSchema>;

export const PackageSchema = z.object({
  title: z.string().min(3, 'Title is too short').max(60),
  price: z.string().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 100000, 'Enter a valid price'),
  durationDays: z.string().refine((v) => intBetween(v, 1, 365), 'Duration: 1–365 days'),
  featuresText: z.string().min(3, 'List at least one feature (one per line)'),
});
export type PackageForm = z.infer<typeof PackageSchema>;

export const ProfileSchema = z.object({
  bio: z.string().min(10, 'Bio is too short (min 10 characters)').max(500, 'Keep bio under 500 characters'),
  specialties: z.string().min(2, 'Add specialties, comma separated').max(200),
  experienceYears: z.string().refine((v) => intBetween(v, 0, 60), 'Experience: 0–60 years'),
});
export type ProfileForm = z.infer<typeof ProfileSchema>;
