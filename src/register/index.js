// const uuidv4 = require('uuid/v4');
const { register: registerGCM } = require('../gcm');
const registerFCM = require('../fcm');

module.exports = register;

async function register({ senderId, appId }) {
  // Should be unique by app - One GCM registration/token by app/appId
  // const appId = `wp:com.receiver.push#${uuidv4()}`;
  const subscription = await registerGCM(appId);
  const result = await registerFCM({
    token : subscription.token,
    senderId,
    appId,
  });
  // Need to be saved by the client
  return Object.assign({}, result, { gcm : subscription });
}
