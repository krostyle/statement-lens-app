export interface MerchantRule {
  id: string;
  userId: string;
  merchantPattern: string; // normalized: lowercase + trimmed
  bank: string;            // "" = any card; "santander" | "falabella" | "liderbci"
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Normalize a merchant name to a canonical pattern used for rule matching */
export function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().trim();
}
