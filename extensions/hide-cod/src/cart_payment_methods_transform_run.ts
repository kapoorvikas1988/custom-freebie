import type {
  CartPaymentMethodsTransformRunInput,
  CartPaymentMethodsTransformRunResult,
} from "../generated/api";

const NO_CHANGES: CartPaymentMethodsTransformRunResult = {
  operations: [],
};

export function cartPaymentMethodsTransformRun(
  input: CartPaymentMethodsTransformRunInput
): CartPaymentMethodsTransformRunResult {
  
  // Extract all payment methods available
  const paymentMethods = input.paymentMethods;
  
  // Flag to check if a free gift is in the cart
  let hasFreeGift = false;

  // Search through all lines in the cart
  const lines = input.cart?.lines || [];
  for (const line of lines) {
    const merchandise = line.merchandise;
    
    // Check if the merchandise is a ProductVariant and has our required tag
    if (merchandise.__typename === "ProductVariant" && merchandise.product?.hasAnyTag) {
      hasFreeGift = true;
      break; 
    }
  }

  // If there is NO free gift in the cart, we do NO changes 
  // (leave all payment methods alone)
  if (!hasFreeGift) {
    return NO_CHANGES;
  }

  // If a free gift WAS found, we hide the COD payment method.
  const codPaymentMethod = paymentMethods.find((pm) => {
    const name = pm.name.toLowerCase();
    
    return name.includes("cash on delivery") || name.includes("cod") || name === "cash on delivery (cod)";
  });

  // If we found the COD payment method, hide it
  if (codPaymentMethod) {
    return {
      operations: [
        {
          paymentMethodHide: {
            paymentMethodId: codPaymentMethod.id,
          },
        },
      ],
    };
  }

  return NO_CHANGES;
}