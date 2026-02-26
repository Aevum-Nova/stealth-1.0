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
      className="space-y-4"
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

        return (
          <label key={field.key} className="block space-y-1">
            <span className="text-sm text-[var(--ink-soft)]">{field.label}</span>

            {field.type === "boolean" ? (
              <input type="checkbox" className="size-4" {...register(field.key)} defaultChecked={Boolean(defaults[field.key])} />
            ) : field.type === "number" ? (
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
                {...register(field.key, { valueAsNumber: true })}
              />
            ) : field.type === "multi_select" ? (
              <div className="space-y-2 rounded-lg border border-[var(--line)] p-2">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(value) ? value.includes(option) : false;
                  return (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
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
              <select className="w-full rounded-lg border border-[var(--line)] px-3 py-2" {...register(field.key)}>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
                {...register(field.key)}
                placeholder={field.type === "multi_text" ? "a,b,c" : ""}
              />
            )}

            {field.help ? <p className="text-xs text-[var(--ink-soft)]">{field.help}</p> : null}
          </label>
        );
      })}

      <button className="rounded-lg bg-[var(--ink)] px-4 py-2 text-white" type="submit">
        Save Configuration
      </button>
    </form>
  );
}
