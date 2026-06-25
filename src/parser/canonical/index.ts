import { buildTree } from './tokenize';
import { transcribeNode, ratContainers } from './transcribe';

/** Transcribe NSG UE-capability text to canonical UE-cap JSON keyed by rat-Type. */
export function nsgTextToCanonical(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { rat, container } of ratContainers(buildTree(text))) {
    // Last-write-wins on a duplicate rat key; fine for Phase 1's single-message input.
    // Phase 2 split-merge will need to merge here instead.
    out[rat] = transcribeNode(container, rat);
  }
  return out;
}
