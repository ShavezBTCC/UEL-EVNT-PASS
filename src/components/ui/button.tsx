import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-indigo-700 shadow-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-red-600 shadow-sm",
        outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-800",
        secondary: "bg-secondary text-secondary-foreground hover:bg-slate-300/70",
        ghost: "hover:bg-slate-100 text-slate-700",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 [&_svg]:size-4",
        sm: "h-9 rounded-md px-3 text-xs [&_svg]:size-4",
        lg: "h-14 rounded-xl px-6 text-base [&_svg]:size-5",
        xl: "h-16 rounded-2xl px-8 text-lg [&_svg]:size-6",
        icon: "h-11 w-11 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
