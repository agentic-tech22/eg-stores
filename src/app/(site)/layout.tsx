import { CartProvider } from "@/components/cart/cart-context";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <div className="storefront flex min-h-screen flex-col font-sans">{children}</div>
    </CartProvider>
  );
}
