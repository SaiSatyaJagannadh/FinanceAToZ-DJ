import Head from "next/head";
import Layout from "../components/Layout";
import StockCheck from "../components/StockCheck";

export default function StockCheckPage() {
  return (
    <>
      <Head>
        <title>Stock Check - Alex AI Financial Advisor</title>
      </Head>
      <Layout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold text-dark">Stock Check</h1>
          <p className="mt-2 text-gray-600">
            Score any US or Indian stock on fundamentals, growth, technicals, institutional conviction and safety,
            blended into one BUY / HOLD / SELL call.
          </p>
          <div className="mt-6">
            <StockCheck />
          </div>
        </div>
      </Layout>
    </>
  );
}
