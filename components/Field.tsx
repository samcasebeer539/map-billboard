import { ReactNode } from "react";

// A form field: small muted label above its control. The control must use the same id.
export default function Field({
  id,
  label,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && " (optional)"}
      </label>
      {children}
    </div>
  );
}
