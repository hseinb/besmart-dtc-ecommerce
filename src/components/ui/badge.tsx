import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-smart-teal text-white",
        gold: "border-transparent bg-smart-gold text-slate-950",
        sale: "border-transparent bg-smart-sale text-white",
        secondary:
          "border-transparent bg-smart-teal-light text-smart-teal",
        outline: "border-slate-200 text-slate-700 bg-white",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
