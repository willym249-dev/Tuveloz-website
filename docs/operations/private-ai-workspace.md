# Private multi-AI workspace

Tuveloz has a local coordinator for asking OpenAI, Gemini, and Claude the same project question without manually copying the conversation between websites. It gives each selected provider a short Tuveloz brief, compact Git status, recent private decisions, and only the files explicitly named for that question.

This is a development and review tool. It does not answer customers, change the website, commit code, send messages, or publish anything by itself.

## What is private

- `.ai-council-cache.json`, `.ai-council-log.jsonl`, and `.ai-council-workspace/` are ignored by Git.
- The decision log stays on this computer unless the owner deliberately copies it elsewhere.
- `--files` accepts only files whose real path remains inside this repository. A path or link that resolves outside the repository is rejected.
- API keys belong only in the local environment or `.env.local`. Never paste a key into chat, a prompt, a log, source code, an issue, or a pull request.

Privacy on this computer does not mean a provider receives nothing. When `--run` is used, the selected project context, question, and explicitly attached file contents are sent to each selected API provider. Do not attach identity documents, customer records, provider documents, credentials, exact private addresses, or confidential third-party material without a separate review and authorization.

## Cost behavior

ChatGPT, Claude, and Google memberships do not include general API use in this tool. Each provider bills its own API account under that provider's terms. A Google Cloud or Workspace payment also does not automatically fund Gemini API calls.

The command is preview-only by default:

```powershell
npm run ai -- "Review this wording for clarity"
```

The preview lists configured providers, model IDs, the maximum provider calls, the output cap per call, and the local context that would be sent. It makes no provider request. Add `--run` only after reviewing that summary:

```powershell
npm run ai -- --run --mode quick --max-calls 1 --max-tokens 400 "Review this wording for clarity"
```

The coordinator enforces one to three provider calls per question. `quick` and `frontier` use one call. `consensus` uses two inexpensive calls and may use one stronger tiebreaker only when the call cap is three. `deep` uses up to the chosen call cap. Repeated identical questions can use the local cache instead of making another request.

## Model routing

The reviewed defaults on September 25, 2026 are:

| Provider | Routine | Strong | Frontier |
| --- | --- | --- | --- |
| OpenAI | `gpt-6-luna` | `gpt-6-sol` | `gpt-6-astra` |
| Google | `gemini-3.5-flash-lite` | `gemini-3.8-flash` | `gemini-3.1-pro-preview` |
| Anthropic | `claude-haiku-4-5-20251001` | `claude-sonnet-5` | `claude-fable-5` |

Use Luna or Haiku for routine drafting and classification, Sol or Gemini Flash for normal coding and product review, and Astra or Fable only for a difficult consequential review. The current model IDs should be rechecked against the providers' official model pages before enabling a new API account or after a provider announces a retirement.

Every default can be changed without editing source. For example, `AI_COUNCIL_OPENAI_CHEAP_MODEL` overrides the routine OpenAI model. The same naming pattern supports `CAPABLE` and `FRONTIER` for `OPENAI`, `GEMINI`, and `ANTHROPIC`.

Official references:

- [OpenAI models](https://developers.openai.com/api/docs/models)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini billing](https://ai.google.dev/gemini-api/docs/billing)
- [Claude model lifecycle](https://docs.anthropic.com/en/docs/about-claude/model-deprecations)
- [Claude pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)

## Safe first use

1. Run a preview with no files attached.
2. Confirm the selected providers, models, call cap, and output cap.
3. Start with one routine provider and a short non-sensitive question.
4. Check that the local log and cache were created only as ignored files.
5. Compare actual provider usage with the expected request before enabling consensus or frontier mode.

No API account, key, paid credit, or live provider call has been created or made by this setup work.
