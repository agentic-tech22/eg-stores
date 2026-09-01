import { cn } from "@/utils/cn";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";

interface ContainerProps {
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
}

const sizeClasses: Record<ContainerSize, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

export function Container({
  size = "xl",
  className,
  children,
}: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizeClasses[size], className)}>
      {children}
    </div>
  );
}
