import test from "node:test";
import assert from "node:assert/strict";
import {
  isUuid,
  searchTerm,
  DISCLOSURE_FOOTER,
  hasDisclosureFooter,
  hasPostalAddress,
  dollarsToCents,
  passesListFilter,
} from "../src/lib/crm-guards.ts";

/* ── UUID validation ────────────────────────────────────────────────────────
 * PostgREST filters are built by string concatenation, so an id that is not a
 * UUID is an injection surface rather than merely a bad lookup.
 */
test("isUuid accepts a real uuid in either case", () => {
  assert.equal(isUuid("033947ad-a0e7-44d3-bea1-1f070c54f5e6"), true);
  assert.equal(isUuid("033947AD-A0E7-44D3-BEA1-1F070C54F5E6"), true);
  assert.equal(isUuid("  033947ad-a0e7-44d3-bea1-1f070c54f5e6  "), true);
});

test("isUuid rejects anything that could carry PostgREST syntax", () => {
  for (const value of [
    "1",
    "not-a-uuid",
    "033947ad-a0e7-44d3-bea1-1f070c54f5e", // one char short
    "033947ad-a0e7-44d3-bea1-1f070c54f5e6x", // one char long
    "033947ad-a0e7-44d3-bea1-1f070c54f5e6&or=(id.neq.0)",
    "*",
    "",
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(isUuid(value), false, `should reject ${JSON.stringify(value)}`);
  }
});

/* ── search sanitiser ─────────────────────────────────────────────────────── */
test("searchTerm keeps what is needed to find a person or company", () => {
  assert.equal(searchTerm("Butterfly Support"), "Butterfly Support");
  assert.equal(searchTerm("Ohio-based"), "Ohio-based");
  assert.equal(searchTerm("salem@giventakedevs.com"), "salem@giventakedevs com");
});

test("searchTerm strips every PostgREST metacharacter", () => {
  for (const ch of [",", "(", ")", "&", "=", "*", ".", "'", '"', "\\", ";", "|", "!", "<", ">"]) {
    assert.equal(searchTerm(`a${ch}b`).includes(ch), false, `${ch} must not survive sanitising`);
  }
});

test("searchTerm neutralises a crafted or-injection", () => {
  // The shape an attacker would try: close the or(), start a new filter.
  assert.equal(searchTerm("x)&or=(id.eq.1"), "x or id eq 1");
});

test("searchTerm collapses whitespace so ilike still matches", () => {
  // Stripping adjacent metacharacters leaves runs of spaces; an ilike pattern
  // containing a double space matches nothing.
  assert.equal(searchTerm("a),b"), "a b");
  assert.match(searchTerm("x!!!y"), /^x y$/);
});

test("searchTerm caps length", () => {
  assert.equal(searchTerm("a".repeat(200)).length, 60);
});

test("searchTerm handles non-strings without throwing", () => {
  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(searchTerm(value), "");
  }
});

/* ── the disclosure footer ──────────────────────────────────────────────────
 * Charter §5, and Salem confirmed on 2026-08-21 that it stays. These assertions
 * are the mechanism by which "it stays" survives a future refactor.
 */
test("hasDisclosureFooter accepts the exact footer", () => {
  assert.equal(hasDisclosureFooter(`Hello.\n\n${DISCLOSURE_FOOTER}`), true);
});

test("hasDisclosureFooter rejects anything less than exact", () => {
  const cases = {
    "hyphen for em dash": DISCLOSURE_FOOTER.replace("—", "-"),
    "changed capitalisation": DISCLOSURE_FOOTER.replace("GivenTake", "Giventake"),
    "second line only": "This message was sent automatically by GivenTake Devs.",
    reworded:
      "This message was sent automatically by GivenTake Devs. Reply and someone will read it.",
    absent: "Kind regards,\nSalem",
  };
  for (const [why, body] of Object.entries(cases)) {
    assert.equal(hasDisclosureFooter(body), false, `must reject: ${why}`);
  }
});

/* ── CAN-SPAM postal address ────────────────────────────────────────────────
 * The gate that no code can clear while the entity is unformed.
 */
