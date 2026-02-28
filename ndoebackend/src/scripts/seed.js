/**
 * RIC Steel Industries — Database Seed Script
 * Run: node src/scripts/seed.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RIC Steel database...\n');

  // ── Clear in dependency order ─────────────────────────────────────────────
  await prisma.activityLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.transferLineItem.deleteMany();
  await prisma.transferOrder.deleteMany();
  await prisma.packet.deleteMany();
  await prisma.coil.deleteMany();
  await prisma.pricingConfig.deleteMany();
  await prisma.party.deleteMany();
  await prisma.user.deleteMany();
  await prisma.settings.deleteMany();
  console.log('  ✓ Old data cleared');

  // ── Settings ──────────────────────────────────────────────────────────────
  await prisma.settings.create({
    data: {
      gst_percentage: 18,
      company_name: 'RIC Steel Industries',
      company_address: 'Plot No. 45, GIDC Industrial Area, Ahmedabad - 382445',
      company_mobile: '+91 98765 43210',
      company_email: 'info@ricsteel.in',
      invoice_prefix: 'RIC',
      invoice_due_days: 30,
      auto_overdue_days: 7,
      bank_details: 'HDFC Bank | AC: 12345678901234 | IFSC: HDFC0001234',
      footer_notes: 'Thank you for your business. Goods once sold will not be taken back.',
    },
  });
  console.log('  ✓ Settings created');

  // ── Users ─────────────────────────────────────────────────────────────────
  const hash = (p) => bcrypt.hashSync(p, 10);
  const [admin, op1, viewer1] = await Promise.all([
    prisma.user.create({ data: { username: 'admin', email: 'admin@ricsteel.in', password_hash: hash('admin123'), role: 'admin', is_active: true } }),
    prisma.user.create({ data: { username: 'operator1', email: 'op1@ricsteel.in', password_hash: hash('op1pass'), role: 'operator', is_active: true } }),
    prisma.user.create({ data: { username: 'viewer1', email: 'viewer@ricsteel.in', password_hash: hash('view123'), role: 'viewer', is_active: true } }),
  ]);
  console.log('  ✓ Users: admin / operator1 / viewer1');

  // ── Parties ───────────────────────────────────────────────────────────────
  const [tata, jsw, sail, essar, uttam] = await Promise.all([
    prisma.party.create({ data: { name: 'Tata Steel Ltd', gst_number: '27AAACT2727Q1ZW', contact_person: 'Rajan Mehta', mobile_number: '9876543210', address: 'Jamshedpur, Jharkhand', credit_limit: 500000, billing_cycle: 'monthly', is_active: true } }),
    prisma.party.create({ data: { name: 'JSW Steel Ltd', gst_number: '29AAACJ3795N1ZN', contact_person: 'Suresh Rao', mobile_number: '9876500001', address: 'Vijayanagar, Karnataka', credit_limit: 750000, billing_cycle: 'monthly', is_active: true } }),
    prisma.party.create({ data: { name: 'SAIL (Bhilai)', gst_number: '22AAACS1234A1ZB', contact_person: 'Anil Kumar', mobile_number: '9765432198', address: 'Bhilai, Chhattisgarh', credit_limit: 600000, billing_cycle: 'quarterly', is_active: true } }),
    prisma.party.create({ data: { name: 'Essar Steel', gst_number: '24AAACE4321K1ZT', contact_person: 'Vikram Shah', mobile_number: '9654321098', address: 'Hazira, Surat, Gujarat', credit_limit: 400000, billing_cycle: 'monthly', is_active: true } }),
    prisma.party.create({ data: { name: 'Uttam Galva', gst_number: '27AAACU5678P1ZY', contact_person: 'Priya Joshi', mobile_number: '9543210987', address: 'Khopoli, Maharashtra', credit_limit: 300000, billing_cycle: 'monthly', is_active: true } }),
  ]);
  console.log('  ✓ Parties: Tata Steel, JSW, SAIL, Essar, Uttam Galva');

  // ── Pricing Configs ───────────────────────────────────────────────────────
  const effDate = new Date('2024-01-01');
  const pricingData = [
    { coil_grade: 'HR', activity_type: 'storage',    rate: 0.50, rate_unit: 'per_kg', jw_line: null },
    { coil_grade: 'HR', activity_type: 'processing', rate: 1.20, rate_unit: 'per_kg', jw_line: 'Line-A' },
    { coil_grade: 'HR', activity_type: 'handling',   rate: 0.30, rate_unit: 'per_kg', jw_line: null },
    { coil_grade: 'CR', activity_type: 'storage',    rate: 0.60, rate_unit: 'per_kg', jw_line: null },
    { coil_grade: 'CR', activity_type: 'processing', rate: 1.50, rate_unit: 'per_kg', jw_line: 'Line-A' },
    { coil_grade: 'CR', activity_type: 'processing', rate: 1.80, rate_unit: 'per_kg', jw_line: 'Line-B' },
    { coil_grade: 'CR', activity_type: 'handling',   rate: 0.40, rate_unit: 'per_kg', jw_line: null },
    { coil_grade: 'GP', activity_type: 'storage',    rate: 0.70, rate_unit: 'per_kg', jw_line: null },
    { coil_grade: 'GP', activity_type: 'processing', rate: 2.00, rate_unit: 'per_kg', jw_line: 'Line-A' },
    { coil_grade: 'GC', activity_type: 'storage',    rate: 0.65, rate_unit: 'per_kg', jw_line: null },
  ];
  await Promise.all(pricingData.map((p) => prisma.pricingConfig.create({ data: { ...p, effective_from: effDate, is_active: true, created_by: admin.id } })));
  console.log('  ✓ Pricing configs: HR / CR / GP / GC rates');

  // ── Coils ─────────────────────────────────────────────────────────────────
  const today = new Date();
  const daysAgo = (n) => new Date(today.getTime() - n * 86400000);

  const coilsData = [
    { coil_number: 'C-2024-001', party: tata,  grade: 'HR', form: 'coil',      size: '2.5mm x 1250mm', thickness: 2.5, width: 1250, weight: 18500, kata: 120, truck: 'GJ-01-AB-1234', kanta: 'Kanta-A', kata_no: 'K-001', chalan: 'CH-001', rate: 48.5, stage: 'received',  daysAgo: 45 },
    { coil_number: 'C-2024-002', party: jsw,   grade: 'CR', form: 'coil',      size: '1.2mm x 1000mm', thickness: 1.2, width: 1000, weight: 12300, kata: 90,  truck: 'MH-12-CD-5678', kanta: 'Kanta-B', kata_no: 'K-002', chalan: 'CH-002', rate: 62.0, stage: 'stage1',   daysAgo: 30 },
    { coil_number: 'C-2024-003', party: sail,  grade: 'HR', form: 'slit_coil', size: '3.0mm x 900mm',  thickness: 3.0, width: 900,  weight: 22100, kata: 150, truck: 'CG-04-EF-9012', kanta: 'Kanta-A', kata_no: 'K-003', chalan: 'CH-003', rate: 46.0, stage: 'stage2',   daysAgo: 20 },
    { coil_number: 'C-2024-004', party: essar, grade: 'GP', form: 'coil',      size: '0.8mm x 1200mm', thickness: 0.8, width: 1200, weight: 9800,  kata: 80,  truck: 'GJ-05-GH-3456', kanta: 'Kanta-C', kata_no: 'K-004', chalan: 'CH-004', rate: 72.0, stage: 'received',  daysAgo: 10 },
    { coil_number: 'C-2024-005', party: tata,  grade: 'CR', form: 'coil',      size: '1.5mm x 1500mm', thickness: 1.5, width: 1500, weight: 15600, kata: 110, truck: 'GJ-01-IJ-7890', kanta: 'Kanta-B', kata_no: 'K-005', chalan: 'CH-005', rate: 60.0, stage: 'received',  daysAgo: 5  },
  ];

  const createdCoils = [];
  for (const cd of coilsData) {
    const coil = await prisma.coil.create({
      data: {
        coil_number: cd.coil_number, current_party_id: cd.party.id, original_party_id: cd.party.id,
        product_form: cd.form, coil_grade: cd.grade, size: cd.size,
        thickness_mm: cd.thickness, width_mm: cd.width, net_weight_kg: cd.weight, kata_weight_kg: cd.kata,
        truck_do_number: cd.truck, kanta_name: cd.kanta, kata_number: cd.kata_no, chalan_number: cd.chalan,
        rate_per_kg: cd.rate, processing_stage: cd.stage, stock_in_date: daysAgo(cd.daysAgo),
        created_by: admin.id,
      },
    });
    // Coil_In ledger entry
    await prisma.transaction.create({
      data: {
        txn_date: daysAgo(cd.daysAgo), activity: 'Coil_In', party_id: cd.party.id, coil_id: coil.id,
        coil_grade: cd.grade, net_weight_kg: cd.weight, rate_applied: cd.rate,
        chalan_number: cd.chalan, truck_do_number: cd.truck, created_by: admin.id,
      },
    });
    createdCoils.push(coil);
  }
  console.log('  ✓ Coils: C-2024-001 to C-2024-005');

  // ── Packets ───────────────────────────────────────────────────────────────
  const packetsData = [
    { no: 'P-2024-001', party: jsw,   grade: 'CR', size: '1.2mm x 1000mm', weight: 4200, kata: 40, truck: 'MH-12-PQ-1111', kanta: 'Kanta-D', kata_no: 'PK-001', rate: 62.0, daysAgo: 60 },
    { no: 'P-2024-002', party: uttam, grade: 'HR', size: '2.0mm x 800mm',  weight: 3100, kata: 30, truck: 'MH-04-RS-2222', kanta: 'Kanta-A', kata_no: 'PK-002', rate: 50.0, daysAgo: 25 },
    { no: 'P-2024-003', party: tata,  grade: 'GP', size: '0.8mm x 600mm',  weight: 2800, kata: 25, truck: 'GJ-01-TU-3333', kanta: 'Kanta-B', kata_no: 'PK-003', rate: 72.0, daysAgo: 12 },
  ];

  for (const pd of packetsData) {
    const pkt = await prisma.packet.create({
      data: {
        packet_number: pd.no, party_id: pd.party.id, original_party_id: pd.party.id,
        coil_grade: pd.grade, size: pd.size, net_weight_kg: pd.weight, kata_weight_kg: pd.kata,
        truck_do_number: pd.truck, kanta_name: pd.kanta, kata_number: pd.kata_no,
        rate_per_kg: pd.rate, stock_in_date: daysAgo(pd.daysAgo), is_dispatched: false,
        created_by: admin.id,
      },
    });
    await prisma.transaction.create({
      data: {
        txn_date: daysAgo(pd.daysAgo), activity: 'Pkt_In', party_id: pd.party.id, packet_id: pkt.id,
        coil_grade: pd.grade, net_weight_kg: pd.weight, rate_applied: pd.rate,
        truck_do_number: pd.truck, created_by: admin.id,
      },
    });
  }
  console.log('  ✓ Packets: P-2024-001 to P-2024-003');

  console.log('\n✅ Seed complete!\n');
  console.log('  Login: admin / admin123');
  console.log('  Login: operator1 / op1pass');
  console.log('  Login: viewer1 / view123\n');
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
