import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/StatusBadge';
import { mockBillingSettings } from '@/lib/billing-data';
import { useToast } from '@/hooks/use-toast';
import { Save, Upload, Receipt } from 'lucide-react';

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Billing settings state
  const [gstPercent, setGstPercent] = useState(String(mockBillingSettings.gstPercent));
  const [paymentTerms, setPaymentTerms] = useState(mockBillingSettings.defaultPaymentTerms);
  const [overdueDays, setOverdueDays] = useState(String(mockBillingSettings.autoOverdueDays));
  const [invoicePrefix, setInvoicePrefix] = useState(mockBillingSettings.invoicePrefix);
  const [companyName, setCompanyName] = useState(mockBillingSettings.companyName);
  const [companyAddress, setCompanyAddress] = useState(mockBillingSettings.companyAddress);
  const [bankDetails, setBankDetails] = useState(mockBillingSettings.bankDetails);
  const [footerNotes, setFooterNotes] = useState(mockBillingSettings.footerNotes);

  function handleSaveBilling() {
    toast({ title: 'Billing settings saved', description: 'Configuration updated successfully.' });
  }

  return (
    <AppLayout>
      <PageHeader title="Settings" description="Application configuration" />

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="account" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="billing" className="data-[state=active]:bg-info data-[state=active]:text-white">
            <Receipt className="h-3.5 w-3.5 mr-1.5" /> Billing
          </TabsTrigger>}
          {isAdmin && <TabsTrigger value="system" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">System</TabsTrigger>}
        </TabsList>

        <TabsContent value="account">
          <div className="rounded-lg border border-border bg-card p-6 max-w-md">
            <h3 className="text-sm font-semibold text-foreground mb-4">Change Password</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Current Password</Label>
                <Input type="password" className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">New Password</Label>
                <Input type="password" className="bg-secondary border-border text-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Confirm New Password</Label>
                <Input type="password" className="bg-secondary border-border text-foreground" />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Update Password</Button>
            </div>
          </div>
        </TabsContent>

        {/* ─── BILLING SETTINGS ─── */}
        {isAdmin && (
          <TabsContent value="billing" className="space-y-5 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Invoice Config */}
              <div className="rounded-lg border border-border bg-card p-5 glass-card space-y-4">
                <h3 className="text-sm font-semibold text-info flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Invoice Configuration
                </h3>
                <Separator className="bg-white/10" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Invoice Prefix</Label>
                    <Input
                      value={invoicePrefix}
                      onChange={e => setInvoicePrefix(e.target.value)}
                      className="bg-secondary border-border text-foreground font-mono-id"
                      placeholder="INV"
                    />
                    <p className="text-[11px] text-muted-foreground">Used in serial number: <span className="text-info font-mono-id">{invoicePrefix}-2026-0001</span></p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">GST Percentage (%)</Label>
                    <Input
                      type="number"
                      value={gstPercent}
                      onChange={e => setGstPercent(e.target.value)}
                      className="bg-secondary border-border text-foreground"
                      min="0" max="100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Default Payment Terms</Label>
                    <Input
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="bg-secondary border-border text-foreground"
                      placeholder="Net 15"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Auto Overdue After (days)</Label>
                    <Input
                      type="number"
                      value={overdueDays}
                      onChange={e => setOverdueDays(e.target.value)}
                      className="bg-secondary border-border text-foreground"
                      min="1"
                    />
                    <p className="text-[11px] text-muted-foreground">Invoice auto-flagged overdue after this many days past due date.</p>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="rounded-lg border border-border bg-card p-5 glass-card space-y-4">
                <h3 className="text-sm font-semibold text-info">Company Information</h3>
                <Separator className="bg-white/10" />

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Company Address</Label>
                  <Textarea
                    value={companyAddress}
                    onChange={e => setCompanyAddress(e.target.value)}
                    rows={2}
                    className="bg-secondary border-border text-foreground resize-none"
                  />
                </div>

                {/* Logo Upload */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Company Logo</Label>
                  <div className="border border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-info/40 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Click to upload logo (PNG/SVG)</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Used on invoice PDFs</p>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="rounded-lg border border-border bg-card p-5 glass-card space-y-4">
                <h3 className="text-sm font-semibold text-info">Bank Details</h3>
                <Separator className="bg-white/10" />
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Bank Details (shown on invoice)</Label>
                  <Textarea
                    value={bankDetails}
                    onChange={e => setBankDetails(e.target.value)}
                    rows={3}
                    className="bg-secondary border-border text-foreground font-mono-id text-xs resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">Format: Bank | A/C | IFSC | Branch</p>
                </div>
              </div>

              {/* Footer Notes */}
              <div className="rounded-lg border border-border bg-card p-5 glass-card space-y-4">
                <h3 className="text-sm font-semibold text-info">Invoice Footer</h3>
                <Separator className="bg-white/10" />
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Footer Notes / T&C</Label>
                  <Textarea
                    value={footerNotes}
                    onChange={e => setFooterNotes(e.target.value)}
                    rows={3}
                    className="bg-secondary border-border text-foreground text-xs resize-none"
                    placeholder="Enter terms and conditions or footer text…"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveBilling} className="bg-info hover:bg-info/90 text-white">
              <Save className="h-4 w-4 mr-2" /> Save Billing Settings
            </Button>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="system">
            <div className="rounded-lg border border-border bg-card p-6 max-w-md space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">API URL</p>
                <p className="text-sm font-mono-id text-foreground mt-1">http://localhost:8000/api/v1</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Database Health</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse-amber" />
                  <span className="text-sm text-success">Connected</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">App Version</p>
                <p className="text-sm text-foreground mt-1">v1.0.0</p>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
