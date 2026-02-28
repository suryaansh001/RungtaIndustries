// Mock data for the Rungta Industrial Corporation application

export const mockDashboardSummary = {
  totalCoils: 1247,
  totalCoilWeight: 3842.5,
  totalPackets: 856,
  totalPacketWeight: 1245.8,
  activeParties: 34,
  transfersToday: 12,
  billedThisMonth: 284500,
  avgHoldingDays: 23,
};

export const mockDashboardActivity = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  stockIn: Math.floor(Math.random() * 20) + 5,
  stockOut: Math.floor(Math.random() * 15) + 3,
  transfer: Math.floor(Math.random() * 10) + 1,
  processing: Math.floor(Math.random() * 8) + 1,
}));

export const mockAgingData = [
  { name: '0–30 days', value: 520, fill: 'hsl(142, 71%, 45%)' },
  { name: '31–60 days', value: 340, fill: 'hsl(38, 92%, 50%)' },
  { name: '61–90 days', value: 210, fill: 'hsl(217, 91%, 60%)' },
  { name: '90+ days', value: 177, fill: 'hsl(0, 84%, 60%)' },
];

export const mockParties = [
  { id: '1', name: 'Tata Steel Ltd', contact: 'Rajesh Kumar', mobile: '9876543210', creditLimit: 5000000, billingCycle: 'Monthly', status: 'active', gst: '27AABCT1234A1Z5', address: 'Mumbai, MH', coilCount: 45, coilWeight: 1250.5, packetCount: 32, packetWeight: 420.3, avgHolding: 18, maxHolding: 45, billed: 85000, lastActivity: '2026-02-27' },
  { id: '2', name: 'JSW Steel', contact: 'Amit Patel', mobile: '9876543211', creditLimit: 3000000, billingCycle: 'Bi-Weekly', status: 'active', gst: '27AABCJ5678B2Z3', address: 'Pune, MH', coilCount: 32, coilWeight: 890.2, packetCount: 21, packetWeight: 310.5, avgHolding: 25, maxHolding: 62, billed: 62000, lastActivity: '2026-02-26' },
  { id: '3', name: 'SAIL Industries', contact: 'Vikram Singh', mobile: '9876543212', creditLimit: 4000000, billingCycle: 'Monthly', status: 'active', gst: '27AABCS9012C3Z1', address: 'Delhi, DL', coilCount: 28, coilWeight: 720.8, packetCount: 18, packetWeight: 245.1, avgHolding: 32, maxHolding: 78, billed: 95000, lastActivity: '2026-02-25' },
  { id: '4', name: 'Essar Steel', contact: 'Deepak Joshi', mobile: '9876543213', creditLimit: 2500000, billingCycle: 'Weekly', status: 'inactive', gst: '27AABCE3456D4Z9', address: 'Surat, GJ', coilCount: 12, coilWeight: 340.1, packetCount: 8, packetWeight: 120.7, avgHolding: 45, maxHolding: 95, billed: 42000, lastActivity: '2026-01-15' },
  { id: '5', name: 'Uttam Galva', contact: 'Sanjay Mehta', mobile: '9876543214', creditLimit: 3500000, billingCycle: 'Monthly', status: 'active', gst: '27AABCU7890E5Z7', address: 'Nagpur, MH', coilCount: 38, coilWeight: 980.4, packetCount: 25, packetWeight: 380.2, avgHolding: 21, maxHolding: 52, billed: 73000, lastActivity: '2026-02-28' },
];

