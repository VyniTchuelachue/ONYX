import { MinimalShell } from '@/components/shell/minimal-shell';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <MinimalShell>{children}</MinimalShell>;
}
