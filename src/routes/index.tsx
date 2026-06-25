import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import type { Capabilities } from "~/parser/types/uecapabilityparser";
import { parseInput } from "~/lib/parse-input";
import { loadFromFragmentWithError, writeFragment } from "~/lib/fragment-state";
import MultiCapabilityView from "~/components/viewer/multicapability-view";
import WarningsBanner from "~/components/warnings-banner";

export default component$(() => {
  const text = useSignal("");
  const results = useSignal<Capabilities[]>([]);
  const error = useSignal<string | undefined>(undefined);
  const warnings = useSignal<string[]>([]);

  // On client load: read the URL fragment and prefill the textarea + parse.
  // useVisibleTask$ runs ONLY in the browser — never during static prerender,
  // so it is safe to access `location.hash` here.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const { text: loaded, decodeError } = await loadFromFragmentWithError(location.hash);

    if (decodeError) {
      // Bad fragment — surface a distinct message; textarea stays empty and editable.
      error.value = decodeError;
      return;
    }

    if (loaded) {
      // Only prefill if the user hasn't typed anything yet — a slow hydration
      // must not clobber input the user already entered.
      if (!text.value) {
        text.value = loaded;
      }
      const parsed = parseInput(loaded);
      results.value = parsed.caps;
      // For a successfully decoded fragment we show parse errors if any,
      // but the textarea is already prefilled so the user can edit and retry.
      error.value = parsed.error;
      warnings.value = parsed.warnings ?? [];
    }
  });

  return (
    <main class="mx-auto max-w-7xl px-4 py-8">
      <h1 class="mb-6 text-2xl font-bold">NSG UE-Capability Viewer</h1>

      <section aria-label="Paste and parse NSG capability text">
        <label for="nsg-input" class="mb-2 block font-medium">
          Paste NSG UE-capability text
        </label>
        <textarea
          id="nsg-input"
          class="mb-4 h-48 w-full rounded border border-gray-300 p-2 font-mono text-sm"
          placeholder="Paste NSG UE-capability log here…"
          value={text.value}
          onInput$={(e) => {
            text.value = (e.target as HTMLTextAreaElement).value;
          }}
        />

        {error.value && (
          <div
            role="alert"
            class="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error.value}
          </div>
        )}

        <WarningsBanner warnings={warnings.value} />

        <button
          type="button"
          class="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick$={async () => {
            const parsed = parseInput(text.value);
            results.value = parsed.caps;
            error.value = parsed.error;
            warnings.value = parsed.warnings ?? [];
            // Update the URL fragment so this page state is shareable.
            // writeFragment uses history.replaceState — client-only; safe here
            // because onClick$ always runs in the browser.
            if (text.value.trim()) {
              await writeFragment(text.value);
            }
          }}
        >
          Parse
        </button>
      </section>

      {results.value.length > 0 && (
        <section aria-label="Parsed capability results" class="mt-8">
          <MultiCapabilityView capabilitiesList={results.value} />
        </section>
      )}
    </main>
  );
});

export const head: DocumentHead = {
  title: "NSG UE-Capability Viewer",
  meta: [
    {
      name: "description",
      content:
        "Paste NSG UE-capability text and view decoded LTE/NR bands and combos — 100% in-browser, no server.",
    },
  ],
};
