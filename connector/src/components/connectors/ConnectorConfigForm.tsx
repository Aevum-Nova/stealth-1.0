import { useMemo } from "react";
import { useForm } from "react-hook-form";

import type { ConnectorCatalogItem, ConnectorConfigField } from "@/types/connector";

interface Props {
  catalogItem: ConnectorCatalogItem;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
}

function defaultValueForField(field: ConnectorConfigField): unknown {
  if (field.default !== undefined) return field.default;
  if (field.type === "boolean") return false;
  if (field.type === "number") return 0;
  if (field.type === "multi_select" || field.type === "multi_text") return [];
  return "";
}

export default function ConnectorConfigForm({ catalogItem, initialValues, onSubmit }: Props) {
  const defaults = useMemo(() => {
    const value: Record<string, unknown> = {};
    catalogItem.config_fields.forEach((field) => {
      value[field.key] = initialValues?.[field.key] ?? defaultValueForField(field);
    });
    return value;
  }, [catalogItem.config_fields, initialValues]);

  const { register, handleSubmit, watch, setValue } = useForm<Record<string, unknown>>({
    defaultValues: defaults
  });

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((values) => {
        const normalized = { ...values };
        catalogItem.config_fields
          .filter((field) => field.type === "multi_text")
          .forEach((field) => {
            const input = values[field.key];
            if (typeof input === "string") {
              normalized[field.key] = input
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean);
            }
          });
        onSubmit(normalized);
      })}
    >
      {catalogItem.config_fields.map((field) => {
        const value = watch(field.key);

        if (field.type === "boolean") {
          return (
            <label key={field.key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="size-4 rounded border-[var(--line)] accent-[var(--action-primary)]"
                {...register(field.key)}
                defaultChecked={Boolean(defaults[field.key])}
              />
              <div>
                <span className="text-[13px] font-medium text-[var(--ink)]">{field.label}</span>
                {field.help ? <p className="text-[11px] text-[var(--ink-muted)]">{field.help}</p> : null}
              </div>
            </label>
          );
        }

        return (
          <div key={field.key} className="space-y-1.5">
            <label className="text-[13px] font-medium text-[var(--ink)]">{field.label}</label>

            {field.type === "number" ? (
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
                {...register(field.key, { valueAsNumber: true })}
              />
            ) : field.type === "multi_select" ? (
              <div className="space-y-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(value) ? value.includes(option) : false;
                  return (
                    <label key={option} className="flex items-center gap-2.5 text-[13px] text-[var(--ink)] cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-[var(--line)] accent-[var(--action-primary)]"
                        checked={selected}
                        onChange={(event) => {
                          const current = Array.isArray(value) ? value : [];
                          const next = event.target.checked
                            ? [...current, option]
                            : current.filter((item) => item !== option);
                          setValue(field.key, next);
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            ) : field.type === "select" ? (
              <select
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
                {...register(field.key)}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
                {...register(field.key)}
                placeholder={field.type === "multi_text" ? "Enter values separated by commas" : ""}
              />
            )}

            {field.help ? <p className="text-[11px] text-[var(--ink-muted)]">{field.help}</p> : null}
          </div>
        );
      })}

      <button
        className="rounded-lg bg-[var(--action-primary)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)]"
        type="submit"
      >
        Save Configuration
      </button>
    </form>
  );
}
