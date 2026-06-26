/**
 * Forked from HandyMenny/uecapabilityparser-web (MIT).
 * Server-side store-item fetch and the `inputs` fetch have been stripped.
 * The component is now a pure function of `capabilitiesList: Capabilities[]`
 * — no network, no server.
 */
import { component$, useComputed$, useSignal } from '@builder.io/qwik';
import type { Capabilities } from '~/parser/types/uecapabilityparser';
import CapabilityView from '~/components/viewer/capability-view';
import SelectInput from '~/components/inputs/select-input';
import { logTypeToString } from '~/helpers/metadata';
import Button from '~/components/inputs/button';
import { capabilitiesToCsv } from '~/lib/csv';
import { downloadCsv } from '~/lib/download';

interface Props {
  capabilitiesList: Capabilities[];
  groupDescription?: string;
  labels?: string[];
}

export default component$(({ capabilitiesList, groupDescription, labels }: Props) => {
  const currentIndex = useSignal(0);
  const currentCapabilities = useComputed$(
    () => capabilitiesList?.[currentIndex.value],
  );

  const capabilitiesSelector: { label: string; value: string }[] = [];

  const descriptions =
    capabilitiesList
      ?.map((value) => value.metadata.description ?? '')
      .filter((value) => value.length > 0) ?? [];
  const descriptionsAlldifferent =
    new Set(descriptions).size == capabilitiesList?.length;
  const types = capabilitiesList?.map((values) => values.logType) ?? [];
  const typesAlldifferent = new Set(types).size == types.length;

  capabilitiesList?.forEach((value, index) => {
    capabilitiesSelector.push({
      label: labels
        ? (labels[index] ?? String(index))
        : descriptionsAlldifferent
          ? (value.metadata.description ?? String(index))
          : typesAlldifferent
            ? logTypeToString(value.logType)
            : (value.id ?? String(index)),
      value: String(index),
    });
  });

  // set group Description
  capabilitiesList?.forEach(
    (cap) => (cap.metadata.groupDescription = groupDescription ?? ''),
  );

  const caps = currentCapabilities.value;

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
      <div class="mb-4 flex flex-col">
        <div class="mx-auto flex w-full max-w-7xl items-end gap-4">
          <div class={'flex-1 ' + (capabilitiesSelector.length < 2 ? 'hidden' : '')}>
            <SelectInput
              label="Select log"
              options={capabilitiesSelector}
              onInput$={async (value) => {
                const index = Number.parseInt(value);
                currentIndex.value = index;
              }}
            />
          </div>
          <Button
            type="button"
            label="Download CSV"
            onClick$={async () => {
              const c = currentCapabilities.value;
              if (c) downloadCsv('ue-capabilities.csv', capabilitiesToCsv(c));
            }}
          />
        </div>
      </div>
      {caps != null && <CapabilityView capabilities={caps} />}
    </div>
  );
});
