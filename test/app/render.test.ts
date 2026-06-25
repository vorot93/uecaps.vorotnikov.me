/**
 * Render smoke test: parse a real NSG NR fixture through the full pipeline
 * (nsgTextToCanonical → interpret) and render it with MultiCapabilityView,
 * then assert the DOM contains known NR bands and NR-CA combo indicators.
 *
 * This proves the forked components render REAL parser output without any
 * network calls.
 */

import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { h } from '@builder.io/qwik';
import MultiCapabilityView from '../../src/components/viewer/multicapability-view';
import { interpret } from '../../src/parser/interpret';
import { nsgTextToCanonical } from '../../src/parser/canonical';
import { readFixtureText } from '../parser/harness';

describe('MultiCapabilityView render smoke test', () => {
  it('renders NR band 41 with band-specific CSS class from the nsgNr fixture', async () => {
    // 1. Parse the fixture
    const text = readFixtureText('nsgNr.input.txt');
    const canonical = nsgTextToCanonical(text);
    const caps = interpret(canonical);

    // Sanity: parser produced NR data
    expect(caps.nrBands?.length).toBeGreaterThan(0);
    expect(caps.nrca?.length).toBeGreaterThan(0);

    // 2. Render
    const { screen, render } = await createDOM();
    await render(
      h(MultiCapabilityView, {
        capabilitiesList: [caps],
      }),
    );

    const html = screen.outerHTML;

    // 3. Assert NR band 41 appears in its band-specific rendered form.
    //    componentsDlToStr produces spans like:
    //      <span class="font-semibold B41">41A</span>
    //    The "B41" class is the band-specific marker — this cannot be a
    //    false-positive from an unrelated number in the page.
    expect(html).toContain('B41');

    // 4. Assert NR band 71 appears in the same band-specific form.
    expect(html).toContain('B71');

    // 5. Assert the NR CA Combos section title appears
    expect(html).toContain('NR CA Combos');
  });

  it('shows "Select log" selector when capabilitiesList has two entries', async () => {
    // Parse the fixture once and reuse the result as two entries so we get
    // a multi-entry capabilitiesList — this exercises the selector display path.
    const text = readFixtureText('nsgNr.input.txt');
    const caps = interpret(nsgTextToCanonical(text));

    const { screen, render } = await createDOM();
    await render(
      h(MultiCapabilityView, {
        capabilitiesList: [caps, caps],
      }),
    );

    const html = screen.outerHTML;

    // The "Select log" label is only rendered when capabilitiesSelector.length >= 2.
    // This tests the multi-entry code path in multicapability-view.tsx.
    expect(html).toContain('Select log');

    // NR Bands section must still appear
    expect(html).toContain('NR Bands');
  });

  it('renders Filters and Generic Capabilities from real parser output (nsgNr)', async () => {
    const caps = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
    // These two sections only render when the respective field is populated
    // (nsgNr has no lteCategory fallback), so their presence proves the flow.
    expect(caps.ueCapFilters?.length).toBeGreaterThan(0);
    expect(caps.ratCapabilities?.length).toBeGreaterThan(0);

    const { screen, render } = await createDOM();
    await render(h(MultiCapabilityView, { capabilitiesList: [caps] }));
    const html = screen.outerHTML;

    expect(html).toContain('Filters');
    expect(html).toContain('Generic Capabilities');
  });

  it('renders a Download CSV button in the multi-view', async () => {
    const caps = interpret(nsgTextToCanonical(readFixtureText('nsgNr.input.txt')));
    const { screen, render } = await createDOM();
    await render(h(MultiCapabilityView, { capabilitiesList: [caps] }));
    expect(screen.outerHTML).toContain('Download CSV');
  });
});
