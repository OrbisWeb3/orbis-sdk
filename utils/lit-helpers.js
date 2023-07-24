import LitJsSdk from "@lit-protocol/sdk-browser";
const { signAndSaveAuthMessage } = LitJsSdk;
import { toUtf8Bytes } from "@ethersproject/strings";
import { hexlify } from "@ethersproject/bytes";
import { blobToBase64, decodeb64, buf2hex, getAddressFromDid, sleep } from "./index.js";
import {
  fromString as uint8arrayFromString,
  toString as uint8arrayToString,
} from "uint8arrays";
import {
  Web3Provider,
  JsonRpcSigner,
  JsonRpcProvider,
} from "@ethersproject/providers";

/** Initialize lit */
let lit;
let litMumbai;
let litReady = false;
export async function connectLitClient() {
  let ready;
  try {
    lit = new LitJsSdk.LitNodeClient({
      alertWhenUnauthorized: false,
      debug: false
    });
    await lit.connect();
    console.log("Lit is ready now!");
    litReady = true;
  } catch(e) {
    console.log("Error connecting to Lit:, e");
  }
}

/** Returns lit object */
export function getLit() {
  return lit;
}

/** temporary function to wait for Lit to be ready before decrypting conten */
async function litIsReady() {
  let ready;
  console.log("Checking if Lit is ready...: " + litReady);

  if(litReady == false) {
    await sleep(1500);
    ready = true;
  } else {
    ready = true;
  }
  console.log("Lit is ready!: " + litReady);

  return;
}

/** Requires user to sign a message which will generate the lit-signature */
export async function generateLitSignature(provider, account, providerNetwork, store) {
  let signedMessage;
  let sig;

  /** Initiate the signature data */
  const now = new Date().toISOString();
  const AUTH_SIGNATURE_BODY = "I am creating an account to use the private features of Orbis at {{timestamp}}";
  const body = AUTH_SIGNATURE_BODY.replace("{{timestamp}}", now);
  const bodyBytes = toUtf8Bytes(body);

  /** Proceed to signing the message for the correct network */
  switch (providerNetwork) {
    /** Generate Lit signature for Ethereum */
    case "ethereum":
      /** Make sure provider is enabled */
      let addresses;
      try {
  			addresses = await provider.enable();
  		} catch(e) {
  			return {
  				status: 300,
  				error: e,
  				result: "Error enabling Ethereum provider."
  			}
  		}

      /** Trigger message signature */
      try {
        signedMessage = await provider.send('personal_sign', [ hexlify(bodyBytes), account ]);

        /** Save signature */
        sig = JSON.stringify({
            sig: signedMessage.result,
            derivedVia: "web3.eth.personal.sign",
            signedMessage: body,
            address: account,
        });
      } catch (e) {
        console.log("Error generating signature for Lit: ", e);
        return {
          status: 300,
          result: "Error generating signature for Lit.",
          error: e
        };
      }
      break;

    /** Generate Lit signature for Solana */
    case "solana":
      signedMessage = await provider.signMessage(bodyBytes, "utf8");
      const hexSig = hexlify(signed.signature, "base16");

      /** Save signature */
      sig = JSON.stringify({
        sig: hexSig,
        derivedVia: "solana.signMessage",
        signedMessage: body,
        address: provider.publicKey.toBase58(),
      });

      break;
    default:

  }

  /** Save signature in localStorage */
  await store.setItem("lit-auth-signature-" + account, sig);
  await store.setItem("lit-auth-signature", sig);

  /** Return success */
  return {
    status: 200,
    result: "Created lit signature with success."
  }
}

