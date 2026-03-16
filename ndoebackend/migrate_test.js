'use strict';
/**
 * TEST MIGRATION — 2 random parties, 10 transactions max
 * Run: node migrate_test.js
 */

const { PrismaClient, Prisma } = require("@prisma/client");
const XLSX   = require("xlsx");
const fs     = require("fs");
const crypto = require("crypto");

try { require("dotenv").config(); } catch {}

const FILE = "RIC Stock Report 31 Dec  2025 (1).csv";
const MAX_TXN = 10;

const uuid = () => crypto.randomUUID();

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || ["none","nan","#name?","#value!",""].includes(s.toLowerCase())) return null;
  return s;
}
function toDate(v) {
  if (v == null) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  try { const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d; } catch { return null; }
}
function posNum(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) && n > 0 ? n : null;
}
function parseSize(sz) {
  if (!sz) return { thickness: null, width: null, length: null };
  const parts = sz.toUpperCase().replace(/MM/g,"").replace(/\s/g,"").split("*").map(p => parseFloat(p));
  return { thickness: isFinite(parts[0]) ? parts[0] : null, width: isFinite(parts[1]) ? parts[1] : null, length: parts[2] != null && isFinite(parts[2]) ? parts[2] : null };
}
function mapGrade(raw) {
  if (!raw) return "CR";
  const MAP = { CR:"CR", HR:"HR", GC:"GC", GP:"GP", BP:"BP", CHEQUERED:"Chequered", CHEQ:"Chequered" };
  return MAP[raw.trim().toUpperCase()] ?? "CR";
}
function hashPw(pw) {
  return "$2b$12$" + crypto.createHash("sha256").update(pw).digest("hex").substring(0, 53);
}

