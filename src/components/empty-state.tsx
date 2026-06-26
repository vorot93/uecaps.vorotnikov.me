import { component$ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';

interface Props {
  onLoadExample$: PropFunction<() => void>;
}

export default component$(({ onLoadExample$ }: Props) => {
  return (
    <div class="mb-6 rounded border border-gray-200 bg-gray-50 px-4 py-4">
      <p class="mb-3 text-sm text-gray-700">
        Paste an NSG <code class="font-mono">ueCapabilityInformation</code> log to decode its LTE/NR
        bands and carrier-aggregation combos — everything runs in your browser; nothing is uploaded.
        New here? Try it with a sample:
      </p>
      <button
        type="button"
        class="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick$={onLoadExample$}
      >
        Load example
      </button>
    </div>
  );
});
