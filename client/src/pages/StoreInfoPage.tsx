import { Link, useLocation } from 'react-router-dom';

const pages: Record<string, { eyebrow: string; title: string; paragraphs: string[] }> = {
  about: {
    eyebrow: 'Our story',
    title: 'A bookshop for the curious.',
    paragraphs: [
      'Books Bin is an independent bookstore built around the belief that the right book can open a new world.',
      'Our shelves bring together thoughtful fiction, ideas, and voices from across the world. Every title is selected to reward a slower, more curious read.',
    ],
  },
  contact: {
    eyebrow: 'We’re here to help',
    title: 'Talk to a bookseller.',
    paragraphs: [
      'For questions about an order, a recommendation, or a book you cannot find, write to our bookselling team.',
    ],
  },
  faq: {
    eyebrow: 'A little help',
    title: 'Frequently asked questions',
    paragraphs: [
      'How do I track an order? Sign in and open Order history to see its latest status.',
      'Can I cancel an order? Orders can be cancelled while they are in an eligible processing state. Open your order details to check.',
      'Which payment methods are available? Razorpay is available when configured by the shop. Cash on delivery may be offered depending on store settings.',
    ],
  },
  'shipping-policy': {
    eyebrow: 'Delivery',
    title: 'Shipping policy',
    paragraphs: [
      'Shipping costs and free-shipping eligibility are calculated from current store settings and shown in your cart before you place an order.',
      'Orders are packed with care. You can review order status and delivery details from your account.',
    ],
  },
  returns: {
    eyebrow: 'Returns',
    title: 'Returns and cancellations',
    paragraphs: [
      'If you need to cancel an eligible order, use the cancellation action on its order details page.',
      'For an item that arrives damaged or incorrect, contact our booksellers with your order number so we can help.',
    ],
  },
  privacy: {
    eyebrow: 'Your information',
    title: 'Privacy policy',
    paragraphs: [
      'Books Bin uses the information you provide to manage your account, deliver orders, and support your requests.',
      'Passwords are stored as secure hashes. Authentication tokens are held in HTTP-only cookies. Payment card details are handled by the payment provider and are not stored by Books Bin.',
    ],
  },
  terms: {
    eyebrow: 'The fine print',
    title: 'Terms of service',
    paragraphs: [
      'Prices, discounts, and availability are confirmed by the server when an order is placed. An order is not considered paid until payment is verified.',
      'Orders and cancellations are subject to the status rules shown in your account.',
    ],
  },
};

export function StoreInfoPage() {
  const { pathname } = useLocation();
  const key = pathname.replace(/^\//, '');
  const page = pages[key] ?? pages.about;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-400">{page.eyebrow}</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">{page.title}</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-600">
        {page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {key === 'contact' && (
        <a className="mt-6 inline-block font-medium text-ink-900 underline underline-offset-4" href="mailto:books@booksbin.example">
          Email books@booksbin.example
        </a>
      )}
      <Link className="mt-10 block text-sm text-ink-500 hover:text-ink-900" to="/catalog">Explore the catalog →</Link>
    </div>
  );
}
