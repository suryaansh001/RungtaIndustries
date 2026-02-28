import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Inventory statuses
  active: 'bg-success/15 text-success border-success/30',
  in_stock: 'bg-success/15 text-success border-success/30',
  completed: 'bg-success/15 text-success border-success/30',
  processing: 'bg-warning/15 text-warning border-warning/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  inactive: 'bg-muted text-muted-foreground border-border',
  dispatched: 'bg-info/15 text-info border-info/30',
  expired: 'bg-destructive/15 text-destructive border-destructive/30',
  reversed: 'bg-destructive/15 text-destructive border-destructive/30',
  // Billing / Invoice statuses
  draft: 'bg-muted/60 text-muted-foreground border-border',
  generated: 'bg-info/15 text-info border-info/30',
  sent: 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30',
  partially_paid: 'bg-warning/15 text-warning border-warning/30',
  paid: 'bg-success/15 text-success border-success/30',
  overdue: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-muted text-muted-foreground border-border';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium capitalize', style, className)}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function HoldingDaysBadge({ days }: { days: number }) {
  const color = days <= 30
    ? 'text-success'
    : days <= 60
      ? 'text-warning'
      : days <= 90
        ? 'text-info'
        : 'text-destructive';
  return <span className={cn('font-mono text-sm font-medium', color)}>{days}d</span>;
}

export function CoilNumberBadge({ number }: { number: string }) {
  return (
    <span className="font-mono-id text-sm font-semibold text-primary">
      {number}
    </span>
  );
}

export function ActivityBadge({ activity }: { activity: string }) {
  const styles: Record<string, string> = {
    'Stock In': 'bg-success/15 text-success border-success/30',
    'Stock Out': 'bg-destructive/15 text-destructive border-destructive/30',
    'Transfer': 'bg-info/15 text-info border-info/30',
    'Processing': 'bg-warning/15 text-warning border-warning/30',
    'Storage': 'bg-muted text-muted-foreground border-border',
  };
  return (
    <Badge variant="outline" className={cn('text-xs', styles[activity] || 'bg-muted text-muted-foreground')}>
      {activity}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    generated: 'Generated',
    sent: 'Sent',
    partially_paid: 'Partially Paid',
    paid: 'Paid',
    overdue: 'Overdue',
  };
  return (
    <StatusBadge status={status} className="capitalize">
      {labels[status] ?? status}
    </StatusBadge>
  );
}

export function BillingTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    storage: 'bg-info/10 text-info border-info/20',
    processing: 'bg-warning/10 text-warning border-warning/20',
    product: 'bg-success/10 text-success border-success/20',
    manual: 'bg-muted/60 text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    storage: 'Storage',
    processing: 'Processing',
    product: 'Product',
    manual: 'Manual',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', styles[type] ?? 'bg-muted text-muted-foreground')}>
      {labels[type] ?? type}
    </Badge>
  );
}