export const mockCoils = [
  { id: '1', coilNumber: 'RIC-C-2026-0001', partyId: '1', partyName: 'Tata Steel Ltd', size: '1250x0.5', productType: 'HR', coilType: 'Full', stage: 'Stock', jwLine: 'L1', weight: 12500, remainingWeight: 12500, holdingDays: 5, status: 'in_stock', thickness: 0.5, width: 1250, length: 2500, kataWeight: 12480, stockInDate: '2026-02-23', truckDo: 'TK-001', kantaName: 'Kanta A', kataNumber: 'KT-001', chalanNumber: 'CH-001', rate: 2.5, remark: '' },
  { id: '2', coilNumber: 'RIC-C-2026-0002', partyId: '1', partyName: 'Tata Steel Ltd', size: '1000x0.8', productType: 'CR', coilType: 'Full', stage: 'Processing', jwLine: 'L2', weight: 8500, remainingWeight: 6200, holdingDays: 18, status: 'processing', thickness: 0.8, width: 1000, length: 2000, kataWeight: 8480, stockInDate: '2026-02-10', truckDo: 'TK-002', kantaName: 'Kanta B', kataNumber: 'KT-002', chalanNumber: 'CH-002', rate: 3.0, remark: 'Priority processing' },
  { id: '3', coilNumber: 'RIC-C-2026-0003', partyId: '2', partyName: 'JSW Steel', size: '1500x1.2', productType: 'GP', coilType: 'Slit', stage: 'Stock', jwLine: 'L1', weight: 15000, remainingWeight: 15000, holdingDays: 32, status: 'in_stock', thickness: 1.2, width: 1500, length: 3000, kataWeight: 14980, stockInDate: '2026-01-27', truckDo: 'TK-003', kantaName: 'Kanta A', kataNumber: 'KT-003', chalanNumber: 'CH-003', rate: 2.8, remark: '' },
  { id: '4', coilNumber: 'RIC-C-2026-0004', partyId: '3', partyName: 'SAIL Industries', size: '800x0.4', productType: 'HR', coilType: 'Full', stage: 'Completed', jwLine: 'L3', weight: 6200, remainingWeight: 0, holdingDays: 65, status: 'dispatched', thickness: 0.4, width: 800, length: 1800, kataWeight: 6180, stockInDate: '2025-12-25', truckDo: 'TK-004', kantaName: 'Kanta C', kataNumber: 'KT-004', chalanNumber: 'CH-004', rate: 2.2, remark: 'Dispatched' },
  { id: '5', coilNumber: 'RIC-C-2026-0005', partyId: '5', partyName: 'Uttam Galva', size: '1100x0.6', productType: 'CR', coilType: 'Full', stage: 'Stock', jwLine: 'L2', weight: 9800, remainingWeight: 9800, holdingDays: 92, status: 'in_stock', thickness: 0.6, width: 1100, length: 2200, kataWeight: 9780, stockInDate: '2025-11-28', truckDo: 'TK-005', kantaName: 'Kanta B', kataNumber: 'KT-005', chalanNumber: 'CH-005', rate: 3.2, remark: 'Long hold' },
];

export const mockPackets = [
  { id: '1', packetNumber: 'RIC-P-2026-0001', partyId: '1', partyName: 'Tata Steel Ltd', size: '1250x0.5x100', coilType: 'Slit', weight: 450, kataWeight: 448, rate: 2.5, storageCharge: 1125, holdingDays: 12, status: 'in_stock', thickness: 0.5, width: 1250, length: 100, date: '2026-02-16', truckDo: 'TK-010', kantaName: 'Kanta A', kataNumber: 'KT-010', remark: '' },
  { id: '2', packetNumber: 'RIC-P-2026-0002', partyId: '2', partyName: 'JSW Steel', size: '1000x0.8x150', coilType: 'Sheet', weight: 620, kataWeight: 618, rate: 3.0, storageCharge: 2790, holdingDays: 15, status: 'in_stock', thickness: 0.8, width: 1000, length: 150, date: '2026-02-13', truckDo: 'TK-011', kantaName: 'Kanta B', kataNumber: 'KT-011', remark: '' },
  { id: '3', packetNumber: 'RIC-P-2026-0003', partyId: '3', partyName: 'SAIL Industries', size: '1500x1.2x200', coilType: 'Slit', weight: 1200, kataWeight: 1198, rate: 2.8, storageCharge: 5040, holdingDays: 25, status: 'dispatched', thickness: 1.2, width: 1500, length: 200, date: '2026-02-03', truckDo: 'TK-012', kantaName: 'Kanta A', kataNumber: 'KT-012', remark: 'Delivered' },
];

