import Link from "next/link";
import { api } from "../../../lib/api";
import CheckoutClient from "../../components/CheckoutClient";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === "true";

  let data;
  try {
    data = await api.getLink(id);
  } catch {
    return (
      <main className={isEmbed ? "shell shell--embed" : "shell shell--narrow"}>
        <div className="panel checkout">
          <p className="title">Payment link not found</p>
          <p className="muted">This link may have been removed, or the id is wrong.</p>
          {!isEmbed && (
            <Link className="linkbtn" href="/">
              Back to dashboard
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={isEmbed ? "shell shell--embed" : "shell shell--narrow"}>
      {!isEmbed && (
        <header className="masthead">
          <h1>Stellar Checkout</h1>
          <span className="net mono">{data.link.asset.code}</span>
        </header>
      )}
      <div className={isEmbed ? "panel panel--embed" : "panel"}>
        <CheckoutClient initial={data} />
      </div>
    </main>
  );
}
