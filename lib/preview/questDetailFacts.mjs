/** Read-only quest details derived exclusively from persisted quest and instance rows.
 * Never infer XP, rewards, or backend capabilities from a progress value.
 */
export function questDetailFacts(quest, instance) {
  const facts = [];
  const domains = {
    hygiene: 'Hygiene & appearance', home: 'Home & environment',
    mental_health: 'Mental health & recovery', personal_growth: 'Growth & hobbies',
    finance: 'Financial health', career: 'Career & productivity',
    relationships: 'Relationships', physical_health: 'Physical health',
  };
  facts.push({ label: 'Category', value: domains[quest.domain] ?? 'Other' });
  facts.push({ label: 'Schedule', value: quest.quest_type === 'goal' ? 'Goal' : quest.cadence === 'daily' ? 'Daily' : 'One-time' });
  if (instance?.due_date) facts.push({ label: quest.quest_type === 'goal' ? 'Goal date' : 'Due date', value: instance.due_date });
  if (instance?.status) facts.push({ label: 'Status', value: {
    available: 'Available', completed: 'Completed', deferred: 'Deferred',
  }[instance.status] ?? 'Unknown' });
  const target = quest.target_amount;
  const increment = quest.progress_increment;
  const unit = typeof quest.progress_unit === 'string' ? quest.progress_unit.trim() : '';
  const untracked = target == null && increment == null && quest.progress_unit == null;
  const validTracked = Number.isSafeInteger(target) && target > 0 && target <= 1000000
    && unit.length > 0 && unit.length <= 32
    && Number.isSafeInteger(increment) && increment > 0 && increment <= target;
  if (validTracked) {
    facts.push({ label: 'Objective', value: `${target} ${unit}` });
    facts.push({ label: 'Quick-add step', value: `${increment} ${unit}` });
    // A full counter with an available status, or a completed status below target,
    // is not a verified coherent server snapshot. Do not suggest a confirmed outcome.
    if (Number.isSafeInteger(instance?.current_amount) && instance.current_amount >= 0 && instance.current_amount <= target
      && (instance.status !== 'available' || instance.current_amount < target)
      && (instance.status !== 'completed' || instance.current_amount === target))
      facts.push({ label: 'Recorded progress', value: `${instance.current_amount} of ${target} ${unit}` });
    else facts.push({ label: 'Recorded progress', value: 'Unavailable — refresh to verify' });
  } else if (untracked) {
    facts.push({ label: 'Objective', value: quest.quest_type === 'goal' ? 'Complete this goal'
      : quest.cadence === 'daily' ? "Complete today's quest" : 'Complete this quest once' });
  } else {
    // An inconsistent account row must not be described as one-tap completion.
    facts.push({ label: 'Objective', value: 'Tracking configuration unavailable — refresh to verify' });
  }
  return facts;
}
