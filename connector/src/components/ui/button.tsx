import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#171717] text-white hover:bg-[#2a2a2a]",
        secondary:
          "border border-[rgba(28,25,23,0.14)] bg-white/70 text-[#161616] hover:bg-white/90",
        ghost: "text-[#707070] hover:text-[#161616] hover:bg-black/[0.04]",
        outline:
          "border border-[rgba(28,25,23,0.14)] bg-transparent text-[#161616] hover:bg-[#f6f5f2]",
        "dark-primary": "bg-[#ffffff] text-[#141414] hover:bg-[#f0f0f0]",
        "dark-secondary":
          "border border-white/20 text-white bg-white/[0.02] hover:bg-white/10",
        link: "text-[#3564e8] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-[52px] px-[22px] rounded-[14px] text-[15px]",
        sm: "h-10 px-4 rounded-[10px] text-sm",
        lg: "h-[60px] px-[26px] rounded-2xl text-lg min-w-[200px]",
        xl: "h-[64px] px-8 rounded-2xl text-lg min-w-[220px]",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
