export default function PlayPage() {
  return (
    <main className="screen play-screen">
      <p className="page-brand">LIFE ASCENSION</p>
      <h1>Play</h1>
      <p className="lede">Adventures open here. They stay shut until your real-life quests have earned the way in.</p>
      <article className="lock-card" aria-disabled="true">
        <div className="lock-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="6" y="10.5" width="12" height="8.5" rx="1.5" />
            <path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3" />
          </svg>
        </div>
        <p className="lock-kicker">Locked</p>
        <h2>Forgotten Crypt</h2>
        <p className="soon-pill">Coming soon</p>
        <p className="muted">This delve is not open. Nothing on this screen grants XP.</p>
      </article>
      <p className="play-note">Real-life quests earn XP. Play is the adventure those quests will open. Finish a quest on your board to move your level. Play itself does not.</p>
    </main>
  );
}