/** Attempt at using SIWE for Lit */
export async function generateLitSignatureV2(provider, account, providerNetwork, store) {
  switch (providerNetwork) {
    /** Support for EVM chains */
    case "ethereum":
      const web3 = new Web3Provider(provider);
      /** Step 1: Get chain id */
      const { chainId } = await web3.getNetwork();

      /** Step 2: Generate signature */
      let res = await signAndSaveAuthMessage({
        web3,
        account,
        chainId,
        resources: null
      });

      break;
    /** Support for Solana */
    case "solana":
      const authSig = await LitJsSdk.checkAndSignAuthMessage({ chain: "solana" });
      store.setItem("lit-auth-signature", JSON.stringify(authSig));
      break;
  }

  /** Step 3: Save signature in local storage while referencing address */
  let __authSig = await getAuthSig(store)
  store.setItem("lit-auth-signature-" + account, JSON.stringify(__authSig));

  /** Step 3: Return results */
  return {
    status: 200,
    result: "Created lit signature with success."
  }
}

/** Retrieve user's authsig from localStorage */
async function getAuthSig(store) {
  let _authSig = await store.getItem("lit-auth-signature")
  const authSig = JSON.parse(_authSig);
  if(authSig && authSig != "") {
    return authSig;
  } else {
    console.log("User not authenticated to Lit Protocol for messages")
    throw new Error("User not authenticated to Lit Protocol for messages");
  }
}

/** Decrypt a string using Lit based on a set of inputs. */
export async function decryptString(encryptedContent, chain, store, forcedAuthSig = null) {
  /** Make sure Lit is ready before trying to decrypt the string */
  await litIsReady();

  /** Retrieve AuthSig or used the one passed as a parameter */
  let authSig;
  if(forcedAuthSig) {
    authSig = forcedAuthSig;
  } else {
    authSig = await getAuthSig(store);
  }

  /** Decode string encoded as b64 to be supported by Ceramic */
  let decodedString;
  try {
    decodedString = decodeb64(encryptedContent.encryptedString);
  } catch(e) {
    console.log("Error decoding b64 string: ", e);
    throw new Error(e);
  }

  /** Instantiate the decrypted symmetric key */
  let decryptedSymmKey;

  /** Decrypt the message accroding to the chain the user is connected on  */
  switch (chain) {
    /** Decrypt for EVM users */
    case "ethereum":
      let _access;
      try {
        _access = JSON.parse(encryptedContent.accessControlConditions);
      } catch(e) {
        console.log("Couldn't parse accessControlConditions: ", e);
        throw new Error(e);
      }

      /** Get encryption key from Lit */
      try {
        decryptedSymmKey = await lit.getEncryptionKey({
          accessControlConditions: _access,
          toDecrypt: encryptedContent.encryptedSymmetricKey,
          chain: "ethereum",
          authSig
        })
      } catch(e) {
        console.log("Error getting encryptionKey for EVM: ", e);
        throw new Error(e);
      }
      break;

    /** Decrypt for Solana users */
    case "solana":
      let _rpcCond;
      try {
        _rpcCond = JSON.parse(encryptedContent.solRpcConditions);
      } catch(e) {
        console.log("Couldn't parse solRpcConditions: ", e);
        throw new Error(e);
      }

      /** Get encryption key from Lit */
      try {
        decryptedSymmKey = await lit.getEncryptionKey({
          solRpcConditions: _rpcCond,
          toDecrypt: encryptedContent.encryptedSymmetricKey,
          chain: "solana",
          authSig
        })
      } catch(e) {
        console.log("Error getting encryptionKey for Solana: ", e);
        throw new Error(e);
      }
      break;
  }

  /** Decrypt the string using the encryption key */
  try {
      let _blob = new Blob([decodedString]);
      const decryptedString = await LitJsSdk.decryptString(_blob, decryptedSymmKey);
      return {
        status: 200,
        result: decryptedString
      };
  } catch(e) {
    console.log("Error decrypting string: ", e)
    throw new Error(e);
  }
}

