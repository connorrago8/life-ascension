# Collapsible Completed on the main Quest Board

Component: `components/CollapsibleCompleted.tsx`

Usage in `app/(app)/quests/page.tsx` (where completed instances are rendered):

```tsx
import { CollapsibleCompleted } from '../../../components/CollapsibleCompleted';

// Inside the board render, after open quests:
<CollapsibleCompleted count={completedInstances.length}>
  {completedInstances.map(inst => (
    <div key={inst.id} className="quest">
      {/* existing completed quest row */}
    </div>
  ))}
</CollapsibleCompleted>
```

- Starts collapsed.
- Remembers open/closed in localStorage (`la.quests.completedOpen`).
- Matches the companion QuestBoard pattern.

CSS for the toggle is already covered by the dark overrides.
