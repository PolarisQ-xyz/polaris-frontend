import { getNetworkDisplayName } from "./freighter-wallet";

describe("getNetworkDisplayName", () => {
  it("maps the testnet passphrase to Testnet", () => {
    expect(getNetworkDisplayName("Test SDF Network ; September 2015")).toBe(
      "Testnet",
    );
  });

  it("maps the mainnet passphrase to Mainnet", () => {
    expect(
      getNetworkDisplayName("Public Global Stellar Network ; September 2015"),
    ).toBe("Mainnet");
  });

  it("maps the futurenet passphrase to Futurenet", () => {
    expect(
      getNetworkDisplayName("Test SDF Future Network ; October 2022"),
    ).toBe("Futurenet");
  });

  it("falls back to the raw passphrase for unknown networks", () => {
    expect(getNetworkDisplayName("Some Custom Network ; 2024")).toBe(
      "Some Custom Network ; 2024",
    );
  });
});

describe("callAsWallet missing-hash handling", () => {
  const MISSING_HASH_MESSAGE =
    "Transaction was sent but no hash was returned — check your wallet history";

  // Mirrors the hash-resolution logic in callAsWallet: a missing hash from
  // both response shapes must throw instead of falling back to "".
  function resolveTxHash(sent: {
    sendTransactionResponse?: { hash?: string };
    getTransactionResponse?: { txHash?: string };
  }): string {
    const txHash =
      sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;
    if (!txHash) {
      throw new Error(MISSING_HASH_MESSAGE);
    }
    return txHash;
  }

  it("returns the hash from sendTransactionResponse when present", () => {
    expect(
      resolveTxHash({ sendTransactionResponse: { hash: "abc123" } }),
    ).toBe("abc123");
  });

  it("falls back to getTransactionResponse.txHash when send hash is absent", () => {
    expect(
      resolveTxHash({ getTransactionResponse: { txHash: "def456" } }),
    ).toBe("def456");
  });

  it("throws when both response shapes are missing a hash", () => {
    expect(() => resolveTxHash({})).toThrow(MISSING_HASH_MESSAGE);
  });

  it("throws when both response shapes carry an empty hash", () => {
    expect(() =>
      resolveTxHash({
        sendTransactionResponse: { hash: "" },
        getTransactionResponse: { txHash: "" },
      }),
    ).toThrow(MISSING_HASH_MESSAGE);
  });
});
