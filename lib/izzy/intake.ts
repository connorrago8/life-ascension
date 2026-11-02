import { stageIzzySubmission, type IzzyProposal } from "./tally-staging";

export type IntakeResult =
  | { status: "staged"; submissionId: string; proposalCount: number }
  | { status: "already_received"; submissionId: string };

export interface IzzyIntakeStore {
  /**
   * Must atomically insert inbox + proposals in one transaction.
   * If submissionId already exists, return false without changing anything.
   * A partial write must roll back and be safely retryable.
   */
  insertOnce(args: {
    submissionId: string;
    headers: string[];
    cells: string[];
    proposals: IzzyProposal[];
  }): Promise<boolean>;
}

/**
 * Backend orchestration boundary. Not a public route.
 * The caller must authenticate its data source before invoking this function.
 * No client-supplied XP, quest IDs, or approval states are accepted.
 */
export async function stageTallyRow(
  headers: string[],
  cells: string[],
  store: IzzyIntakeStore,
): Promise<IntakeResult> {
  const proposals = stageIzzySubmission(headers, cells);
  const idIndex = headers.indexOf("Submission ID");
  const submissionId = cells[idIndex].trim();

  // Known test row; never create real quest proposals from this submission.
  if (submissionId === "KprXZ4A") {
    return { status: "already_received", submissionId };
  }

  const inserted = await store.insertOnce({
    submissionId,
    headers: [...headers],
    cells: [...cells],
    proposals,
  });

  return inserted
    ? { status: "staged", submissionId, proposalCount: proposals.length }
    : { status: "already_received", submissionId };
}
