import Head from "next/head";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import StockCheck from "../components/StockCheck";

export default function StockCheckPage() {
  const { query, isReady } = useRouter();
  const symbol = typeof query.symbol === "string" ? query.symbol.toUpperCase() : undefined;
  const market = query.market === "IN" ? "IN" : "US";

  return (
    <>
      <Head>
        <title>Stock Check - FinFreedom AI</title>
      </Head>
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-dark">Stock Check</h1>
          <p className="mt-2 text-gray-600">
            Score any US or Indian stock on fundamentals, growth, technicals, institutional conviction and safety,
            then dig into price projections, analyst calls, upcoming announcements and the latest news.
          </p>
          <div className="mt-6">
            {isReady && <StockCheck initialSymbol={symbol} initialMarket={market} />}
          </div>
        </div>
      </Layout>
    </>
  );
}
