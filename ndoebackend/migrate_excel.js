'use strict';
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  RIC STEEL — Excel → Neon PostgreSQL Migration (CommonJS)           ║
 * ║  Target schema: Prisma schema v2.0 (prisma/schema.prisma)           ║
 * ║  Source: "RIC Stock Report 31 Dec  2025 (1).csv" (xlsx format)      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * USAGE:
 *   # Dry run (parse + validate, zero DB writes):
 *   node migrate_excel.js --dry-run
 *
 *   # Full migration:
 *   node migrate_excel.js
 *
 *   # Custom file + verbose:
 *   node migrate_excel.js --file "path/to/file.xlsx" --verbose
 */

const { PrismaClient, Prisma } = require("@prisma/client");
const XLSX   = require("xlsx");
const fs     = require("fs");
const crypto = require("crypto");

try { require("dotenv").config(); } catch {}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — ARG PARSING & STATS
// ════════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  return {
    file:    get("--file") ?? "RIC Stock Report 31 Dec  2025 (1).csv",
    dryRun:  args.includes("--dry-run"),
    verbose: args.includes("--verbose"),
  };
}

class MigStats {
  constructor() {
    this.parties = 0;    this.partiesSkip = 0;
    this.coils   = 0;    this.coilsSkip   = 0;
    this.packets = 0;    this.packetsSkip = 0;
    this.jwOutputs = 0;  this.jwOrphan    = 0;
    this.transfers = 0;  this.tli         = 0;  this.transferOrphan = 0;
    this.dispatches = 0; this.dispatchOrphan = 0;
    this.handling   = 0; this.handlingOrphan = 0;
    this.transactions = 0;
    this.warnings = [];
  }
  warn(msg) { this.warnings.push(msg); }
  report() {
    const SEP = "═".repeat(64);
    console.log(`\n${SEP}\n  MIGRATION SUMMARY\n${SEP}`);
    const rows = [
      ["Parties",            this.parties,    this.partiesSkip,    "skipped"],
      ["Coils",              this.coils,      this.coilsSkip,      "skipped"],
      ["Packets",            this.packets,    this.packetsSkip,    "skipped"],
      ["JW Processing Txns", this.jwOutputs,  this.jwOrphan,       "orphans"],
      ["Transfer Orders",    this.transfers,  this.transferOrphan, "orphans"],
      ["Transfer LineItems", this.tli],
      ["Dispatch Txns",      this.dispatches, this.dispatchOrphan, "orphans"],
      ["Handling Txns",      this.handling,   this.handlingOrphan, "orphans"],
      ["Total Transactions", this.transactions],
    ];
    for (const [label, ok, bad, bLabel] of rows) {
      let s = `  ${label.padEnd(30)} inserted=${String(ok).padEnd(6)}`;
      if (bad !== undefined && bLabel) s += ` ${bLabel}=${bad}`;
      console.log(s);
    }
    if (this.warnings.length) {
      console.log(`\n  ⚠  ${this.warnings.length} warnings:`);
      this.warnings.slice(0, 25).forEach(w => console.log(`     • ${w}`));
      if (this.warnings.length > 25)
        console.log(`     … and ${this.warnings.length - 25} more → migrate_warnings.txt`);
    }
    console.log(SEP);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — HELPERS
// ════════════════════════════════════════════════════════════════════════════

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
  try { const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d; }
  catch { return null; }
}

function toNum(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : null;
}

function posNum(v) {
  const n = toNum(v);
  return n != null && n > 0 ? n : null;
}

function parseSize(sz) {
  if (!sz) return { thickness: null, width: null, length: null };
  const s = sz.toUpperCase().replace(/MM/g, "").replace(/\s/g, "");
  const parts = s.split("*").map(p => parseFloat(p));
  return {
    thickness: isFinite(parts[0]) ? parts[0] : null,
    width:     isFinite(parts[1]) ? parts[1] : null,
    length:    parts[2] != null && isFinite(parts[2]) ? parts[2] : null,
  };
}

function mapGrade(raw) {
  if (!raw) return "CR";
  const MAP = { CR:"CR", HR:"HR", GC:"GC", GP:"GP", BP:"BP", CHEQUERED:"Chequered", CHEQ:"Chequered" };
  return MAP[raw.trim().toUpperCase()] ?? "CR";
}

function mapProduct(raw) {
  if (!raw) return "coil";
  const r = raw.trim().toUpperCase();
  if (r === "PACKET")                            return "packet";
  if (r === "SHEET")                             return "sheet";
  if (r.includes("SLIT"))                        return "slit_coil";
  if (r.includes("REWOUND") || r.includes("REWIND")) return "rewound_coil";
  return "coil";
}

function mapActivity(act) {
  const MAP = {
    "Coil-In":"Coil_In", "Pkt-In":"Pkt_In",
    "Coil-Transfer-Out":"Coil_Transfer_Out", "Coil-Transfer-In":"Coil_Transfer_In",
    "Pkt-Transfer-Out":"Pkt_Transfer_Out",   "Pkt-Transfer-In":"Pkt_Transfer_In",
    "Dispatch":"Dispatch", "Handling":"Handling",
    "Internal-Transfer":"Internal_Transfer",
    "JW-C":"JW_C", "JW-R":"JW_R", "JW-S":"JW_S",
  };
  return MAP[act] ?? act;
}

function decodeJwcOutput(output) {
  const plates  = Math.floor(output);
  const scrapKg = Math.round((output - plates) * 10000) / 10000;
  return { plates, scrapKg, totalQty: Math.abs(output) };
}

function hashPw(pw) {
  const hash = crypto.createHash("sha256").update(pw).digest("hex");
  return `$2b$12$${hash.substring(0, 53)}`;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — EXCEL LOADER
// ════════════════════════════════════════════════════════════════════════════

function loadExcel(filePath) {
  console.log(`\n  📂  Reading ${filePath} …`);
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const wb = XLSX.readFile(filePath, { cellDates: true, dense: false });

  // ── PARTY MASTER ──────────────────────────────────────────────
  const pmSheet = wb.Sheets["PARTY MASTER"];
  if (!pmSheet) throw new Error('Sheet "PARTY MASTER" not found in workbook');
  const pmRaw       = XLSX.utils.sheet_to_json(pmSheet, { header: 1 });
  const partyMaster = [];
  for (let i = 1; i < pmRaw.length; i++) {
    const name = clean(pmRaw[i]?.[0]);
    if (!name) continue;
    partyMaster.push({
      name,
      gst:     clean(pmRaw[i]?.[1]),
      address: clean(pmRaw[i]?.[2]),
      mobile:  clean(pmRaw[i]?.[3] != null ? String(pmRaw[i][3]).substring(0, 15) : null),
      contact: clean(pmRaw[i]?.[4]),
    });
  }
  console.log(`  ✅  Party Master: ${partyMaster.length} rows`);

  // ── DATA ENTRY ─────────────────────────────────────────────────
  const deSheet = wb.Sheets["Data Entry"];
  if (!deSheet) throw new Error('Sheet "Data Entry" not found in workbook');
  const deRaw = XLSX.utils.sheet_to_json(deSheet, { header: 1, raw: false, cellDates: true });

  const KNOWN = new Set([
    "Coil-In","Pkt-In","JW-C","JW-R","JW-S",
    "Coil-Transfer-Out","Coil-Transfer-In",
    "Pkt-Transfer-Out","Pkt-Transfer-In",
    "Dispatch","Handling","Internal-Transfer",
  ]);

  const rows = [];
  let skipped = 0;

  for (let i = 2; i < deRaw.length; i++) {
    const r = deRaw[i];
    if (!r || !r[0]) { skipped++; continue; }
    const dt  = toDate(r[0]);
    const act = clean(r[1]);
    if (!dt || !act || !KNOWN.has(act)) { skipped++; continue; }

    rows.push({
      rowNum:    i + 1,
      date:      dt,
      activity:  act,
      party:     clean(r[2]),
      number:    r[3] != null ? String(r[3]).trim() || null : null,
      product:   clean(r[4]),
      size:      clean(r[5]),
      coilType:  clean(r[6]),
      netWeight: posNum(r[7]),
      truck:     clean(r[8]),
      truckRaw:  r[8],
      output:    toNum(r[9]),
      chalan:    r[10] != null ? String(r[10]).trim() || null : null,
      kanta:     clean(r[11]),
      kataNum:   r[12] != null ? String(r[12]).trim() || null : null,
      kataWt:    posNum(r[13]),
      rate:      posNum(r[14]),
      remark:    (() => { const rm = clean(r[17]); return rm && rm.toUpperCase() === "RIC" ? null : rm; })(),
      unit:      clean(r[18]),
      dateIn:    toDate(r[29]),
      dateOut:   toDate(r[30]),
    });
  }

  console.log(`  ✅  Data Entry: ${rows.length} valid rows  (${skipped} skipped)`);
  return { rows, partyMaster };
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MIGRATION PHASES
// ════════════════════════════════════════════════════════════════════════════

async function phase0System(prisma, dry, stats) {
  console.log("\n  👤  Phase 0: System user + Settings + Pricing");
  if (dry) { console.log("       (dry run — skipped)"); return "dry-run-migrator"; }

  const users = [
    { username: "admin",          email: "admin@ricsteel.com",      pw: "Admin@123",         role: "admin"    },
    { username: "excel_migrator", email: "migrator@ricsteel.local", pw: "MigratorInternal!", role: "operator" },
    { username: "operator1",      email: "op1@ricsteel.com",        pw: "Operator@1",        role: "operator" },
    { username: "viewer",         email: "viewer@ricsteel.com",     pw: "Viewer@123",        role: "viewer"   },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where:  { username: u.username },
      update: {},
      create: {
        id:            uuid(),
        username:      u.username,
        email:         u.email,
        password_hash: hashPw(u.pw),
        role:          u.role,
        is_active:     u.username !== "excel_migrator",
      },
    });
  }

  const migrator = await prisma.user.findUnique({ where: { username: "excel_migrator" } });

  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        id:               uuid(),
        company_name:     "RIC Steel Industries",
        company_address:  "Rajasthan, India",
        company_mobile:   "",
        company_email:    "",
        gst_percentage:   18,
        invoice_prefix:   "INV",
        invoice_due_days: 30,
      },
    });
  }

  const pricingDefaults = [
    { coil_grade: "CR", activity_type: "storage",    rate: new Prisma.Decimal("3.00"),   rate_unit: "per_kg"   },
    { coil_grade: "GP", activity_type: "storage",    rate: new Prisma.Decimal("3.00"),   rate_unit: "per_kg"   },
    { coil_grade: "GC", activity_type: "storage",    rate: new Prisma.Decimal("3.00"),   rate_unit: "per_kg"   },
    { coil_grade: "HR", activity_type: "storage",    rate: new Prisma.Decimal("3.00"),   rate_unit: "per_kg"   },
    { coil_grade: "CR", activity_type: "processing", rate: new Prisma.Decimal("5.00"),   rate_unit: "per_kg"   },
    { coil_grade: "CR", activity_type: "handling",   rate: new Prisma.Decimal("170.00"), rate_unit: "per_coil" },
  ];
  for (const p of pricingDefaults) {
    const eff = new Date("2021-01-01");
    const exists = await prisma.pricingConfig.findFirst({
      where: { coil_grade: p.coil_grade, activity_type: p.activity_type, jw_line: null, effective_from: eff },
    });
    if (!exists) {
      await prisma.pricingConfig.create({
        data: {
          id:             uuid(),
          coil_grade:     p.coil_grade,
          activity_type:  p.activity_type,
          rate:           p.rate,
          rate_unit:      p.rate_unit,
          jw_line:        null,
          effective_from: eff,
          created_by:     migrator?.id ?? null,
        },
      });
    }
  }

  console.log(`       ✅  Users + Settings + ${pricingDefaults.length} pricing defaults`);
  return migrator?.id ?? "";
}


