export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name?: string; email?: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('razorpay-checkout') as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.id = 'razorpay-checkout';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('Unable to load the Razorpay checkout.'));
    }, { once: true });
    if (!existing) document.body.appendChild(script);
  });
  if (!window.Razorpay) throw new Error('Razorpay checkout did not initialize.');
}

export async function openRazorpayCheckout(input: {
  key: string;
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  name: string;
  prefill: { name?: string; email?: string };
  onSuccess: (response: RazorpayPaymentResponse) => void;
  onDismiss: () => void;
}) {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout did not initialize.');
  new Razorpay({
    key: input.key,
    amount: input.amount,
    currency: input.currency,
    name: input.name,
    description: input.description,
    order_id: input.orderId,
    prefill: input.prefill,
    handler: input.onSuccess,
    modal: { ondismiss: input.onDismiss },
  }).open();
}
