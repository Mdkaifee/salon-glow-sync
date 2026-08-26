export type OfferPricingOption = "discount" | "fixed";
export type OfferDiscountType = "percentage" | "fixed";

/** Keeps controlled number inputs usable when a user clears or types an invalid value. */
export function toNonNegativeNumber(value: string, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(0, maximum), Math.max(0, parsed));
}

export function toPositiveInteger(value: string, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.max(1, Math.floor(toNonNegativeNumber(value, maximum)));
}

export function calculateOriginalPrice(services: { price: number }[]) {
  return services.reduce((sum, service) => sum + service.price, 0);
}

export function calculateDiscountedPrice({
  originalPrice,
  discountType,
  discountValue,
  maxDiscountAmount,
}: {
  originalPrice: number;
  discountType: OfferDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
}) {
  if (originalPrice <= 0) return 0;
  const rawDiscount =
    discountType === "percentage" ? (originalPrice * discountValue) / 100 : discountValue;
  const appliedDiscount =
    discountType === "percentage" && maxDiscountAmount > 0
      ? Math.min(rawDiscount, maxDiscountAmount)
      : rawDiscount;
  return Math.max(0, Math.round((originalPrice - appliedDiscount) * 100) / 100);
}

export function validateOfferPricing({
  pricingOption,
  originalPrice,
  discountType,
  discountValue,
  maxDiscountAmount,
  offeredPrice,
}: {
  pricingOption: OfferPricingOption;
  originalPrice: number;
  discountType: OfferDiscountType;
  discountValue: number;
  maxDiscountAmount: number;
  offeredPrice: number;
}): string | null {
  if (originalPrice <= 0) {
    return "Select at least one service with a price greater than 0.";
  }
  if (pricingOption === "fixed") {
    if (offeredPrice <= 0) return "Offered price must be greater than 0.";
    if (offeredPrice >= originalPrice) {
      return "Offered price must be less than the original price.";
    }
    return null;
  }
  if (discountType === "percentage") {
    if (discountValue <= 0 || discountValue > 100) {
      return "Percentage off must be between 1 and 100.";
    }
    if (maxDiscountAmount > 0 && maxDiscountAmount >= originalPrice) {
      return "Max discount amount must be less than the original price.";
    }
  } else {
    if (discountValue <= 0) return "Amount off must be greater than 0.";
    if (discountValue >= originalPrice) {
      return "Amount off cannot be greater than or equal to the original price.";
    }
  }
  return null;
}