async function phase1Parties(prisma, partyMaster, rows, dry, stats) {
  console.log("\n  🏢  Phase 1: Parties");

  const dataNames = new Set();
  for (const r of rows) if (r.party) dataNames.add(r.party.trim());

  const seenUpper = new Set();
  const allParties = [];
  for (const p of partyMaster) {
    const key = p.name.toUpperCase();
    if (!seenUpper.has(key)) { allParties.push(p); seenUpper.add(key); }
  }
  for (const name of [...dataNames].sort()) {
    const key = name.toUpperCase();
    if (!seenUpper.has(key)) {
      stats.warn(`Party only in Data Entry (not in Party Master): '${name}'`);
      allParties.push({ name, gst: null, address: null, mobile: null, contact: null });
      seenUpper.add(key);
    }
  }

  const partyMap = new Map(); // UPPER_NAME → id

  if (dry) {
    let fakeIdx = 1;
    for (const p of allParties) {
      partyMap.set(p.name.toUpperCase(), `dry-party-${fakeIdx++}`);
      stats.parties++;
    }
    console.log(`       ✅  (dry) would insert ${stats.parties} parties`);
    return partyMap;
  }

  for (const p of allParties) {
    const name = p.name.trim();
    try {
      const existing = await prisma.party.findFirst({ where: { name } });
      if (existing) {
        partyMap.set(name.toUpperCase(), existing.id);
        stats.partiesSkip++;
        continue;
      }
      const created = await prisma.party.create({
        data: {
          id:             uuid(),
          name,
          gst_number:     p.gst ?? null,
          address:        p.address ?? null,
          mobile_number:  p.mobile ?? null,
          contact_person: p.contact ?? null,
          billing_cycle:  "monthly",
          is_active:      true,
        },
      });
      partyMap.set(name.toUpperCase(), created.id);
      stats.parties++;
    } catch (e) {
      const ex = await prisma.party.findFirst({ where: { name } });
      if (ex) { partyMap.set(name.toUpperCase(), ex.id); stats.partiesSkip++; }
      else stats.warn(`Party insert failed: '${name}' — ${e.message}`);
    }
  }

  console.log(`       ✅  inserted=${stats.parties}  already_existed=${stats.partiesSkip}`);
  return partyMap;
}