export const mockTransfers = [
  { id: '1', transferNumber: 'TRF-2026-001', date: '2026-02-28', fromParty: 'Tata Steel Ltd', toParty: 'JSW Steel', coilCount: 3, totalWeight: 28500, status: 'completed', reversible: true, remark: 'Regular transfer' },
  { id: '2', transferNumber: 'TRF-2026-002', date: '2026-02-27', fromParty: 'JSW Steel', toParty: 'SAIL Industries', coilCount: 2, totalWeight: 15200, status: 'pending', reversible: false, remark: '' },
  { id: '3', transferNumber: 'TRF-2026-003', date: '2026-02-25', fromParty: 'Uttam Galva', toParty: 'Tata Steel Ltd', coilCount: 5, totalWeight: 42000, status: 'completed', reversible: true, remark: 'Bulk transfer' },
];

export const mockTransactions = [
  { id: '1', date: '2026-02-28', activity: 'Stock In', partyName: 'Tata Steel Ltd', coilNumber: 'RIC-C-2026-0001', packetNumber: '', productType: 'HR', weight: 12500, rate: 2.5, amount: 31250, remark: 'New arrival' },
  { id: '2', date: '2026-02-27', activity: 'Processing', partyName: 'Tata Steel Ltd', coilNumber: 'RIC-C-2026-0002', packetNumber: '', productType: 'CR', weight: -2300, rate: 3.0, amount: 6900, remark: 'Slitting' },
  { id: '3', date: '2026-02-26', activity: 'Transfer', partyName: 'JSW Steel', coilNumber: 'RIC-C-2026-0003', packetNumber: '', productType: 'GP', weight: 15000, rate: 2.8, amount: 42000, remark: 'Incoming transfer' },
  { id: '4', date: '2026-02-25', activity: 'Stock Out', partyName: 'SAIL Industries', coilNumber: 'RIC-C-2026-0004', packetNumber: '', productType: 'HR', weight: -6200, rate: 2.2, amount: 13640, remark: 'Dispatch' },
  { id: '5', date: '2026-02-24', activity: 'Storage', partyName: 'Uttam Galva', coilNumber: '', packetNumber: 'RIC-P-2026-0001', productType: 'CR', weight: 0, rate: 3.2, amount: 1560, remark: 'Monthly billing' },
];

export const mockPricing = [
  { id: '1', productType: 'HR', activity: 'Storage', jwLine: 'L1', rate: 2.5, unit: 'per kg/day', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', status: 'active' },
  { id: '2', productType: 'CR', activity: 'Storage', jwLine: 'L2', rate: 3.0, unit: 'per kg/day', effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', status: 'active' },
  { id: '3', productType: 'GP', activity: 'Processing', jwLine: 'L1', rate: 2.8, unit: 'per kg', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', status: 'active' },
  { id: '4', productType: 'HR', activity: 'Storage', jwLine: 'L1', rate: 2.0, unit: 'per kg/day', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', status: 'expired' },
];

export const mockUsers = [
  { id: '1', username: 'admin', email: 'admin@ricsteel.com', role: 'admin', status: 'active', lastLogin: '2026-02-28 09:30', created: '2025-01-01' },
  { id: '2', username: 'operator1', email: 'op1@ricsteel.com', role: 'operator', status: 'active', lastLogin: '2026-02-28 08:15', created: '2025-03-15' },
  { id: '3', username: 'viewer1', email: 'view1@ricsteel.com', role: 'viewer', status: 'active', lastLogin: '2026-02-27 14:00', created: '2025-06-20' },
  { id: '4', username: 'operator2', email: 'op2@ricsteel.com', role: 'operator', status: 'inactive', lastLogin: '2026-01-10 11:45', created: '2025-04-10' },
];
