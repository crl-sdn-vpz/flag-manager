import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { isErrorResponse, useCreateFlag } from "../api";
import { type CreateFlagFormValues, createFlagFormSchema, validationIssuesSchema } from "../schema";
import { FormField } from "./form-field";

const fieldNames = ["key", "name", "description"] as const;
const isFieldName = (value: unknown): value is (typeof fieldNames)[number] =>
  fieldNames.some((name) => name === value);

const inputClass =
  "block w-full rounded-md border border-line bg-surface px-3 py-2 aria-invalid:border-danger";

export function CreateFlagForm({ announce }: { announce: (message: string) => void }) {
  const create = useCreateFlag();
  const [formError, setFormError] = useState<string>();
  const form = useForm<CreateFlagFormValues>({
    resolver: zodResolver(createFlagFormSchema),
    mode: "onTouched",
    defaultValues: { key: "", name: "", description: "" },
  });
  const { errors } = form.formState;

  const onSubmit = (values: CreateFlagFormValues) => {
    setFormError(undefined);
    create.mutate(
      { body: values },
      {
        onSuccess: (flag) => {
          // Focus stays in the form (no context change); the result is announced instead.
          // Focus before reset: React Hook Form ignores setFocus right after reset().
          form.setFocus("key");
          form.reset();
          announce(`Flag ${flag.key} created. It is off.`);
        },
        onError: (error) => {
          if (isErrorResponse(error) && error.code === "flag_key_conflict") {
            form.setError("key", { message: "This key already exists" }, { shouldFocus: true });
            return;
          }
          const issues = validationIssuesSchema.safeParse(
            isErrorResponse(error) ? error.details.issues : undefined,
          );
          const fieldIssues = issues.success
            ? issues.data.filter((issue) => isFieldName(issue.path[0]))
            : [];
          if (fieldIssues.length > 0) {
            for (const issue of fieldIssues) {
              const field = issue.path[0];
              if (isFieldName(field)) form.setError(field, { message: issue.message });
            }
            return;
          }
          setFormError("Couldn't create the flag. Check your connection and try again.");
          announce("Couldn't create the flag.");
        },
      },
    );
  };

  return (
    <form
      aria-labelledby="create-flag-heading"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-md border border-line bg-surface p-4"
    >
      <h2 id="create-flag-heading" className="text-lg font-semibold">
        New flag
      </h2>
      <FormField
        id="flag-key"
        label="Key"
        hint="Lowercase letters, digits and hyphens, e.g. new-checkout. Can't be changed later."
        error={errors.key?.message}
      >
        {(describedBy) => (
          <input
            id="flag-key"
            className={`${inputClass} font-mono`}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.key ? true : undefined}
            aria-describedby={describedBy}
            {...form.register("key")}
          />
        )}
      </FormField>
      <FormField id="flag-name" label="Name" error={errors.name?.message}>
        {(describedBy) => (
          <input
            id="flag-name"
            className={inputClass}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy}
            {...form.register("name")}
          />
        )}
      </FormField>
      <FormField
        id="flag-description"
        label="Description (optional)"
        error={errors.description?.message}
      >
        {(describedBy) => (
          <textarea
            id="flag-description"
            rows={2}
            className={inputClass}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy}
            {...form.register("description")}
          />
        )}
      </FormField>
      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create flag"}
      </Button>
      <p className="text-xs text-fg-muted">New flags start off.</p>
    </form>
  );
}
