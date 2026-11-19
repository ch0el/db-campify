export type EnrollmentStatus = 'confirmed' | 'cancelled' | 'waitlisted';
export interface Enrollment {
  registration_id: string;
  participant_id: string;
  participant_name: string;
  camp_id: string;
  camp_name: string;
  camp_type: string;
  starts_on: string;
  ends_on: string;
  registered_on: string;
  school: string;
  district: string;
  referral_source: string;
  status: EnrollmentStatus;
  amount_cents: number;
}
export const featureKeys = ['goals', 'players', 'demographics', 'calendar', 'enrollment'] as const;
export type Feature = typeof featureKeys[number];
export interface Profile { display_name: string; features: Feature[] }
export interface Goal { year: number; target: number }
export interface ImportRecord { id: string; file_name: string; imported_at: string; row_count: number; file_hash: string }
export interface Dataset { enrollments: Enrollment[]; imports: ImportRecord[]; goals: Goal[] }
