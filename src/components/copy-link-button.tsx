import { component$, useSignal } from '@builder.io/qwik';

export default component$(() => {
  const copied = useSignal(false);
  return (
    <button
      type="button"
      class="rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick$={async () => {
        // navigator.clipboard + location are browser-only — onClick$ runs only
        // in the browser, never during prerender.
        try {
          await navigator.clipboard.writeText(location.href);
          copied.value = true;
          setTimeout(() => {
            copied.value = false;
          }, 2000);
        } catch {
          // Clipboard rejected (e.g. non-secure context) — the link is still in
          // the address bar, so the user can copy manually.
          copied.value = false;
        }
      }}
    >
      {copied.value ? 'Copied!' : 'Copy link'}
    </button>
  );
});
