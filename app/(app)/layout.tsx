import { AppNav } from '../components/AppNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <AppNav />
      <div className="shell-main">{children}</div>
    </div>
  );
}
