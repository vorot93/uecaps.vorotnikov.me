/**
 * Forked from HandyMenny/uecapabilityparser-web (MIT).
 * Server-side CSV generation and input-download calls have been stripped;
 * CSV export is deferred to Phase 2.
 * All rendering is pure client-side from the Capabilities object.
 */
import { component$, useSignal } from '@builder.io/qwik';
import LteBands from '~/components/table/lte-bands';
import NrBands from '~/components/table/nr-bands';
import Lteca from '~/components/table/lteca';
import Endc from '~/components/table/endc';
import Nrca from '~/components/table/nrca';
import Nrdc from '~/components/table/nrdc';
import { type Capabilities } from '~/parser/types/uecapabilityparser';
import Filters from '~/components/table/filters';
import MetadataTable from '~/components/table/metadata-table';
import Ratcapabilities from '~/components/table/ratcapabilities';
import ExpandCollapseAll from '~/components/table/expand-collapse-all';

interface Props {
  capabilities: Capabilities;
}

export default component$(({ capabilities }: Props) => {
  const sectionsRef = useSignal<HTMLElement>();
  return (
    <>
      <div class={'flex flex-1 flex-col'} ref={sectionsRef}>
        <div class="mx-auto w-full max-w-7xl">
          <ExpandCollapseAll target={sectionsRef} />
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <MetadataTable cap={capabilities ?? undefined} title="Metadata" />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Ratcapabilities
              cap={capabilities ?? undefined}
              title="Generic Capabilities"
            />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Filters
              filters={capabilities?.ueCapFilters ?? undefined}
              title="Filters"
            />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <LteBands bands={capabilities?.lteBands} title="LTE Bands" />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <NrBands bands={capabilities?.nrBands} title="NR Bands" />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Lteca
              combos={capabilities?.lteca}
              coloredBands={true}
              title="LTE CA Combos"
            />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Endc combos={capabilities?.endc} title="EN-DC Combos" />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Nrca combos={capabilities?.nrca} title="NR CA Combos" />
          </div>
        </div>
        <div class="mx-auto w-full max-w-7xl overflow-x-auto">
          <div class="w-full text-sm sm:w-fit sm:min-w-[32rem] sm:max-w-full md:min-w-[36rem]">
            <Nrdc combos={capabilities?.nrdc} title="NR DC Combos" />
          </div>
        </div>
      </div>
    </>
  );
});
