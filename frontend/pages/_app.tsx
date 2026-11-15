import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import ChatWidget from "@/components/ChatWidget";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ClerkProvider
        {...pageProps}
        afterSignOutUrl="/"
        signInForceRedirectUrl="/dashboard/"
        signUpForceRedirectUrl="/dashboard/"
      >
        <Component {...pageProps} />
        <ToastContainer />
        <ChatWidget />
      </ClerkProvider>
    </ErrorBoundary>
  );
}