/** Lit Cloud only: Decrypt string from API (can be used to support encryption / decryption from React Native for example) */
export async function decryptStringFromAPI(encryptedContent, chain, store) {

  /** Retrieve AuthSig */
  let authSig = await getAuthSig(store);

  /** Making sure authsig is present  */
  if(!authSig) {
    return {
      status: 300,
      result: "Error decrypting string.",
      error: "AuthSig must be present."
    }
  }

  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authSig: JSON.stringify(authSig),
      chain: chain,
      encryptedContent: encryptedContent
    })
  };
  try {
    let _data = await fetch("https://lit.orbis.club/lit-decrypt-v2", requestOptions);
    let _result = await _data.json();
    return _result;
  } catch(e) {
    console.log("Error decrypting string with API: ", e)
    return {
      status: 300,
      result: e
    };
  }
}

/** API debug: Used to turn the decrypted symmetric key into a string  */
export async function decryptBlob(decodedString, decryptedSymmKey) {
  let _blob = new Blob([decodedString]);
  const decryptedString = await LitJsSdk.decryptString(_blob, decryptedSymmKey);
  return {
    status: 200,
    result: decryptedString
  };
}

/** Encryp a DM */
export async function encryptDM(recipients, body, litCloud) {
  /** Step 1: Retrieve access control conditions from recipients */
  let { accessControlConditions, solRpcConditions } = generateAccessControlConditionsForDMs(recipients);

  /** Initiate result values */
  let encryptedMessage = null;
  let encryptedMessageSolana = null;

  /** Encrypt string for EVM and return result */
  if(litCloud == true) {
    let resFromAPI = await encryptStringFromAPI(body, accessControlConditions, solRpcConditions);
    encryptedMessage = resFromAPI.encryptedMessage;
    encryptedMessageSolana = resFromAPI.encryptedMessageSolana;
  } else {
    if(accessControlConditions && accessControlConditions.length > 0) {
      try {
        encryptedMessage = await encryptString(body, "ethereum", accessControlConditions);
      } catch(e) {
        console.log("Error encrypting DM: ", e);
        throw new Error(e)
      }
    }

    /** Encrypt string for Solana and return result */
    if(solRpcConditions && solRpcConditions.length > 0) {
      try {
        encryptedMessageSolana = await encryptString(body, "solana", solRpcConditions);
      } catch(e) {
        console.log("Error encrypting DM: ", e);
        throw new Error(e)
      }
    }
  }


  return {
    encryptedMessage: encryptedMessage,
    encryptedMessageSolana: encryptedMessageSolana
  }
}

/** Encrypt post based on the encryptionRules added by the user */
export async function encryptPost(body, encryptionRules) {
  /**
   * Step 1:
   * Retrieve access control conditions based on the encryptionRules are used custom conditions
   * passed as a parameter
   */
  let accessControlConditions;
  if(encryptionRules && encryptionRules.accessControlConditions) {
    accessControlConditions = encryptionRules.accessControlConditions;
  } else {
    accessControlConditions = generateAccessControlConditionsForPosts(encryptionRules);
  }

  /** Step 2: Check if accessControlConditions are valid */
  if(!accessControlConditions) {
    return {
      status: 300,
      result: "You must use valid access control conditions to encrypt posts."
    }
  }

  /** Step 3: Encrypt string and return result */
  try {
    let result = await encryptString(body, "ethereum", accessControlConditions);
    return result
  } catch(e) {
    console.log("Error encrypting post: ", e);
    throw new Error(e)
  }
}

