// Shared shape for the stable label<->input association IDs (WCAG 1.3.1 /
// 4.1.2) the orchestrator builds once from useId() and passes down to every
// section as a single `ids` prop. Kept as a plain type (not a hook) so
// section components can accept it without importing React's `useId`.
export interface CalculatorFieldIds {
  printName: string;
  printerSelect: string;
  modelUrl: string;
  modelCost: string;
  authorMinPrice: string;
  gramsBase: string;
  printTime: string;
  failureRate: string;
  prepTime: string;
  postProcessing: string;
  shippingMethod: string;
  shippingDistance: string;
  carrierCost: string;
  sellingPlatform: string;
  profitMargin: string;
  targetProfit: string;
  sellingPrice: string;
  taxRate: string;
}