// ── Load Excel ───────────────────────────────────────────────────────────────
function loadExcel() {
  console.log(`\n  📂  Reading ${FILE} …`);
  const wb = XLSX.readFile(FILE, { cellDates: true, dense: false });

  // Party Master
  const pmRaw = XLSX.utils.sheet_to_json(wb.Sheets["PARTY MASTER"], { header: 1 });
  const partyMaster = [];
  for (let i = 1; i < pmRaw.length; i++) {
    const name = clean(pmRaw[i]?.[0]);
    if (!name) continue;
    partyMaster.push({ name, gst: clean(pmRaw[i]?.[1]), address: clean(pmRaw[i]?.[2]) });
  }

  // Data Entry
  const KNOWN = new Set(["Coil-In","Pkt-In","JW-C","Dispatch","Handling","Coil-Transfer-Out","Coil-Transfer-In"]);
  const deRaw = XLSX.utils.sheet_to_json(wb.Sheets["Data Entry"], { header: 1, raw: false, cellDates: true });
  const rows = [];
  for (let i = 2; i < deRaw.length; i++) {
    const r = deRaw[i];
    if (!r || !r[0]) continue;
    const dt  = toDate(r[0]);
    const act = clean(r[1]);
    if (!dt || !act || !KNOWN.has(act)) continue;
    rows.push({
      rowNum: i + 1, date: dt, activity: act,
      party:     clean(r[2]),
      number:    r[3] != null ? String(r[3]).trim() || null : null,
      size:      clean(r[5]),
      coilType:  clean(r[6]),
      netWeight: posNum(r[7]),
      truck:     clean(r[8]),
      output:    (() => { const n = parseFloat(r[9]); return isFinite(n) ? n : null; })(),
      kataWt:    posNum(r[13]),
      rate:      posNum(r[14]),
      remark:    clean(r[17]),
      dateIn:    toDate(r[29]),
    });
  }
  return { partyMaster, rows };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   RIC Steel — TEST MIGRATION (2 parties, 10 txns)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  const { partyMaster, rows } = loadExcel();

  // Pick 2 random parties that actually have Coil-In data
  const partiesWithCoils = [...new Set(
    rows.filter(r => r.activity === "Coil-In" && r.party).map(r => r.party)
  )];
  // Shuffle and take 2
  for (let i = partiesWithCoils.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [partiesWithCoils[i], partiesWithCoils[j]] = [partiesWithCoils[j], partiesWithCoils[i]];
  }
  const chosen = partiesWithCoils.slice(0, 2);
  console.log(`\n  🎲  Chosen parties: ${chosen[0]}  |  ${chosen[1]}`);

  // Filter rows to only chosen parties
  const chosenUpper = new Set(chosen.map(p => p.toUpperCase()));
  const filtered = rows.filter(r => r.party && chosenUpper.has(r.party.toUpperCase()));
  console.log(`  📊  Rows for these parties: ${filtered.length}`);

  const prisma = new PrismaClient({ log: ["warn","error"] });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("  ✅  DB connected\n");

    // ── Ensure migrator user exists ──────────────────────────────────────────
    await prisma.user.upsert({
      where:  { username: "test_migrator" },
      update: {},
      create: { id: uuid(), username: "test_migrator", email: "test@ricsteel.local",
                password_hash: hashPw("test"), role: "operator", is_active: false },
    });
    const migUser = await prisma.user.findUnique({ where: { username: "test_migrator" } });
    const mid = migUser.id;

    // ── Insert 2 parties ─────────────────────────────────────────────────────
    const partyMap = new Map();
    for (const name of chosen) {
      const pm = partyMaster.find(p => p.name.toUpperCase() === name.toUpperCase());
      let party = await prisma.party.findFirst({ where: { name } });
      if (!party) {
        party = await prisma.party.create({
          data: { id: uuid(), name, gst_number: pm?.gst ?? null, address: pm?.address ?? null,
                  billing_cycle: "monthly", is_active: true },
        });
        console.log(`  ✅  Created party: ${name}`);
      } else {
        console.log(`  ℹ️   Party already exists: ${name}`);
      }
      partyMap.set(name.toUpperCase(), party.id);
    }

    // ── Insert Coil-In rows (up to MAX_TXN) ─────────────────────────────────
    const coilInRows = filtered.filter(r => r.activity === "Coil-In");
    let txnCount = 0;
    const coilMap = new Map();

    console.log(`\n  🔩  Inserting coils + transactions (max ${MAX_TXN})…`);
    for (const r of coilInRows) {
      if (txnCount >= MAX_TXN) break;
      const num     = r.number;
      if (!num) continue;
      const partyId = partyMap.get((r.party ?? "").toUpperCase());
      if (!partyId) continue;
      const weight  = r.netWeight ?? r.kataWt;
      if (!weight)  continue;

      const sz      = parseSize(r.size);
      const grade   = mapGrade(r.coilType);
      const coilId  = uuid();
      const stockDate = r.dateIn ?? r.date;

      // Skip if already exists
      const existing = await prisma.coil.findUnique({ where: { coil_number: num } });
      if (existing) { coilMap.set(num, existing.id); console.log(`  ↩️   Skipped (exists): Coil ${num}`); continue; }

      await prisma.coil.create({
        data: {
          id: coilId, coil_number: num,
          current_party_id: partyId, original_party_id: partyId,
          product_form: "coil", coil_grade: grade,
          size:          r.size ?? "Unknown",
          thickness_mm:  sz.thickness != null ? new Prisma.Decimal(sz.thickness) : null,
          width_mm:      sz.width     != null ? new Prisma.Decimal(sz.width)     : null,
          net_weight_kg: new Prisma.Decimal(weight),
          processing_stage: "received",
          rate_per_kg:   r.rate != null ? new Prisma.Decimal(r.rate) : null,
          stock_in_date: stockDate,
          remark:        r.remark,
          created_by:    mid,
        },
      });
      coilMap.set(num, coilId);

      const amount = r.rate != null ? weight * r.rate : null;
      await prisma.transaction.create({
        data: {
          id: uuid(), txn_date: r.date, activity: "Coil_In",
          party_id: partyId, coil_id: coilId, coil_grade: grade,
          net_weight_kg: new Prisma.Decimal(weight),
          rate_applied:  r.rate != null ? new Prisma.Decimal(r.rate) : null,
          amount_charged: amount != null ? new Prisma.Decimal(amount) : null,
          truck_do_number: r.truck, remark: r.remark, created_by: mid,
        },
      });
      txnCount++;
      console.log(`  ✅  [${txnCount}/${MAX_TXN}]  Coil ${num.padEnd(18)} | ${r.party.padEnd(30)} | ${weight} kg`);
    }

    // ── Verification ─────────────────────────────────────────────────────────
    console.log("\n  🔎  DB counts after test migration:");
    const [pCnt, cCnt, tCnt] = await Promise.all([
      prisma.party.count(),
      prisma.coil.count(),
      prisma.transaction.count(),
    ]);
    console.log(`       parties      : ${pCnt}`);
    console.log(`       coils        : ${cCnt}`);
    console.log(`       transactions : ${tCnt}`);

    console.log("\n  ✅  Test migration done!");
    console.log("  👉  To run FULL migration:  node migrate_excel.js\n");

  } catch (e) {
    console.error(`\n  ❌  Error: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
