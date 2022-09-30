import { Buffer } from 'buffer';

/** To generate dids from a Seed */
import { DID } from 'dids'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { getResolver } from 'key-did-resolver'

/** Force index a stream. This shouldn't be necessary because our indexer picks up all new streams automatically but at least we are 100% sure. */
export async function forceIndex(stream_id) {
  const requestOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
  let _result;
  try {
    _result = await fetch("https://api.orbis.club/index-stream/mainnet/" + stream_id, requestOptions);
		  console.log("Indexed " + stream_id + " with success.");
    return;
  } catch(e) {
    console.log("Error indexing new stream: ", e);
    return;
  }
}

/** Generate a random seed that can be used to authenticate a new did:key */
export function randomSeed() {
  const buffer = new Uint8Array(32);
  let seedCrypto = crypto.getRandomValues(buffer);
  return seedCrypto;
}

/** Force index a did to retrieve blockchain details such as nonces and ens name. */
export async function forceIndexDid(did) {
  const requestOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
  let _result;
  try {
    let _result_api = await fetch("https://api.orbis.club/index-orbis-did/" + did, requestOptions);
    _result = await _result_api.json();
	   console.log("Indexed " + did + " with success.");
     return _result;
  } catch(e) {
    console.log("Error indexing new did: ", e);
    return;
  }
}

/** Returns a JSON object with the address and network based on the did */
export function getAddressFromDid(did) {
  if(did && did.substring(0, 7) == "did:pkh") {
    /** Explode address to retrieve did */
    let addressParts = did.split(":");
    if(addressParts.length >= 4) {
      let address = addressParts[4];
      let network = addressParts[2];
      let chain = addressParts[2] + ":" + addressParts[3];

      /** Return result */
      return {
        address: address,
        network: network,
        chain: chain
      }
    } else {
      /** Return null object */
      return {
        address: null,
        network: null,
        chain: null
      }
    }
  } else {
    /** Return null object */
    return {
      address: null,
      network: null,
      chain: null
    }
  }
}

/**
 * This function converts blobs to base 64.
 * for easier storage in ceramic
 * @param {Blob} blob what you'd like to encode
 * @returns {Promise<String>} returns a string of b64
 */
export function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () =>
    resolve(
        reader.result.replace("data:application/octet-stream;base64,", "")
    );
    reader.readAsDataURL(blob);
  });
}

/** Decodes a b64 string */
export function decodeb64(b64String) {
  return new Uint8Array(Buffer.from(b64String, "base64"));
}

/** Turns a uint8array in a buffer */
export function buf2hex(buffer) { // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Wait for x ms in an async function */
export const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/** To sort an array based on a specific key */
export function sortByKey(array, key) {
  return array.sort(function(a, b) {
    var x = a[key]; var y = b[key];
    return ((x > y) ? -1 : ((x < y) ? 1 : 0));
  });
}
