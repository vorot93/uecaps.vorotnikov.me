import { $, component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { collectCaptures, type Capture, type MultiParse } from "~/lib/multi-capture";
import { loadCapturesFromFragment, writeFragmentCaptures } from "~/lib/fragment-state";
import MultiCapabilityView from "~/components/viewer/multicapability-view";
import CaptureCard from "~/components/capture-card";
import EmptyState from "~/components/empty-state";
import CopyLinkButton from "~/components/copy-link-button";
import ThemeToggle from "~/components/theme-toggle";

export default component$(() => {
  const store = useStore<{ captures: Capture[] }>({
    captures: [{ name: "", text: "" }],
  });
  const result = useSignal<MultiParse | undefined>(undefined);
  const globalError = useSignal<string | undefined>(undefined);

  // On client load: read the URL fragment, prefill the cards, and parse.
  // useVisibleTask$ runs ONLY in the browser — never during static prerender —
  // so it is safe to access `location.hash` here.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const { captures, decodeError } = await loadCapturesFromFragment(location.hash);
    if (decodeError) {
      globalError.value = decodeError;
      return;
    }
    if (captures) {
      // Only adopt shared captures if the user hasn't typed yet — the pristine
      // initial state is exactly one card with empty name and text. This is the
      // multi-card analog of the old `!text.value` guard.
      const pristine =
        store.captures.length === 1 &&
        store.captures[0]!.name === "" &&
        store.captures[0]!.text === "";
      if (pristine && captures.length > 0) {
        // Only auto-parse when we actually adopt a shared link — so a fragment
        // load during a slow-hydration race never prematurely parses (or shows
        // a parse error for) input the user is mid-typing.
        store.captures = captures;
        result.value = collectCaptures(store.captures);
      }
    }
  });

  const runParse = $(async () => {
    const r = collectCaptures(store.captures);
    result.value = r;
    globalError.value = r.allBlank
      ? "Paste NSG UE-capability text to begin."
      : undefined;
    // writeFragmentCaptures uses history.replaceState — client-only; safe here
    // because this QRL only runs from an onClick$ in the browser.
    if (!r.allBlank) {
      await writeFragmentCaptures(store.captures);
    }
  });

  const onLoadExample = $(async () => {
    const { EXAMPLE_NSG, EXAMPLE_LABEL } = await import("~/lib/example-capture");
    store.captures = [{ name: EXAMPLE_LABEL, text: EXAMPLE_NSG }];
    await runParse();
  });

  return (
    <main class="mx-auto max-w-7xl px-4 py-8">
      <div class="mb-6 flex items-center justify-between gap-4">
        <h1 class="text-2xl font-bold">NSG UE-Capability Viewer</h1>
        <ThemeToggle />
      </div>
      {result.value === undefined && <EmptyState onLoadExample$={onLoadExample} />}

      <section aria-label="Paste and parse NSG capability text">
        {store.captures.map((capture, index) => (
          <CaptureCard
            key={index}
            index={index}
            name={capture.name}
            text={capture.text}
            error={result.value?.cards[index]?.error}
            warnings={result.value?.cards[index]?.warnings}
            canRemove={store.captures.length > 1}
            onNameChange$={(value) => {
              store.captures[index]!.name = value;
            }}
            onTextChange$={(value) => {
              store.captures[index]!.text = value;
            }}
            onRemove$={() => {
              store.captures = store.captures.filter((_, i) => i !== index);
            }}
          />
        ))}

        {globalError.value && (
          <div
            role="alert"
            class="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {globalError.value}
          </div>
        )}

        <div class="flex gap-3">
          <button
            type="button"
            class="rounded border border-gray-400 px-4 py-2 font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            onClick$={() => {
              store.captures = [...store.captures, { name: "", text: "" }];
            }}
          >
            + Add capture
          </button>
          <button
            type="button"
            class="rounded border border-gray-400 px-4 py-2 font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            onClick$={onLoadExample}
          >
            Load example
          </button>
          <button
            type="button"
            class="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick$={runParse}
          >
            Parse
          </button>
        </div>
      </section>

      {result.value && result.value.devices.length > 0 && (
        <section aria-label="Parsed capability results" class="mt-8">
          <div class="mb-4 flex">
            <CopyLinkButton />
          </div>
          <MultiCapabilityView
            capabilitiesList={result.value.devices}
            labels={result.value.labels}
          />
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
