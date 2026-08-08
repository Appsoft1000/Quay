"use client";

/**
 * Stellar Wallets Kit, wrapped so the rest of the app never imports it directly.
 *
 * Two reasons for the wrapper:
 *
 *  - The kit touches `window` at import time, so it cannot be pulled in during
 *    Next's server render. Every entry point here loads it lazily, inside a
 *    browser event, and the module is never referenced at module scope.
 *  - Its surface went static in v2 (`StellarWalletsKit.authModal()` rather than
 *    `new StellarWalletsKit(...)`). Keeping that behind one file means a future
 *    version bump is a change here, not across the UI.
 */

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public" ? "public" : "testnet";

export const NETWORK_PASSPHRASE =
  NETWORK === "public"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

type Kit = typeof import("@creit.tech/stellar-wallets-kit").StellarWalletsKit;

let ready: Promise<Kit> | null = null;

/** Loads and initialises the kit exactly once per page. */
async function kit(): Promise<Kit> {
  if (!ready) {
    ready = (async () => {
      // v2 has no `allowAllModules()`; each wallet is its own subpath import.
      // Listed explicitly rather than pulled in wholesale — every module here
      // is browser-facing code shipped to the buyer, and the hardware-wallet
      // and WalletConnect modules are large and pull in dependencies this app
      // has no use for.
      const [mod, freighter, xbull, albedo, rabet, lobstr, hana] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/rabet"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/hana"),
      ]);

      mod.StellarWalletsKit.init({
        modules: [
          new freighter.FreighterModule(),
          new xbull.xBullModule(),
          new albedo.AlbedoModule(),
          new rabet.RabetModule(),
          new lobstr.LobstrModule(),
          new hana.HanaModule(),
        ],
        network: NETWORK === "public" ? mod.Networks.PUBLIC : mod.Networks.TESTNET,
      });
      return mod.StellarWalletsKit;
    })();
  }
  return ready;
}

/**
 * Opens the wallet picker and returns the chosen address.
 *
 * Resolves `null` when the user closes the modal without picking — a dismissed
 * dialog is not an error, and surfacing it as one puts a red banner in front of
 * someone who simply changed their mind.
 */
export async function connectWallet(): Promise<string | null> {
  const k = await kit();
  try {
    const { address } = await k.authModal();
    return address || null;
  } catch {
    return null;
  }
}

/** Signs a SEP-10 challenge. Returns the signed XDR to post back to /auth. */
export async function signChallenge(xdr: string, address: string): Promise<string> {
  const k = await kit();
  const { signedTxXdr } = await k.signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}

/** Forgets the wallet selection. Independent of the API session. */
export async function disconnectWallet(): Promise<void> {
  const k = await kit();
  await k.disconnect().catch(() => {
    // Some modules have nothing to disconnect from; the local session is
    // cleared by the caller regardless, so this must not throw.
  });
}

/** `GABC…WXYZ` — addresses are 56 chars and unreadable in full in a header. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
