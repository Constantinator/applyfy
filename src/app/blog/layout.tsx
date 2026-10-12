import { SiteHeader } from "@/components/site/site-header";

// Blog : public, même en-tête que la landing.
export default function BlogLayout({ children }: LayoutProps<"/blog">) {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
