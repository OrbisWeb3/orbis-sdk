import { Orbis } from './index.js';

/** Test Orbis class creation */
let orbis = new Orbis();

async function testConnect() {
  let res = await orbis.connect_v2({
    provider: 'oauth',
    oauth: {
      type: 'google',
      userId: 'xxx',
      accessToken: 'yyy'
    }
  });

  console.log("res: ", res);
}

testConnect();
