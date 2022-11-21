global.Buffer = global.Buffer || require('buffer').Buffer
import 'core-js/features/array/find';
import 'core-js/features/array/includes';
import 'core-js/features/number/is-nan';
import 'react-native-url-polyfill/auto';
import * as encoding from 'text-encoding';
const { NativeModules } = require('react-native')
const base64Decode = require('fast-base64-decode')
var sha256 = require('js-sha256');
import 'react-native-webcrypto'

if (typeof BigInt === 'undefined') global.BigInt = require('big-integer')

if (typeof global.crypto !== 'object') {
  console.log("global.crypto doesn't exist, we initialize it.");
  global.crypto = {}
}

/*if (typeof global.crypto !== 'object') {
  console.log("global.crypto doesn't exist, we initialize it.");
  global.crypto = {}
}


/** Assign crypto
global.crypto = crypto;
console.log("global.crypto: ", global.crypto);*/

/** Polyfill to fix allSettled */
Promise.allSettled = function (promises) {
  let mappedPromises = promises.map((p) => {
    return p
      .then((value) => {
        return {
          status: 'fulfilled',
          value,
        };
      })
      .catch((reason) => {
        return {
          status: 'rejected',
          reason,
        };
      });
    });
  return Promise.all(mappedPromises);
};

/** Polyfill to fix crypto package */

class TypeMismatchError extends Error {}
class QuotaExceededError extends Error {}

let warned = false
function insecureRandomValues (array) {
  if (!warned) {
    console.warn('Using an insecure random number generator, this should only happen when running in a debugger without support for crypto.getRandomValues')
    warned = true
  }

  for (let i = 0, r; i < array.length; i++) {
    if ((i & 0x03) === 0) r = Math.random() * 0x100000000
    array[i] = (r >>> ((i & 0x03) << 3)) & 0xff
  }

  return array
}

/**
 * @param {number} byteLength
 * @returns {string}
 */
function getRandomBase64 (byteLength) {
  if (NativeModules.RNGetRandomValues) {
    return NativeModules.RNGetRandomValues.getRandomBase64(byteLength)
  } else if (NativeModules.ExpoRandom) {
    // Expo SDK 41-44
    return NativeModules.ExpoRandom.getRandomBase64String(byteLength)
  } else if (global.ExpoModules) {
    // Expo SDK 45+
    return global.ExpoModules.ExpoRandom.getRandomBase64String(byteLength);
  } else {
    throw new Error('Native module not found')
  }
}

/**
 * Polyfill to replace the crypto.getRandomValues function
 * @param {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Uint8ClampedArray} array
 */
 function getRandomValues (array) {
   if (!(array instanceof Int8Array || array instanceof Uint8Array || array instanceof Int16Array || array instanceof Uint16Array || array instanceof Int32Array || array instanceof Uint32Array || array instanceof Uint8ClampedArray)) {
     throw new TypeMismatchError('Expected an integer array')
   }

   if (array.byteLength > 65536) {
     throw new QuotaExceededError('Can only request a maximum of 65536 bytes')
   }

   // Calling getRandomBase64 in debug mode leads to the error
   // "Calling synchronous methods on native modules is not supported in Chrome".
   // So in that specific case we fall back to just using Math.random.
   if (__DEV__) {
     if (typeof global.nativeCallSyncHook === 'undefined') {
       return insecureRandomValues(array)
     }
   }

   base64Decode(getRandomBase64(array.byteLength), new Uint8Array(array.buffer, array.byteOffset, array.byteLength))

   return array
 }

 async function _digest(name, data) {
   let hash = sha256.create().update(data).digest();
   return hash
 }

/** Assign crypto polyfills to global.crypt object */
global.crypto = {
 getRandomValues: getRandomValues,
 subtle: {
   digest: _digest
 }
}

/* if (typeof global.crypto.getRandomValues !== 'function') {
   console.log("global.crypto.getRandomValues doesn't exist, we assign the new function.");
   global.crypto.getRandomValues = getRandomValues
 }
 if (typeof global.crypto.subtle.digest !== 'function') {
   console.log("global.crypto.getRandomValues doesn't exist, we assign the new function.");
   global.crypto.subtle.digest = _digest
 }*/