async function phase2Coils(prisma, rows, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  🔩  Phase 2: Coils (Coil-In rows)");
  const coilInRows = rows.filter(r => r.activity === "Coil-In");
  console.log(`       Found ${coilInRows.length} Coil-In rows`);

  const coilMap = new Map(); // coil_number → id

  for (const r of coilInRows) {
    const num = r.number;
    if (!num) { stats.coilsSkip++; continue; }

    const partyId = partyMap.get((r.party ?? "").toUpperCase());
    if (!partyId) {
      stats.warn(`Coil-In row ${r.rowNum}: unknown party '${r.party}' for coil ${num}`);
      stats.coilsSkip++; continue;
    }

    const weight = r.netWeight ?? r.kataWt;
    if (!weight || weight <= 0) {
      stats.warn(`Coil-In row ${r.rowNum}: no weight for coil ${num}`);
      stats.coilsSkip++; continue;
    }

    const stockDate = r.dateIn ?? r.date;
    const sz        = parseSize(r.size);
    const grade     = mapGrade(r.coilType);
    const form      = mapProduct(r.product);
    const coilId    = uuid();

    if (!dry) {
      try {
        const existing = await prisma.coil.findUnique({ where: { coil_number: num } });
        if (existing) { coilMap.set(num, existing.id); stats.coilsSkip++; continue; }

        await prisma.coil.create({
          data: {
            id:                coilId,
            coil_number:       num,
            current_party_id:  partyId,
            original_party_id: partyId,
            product_form:      form,
            coil_grade:        grade,
            size:              r.size ?? "Unknown",
            thickness_mm:      sz.thickness != null ? new Prisma.Decimal(sz.thickness) : null,
            width_mm:          sz.width     != null ? new Prisma.Decimal(sz.width)     : null,
            length_mm:         sz.length    != null ? new Prisma.Decimal(sz.length)    : null,
            net_weight_kg:     new Prisma.Decimal(weight),
            kata_weight_kg:    r.kataWt != null ? new Prisma.Decimal(r.kataWt) : null,
            truck_do_number:   r.truck,
            kanta_name:        r.kanta,
            kata_number:       r.kataNum,
            processing_stage:  "received",
            rate_per_kg:       r.rate != null ? new Prisma.Decimal(r.rate) : null,
            stock_in_date:     stockDate,
            remark:            r.remark,
            created_by:        migratorId,
          },
        });
        coilMap.set(num, coilId);

        const amount = r.rate != null ? weight * r.rate : null;
        await prisma.transaction.create({
          data: {
            id:              uuid(),
            txn_date:        r.date,
            activity:        "Coil_In",
            party_id:        partyId,
            coil_id:         coilId,
            coil_grade:      grade,
            net_weight_kg:   new Prisma.Decimal(weight),
            rate_applied:    r.rate != null ? new Prisma.Decimal(r.rate) : null,
            amount_charged:  amount != null ? new Prisma.Decimal(amount) : null,
            truck_do_number: r.truck,
            remark:          r.remark,
            created_by:      migratorId,
          },
        });
        stats.transactions++;
        stats.coils++;
        if (verbose) console.log(`         ✅  Coil ${num.padEnd(20)} ${(r.party ?? "").substring(0,30).padEnd(30)} ${weight} kg`);

      } catch (e) {
        if (e.code === "P2002") {
          const ex = await prisma.coil.findUnique({ where: { coil_number: num } });
          if (ex) { coilMap.set(num, ex.id); stats.coilsSkip++; }
        } else {
          stats.warn(`Coil ${num}: ${e.message}`);
          stats.coilsSkip++;
        }
      }
    } else {
      coilMap.set(num, coilId);
      stats.coils++;
    }
  }

  console.log(`       ✅  inserted=${stats.coils}  skipped=${stats.coilsSkip}`);
  return coilMap;
}


