// Module augmentation for jspdf-autotable's runtime side-effect on jsPDF.
// The autotable plugin mutates the jsPDF instance to expose `lastAutoTable.finalY`
// (the Y coordinate immediately below the last rendered table), but the upstream
// @types/jspdf does not declare this field. This augmentation gives TypeScript
// first-class knowledge of the field so consumers (src/pdf/generateQuotePdf.ts)
// can read `doc.lastAutoTable.finalY` without an `(doc as any)` escape hatch.
//
// Closes v1.3 POL-03 (REQUIREMENTS.md). Auto-discovered by tsc because src/ is
// in tsconfig.json's `include`. No runtime impact — pure type-only declaration.

declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
