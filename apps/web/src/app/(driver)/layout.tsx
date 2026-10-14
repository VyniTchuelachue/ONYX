import { DriverShell } from '@/components/shell/driver-shell';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