/** Encrypt string based on some access control conditions */
export async function encryptString(body, chain = "ethereum", controlConditions) {
  /** Step 2: Encrypt message */
  const { encryptedString, symmetricKey } = await LitJsSdk.encryptString(body);

  /** We convert the encrypted string to base64 to make it work with Ceramic */
  let base64EncryptedString = await blobToBase64(encryptedString);

  /** Step 4: Save encrypted content to lit nodes */
  let encryptedSymmetricKey;
  switch (chain) {
    /** Encrypt for EVM based on the access control conditions */
    case "ethereum":
      try {
        encryptedSymmetricKey = await lit.saveEncryptionKey({
          accessControlConditions: controlConditions,
          symmetricKey: symmetricKey,
          authSig: evmEmptyAuthSig,
          chain: "ethereum"
        });
      } catch(e) {
        console.log("Error encrypting string with Lit for EVM: ", e);
        throw new Error("Error encrypting string with Lit: " + e)
      }

      /** Step 5: Return encrypted content which will be stored on Ceramic (and needed to decrypt the content) */
      return {
        accessControlConditions: JSON.stringify(controlConditions),
        encryptedSymmetricKey: buf2hex(encryptedSymmetricKey),
        encryptedString: base64EncryptedString
      };

    /** Encrypt for Solana based on the sol rpc conditions */
    case "solana":
      try {
        encryptedSymmetricKey = await lit.saveEncryptionKey({
          solRpcConditions: controlConditions,
          symmetricKey: symmetricKey,
          authSig: solEmptyAuthSig,
          chain: "solana"
        });
      } catch(e) {
        console.log("Error encrypting string with Lit for Solana: ", e);
        throw new Error("Error encrypting string with Lit: " + e)
      }

      /** Step 5: Return encrypted content which will be stored on Ceramic (and needed to decrypt the content) */
      return {
        solRpcConditions: JSON.stringify(controlConditions),
        encryptedSymmetricKey: buf2hex(encryptedSymmetricKey),
        encryptedString: base64EncryptedString
      };
  }
}

/** Lit Cloud only: Encrypt string from API (can be used to support encryption / decryption from React Native for example)  */
export async function encryptStringFromAPI(body, accessControlConditions, solRpcConditions) {
  try {
    /** Creating variables for the request */
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessControlConditions: accessControlConditions,
        solRpcConditions: solRpcConditions,
        body: body
      })
    };

    let _data = await fetch("https://lit.orbis.club/lit-encrypt-v2", requestOptions);
    let _result = await _data.json();
    return _result.result;
  } catch(e) {
    console.log("Error encrypting string with API: ", e)
    return {
      status: 300,
      result: e
    };
  }
}

/** This function will take an array of recipients and turn it into a clean access control conditions array */
export function generateAccessControlConditionsForDMs(recipients) {
  let { ethRecipients, solRecipients } = cleanRecipients(recipients);
  let _accessControlConditions = [];
  let _solRpcConditions = [];

  /** Loop through all EVM users in this conversation */
  ethRecipients.forEach((ethRecipient, i) => {
    let { address } = getAddressFromDid(ethRecipient);
    _accessControlConditions.push({
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [
        ':userAddress',
      ],
      returnValueTest: {
        comparator: '=',
        value: address
      }
    });

    /** Push `or` operator if recipient isn't the last one of the list */
    if(i < ethRecipients.length - 1) {
      _accessControlConditions.push({"operator": "or"})
    }
  });

  /** Loop through Solana recipients */
  solRecipients.forEach((solRecipient, i) => {
    let { address } = getAddressFromDid(solRecipient);
    _solRpcConditions.push({
      method: "",
      params: [":userAddress"],
      chain: "solana",
      pdaParams: [],
      pdaInterface: { offset: 0, fields: {} },
      pdaKey: "",
      returnValueTest: {
        key: "",
        comparator: "=",
        value: address,
      },
    });

    /** Push `or` operator if recipient isn't the last one of the list */
    if(i < solRecipients.length - 1) {
      _solRpcConditions.push({"operator": "or"})
    }
  });

  /** Return clean access control conditions for both Solana and EVM */
  return {
    accessControlConditions: _accessControlConditions,
    solRpcConditions: _solRpcConditions
  };
}

