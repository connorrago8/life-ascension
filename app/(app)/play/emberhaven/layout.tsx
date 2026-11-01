import { TownVisitProvider } from './TownVisit';

export default function TownLayout({ children }: { children: React.ReactNode }) {
  return <TownVisitProvider>{children}</TownVisitProvider>;
}
