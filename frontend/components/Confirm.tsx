"use client";
import { ReactNode } from "react";
/** Submit button that asks for confirmation first (RA-04). */
export default function Confirm({ children, message, className }: { children: ReactNode; message: string; className?: string }) {
  return <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
