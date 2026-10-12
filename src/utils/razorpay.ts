export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: string, handler: (error: unknown) => void): void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay Checkout did not load'));
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(input: { keyId: string; orderId: string; amount: number; currency: string; name: string; description: string }): Promise<RazorpaySuccess> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable');
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: input.keyId,
      amount: input.amount,
      currency: input.currency,
      name: 'OneMinute Healthcare',
      description: input.description,
      order_id: input.orderId,
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Razorpay Checkout was closed')) },
    });
    checkout.on('payment.failed', reject);
    checkout.open();
  });
}