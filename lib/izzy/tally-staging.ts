/**
 * IZ-3: Untrusted Tally row normalization.
 * Pure module: no credentials, database writes, or XP changes.
 * Every output is a proposal for human review, never an active quest.
 */
export type IzzyCategory =
  | "daily" | "weekly" | "monthly" | "project"
  | "long_term" | "relationship" | "bonus" | "reward";

export type IzzyProposal = {
  sourceSubmissionId: string;
  category: IzzyCategory;
  text: string;
  status: "review_required";
  visibility: "secret" | "visible" | "unspecified";
};

const FIELD_CATEGORIES: ReadonlyArray<[string, IzzyCategory]> = [
  ["DAILY HABITS:", "daily"],
  ["WEEKLY CHORES:", "weekly"],
  ["MONTHLY RESPONSIBILITIES:", "monthly"],
  ["BIG PROJECTS:", "project"],
  ["LONG-TERM GOALS:", "long_term"],
  ["RELATIONSHIP QUESTS:", "relationship"],
  ["BONUS QUESTS:", "bonus"],
  ["REWARDS:", "reward"],
];

function visibilityOf(value: string): IzzyProposal["visibility"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("secret") && !normalized.includes("visible")) return "secret";
  if (normalized.includes("visible") && !normalized.includes("secret")) return "visible";
  return "unspecified";
}

function findColumn(headers: string[], prefix: string): number {
  return headers.findIndex((header) => header.includes(prefix));
}

/**
 * A single field can contain many ideas. We intentionally retain the entire
 * answer instead of splitting on commas/newlines and changing its meaning.
 * A later reviewer/AI parser may propose splits with provenance.
 */
export function stageIzzySubmission(headers: string[], cells: string[]): IzzyProposal[] {
  const idIndex = headers.indexOf("Submission ID");
  if (idIndex < 0) throw new Error("Missing Submission ID column");
  const submissionId = (cells[idIndex] ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(submissionId)) {
    throw new Error("Invalid submission ID");
  }

  const visibilityIndex = headers.findIndex((header) => header === "Should your rewards be secret or visible?");
  const visibility = visibilityOf(visibilityIndex >= 0 ? (cells[visibilityIndex] ?? "") : "");
  const proposals: IzzyProposal[] = [];
  for (const [prefix, category] of FIELD_CATEGORIES) {
    const index = findColumn(headers, prefix);
    if (index < 0) continue;
    const text = (cells[index] ?? "").trim();
    if (!text) continue;
    if (text.length > 20_000) throw new Error("Submission field exceeds limit");
    proposals.push({
      sourceSubmissionId: submissionId,
      category,
      text,
      status: "review_required",
      visibility: category === "reward" ? visibility : "unspecified",
    });
  }
  return proposals;
}
