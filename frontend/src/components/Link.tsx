import React from "react";

type LinkProps<T extends React.ElementType> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Link<T extends React.ElementType = "a">({
  as,
  children,
  className = "",
  ...props
}: LinkProps<T>) {
  const Component = as || "a";

  const baseClasses =
    "text-lg text-orange-300 hover:text-orange-100 focus:outline-none focus:bg-orange-300 rounded focus:text-black transition-colors px-1 py-0.5";

  return (
    <Component className={`${baseClasses} ${className}`} {...props}>
      {children}
    </Component>
  );
}