async function phase3Packets(prisma, rows, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  📦  Phase 3: Packets (Pkt-In rows)");
  const pktInRows = rows.filter(r => r.activity === "Pkt-In");
  console.log(`       Found ${pktInRows.length} Pkt-In rows`);

  const pktMap = new Map();

  for (const r of pktInRows) {
    const num = r.number;
    if (!num) { stats.packetsSkip++; continue; }

    const partyId = partyMap.get((r.party ?? "").toUpperCase());
    if (!partyId) {
      stats.warn(`Pkt-In row ${r.rowNum}: unknown party '${r.party}'`);
      stats.packetsSkip++; continue;
    }

    const weight = r.netWeight ?? r.kataWt;
    if (!weight || weight <= 0) {
      stats.warn(`Pkt-In row ${r.rowNum}: no weight for packet ${num}`);
      stats.packetsSkip++; continue;
    }

    const stockDate = r.dateIn ?? r.date;
    const sz        = parseSize(r.size);
    const grade     = mapGrade(r.coilType);
    const pktId     = uuid();

    if (!dry) {
      try {
        const existing = await prisma.packet.findUnique({ where: { packet_number: num } });
        if (existing) { pktMap.set(num, existing.id); stats.packetsSkip++; continue; }

        await prisma.packet.create({
          data: {
            id:                pktId,
            packet_number:     num,
            party_id:          partyId,
            original_party_id: partyId,
            size:              r.size ?? "Unknown",
            thickness_mm:      sz.thickness != null ? new Prisma.Decimal(sz.thickness) : null,
            width_mm:          sz.width     != null ? new Prisma.Decimal(sz.width)     : null,
            length_mm:         sz.length    != null ? new Prisma.Decimal(sz.length)    : null,
            coil_grade:        grade,
            net_weight_kg:     new Prisma.Decimal(weight),
            kata_weight_kg:    r.kataWt != null ? new Prisma.Decimal(r.kataWt) : null,
            truck_do_number:   r.truck,
            kanta_name:        r.kanta,
            kata_number:       r.kataNum,
            rate_per_kg:       r.rate != null ? new Prisma.Decimal(r.rate) : null,
            stock_in_date:     stockDate,
            is_dispatched:     false,
            remark:            r.remark,
            created_by:        migratorId,
          },
        });
        pktMap.set(num, pktId);

        const amount = r.rate != null ? weight * r.rate : null;
        await prisma.transaction.create({
          data: {
            id:              uuid(),
            txn_date:        r.date,
            activity:        "Pkt_In",
            party_id:        partyId,
            packet_id:       pktId,
            coil_grade:      grade,
            net_weight_kg:   new Prisma.Decimal(weight),
            rate_applied:    r.rate != null ? new Prisma.Decimal(r.rate) : null,
            amount_charged:  amount != null ? new Prisma.Decimal(amount) : null,
            truck_do_number: r.truck,
            remark:          r.remark,
            created_by:      migratorId,
          },
        });
        stats.transactions++;
        stats.packets++;
        if (verbose) console.log(`         ✅  Packet ${num.padEnd(20)} ${(r.party ?? "").substring(0,30).padEnd(30)} ${weight} kg`);

      } catch (e) {
        if (e.code === "P2002") {
          const ex = await prisma.packet.findUnique({ where: { packet_number: num } });
          if (ex) { pktMap.set(num, ex.id); stats.packetsSkip++; }
        } else {
          stats.warn(`Packet ${num}: ${e.message}`);
          stats.packetsSkip++;
        }
      }
    } else {
      pktMap.set(num, pktId);
      stats.packets++;
    }
  }

  console.log(`       ✅  inserted=${stats.packets}  skipped=${stats.packetsSkip}`);
  return pktMap;
}


