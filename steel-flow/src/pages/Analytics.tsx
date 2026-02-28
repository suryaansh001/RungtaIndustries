import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { KPICard } from '@/components/KPICard';
import { mockMonthlyRevenue, mockRevenueCategoryData, mockProductionVelocity, mockInvoices } from '@/lib/billing-data';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ComposedChart,
} from 'recharts';
import { DollarSign, TrendingUp, Users, BarChart2 } from 'lucide-react';

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(222, 25%, 13%)',
    border: '1px solid hsl(218, 25%, 22%)',
    borderRadius: '8px',
    color: 'hsl(210, 40%, 96%)',
    fontSize: '12px',
  },
};

function fmtAmount(v: number) {
  return `₹${(v / 1000).toFixed(0)}K`;
}

export default function Analytics() {
  // Revenue KPIs
  const totalRevenue = mockInvoices
    .filter(i => i.status !== 'draft')
    .reduce((s, i) => s + i.subtotal, 0);

  const storageRevenue = mockInvoices
    .filter(i => i.billingType === 'storage' && i.status !== 'draft')
    .reduce((s, i) => s + i.subtotal, 0);

  const processingRevenue = mockInvoices
    .filter(i => i.billingType === 'processing' && i.status !== 'draft')
    .reduce((s, i) => s + i.subtotal, 0);

  const productRevenue = mockInvoices
    .filter(i => i.billingType === 'product' && i.status !== 'draft')
    .reduce((s, i) => s + i.subtotal, 0);

  const activeClients = new Set(mockInvoices.filter(i => i.status !== 'draft').map(i => i.clientId)).size;
  const avgPerClient = activeClients > 0 ? Math.round(totalRevenue / activeClients) : 0;

  // Monthly trend data (cumulative total)
  const trendData = mockMonthlyRevenue.map(d => ({
    ...d,
    total: d.storage + d.processing + d.product + d.manual,
  }));

  return (
    <AppLayout>
      <PageHeader title="Revenue Analytics" description="Financial performance insights — storage, processing and product billing." />

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Total Revenue"
          value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
          icon={TrendingUp}
          className="glass-card border-info/20 billing-blue-glow"
        />
        <KPICard
          title="Storage Revenue"
          value={`₹${(storageRevenue / 1000).toFixed(0)}K`}
          icon={BarChart2}
          className="glass-card border-info/15"
        />
        <KPICard
          title="Processing Revenue"
          value={`₹${(processingRevenue / 1000).toFixed(0)}K`}
          icon={BarChart2}
          className="glass-card border-info/15"
        />
        <KPICard
          title="Direct Billing"
          value={`₹${(productRevenue / 100000).toFixed(1)}L`}
          icon={DollarSign}
          className="glass-card border-info/15"
        />
        <KPICard
          title="Avg / Client"
          value={`₹${(avgPerClient / 1000).toFixed(0)}K`}
          icon={Users}
          className="glass-card border-info/15"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">

        {/* Monthly Revenue Trend */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4 glass-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(218, 25%, 22%)" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtAmount} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(215, 20%, 65%)' }} />
              <Line type="monotone" dataKey="total" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={{ fill: 'hsl(217, 91%, 60%)', r: 3 }} name="Total Revenue" />
              <Line type="monotone" dataKey="storage" stroke="hsl(142, 71%, 45%)" strokeWidth={1.5} dot={false} name="Storage" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="processing" stroke="hsl(38, 92%, 50%)" strokeWidth={1.5} dot={false} name="Processing" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Category (Donut-ish) */}
        <div className="rounded-lg border border-border bg-card p-4 glass-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Category</h3>
          <div className="space-y-2.5">
            {mockRevenueCategoryData.map(cat => {
              const total = mockRevenueCategoryData.reduce((s, c) => s + c.value, 0);
              const pct = total > 0 ? (cat.value / total * 100).toFixed(1) : '0';
              return (
                <div key={cat.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: cat.fill }}>{cat.name}</span>
                    <span className="font-mono-id text-foreground">{pct}% — ₹{(cat.value/1000).toFixed(0)}K</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: cat.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue by Category (Stacked Bar) */}
      <div className="rounded-lg border border-border bg-card p-4 glass-card mb-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Category — Stacked Bar</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(218, 25%, 22%)" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtAmount} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']} />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(215, 20%, 65%)' }} />
            <Bar dataKey="storage"    stackId="a" fill="hsl(217, 91%, 60%)"  name="Storage"    radius={[0,0,0,0]} />
            <Bar dataKey="processing" stackId="a" fill="hsl(142, 71%, 45%)"  name="Processing" />
            <Bar dataKey="product"    stackId="a" fill="hsl(38, 92%, 50%)"   name="Product" />
            <Bar dataKey="manual"     stackId="a" fill="hsl(280, 65%, 60%)"  name="Manual"     radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Production Velocity */}
      <div className="rounded-lg border border-border bg-card p-4 glass-card">
        <h3 className="text-sm font-semibold text-foreground mb-1">Production Velocity</h3>
        <p className="text-xs text-muted-foreground mb-4">Avg days per stage vs coils/packets completed per week</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={mockProductionVelocity}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(218, 25%, 22%)" />
            <XAxis dataKey="week" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'hsl(215, 20%, 65%)' }} />
            <Bar yAxisId="left" dataKey="completed" fill="hsl(217, 91%, 55%)" name="Completed / Week" radius={[2,2,0,0]} opacity={0.7} />
            <Line yAxisId="right" type="monotone" dataKey="avgDays" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ fill: 'hsl(38, 92%, 50%)', r: 3 }} name="Avg Days / Stage" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </AppLayout>
  );
}