test("hasPostalAddress accepts a real address", () => {
  assert.equal(hasPostalAddress("GivenTake Devs LLC, 1234 Detroit Ave, Cleveland, OH 44113"), true);
  assert.equal(hasPostalAddress("1234 Detroit Ave, Cleveland, OH 44113-1234"), true);
});

test("hasPostalAddress rejects things that are not addresses", () => {
  for (const body of ["Cleveland, Ohio", "Call us on 216 555 0100", "Reply to this email", ""]) {
    assert.equal(hasPostalAddress(body), false, `must reject: ${body || "(empty)"}`);
  }
});

/* ── money ──────────────────────────────────────────────────────────────────
 * The column is amount_cents. Float arithmetic is how a total drifts.
 */
test("dollarsToCents is exact for anything a form can produce", () => {
  assert.equal(dollarsToCents("10"), 1000);
  assert.equal(dollarsToCents("2500.50"), 250050);
  assert.equal(dollarsToCents("19.99"), 1999);
  assert.equal(dollarsToCents("0.01"), 1);
  assert.equal(dollarsToCents(10), 1000);
});

test("dollarsToCents does not lose the cent that float math loses", () => {
  // Math.round(1.115 * 100) and Math.round((1.115 + EPSILON) * 100) disagree,
  // because the stored double is 1.1149999…. Parsing the string cannot.
  assert.equal(dollarsToCents("1.11"), 111);
  assert.equal(dollarsToCents("1.12"), 112);
  assert.equal(dollarsToCents("0.61"), 61);
  assert.equal(dollarsToCents("1234.56"), 123456);
});

test("dollarsToCents rejects more precision than a cent rather than rounding it", () => {
  // Silently deciding whether 1.005 is 100 or 101 cents is how a total stops
  // reconciling. Refuse instead.
  for (const value of ["1.005", "0.001", "10.999"]) {
    assert.throws(() => dollarsToCents(value), /two decimal places/, `should reject ${value}`);
  }
});

test("dollarsToCents refuses anything that is not a positive amount", () => {
  for (const value of ["0", "-5", "abc", "", null, undefined, NaN, Infinity, "1e3", " "]) {
    assert.throws(() => dollarsToCents(value), /two decimal places/);
  }
});

/* ── list filtering ─────────────────────────────────────────────────────── */
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const opts = (over = {}) => ({ query: "", mineOnly: false, currentUserId: ME, ...over });

test("mine matches owner or assignee", () => {
  assert.equal(passesListFilter({ owner_id: ME }, "x", opts({ mineOnly: true })), true);
  assert.equal(passesListFilter({ assigned_to: ME }, "x", opts({ mineOnly: true })), true);
  assert.equal(passesListFilter({ owner_id: OTHER }, "x", opts({ mineOnly: true })), false);
  assert.equal(passesListFilter({}, "x", opts({ mineOnly: true })), false);
});

test("mine is ignored with no signed-in user rather than hiding everything", () => {
  assert.equal(
    passesListFilter({ owner_id: OTHER }, "x", opts({ mineOnly: true, currentUserId: null })),
    true,
  );
});

test("text filter is case-insensitive and matches anywhere", () => {
  assert.equal(passesListFilter({}, "Butterfly Support", opts({ query: "supp" })), true);
  assert.equal(passesListFilter({}, "Butterfly Support", opts({ query: "SUPPORT" })), true);
  assert.equal(passesListFilter({}, "Butterfly Support", opts({ query: "mosquito" })), false);
});

test("blank and whitespace-only queries match everything", () => {
  assert.equal(passesListFilter({}, "anything", opts({ query: "" })), true);
  assert.equal(passesListFilter({}, "anything", opts({ query: "   " })), true);
});

test("both filters apply together", () => {
  const row = { owner_id: ME };
  assert.equal(passesListFilter(row, "Butterfly", opts({ query: "butter", mineOnly: true })), true);
  assert.equal(
    passesListFilter(row, "Butterfly", opts({ query: "mosquito", mineOnly: true })),
    false,
  );
  assert.equal(
    passesListFilter({ owner_id: OTHER }, "Butterfly", opts({ query: "butter", mineOnly: true })),
    false,
  );
});