async function phase4Processing(prisma, rows, coilMap, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  ⚙️   Phase 4: Processing (JW-C / JW-R / JW-S rows)");
  const jwRows = rows.filter(r => ["JW-C","JW-R","JW-S"].includes(r.activity));
  console.log(`       Found ${jwRows.length} JW rows`);

  const coilJwCount = new Map();

  for (const r of jwRows.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const num = r.number;
    if (!num) { stats.jwOrphan++; continue; }

    const coilId  = coilMap.get(num);
    if (!coilId) {
      stats.warn(`JW row ${r.rowNum}: coil '${num}' has no Coil-In record — orphan`);
      stats.jwOrphan++; continue;
    }

    const partyId = partyMap.get((r.party ?? "").toUpperCase());
    const count   = (coilJwCount.get(num) ?? 0) + 1;
    coilJwCount.set(num, count);
    const stage   = count === 1 ? "stage1" : count === 2 ? "stage2" : "stage3";
    const actEnum = mapActivity(r.activity);
    const { plates, scrapKg, totalQty } = r.output != null
      ? decodeJwcOutput(r.output)
      : { plates: 0, scrapKg: 0, totalQty: 0 };

    const txnWeight = totalQty > 0 ? -totalQty : -1;

    if (!dry) {
      await prisma.coil.update({ where: { id: coilId }, data: { processing_stage: stage } });

      if (partyId && txnWeight !== 0) {
        await prisma.transaction.create({
          data: {
            id:            uuid(),
            txn_date:      r.date,
            activity:      actEnum,
            party_id:      partyId,
            coil_id:       coilId,
            coil_grade:    mapGrade(r.coilType),
            net_weight_kg: new Prisma.Decimal(txnWeight),
            output_qty:    new Prisma.Decimal(totalQty),
            rate_applied:  r.rate != null ? new Prisma.Decimal(r.rate) : null,
            jw_line:       null,
            remark:        r.remark,
            created_by:    migratorId,
          },
        });
        stats.transactions++;
      }
    }

    stats.jwOutputs++;
    if (verbose)
      console.log(`         ✅  ${r.activity} coil=${num.padEnd(15)} plates=${plates} scrap=${scrapKg}kg → stage=${stage}`);
  }

  console.log(`       ✅  inserted=${stats.jwOutputs}  orphans=${stats.jwOrphan}`);
}


