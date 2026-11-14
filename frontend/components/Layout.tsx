import { useUser, UserButton, Show } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";
import PageTransition from "./PageTransition";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useUser();
  const router = useRouter();

  // Helper to determine if a link is active
  const isActive = (path: string) => router.pathname === path;

  const navLinks = [
    ["/dashboard", "Dashboard"],
    ["/accounts", "Accounts"],
    ["/advisor-team", "Advisor Team"],
    ["/analysis", "Analysis"],
  ].map(([href, label]) => (
    <Link
      key={href}
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
        isActive(href) ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  ));

  return (
    <Show when="signed-in" fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to sign in...</p>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-dark text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-8">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                  <span className="w-8 h-8 rounded-lg bg-primary grid place-items-center font-bold">A</span>
                  Alex
                </Link>
                <div className="hidden md:flex items-center gap-1">{navLinks}</div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-sm text-white/70">
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </span>
                <UserButton />
              </div>
            </div>

            <div className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">{navLinks}</div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <PageTransition>
            {children}
          </PageTransition>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 font-medium mb-2">
                Important Disclaimer
              </p>
              <p className="text-xs text-gray-600">
                This AI-generated advice has not been vetted by a qualified financial advisor and should not be used for trading decisions.
                For informational purposes only. Always consult with a licensed financial professional before making investment decisions.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                © 2025 Alex AI Financial Advisor. Powered by AI agents and built with care.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Show>
  );
}