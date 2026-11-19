import type { Dataset, Enrollment } from './types';
// Entirely synthetic. Stable participant IDs intentionally repeat across years.
export function demoDataset(): Dataset {
  const enrollments: Enrollment[] = [];
  const schools = ['Riverside High School', 'Jordan High School', 'Chapel Hill High School', 'Cary High School', 'Northern High School', 'East Chapel Hill High School'];
  const districts = ['Durham', 'Durham', 'Chapel Hill–Carrboro', 'Wake', 'Durham', 'Chapel Hill–Carrboro'];
  const names = ['Alex', 'Cameron', 'Jordan', 'Morgan', 'Riley', 'Sam', 'Taylor', 'Casey'];
  const counts = [84, 109, 96, 132, 156];
  for (let yi = 0; yi < 5; yi++) {
    const year = 2022 + yi;
    for (let i = 0; i < counts[yi]; i++) {
      const camp = i % 3;
      const person = (i + yi * 23) % 210;
      const starts = [`${year}-06-15`, `${year}-07-12`, `${year}-11-21`][camp];
      enrollments.push({
        registration_id: `DEMO-${year}-${i + 1}`, participant_id: `DEMO-P${person}`,
        participant_name: `${names[person % names.length]} Sample ${person + 1}`,
        camp_id: `DEMO-C${year}-${camp}`, camp_name: ['Summer Skills Camp', 'Youth Development Camp', 'Fall Prospect Camp'][camp],
        camp_type: ['Skills', 'Youth', 'Prospect'][camp], starts_on: starts,
        ends_on: [`${year}-06-18`, `${year}-07-15`, `${year}-11-22`][camp],
        registered_on: `${year}-04-${String(i % 27 + 1).padStart(2, '0')}`,
        school: schools[person % schools.length], district: districts[person % schools.length],
        referral_source: i % 10 < 6 ? 'Duke outreach' : ['Word of mouth', 'Play’n Sports', 'Unknown'][i % 3],
        status: i % 23 === 0 ? 'cancelled' : i % 29 === 0 ? 'waitlisted' : 'confirmed',
        amount_cents: [22500, 17500, 30000][camp],
      });
    }
  }
  return { enrollments, imports: [], goals: Array.from({ length: 5 }, (_, i) => ({ year: 2022 + i, target: [90, 110, 120, 140, 160][i] })) };
}
