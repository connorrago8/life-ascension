import Link from 'next/link';
export default function PlayPage() {
 return <main className="screen play-screen">
  <p className="page-brand">LIFE ASCENSION · ADVENTURE HUB</p>
  <h1>Hub</h1>
  <p className="lede">Your home between adventures. Real-life quests strengthen your character; the Hub never awards XP on its own.</p>
  <section className="panel" aria-label="Hub destinations">
   <h2>Choose your destination</h2>
   <p className="muted">Choose a destination. Your quest progress is preserved across navigation.</p>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
    <Link className="btn" href="/quest-board-v3">Quest Board</Link>
    <Link className="btn ghost" href="/character">Character</Link>
    <Link className="btn ghost" href="/play/emberhaven">Visit Emberhaven Town →</Link>
    <Link className="btn ghost" href="/companion">Companion</Link>
    <Link className="btn ghost" href="/">Home</Link>
   </div>
  </section>
  <article className="lock-card">
   <p className="lock-kicker">Adventure preview</p>
   <h2>Forgotten Crypt</h2>
   <p className="soon-pill">Playable preview</p>
   <p className="muted">Explore the Crypt in this isolated integration preview. An unfinished run resumes on this device.</p>
   <Link className="btn" href="/play/delve">Enter Forgotten Crypt →</Link>
  </article>
 </main>;
}
