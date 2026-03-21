import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-mono text-[10px] uppercase tracking-[0.15em] transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/30 px-3 py-1",
        secondary: "bg-secondary text-secondary-foreground px-3 py-1",
        outline: "border border-border text-muted-foreground px-3 py-1",
        under: "bg-[rgba(0,192,122,0.12)] text-under border border-[rgba(0,192,122,0.3)] px-3.5 py-1",
        even: "bg-[rgba(138,133,128,0.1)] text-ash border border-[rgba(138,133,128,0.25)] px-3.5 py-1",
        bogey: "bg-[rgba(245,149,32,0.1)] text-bogey border border-[rgba(245,149,32,0.3)] px-3.5 py-1",
        double: "bg-[rgba(232,32,42,0.12)] text-double border border-[rgba(232,32,42,0.3)] px-3.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
