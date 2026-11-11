export const metadata = { title: 'Connect Apple Health · LIFE ASCENSION' };

/** Short in-app guide. Full version: docs/apple-health-shortcut.md. */
export default function WellnessSetupPage() {
  return (
    <main className="wrap wellness-setup">
      <div className="eyebrow">LIFE ASCENSION</div>
      <h1>Connect Apple Health</h1>
      <p className="muted">An iPhone Shortcut sends last night&apos;s sleep and yesterday&apos;s steps each morning. They show under Wellness on your Character. Readings never give XP.</p>

      <section className="panel">
        <h2>1. Make an API key</h2>
        <p>Go to <a href="/settings/api-keys">Settings → API keys</a>, name it <strong>Apple Health</strong> and copy the key. It is shown once; keep it private.</p>
      </section>

      <section className="panel">
        <h2>2. Build the Shortcut</h2>
        <ol className="wellness-steps">
          <li><strong>Format Date</strong>: today minus 1 day as <code>yyyy-MM-dd</code>.</li>
          <li><strong>Find Health Samples</strong>: Steps, yesterday, then <strong>Calculate Statistics → Sum</strong>.</li>
          <li><strong>Find Health Samples</strong>: Sleep Analysis, last night, asleep only. Sum the durations and convert to hours.</li>
          <li><strong>Get Contents of URL</strong>: POST to <code>/api/wellness</code> on this app with header <code>Authorization: Bearer &lt;your key&gt;</code> and a JSON body <code>{'{'}&quot;date&quot;, &quot;sleep_hours&quot;, &quot;steps&quot;{'}'}</code>.</li>
        </ol>
      </section>

      <section className="panel">
        <h2>3. Run it every morning</h2>
        <p>Shortcuts → Automation → Personal Automation → <strong>Time of Day, 8:00 AM, Daily</strong> → <strong>Run Immediately</strong>.</p>
      </section>

      <p className="muted">Sleep 0–24 h and steps 0–200,000. Posting the same date again updates it. Private test builds block outside requests, so the Shortcut works only on the live app.</p>
      <p className="foot"><a href="/character#wellness">Back to Character</a> · <a href="/settings/api-keys">API keys</a></p>
    </main>
  );
}
