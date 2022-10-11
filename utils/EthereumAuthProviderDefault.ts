import { EthereumAuthProvider, SolanaAuthProvider, CosmosAuthProvider } from '@ceramicnetwork/blockchain-utils-linking'


/** Replacing default EthereumAuthProvider class to force connection to an existing did if any. */
let CHAIN_ID = 1;
export class EthereumAuthProviderDefault extends EthereumAuthProvider {
  async accountId(): Promise<AccountId> {
    const accountId = await super.accountId()
    return new AccountId({
      address: accountId.address,
      chainId: `${accountId.chainId.namespace}:${CHAIN_ID}`,
    })
  }
}
