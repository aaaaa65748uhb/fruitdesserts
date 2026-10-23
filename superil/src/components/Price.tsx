import { formatILS } from "@/lib/format";

export function Price({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`num ${className}`}>{formatILS(value)}</span>;
}