/** This function will take the encryptionRules object and turn it into a clean access control conditions array */
export function generateAccessControlConditionsForPosts(encryptionRules) {
  let _accessControlConditions = [];

  switch(encryptionRules.type) {
    case "token-gated":
      let chain = encryptionRules.chain;
      let contractType = encryptionRules.contractType; // Can be only ERC20 or ERC721
      let contractAddress = encryptionRules.contractAddress;
      let minTokenBalance = encryptionRules.minTokenBalance;

      if(encryptionRules.contractType == "ERC20" || encryptionRules.contractType == "ERC721") {
        /** Adds an access control condition based on token gated content */
        _accessControlConditions.push({
          contractAddress: encryptionRules.contractAddress,
          standardContractType: encryptionRules.contractType,
          chain: encryptionRules.chain,
          method: 'balanceOf',
          parameters: [
            ':userAddress'
          ],
          returnValueTest: {
            comparator: '>=',
            value: encryptionRules.minTokenBalance.toString()
          }
        });
      } else if(encryptionRules.contractType == "ERC1155") {
        _accessControlConditions.push({
          contractAddress: encryptionRules.contractAddress,
          standardContractType: encryptionRules.contractType,
          chain: encryptionRules.chain,
          method: 'balanceOf',
          parameters: [
            ':userAddress',
            encryptionRules.tokenId
          ],
          returnValueTest: {
            comparator: '>=',
            value: encryptionRules.minTokenBalance.toString()
          }
        });
      } else if(encryptionRules.contractType == "SolanaContract") {
        _accessControlConditions.push({
          method: "balanceOfToken",
          params: [encryptionRules.contractAddress],
          pdaParams: [],
          pdaInterface: { offset: 0, fields: {} },
          pdaKey: "",
          chain: "solana",
          returnValueTest: {
            key: "$.amount",
            comparator: ">=",
            value: encryptionRules.minTokenBalance.toString(),
          },
        });
      }

      break;
  }

  /** Return clean access control conditions */
  return _accessControlConditions;
}

/** Clean the list of recipients to keep only the did pkh */
function cleanRecipients(recipients) {
  /** Instantiate new array */
  let ethRecipients = [];
  let solRecipients = [];

  /** Loop through all recipients */
  recipients.forEach((recipient, i) => {
    /** Get address and network from DiD */
    let { address, network } = getAddressFromDid(recipient);

    /** If user is using EVM or Solana we add it to its respective array */
    switch (network) {
      case "eip155":
        ethRecipients.push(recipient);
        break;
      case "solana":
        solRecipients.push(recipient);
        break;
    }
  });

  /** Return recipients list without did:key */
  return {
    ethRecipients: ethRecipients,
    solRecipients: solRecipients
  };
}

/** This function will execute a Lit Action and return the results */
export async function executeLitAction(action) {
  let results;
  try {
    results = await litMumbai.executeJs(action);
  } catch(e) {
    console.log("Error running Lit Action: ", e);
    return;
  }
  return results;
}

/** Default AuthSig to be used to write content */
export const evmEmptyAuthSig = {
  sig: "0x111d0285180969b8790683e2665b9e48737deb995242fa9353ee7b42f879f12d7804b5d5152aedf7f59d32dfb02de46f2b541263738342dc811b7e54229fe5a31c",
  derivedVia: "web3.eth.personal.sign",
  signedMessage: "localhost:3000 wants you to sign in with your Ethereum account:\n0x348d53ac2638BEA8684Ac9ec4DDeAE1171b01059\n\n\nURI: http://localhost:3000\nVersion: 1\nChain ID: 137\nNonce: Tq3dXTTh4zHBmvWVM\nIssued At: 2022-10-04T12:48:40.872Z",
  address: "0x348d53ac2638bea8684ac9ec4ddeae1171b01059"
};
export const solEmptyAuthSig = {
  sig: "8cfb8dc58d7f6e2740618af75c1c4fe3653e8179806e490062364765e49a5fd3810a7db1255a9355cf04b804aa30c8fb0c401b228db3d550b17ed59425c8f80f",
  derivedVia: "solana.signMessage",
  signedMessage: "I am creating an account to use Lit Protocol at 2022-10-04T12:45:03.943Z",
  address: "7ddxX3wPse3Nm43Vrtp8CG7EEH7SXFZj1jqZTsEZcedj"
};
