import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge, type ClassNameValue } from "tailwind-merge";

// Los tamaños por papel de globals.css (text-title, text-body…) son tamaños, no colores: sin esto, un color
// posterior (text-muted-foreground) los descartaba.
const twMerge: (...classes: ClassNameValue[]) => string = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["title", "people", "section", "body", "aux", "action"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
