import { buildTree } from './tokenize';
import { transcribeNode, ratContainers } from './transcribe';
export { unsupportedRatTypes } from './transcribe';

/** Transcribe NSG UE-capability text to canonical UE-cap JSON keyed by rat-Type. */
export function nsgTextToCanonical(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { rat, container } of ratContainers(buildTree(text))) {
    // Split-half merge: a paste may carry the LTE half and the NR half as
    // separate ueCapabilityInformation messages. Keep the first populated
    // container per RAT so a later/empty/duplicate one never clobbers it.
    // (Overlap deep-merge of a RAT present in multiple messages is deferred —
    // no oracle; the real nsgMrdcSplit halves are complementary.)
    const existing = out[rat];
    if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) continue;
    out[rat] = transcribeNode(container, rat);
  }
  return out;
}
