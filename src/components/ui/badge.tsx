import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "patient" | "priority" | "hmo" | "emergency" | "status";
  status?: string;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-gray-50 text-gray-700 border-gray-200",
  patient: "bg-blue-50 text-blue-700 border-blue-200",
  priority: "bg-amber-50 text-amber-700 border-amber-200",
  hmo: "bg-purple-50 text-purple-700 border-purple-200",
  emergency: "bg-red-50 text-red-700 border-red-200",
  status: "bg-transparent border-transparent",
};

const statusColors: Record<string, string> = {
  WAITING: "text-yellow-600",
  IN_CONSULT: "text-blue-600",
  DONE: "text-green-600",
  NO_SHOW: "text-red-500",
  RESCHEDULED: "text-slate-500",
  CANCELLED: "text-slate-400",
};

export function Badge({
  children,
  variant = "default",
  status,
  className = "",
}: BadgeProps) {
  const statusClass = status ? statusColors[status] ?? "" : "";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${statusClass} ${className}`}
    >
      {children}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const priorityCategories = ["SENIOR", "PWD", "PREGNANT"];
  if (category === "HMO") {
    return <Badge variant="hmo">HMO</Badge>;
  }
  if (priorityCategories.includes(category)) {
    return <Badge variant="priority">{category.replace("_", " ")}</Badge>;
  }
  return <Badge variant="patient">{category.replace("_", " ")}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="status" status={status}>
      {status.replace("_", " ")}
    </Badge>
  );
}