async function phase5Transfers(prisma, rows, coilMap, pktMap, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  🔄  Phase 5: Transfers");

  const cOut = rows.filter(r => r.activity === "Coil-Transfer-Out");
  const cIn  = rows.filter(r => r.activity === "Coil-Transfer-In");
  const pOut = rows.filter(r => r.activity === "Pkt-Transfer-Out");
  const pIn  = rows.filter(r => r.activity === "Pkt-Transfer-In");

  console.log(`       Coil transfers:   ${cOut.length} out / ${cIn.length} in`);
  console.log(`       Packet transfers: ${pOut.length} out / ${pIn.length} in`);

  async function processTransfers(outRows, inRows, itemMap, ttype, isPacket, seqPrefix) {
    const outLup = new Map();
    const inLup  = new Map();
    for (const r of outRows) if (r.number) outLup.set(`${r.number}|${r.date.toISOString().slice(0,10)}`, r);
    for (const r of inRows)  if (r.number) inLup.set(`${r.number}|${r.date.toISOString().slice(0,10)}`, r);

    const groups = new Map();
    for (const [key, outR] of outLup) {
      const inR = inLup.get(key);
      if (!inR) {
        const [num, d] = key.split("|");
        stats.warn(`Transfer-Out has no matching Transfer-In: num=${num} date=${d}`);
        stats.transferOrphan++;
        continue;
      }
      const gKey = `${outR.date.toISOString().slice(0,10)}|${(outR.party??"").toUpperCase()}|${(inR.party??"").toUpperCase()}`;
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey).push({
        num:    key.split("|")[0],
        date:   outR.date,
        weight: outR.netWeight ?? outR.kataWt,
        size:   outR.size,
        truck:  outR.truck,
      });
    }

    let seq = 1;
    for (const [gKey, items] of groups) {
      const [dateStr, fromUpper, toUpper] = gKey.split("|");
      const fromId = partyMap.get(fromUpper);
      const toId   = partyMap.get(toUpper);

      if (!fromId || !toId) {
        stats.warn(`Transfer: unknown party from='${fromUpper}' to='${toUpper}'`);
        stats.transferOrphan += items.length; continue;
      }
      if (fromId === toId) {
        stats.warn(`Transfer: same party both sides '${fromUpper}'`);
        stats.transferOrphan += items.length; continue;
      }

      const tdate   = items[0].date;
      const tnum    = `MIG-${seqPrefix}-${String(seq).padStart(5, "0")}`;
      const orderId = uuid();

      if (!dry) {
        await prisma.transferOrder.create({
          data: {
            id:              orderId,
            transfer_number: tnum,
            from_party_id:   fromId,
            to_party_id:     toId,
            transfer_type:   ttype,
            status:          "completed",
            transfer_date:   tdate,
            is_reversible:   false,
            remark:          "Migrated from Excel",
            created_by:      migratorId,
          },
        });

        for (const item of items) {
          const itemId = itemMap.get(item.num);
          if (!itemId) {
            stats.warn(`Transfer item '${item.num}' not in ${isPacket ? "packet" : "coil"} map`);
            stats.transferOrphan++; continue;
          }

          let weight = item.weight;
          let size   = item.size;
          let stage  = null;
          let grade  = null;

          if (!isPacket) {
            const coilObj = await prisma.coil.findUnique({ where: { id: itemId } });
            if (coilObj) {
              weight = weight ?? Number(coilObj.net_weight_kg);
              size   = size   ?? coilObj.size;
              stage  = coilObj.processing_stage;
              grade  = coilObj.coil_grade;
            }
          } else {
            const pktObj = await prisma.packet.findUnique({ where: { id: itemId } });
            if (pktObj) {
              weight = weight ?? Number(pktObj.net_weight_kg);
              size   = size   ?? pktObj.size;
              grade  = pktObj.coil_grade;
            }
          }

          await prisma.transferLineItem.create({
            data: {
              id:                        uuid(),
              transfer_order_id:         orderId,
              coil_id:                   !isPacket ? itemId : null,
              packet_id:                 isPacket  ? itemId : null,
              coil_number_snapshot:      item.num,
              weight_kg_snapshot:        weight != null ? new Prisma.Decimal(weight) : null,
              size_snapshot:             size,
              snapshot_processing_stage: stage ?? null,
              prev_party_id:             fromId,
              new_party_id:              toId,
            },
          });
          stats.tli++;

          if (!isPacket) {
            await prisma.coil.update({ where: { id: itemId }, data: { current_party_id: toId } });
          } else {
            await prisma.packet.update({ where: { id: itemId }, data: { party_id: toId } });
          }

          if (weight) {
            const actOut = isPacket ? "Pkt_Transfer_Out" : "Coil_Transfer_Out";
            const actIn  = isPacket ? "Pkt_Transfer_In"  : "Coil_Transfer_In";

            await prisma.transaction.create({
              data: {
                id:                uuid(),
                txn_date:          tdate,
                activity:          actOut,
                party_id:          fromId,
                coil_id:           !isPacket ? itemId : null,
                packet_id:         isPacket  ? itemId : null,
                transfer_order_id: orderId,
                coil_grade:        grade ?? null,
                net_weight_kg:     new Prisma.Decimal(-weight),
                created_by:        migratorId,
              },
            });
            await prisma.transaction.create({
              data: {
                id:                uuid(),
                txn_date:          tdate,
                activity:          actIn,
                party_id:          toId,
                coil_id:           !isPacket ? itemId : null,
                packet_id:         isPacket  ? itemId : null,
                transfer_order_id: orderId,
                coil_grade:        grade ?? null,
                net_weight_kg:     new Prisma.Decimal(weight),
                created_by:        migratorId,
              },
            });
            stats.transactions += 2;
          }
        }
      }

      stats.transfers++;
      seq++;
      if (verbose)
        console.log(`         ✅  ${tnum}  ${fromUpper.substring(0,22).padEnd(22)} → ${toUpper.substring(0,22).padEnd(22)}  (${items.length} items)`);
    }
  }

  await processTransfers(cOut, cIn, coilMap, "coil_transfer",   false, "C");
  await processTransfers(pOut, pIn, pktMap,  "packet_transfer", true,  "P");

  console.log(`       ✅  orders=${stats.transfers}  line_items=${stats.tli}  orphans=${stats.transferOrphan}`);
}


