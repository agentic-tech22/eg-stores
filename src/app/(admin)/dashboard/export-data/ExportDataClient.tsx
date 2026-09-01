"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Download, FileSpreadsheet } from "lucide-react";
import { Button, PageHeader } from "@/components/molecules/admin";
import { Field, Select, TextInput } from "@/components/molecules/form";
import { downloadCsv } from "@/lib/export/download";
import { notify } from "@/lib/toast";
import { exportDataset } from "@/services/export.service";
import {
  EXPORT_DATASETS,
  type ExportDataset,
  type ExportDatasetInfo,
} from "@/types/export.types";
import {
  DATE_PRESETS,
  getPresetRange,
  toLocalDateStr,
  type DatePreset,
} from "@/utils/date-range";

interface ExportDataClientProps {
  currency: { code: string; locale: string };
}

/** "All" (the existing preset) plus a custom two-date range. */
type RangeChoice = DatePreset | "custom";

const GROUP_ORDER: ExportDatasetInfo["group"][] = [
  "Sales",
  "Invoices",
  "Products",
  "Customers",
];

export function ExportDataClient({ currency }: ExportDataClientProps) {
  const [choice, setChoice] = useState<RangeChoice>("all");
  const [customStart, setCustomStart] = useState(() =>
    toLocalDateStr(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
  );
  const [customEnd, setCustomEnd] = useState(() => toLocalDateStr(new Date()));
  /** Which dataset is currently being built, so only its button spins. */
  const [busy, setBusy] = useState<ExportDataset | null>(null);

  const range = useMemo(() => {
    if (choice === "custom") return { start: customStart, end: customEnd };
    return getPresetRange(choice);
  }, [choice, customStart, customEnd]);

  const rangeLabel = range
    ? `${range.start} to ${range.end}`
    : "all records, no date filter";

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        datasets: EXPORT_DATASETS.filter((d) => d.group === group),
      })).filter((g) => g.datasets.length > 0),
    [],
  );

  async function handleExport(dataset: ExportDatasetInfo) {
    if (busy) return;
    if (choice === "custom" && (!customStart || !customEnd)) {
      notify.error("Pick both a start and an end date.");
      return;
    }

    setBusy(dataset.value);
    const toastId = notify.loading(`Preparing ${dataset.label.toLowerCase()}…`);

    try {
      const result = await exportDataset({
        dataset: dataset.value,
        from: range?.start ?? null,
        to: range?.end ?? null,
      });

      if (!result.success || !result.csv || !result.filename) {
        notify.error(result.error ?? "Export failed.");
        return;
      }

      downloadCsv(result.filename, result.csv);
      notify.success(
        result.rowCount === 0
          ? "No records matched — downloaded an empty file with just the column headings."
          : `Exported ${result.rowCount?.toLocaleString()} rows to ${result.filename}`,
      );
    } catch (error) {
      notify.fromError(error);
    } finally {
      notify.dismiss(toastId);
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Data"
        title="Export data"
        description="Download your records as CSV — opens directly in Excel, Google Sheets or Numbers. Amounts are exported as plain numbers in your shop currency so you can total them straight away."
      />

      {/* Date range: one choice, applied to whichever dataset you export. */}
      <div className="border-admin-border bg-admin-surface rounded-2xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="text-admin-accent h-4 w-4" />
          <p className="text-admin-text-muted text-[11px] font-bold tracking-[0.15em] uppercase">
            Date range
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Period" hint="Applies to the export you run below.">
            {(p) => (
              <Select
                value={choice}
                onChange={(e) => setChoice(e.target.value as RangeChoice)}
                {...p}
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.value === "all"
                      ? "All time (no filter)"
                      : preset.label}
                  </option>
                ))}
                <option value="custom">Custom range…</option>
              </Select>
            )}
          </Field>

          {choice === "custom" && (
            <>
              <Field label="From">
                {(p) => (
                  <TextInput
                    type="date"
                    value={customStart}
                    max={customEnd || undefined}
                    onChange={(e) => setCustomStart(e.target.value)}
                    {...p}
                  />
                )}
              </Field>
              <Field label="To">
                {(p) => (
                  <TextInput
                    type="date"
                    value={customEnd}
                    min={customStart || undefined}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    {...p}
                  />
                )}
              </Field>
            </>
          )}
        </div>

        <p className="text-admin-text-muted mt-4 text-sm">
          Exporting{" "}
          <span className="text-admin-text font-semibold">{rangeLabel}</span>.
          Money columns are in {currency.code}.
        </p>
      </div>

      {/* One card per dataset, exported one at a time. */}
      {grouped.map(({ group, datasets }) => (
        <section key={group} className="mt-8">
          <h2 className="text-admin-text-muted mb-3 text-[11px] font-bold tracking-[0.15em] uppercase">
            {group}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {datasets.map((dataset) => (
              <div
                key={dataset.value}
                className="border-admin-border bg-admin-surface flex flex-col justify-between gap-4 rounded-2xl border p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-admin-accent h-4 w-4 shrink-0" />
                    <p className="text-admin-text font-bold">{dataset.label}</p>
                  </div>
                  <p className="text-admin-text-muted mt-2 text-sm">
                    {dataset.description}
                  </p>
                  <p className="text-admin-text-muted mt-1 text-xs">
                    Date range filters on {dataset.dateBasis}.
                  </p>
                </div>

                <div>
                  <Button
                    variant="secondary"
                    size="lg"
                    loading={busy === dataset.value}
                    disabled={busy !== null && busy !== dataset.value}
                    onClick={() => void handleExport(dataset)}
                    leadingIcon={
                      <Download className="h-4 w-4" strokeWidth={2.5} />
                    }
                  >
                    Export CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
