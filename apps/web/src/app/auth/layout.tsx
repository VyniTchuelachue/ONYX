import { MinimalShell } from '@/components/shell/minimal-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <MinimalShell>{children}</MinimalShell>;
}