async function phase6Dispatches(prisma, rows, coilMap, pktMap, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  🚛  Phase 6: Dispatches");
  const dispRows = rows.filter(r => r.activity === "Dispatch");
  console.log(`       Found ${dispRows.length} Dispatch rows`);

  for (const r of dispRows) {
    const num     = r.number;
    const partyId = partyMap.get((r.party ?? "").toUpperCase());
    const coilId  = num ? coilMap.get(num) : undefined;
    const pktId   = num ? pktMap.get(num)  : undefined;

    if (!num || (!coilId && !pktId)) {
      stats.warn(`Dispatch row ${r.rowNum}: '${num}' not in coil/packet map`);
      stats.dispatchOrphan++; continue;
    }
    if (!partyId) {
      stats.warn(`Dispatch row ${r.rowNum}: unknown party '${r.party}'`);
      stats.dispatchOrphan++; continue;
    }
    if (r.output == null) {
      stats.warn(`Dispatch row ${r.rowNum}: no output value for '${num}'`);
      stats.dispatchOrphan++; continue;
    }

    const weight = Math.abs(r.output);
    const grade  = mapGrade(r.coilType);

    if (!dry) {
      await prisma.transaction.create({
        data: {
          id:              uuid(),
          txn_date:        r.date,
          activity:        "Dispatch",
          party_id:        partyId,
          coil_id:         coilId ?? null,
          packet_id:       pktId  ?? null,
          coil_grade:      grade,
          net_weight_kg:   new Prisma.Decimal(-weight),
          rate_applied:    r.rate != null ? new Prisma.Decimal(r.rate)           : null,
          amount_charged:  r.rate != null ? new Prisma.Decimal(weight * r.rate)  : null,
          chalan_number:   r.chalan,
          truck_do_number: r.truck,
          remark:          r.remark,
          created_by:      migratorId,
        },
      });
      stats.transactions++;

      if (pktId) {
        await prisma.packet.update({ where: { id: pktId }, data: { is_dispatched: true } });
      }
    }

    stats.dispatches++;
    if (verbose)
      console.log(`         ✅  Dispatch num=${String(num).padEnd(18)} ${weight} kg  chalan=${r.chalan}`);
  }

  console.log(`       ✅  inserted=${stats.dispatches}  orphans=${stats.dispatchOrphan}`);
}


