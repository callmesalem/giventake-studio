/**
 * Rewrites the SOW sections an accepted proposal knows: 1 (background),
 * 3 (deliverables table), 4 (exclusions list), 6 (adds the overall timeline)
 * and the fee block of 7. Everything else keeps the template's wording for the
 * lawyer to approve once. Pure: string in, string out.
 */
import {
  OWN_IT_MONTHLY_CENTS,
  OWN_IT_MONTHS,
  formatUsd,
  paymentOptions,
  proposalTotals,
  type PaymentOptionKey,
  type ProposalLine,
} from "./proposals.ts";

/** Replace the body between the `## <n>.` heading line and the next `## ` heading. */
function replaceSection(md: string, n: number, body: (old: string) => string): string {
  const re = new RegExp(`(\\n## ${n}\\. [^\\n]*\\n)([\\s\\S]*?)(?=\\n## )`);
  if (!re.test(md)) throw new Error(`SOW template has no section ${n}`);
  return md.replace(re, (_all, heading: string, old: string) => `${heading}${body(old)}`);
}

export function applyProposalToSow(
  rawTemplate: string,
  p: { summary: string; timeline: string; lines: ProposalLine[]; option: PaymentOptionKey },
): string {
  // A Windows checkout of the template has CRLF; the section regexes assume LF.
  const template = rawTemplate.replace(/\r\n/g, "\n");
  const oneTime = p.lines.filter((l) => !l.recurring && l.unit_price_cents > 0);
  const monthly = p.lines.filter((l) => l.recurring);
  const totals = proposalTotals(p.lines);
  const excludes = [...new Set(p.lines.flatMap((l) => l.excludes))];

  let out = replaceSection(template, 1, () => `\n${p.summary.trim() || "[BACKGROUND]"}\n`);

  out = replaceSection(out, 3, (old) => {
    const marker = old.indexOf("Every project also includes");
    const standing = marker >= 0 ? old.slice(marker) : "";
    const rows = oneTime.map((l, i) => {
      const qty = l.quantity !== 1 ? ` × ${l.quantity}` : "";
      const inc = l.includes.length ? ` (${l.includes.join("; ")})` : "";
      return `| ${i + 1} | ${l.name}${qty}${inc} | Deployed + documented | [DATE] |`;
    });
    return `\n| # | Deliverable | Format | Target date |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n${standing}`;
  });

  out = replaceSection(out, 4, (old) => {
    const cut = old.indexOf("The following are");
    const intro = cut >= 0 ? old.slice(0, cut) : "\n";
    const list = [...excludes, "Anything not expressly listed in Sections 2 and 3"].map(
      (x) => `- ${x}`,
    );
    return `${intro}The following are **not** included and require a Change Order:\n\n${list.join("\n")}\n`;
  });

  out = replaceSection(
    out,
    6,
    (old) => `\n**Estimated overall timeline:** ${p.timeline.trim() || "[TIMELINE]"}\n${old}`,
  );

  const option = paymentOptions(totals).find((o) => o.key === p.option);
  const schedule =
    p.option === "own_it"
      ? `**Own-it plan:** $0 down, then ${OWN_IT_MONTHS} monthly payments of ${formatUsd(OWN_IT_MONTHLY_CENTS)}. Ownership of the deliverables transfers to Client after the final payment; ending early requires paying the remaining payments. [REVIEW with attorney: own-it plan terms]`
      : [
          "| Milestone | Amount | Due |",
          "| --- | --- | --- |",
          ...(option?.schedule ?? []).map(
            (s) => `| ${s.label} | ${formatUsd(s.amountCents)} | ${s.due} |`,
          ),
        ].join("\n");
  const monthlyLine = monthly.length
    ? `\n\n**After launch (monthly):** ${monthly.map((l) => `${l.name} ${formatUsd(l.unit_price_cents)}/mo`).join("; ")}`
    : "";

  const feeBlock = /\*\*Total fee: `\$\[AMOUNT\]`\*\*[^\n]*\n\n\| Milestone[\s\S]*?\n\n/;
  if (!feeBlock.test(out))
    throw new Error("SOW template fee block has changed; update applyProposalToSow");
  return out.replace(
    feeBlock,
    () =>
      `${
        p.option === "own_it"
          ? `**Total fee: ${formatUsd(OWN_IT_MONTHLY_CENTS * OWN_IT_MONTHS)}** under the own-it plan`
          : `**Total fee: ${formatUsd(totals.oneTimeCents)}** fixed fee`
      }\n\n${schedule}${monthlyLine}\n\n`,
  );
}
