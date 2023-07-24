import { Cacao, SiweMessage } from '@didtools/cacao';
import { randomBytes, randomString } from '@stablelib/random';
import { DIDSession, createDIDKey, createDIDCacao } from 'did-session'
import { evmEmptyAuthSig, executeLitAction } from "./lit-helpers.js";

/** Used to connect an Oauth user to its PKP */
 export async function authenticatePkp(options) {
   console.log("Enter authenticatePkp() with:", options);

  /** Step 1: Create a new did:key */
  const keySeed = randomBytes(32);
  const didKey = await createDIDKey(keySeed);

  /** Step 2: Create a SIWE message */
  let siweMessage = createSiweMessage(options.address.toLowerCase(), didKey.id);

  const action = {
    ipfsId: options.ipfs,
    authSig: evmEmptyAuthSig,
    authMethods: [{
      accessToken: options.accessToken,
      authMethodType: options.authMethodType,
    }],
    jsParams: {
      userId: options.userId.toString(),
      publicKey: options.publicKey.toString(),
      sigName: "siwe-sign",
      message: siweMessage.signMessage()
    }
  };

  let results = await executeLitAction(action);
  if(results && results.signatures) {
    console.log("signatures returned from Lit Action: ", results.signatures["siwe-sign"]);
    let signature = results.signatures["siwe-sign"].signature;
    siweMessage.signature = signature;

    console.log("logs: ", results.logs);
    console.log("Lit Action hex signature: ", signature);
    console.log("Message to sign:", siweMessage.signMessage());

    /** Step 4: Create a Cacao object with the message being signed by Metamask */
    let cacao = Cacao.fromSiweMessage(siweMessage);

    /** Step 5: Create a did with this Cacao object */
    const did = await createDIDCacao(didKey, cacao);
    let didSession = new DIDSession({
        cacao,
        keySeed,
        did
    });
    return {
      status: 200,
      session: didSession
    };
  } else {
    console.log("results Lit Action: ", results);
    return({
      status: 300,
      error: "Error generating signatures from LitAction"
    })
  }

}

/** Will generate a SIWE message that can be signed to authenticate the user to Ceramic */
export function createSiweMessage(address, uri) {
    const VERSION = '1';
    const CHAIN_NAMESPACE = 'eip155';
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const message = new SiweMessage({
        domain: window.location.hostname,
        address: address,
        statement: 'Give this application access to some of your data on Ceramic',
        uri: uri,
        version: VERSION,
        nonce: randomString(10),
        issuedAt: now.toISOString(),
        expirationTime: threeMonthsLater.toISOString(),
        chainId: '1',
        resources: [`ceramic://*`]
    });
    return message;
}
