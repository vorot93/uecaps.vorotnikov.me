import { component$ } from '@builder.io/qwik';
import type { Signal } from '@builder.io/qwik';

interface Props {
  target: Signal<HTMLElement | undefined>;
}

export default component$(({ target }: Props) => {
  return (
    <div class="mb-4 flex gap-2">
      <button
        type="button"
        class="rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        onClick$={() => {
          target.value
            ?.querySelectorAll('details')
            .forEach((d) => ((d as HTMLDetailsElement).open = true));
        }}
      >
        Expand all
      </button>
      <button
        type="button"
        class="rounded border border-gray-400 px-3 py-1.5 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        onClick$={() => {
          target.value
            ?.querySelectorAll('details')
            .forEach((d) => ((d as HTMLDetailsElement).open = false));
        }}
      >
        Collapse all
      </button>
    </div>
  );
});
