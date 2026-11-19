import { writeFileSync } from 'node:fs';
import { demoDataset } from '../src/lib/demo.ts';
import Papa from 'papaparse';
const rows = demoDataset().enrollments.map(r => ({
  'Registration ID':r.registration_id,'Participant ID':r.participant_id,'Participant Name':r.participant_name,
  'Camp ID':r.camp_id,'Camp Name':r.camp_name,'Camp Type':r.camp_type,'Start Date':r.starts_on,'End Date':r.ends_on,
  'Registration Date':r.registered_on,'School':r.school,'District':r.district,'Referral Source':r.referral_source,
  'Status':r.status,'Amount Paid':(r.amount_cents/100).toFixed(2),
}));
writeFileSync('public/campify-demo-enrollments.csv', Papa.unparse(rows));
console.log(`Wrote ${rows.length} synthetic enrollments to public/campify-demo-enrollments.csv`);
