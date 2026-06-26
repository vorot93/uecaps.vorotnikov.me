import { component$ } from '@builder.io/qwik';
import type { PropFunction } from '@builder.io/qwik';
import Button from '~/components/inputs/button';
import WarningsBanner from '~/components/warnings-banner';

interface Props {
  index: number;
  name: string;
  text: string;
  error?: string;
  warnings?: string[];
  canRemove: boolean;
  onNameChange$: PropFunction<(value: string) => void>;
  onTextChange$: PropFunction<(value: string) => void>;
  onRemove$: PropFunction<() => void>;
}

export default component$((props: Props) => {
  const { index, name, text, error, warnings, canRemove } = props;
  return (
    <div class="mb-4 rounded border border-gray-300 p-4 dark:border-gray-700">
      <div class="mb-2 flex items-center justify-between gap-4">
        <span class="font-medium">Capture {index + 1}</span>
        {canRemove && (
          <Button type="button" label="Remove" onClick$={props.onRemove$} />
        )}
      </div>
      <input
        type="text"
        class="mb-2 w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        placeholder="Name (optional, e.g. Pixel 8)"
        value={name}
        onInput$={(e) => props.onNameChange$((e.target as HTMLInputElement).value)}
      />
      <textarea
        class="mb-2 h-48 w-full rounded border border-gray-300 p-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        placeholder="Paste NSG UE-capability log here…"
        value={text}
        onInput$={(e) => props.onTextChange$((e.target as HTMLTextAreaElement).value)}
      />
      {error && (
        <div
          role="alert"
          class="mb-2 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}
      <WarningsBanner warnings={warnings} />
    </div>
  );
});
