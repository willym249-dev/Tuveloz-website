ACK_REPRO_BUILD_NONCE: IH-REPRO-20260824-51D4A7
CLAUDE_SESSION: Revenue opportunity brainstorm
REBUILD_HASH_MATCH: YES
CORE_VERIFIER: PASS
FULL_VERIFIER: FAIL
EVIDENCE_ACCEPTED: NO
STRONGEST_REMAINING_DISSENT: The full kit's PDF check still decides on the extractor rather than on the content, because stock pypdf 6.16.2 here returns letter-spaced headings such as "B I L L R E V I E W", which the new ordered-token and contiguous-run rules score as 4.1%, 3.0% and 6.5% drift and six failures on the same bytes Codex passed, while a flattened alphanumeric comparison of those three files scores 1.48%, 0.00% and 0.00%.
NEXT_BUILD: Score PDF drift on a flattened alphanumeric stream and demote the ordered-token and contiguous-run rules to warnings, then print the extractor name and version beside any PASS so a verdict is scoped to the environment that produced it.
