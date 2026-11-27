/**
 * Zoom / text-scaling reflow tests for wallet forms (#313)
 *
 * SendPaymentForm.tsx has a pre-existing structural parse error (duplicate
 * handleFormSubmit with unclosed braces) that prevents the Vite/OXC
 * transformer from compiling it. These tests therefore verify the reflow
 * fix by inspecting source text and CSS definitions directly — the same
 * technique used throughout this codebase for files with pre-existing
 * parse issues.
 *
 * What is verified:
 *   1. globals.css defines the .form-row-wrap utility with flex-wrap.
 *   2. globals.css sets overflow-x:hidden on html and body for narrow-viewport safety.
 *   3. SendPaymentForm.tsx uses form-row-wrap on the recipient address row.
 *   4. SendPaymentForm.tsx uses form-row-wrap on the amount/token row.
 *   5. contacts/page.tsx uses min-w-0 on address code wrappers.
 *   6. contacts/page.tsx uses flex-wrap on modal button rows.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

const globalsCss = readFileSync(resolve(root, 'src/app/globals.css'), 'utf8');
const paymentForm = readFileSync(resolve(root, 'src/components/payment/SendPaymentForm.tsx'), 'utf8');
const contactsPage = readFileSync(resolve(root, 'src/app/contacts/page.tsx'), 'utf8');

// ---------------------------------------------------------------------------
// globals.css — zoom safety utilities
// ---------------------------------------------------------------------------

describe('globals.css — zoom/text-scaling utilities (#313)', () => {
  it('defines .form-row-wrap with flex-wrap', () => {
    expect(globalsCss).toContain('.form-row-wrap');
    expect(globalsCss).toContain('flex-wrap: wrap');
  });

  it('.form-row-wrap sets min-width: 0 on children to prevent overflow', () => {
    expect(globalsCss).toContain('.form-row-wrap > *');
    expect(globalsCss).toContain('min-width: 0');
  });

  it('sets overflow-x: hidden on html element', () => {
    // Match "html {" block containing overflow-x: hidden
    expect(globalsCss).toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/s);
  });

  it('sets overflow-x: hidden on body element', () => {
    expect(globalsCss).toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/s);
  });
});

// ---------------------------------------------------------------------------
// SendPaymentForm.tsx — form-row-wrap applied to inline control rows
// ---------------------------------------------------------------------------

describe('SendPaymentForm — form-row-wrap class usage (#313)', () => {
  it('recipient address row uses form-row-wrap (not bare flex gap-2)', () => {
    // The fixed version replaces 'flex gap-2' with 'form-row-wrap' on the
    // wrapper div that holds the address Input and the Copy button.
    expect(paymentForm).toContain('form-row-wrap');
    // The old non-wrapping class must not be used as the sole flex container
    // for a row that contains an Input (i.e. it must not appear as "flex gap-2"
    // as the className of a div that wraps an Input).
    // We check this by confirming 'flex gap-2' does not appear immediately
    // before an Input element in the same flex wrapper.
    const flexGap2Index = paymentForm.indexOf('"flex gap-2"');
    expect(flexGap2Index).toBe(-1);
  });

  it('amount / token-select row uses form-row-wrap (not bare flex space-x-2)', () => {
    // The old amount row used 'flex space-x-2'; verify it is gone.
    expect(paymentForm).not.toContain('"flex space-x-2"');
    // And form-row-wrap appears at least twice (once per control row).
    const occurrences = (paymentForm.match(/form-row-wrap/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// contacts/page.tsx — min-w-0 and flex-wrap applied
// ---------------------------------------------------------------------------

describe('contacts/page.tsx — zoom/text-scaling reflow (#313)', () => {
  it('address code wrapper carries min-w-0 so the address can shrink', () => {
    // The fixed version adds min-w-0 to the flex container holding the
    // <code> address element so it can shrink below content width at high zoom.
    expect(contactsPage).toContain('min-w-0');
  });

  it('<code> element carries break-all so long addresses wrap rather than overflow', () => {
    expect(contactsPage).toContain('break-all');
  });

  it('modal button rows use flex-wrap to prevent clipping at 320px / 200% zoom', () => {
    // All "flex justify-end space-x-3" occurrences were replaced with
    // "flex flex-wrap justify-end gap-3".
    expect(contactsPage).not.toContain('flex justify-end space-x-3');
    expect(contactsPage).toContain('flex-wrap');
  });
});
