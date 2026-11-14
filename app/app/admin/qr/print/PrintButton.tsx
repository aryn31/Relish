"use client";
import { useT } from "@/components/I18n";
export default function PrintButton() { const _ = useT(); return <button className="no-print" onClick={() => window.print()}>{_("Print / Save as PDF")}</button>; }
