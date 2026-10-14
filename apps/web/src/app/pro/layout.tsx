import { ProShell } from '@/components/shell/pro-shell';

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <ProShell>{children}</ProShell>;
}
