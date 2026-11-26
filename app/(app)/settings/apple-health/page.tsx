import { AppleHealthToken } from '../../../../components/ascension/AppleHealthToken';

/** In-app setup. The long version is docs/apple-health-sleep.md. */
export default function AppleHealthPage() {
  return (
    <main className="wrap">
      <p className="eyebrow">SETTINGS</p>
      <h1>Apple Health</h1>
      <p className="muted">An iPhone Shortcut can record Lights Out from last night&apos;s sleep and store today&apos;s nutrition on your account. Oura and Whoop already sync into Apple Health, so they need no separate setup. Cronometer writes the nutrition samples.</p>
      <AppleHealthToken />
      <section className="panel">
        <h2>2. Build the Shortcut</h2>
        <p>Shortcuts → +. Allow Health access when asked. Add these actions in order.</p>
        <ol className="wellness-steps">
          <li><strong>Find Health Samples</strong> where Type is <strong>Sleep</strong> and Start Date is in the last <strong>18 hours</strong>. Keep every sample. Oura, Whoop, and Apple Watch may all appear.</li>
          <li>For each sample, read Start Date, End Date, Source, and Value. Skip a sample whose Value is <strong>In Bed</strong> or <strong>Awake</strong>. Format each start and end as <strong>ISO 8601</strong> so the offset is included.</li>
          <li>Put those asleep samples in a list named <code>samples</code>. Each item has <code>start</code>, <code>end</code>, <code>source_name</code>, and <code>value</code>.</li>
          <li>Set <code>sleep_start</code> and <code>sleep_end</code> from the earliest asleep sample. Set <code>source</code> to <code>apple_health</code>.</li>
          <li>Make a sleep <code>request_id</code> with <strong>Format Date</strong> custom <code>yyyyMMddHHmm</code>, then <strong>Text</strong> <code>00000000-0000-4000-8000-</code> plus that text.</li>
          <li><strong>Get Contents of URL</strong> for sleep. URL: this app + <code>/api/health/sleep</code>. Method: <strong>POST</strong>. Header <code>Authorization</code> = <code>Bearer</code> plus the token. JSON body: <code>sleep_start</code>, <code>sleep_end</code>, <code>source</code> = <code>apple_health</code>, <code>samples</code>, and <code>request_id</code>.</li>
          <li>In a second request, <strong>Find Health Samples</strong> for <strong>DietaryEnergyConsumed</strong>, <strong>DietaryProtein</strong>, <strong>DietaryCarbohydrates</strong>, and <strong>DietaryFatTotal</strong>. Sum each one for the game day that starts at <strong>5:00 AM</strong> Chicago. Fiber and Water are optional and are ignored. If a type has no samples, send null. Do not send 0 unless the log really says 0. A failed read sends <code>read_status</code> <code>failed</code> and no totals.</li>
          <li><strong>Get Contents of URL</strong> again. URL: this app + <code>/api/health/nutrition</code>. Same Bearer token. JSON: <code>schema_version</code> 1, <code>game_date</code>, <code>timezone</code> <code>America/Chicago</code>, <code>basis</code> <code>game_window</code> or <code>diary_date</code>, <code>source</code> <code>cronometer</code>, <code>observed_at</code>, a new <code>request_id</code>, <code>energy_kcal</code> (or <code>dietary_energy_kcal</code>), <code>protein_g</code>, <code>carbs_g</code>, <code>fat_g</code>, and <code>read_status</code>.</li>
        </ol>
      </section>
      <section className="panel">
        <h2>3. Run it every morning</h2>
        <p>Shortcuts → Automation → + → Personal Automation → <strong>Time of Day</strong> → <strong>7:00 AM</strong>, Daily → <strong>Run Immediately</strong>.</p>
        <p>Check it once on the free Cronometer plan, and once with the phone locked. Health reads can fail while the phone is locked, and the free plan has to be the one writing Dietary Energy and Protein into Apple Health.</p>
      </section>
      <section className="panel">
        <h2>What gets saved</h2>
        <p>Sleep stores only the start, the end, and the source. Asleep at or before <strong>11:00 PM</strong> Chicago records Lights Out through the same path as the button. A later send for that night adds 0 XP. Manual entry still works, and whichever arrives first wins. The receipt reads Auto from Apple Health, plus the source name when the earliest asleep sample has one, such as Oura.</p>
        <p>Nutrition is a separate post to <code>/api/health/nutrition</code>. It stores energy, protein, carbs, and fat only. Fiber and water are discarded. Null means the read did not verify that number. Zero means the diary really said zero. A newer observation wins, and a null never erases a number already saved. It awards 0 XP and does not complete a quest. A bad nutrition post cannot undo Lights Out. Only you can read the row.</p>
      </section>
      <p className="foot"><a href="/health">Health</a> · <a href="/more">Settings</a></p>
    </main>
  );
}
