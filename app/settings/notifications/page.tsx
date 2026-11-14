import '../../engagement.css';
import { NotificationSettings } from '../../../components/NotificationSettings';

export const metadata = { title: 'Notifications · LIFE ASCENSION' };

export default function NotificationSettingsPage() {
  return (
    <main className="wrap engage-settings">
      <p className="page-brand">LIFE ASCENSION</p>
      <h1>Notifications</h1>
      <p className="muted">Web push for this account. Nothing here is shared with your partner's progress.</p>
      <NotificationSettings />
    </main>
  );
}