async function phase7Handling(prisma, rows, coilMap, pktMap, partyMap, migratorId, dry, stats, verbose) {
  console.log("\n  🔧  Phase 7: Handling charges");
  const handRows = rows.filter(r => r.activity === "Handling");
  console.log(`       Found ${handRows.length} Handling rows`);

  for (const r of handRows) {
    const num     = r.number;
    const partyId = partyMap.get((r.party ?? "").toUpperCase());
    const coilId  = num ? coilMap.get(num) : undefined;
    const pktId   = num ? pktMap.get(num)  : undefined;

    if (!num || (!coilId && !pktId)) { stats.handlingOrphan++; continue; }
    if (!partyId) { stats.handlingOrphan++; continue; }

    if (!dry) {
      await prisma.transaction.create({
        data: {
          id:              uuid(),
          txn_date:        r.date,
          activity:        "Handling",
          party_id:        partyId,
          coil_id:         coilId ?? null,
          packet_id:       pktId  ?? null,
          coil_grade:      mapGrade(r.coilType),
          net_weight_kg:   null,
          rate_applied:    r.rate != null ? new Prisma.Decimal(r.rate) : null,
          amount_charged:  r.rate != null ? new Prisma.Decimal(r.rate) : null,
          chalan_number:   r.chalan,
          truck_do_number: r.truck,
          remark:          r.remark,
          created_by:      migratorId,
        },
      });
      stats.transactions++;
    }

    stats.handling++;
    if (verbose)
      console.log(`         ✅  Handling num=${String(num).padEnd(18)} fee=₹${r.rate}`);
  }

  console.log(`       ✅  inserted=${stats.handling}  orphans=${stats.handlingOrphan}`);
}


async function phase8ActivityLog(prisma, migratorId, stats, dry) {
  if (dry) return;
  await prisma.activityLog.create({
    data: {
      id:          uuid(),
      user_id:     migratorId || null,
      action_type: "BULK_MIGRATION",
      entity_type: "Excel",
      entity_id:   null,
      description: `Excel migration completed: ${stats.coils} coils, ${stats.packets} packets, `
                 + `${stats.transfers} transfer orders, ${stats.transactions} transactions`,
    },
  });
  console.log("\n  📋  Phase 8: Activity log entry created");
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — VERIFY
// ════════════════════════════════════════════════════════════════════════════

async function verify(prisma) {
  console.log("\n  🔎  Verification");
  const checks = await Promise.all([
    prisma.party.count(),
    prisma.coil.count(),
    prisma.packet.count(),
    prisma.transferOrder.count(),
    prisma.transferLineItem.count(),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { activity: "Dispatch" } }),
    prisma.transaction.count({ where: { activity: "Handling" } }),
    prisma.packet.count({ where: { is_dispatched: true } }),
  ]);
  const labels = [
    "parties","coils","packets","transfer_orders",
    "transfer_line_items","transactions (total)",
    "  → dispatch txns","  → handling txns",
    "packets dispatched",
  ];
  console.log();
  labels.forEach((l, i) => console.log(`       ${l.padEnd(30)} ${checks[i]}`));
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6 — MAIN
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  const { file, dryRun, verbose } = parseArgs();

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   RIC Steel — Excel → Neon/PostgreSQL Migration         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  File:     ${file}`);
  console.log(`  Dry-run:  ${dryRun}`);
  console.log(`  Verbose:  ${verbose}`);
  if (!process.env.DATABASE_URL)
    console.warn("\n  ⚠  DATABASE_URL not set — check your .env file");

  const prisma = new PrismaClient({ log: dryRun ? [] : ["warn","error"] });
  const stats  = new MigStats();

  try {
    if (!dryRun) {
      await prisma.$queryRaw`SELECT 1`;
      console.log("\n  ✅  Database connected.\n");
    } else {
      console.log("\n  ℹ️  Dry-run mode — no DB writes.\n");
    }

    const { rows, partyMaster } = loadExcel(file);

    const migratorId = await phase0System(prisma, dryRun, stats);
    const partyMap   = await phase1Parties(prisma, partyMaster, rows, dryRun, stats);
    const coilMap    = await phase2Coils(prisma, rows, partyMap, migratorId, dryRun, stats, verbose);
    const pktMap     = await phase3Packets(prisma, rows, partyMap, migratorId, dryRun, stats, verbose);
    await phase4Processing(prisma, rows, coilMap, partyMap, migratorId, dryRun, stats, verbose);
    await phase5Transfers(prisma, rows, coilMap, pktMap, partyMap, migratorId, dryRun, stats, verbose);
    await phase6Dispatches(prisma, rows, coilMap, pktMap, partyMap, migratorId, dryRun, stats, verbose);
    await phase7Handling(prisma, rows, coilMap, pktMap, partyMap, migratorId, dryRun, stats, verbose);
    await phase8ActivityLog(prisma, migratorId, stats, dryRun);

    if (!dryRun) await verify(prisma);

  } catch (e) {
    console.error(`\n  ❌  Migration failed: ${e.message}`);
    if (verbose) console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  stats.report();

  if (stats.warnings.length) {
    const wf = "migrate_warnings.txt";
    fs.writeFileSync(wf, stats.warnings.join("\n"));
    console.log(`\n  ⚠️  Full warning log → ${wf}`);
  }

  console.log("\n  ✅  Migration complete!\n");
  if (!dryRun) {
    console.log("  Spot checks:");
    console.log("    npx prisma studio");
  }
}

main();
