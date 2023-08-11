global.Buffer = global.Buffer || require('buffer').Buffer
import 'core-js/features/array/find';
import 'core-js/features/array/includes';
import 'core-js/features/number/is-nan';
import 'react-native-url-polyfill/auto';
import * as encoding from 'text-encoding';
const { NativeModules } = require('react-native')
import base64Decode from 'fast-base64-decode'
var sha256 = require('js-sha256');
import 'react-native-webcrypto'
import * as Crypto from 'expo-crypto';

if (typeof BigInt === 'undefined') global.BigInt = require('big-integer')

if (typeof global.crypto !== 'object') {
  console.log("global.crypto doesn't exist, we initialize it.");
  global.crypto = {}
}

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

/** Polyfill to fix crypto package (are TypeMismatchError and QuotaExceededError still necessary?) */
class TypeMismatchError extends Error {}
class QuotaExceededError extends Error {}

/** Replacement function to digest for React Native, we could migrate to Crypto.digest (from expo) but it returns a promise */
 async function _digest(name, data) {
   let hash = sha256.create().update(data).digest();
   return hash
 }

/** Assign crypto polyfills to global.crypto object */
global.crypto = {
 getRandomValues: Crypto.getRandomValues,
 subtle: {
   digest: _digest
 }
}
