const Long = require('long');
const protobuf = require('protobufjs');
const querystring = require('querystring');
const request = require('../utils/request');
const { waitFor } = require('../utils/timeout');
// const fcmKey = require('../fcm/server-key');
const fcmKey = [ 0x04, 0x33, 0x94, 0xf7, 0xdf, 0xa1, 0xeb, 0xb1, 0xdc, 0x03, 0xa2, 0x5e, 0x15, 0x71, 0xdb, 0x48, 0xd3, 0x2e, 0xed, 0xed, 0xb2, 0x34, 0xdb, 0xb7, 0x47, 0x3a, 0x0c, 0x8f, 0xc4, 0xcc, 0xe1, 0x6f, 0x3c, 0x8c, 0x84, 0xdf, 0xab, 0xb6, 0x66, 0x3e, 0xf2, 0x0c, 0xd4, 0x8b, 0xfe, 0xe3, 0xf9, 0x76, 0x2f, 0x14, 0x1c, 0x63, 0x08, 0x6a, 0x6f, 0x2d, 0xb1, 0x1a, 0x95, 0xb0, 0xce, 0x37, 0xc0, 0x9c, 0x6e ];
const { toBase64 } = require('../utils/base64');

const serverKey = toBase64(Buffer.from(fcmKey));

const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3';
const CHECKIN_URL = 'https://android.clients.google.com/checkin';

let root;
let AndroidCheckinResponse;
const checkin_proto_file = { "options": { "optimize_for": "LITE_RUNTIME" }, "nested": { "checkin_proto": { "nested": { "DeviceType": { "values": { "DEVICE_ANDROID_OS": 1, "DEVICE_IOS_OS": 2, "DEVICE_CHROME_BROWSER": 3, "DEVICE_CHROME_OS": 4 } }, "ChromeBuildProto": { "fields": { "platform": { "type": "Platform", "id": 1 }, "chromeVersion": { "type": "string", "id": 2 }, "channel": { "type": "Channel", "id": 3 } }, "nested": { "Platform": { "values": { "PLATFORM_WIN": 1, "PLATFORM_MAC": 2, "PLATFORM_LINUX": 3, "PLATFORM_CROS": 4, "PLATFORM_IOS": 5, "PLATFORM_ANDROID": 6 } }, "Channel": { "values": { "CHANNEL_STABLE": 1, "CHANNEL_BETA": 2, "CHANNEL_DEV": 3, "CHANNEL_CANARY": 4, "CHANNEL_UNKNOWN": 5 } } } }, "AndroidCheckinProto": { "fields": { "lastCheckinMsec": { "type": "int64", "id": 2 }, "cellOperator": { "type": "string", "id": 6 }, "simOperator": { "type": "string", "id": 7 }, "roaming": { "type": "string", "id": 8 }, "userNumber": { "type": "int32", "id": 9 }, "type": { "type": "DeviceType", "id": 12, "options": { "default": "DEVICE_ANDROID_OS" } }, "chromeBuild": { "type": "checkin_proto.ChromeBuildProto", "id": 13 } } }, "GservicesSetting": { "fields": { "name": { "rule": "required", "type": "bytes", "id": 1 }, "value": { "rule": "required", "type": "bytes", "id": 2 } } }, "AndroidCheckinRequest": { "fields": { "imei": { "type": "string", "id": 1 }, "meid": { "type": "string", "id": 10 }, "macAddr": { "rule": "repeated", "type": "string", "id": 9 }, "macAddrType": { "rule": "repeated", "type": "string", "id": 19 }, "serialNumber": { "type": "string", "id": 16 }, "esn": { "type": "string", "id": 17 }, "id": { "type": "int64", "id": 2 }, "loggingId": { "type": "int64", "id": 7 }, "digest": { "type": "string", "id": 3 }, "locale": { "type": "string", "id": 6 }, "checkin": { "rule": "required", "type": "AndroidCheckinProto", "id": 4 }, "desiredBuild": { "type": "string", "id": 5 }, "marketCheckin": { "type": "string", "id": 8 }, "accountCookie": { "rule": "repeated", "type": "string", "id": 11 }, "timeZone": { "type": "string", "id": 12 }, "securityToken": { "type": "fixed64", "id": 13 }, "version": { "type": "int32", "id": 14 }, "otaCert": { "rule": "repeated", "type": "string", "id": 15 }, "fragment": { "type": "int32", "id": 20 }, "userName": { "type": "string", "id": 21 }, "userSerialNumber": { "type": "int32", "id": 22 } } }, "AndroidCheckinResponse": { "fields": { "statsOk": { "rule": "required", "type": "bool", "id": 1 }, "timeMsec": { "type": "int64", "id": 3 }, "digest": { "type": "string", "id": 4 }, "settingsDiff": { "type": "bool", "id": 9 }, "deleteSetting": { "rule": "repeated", "type": "string", "id": 10 }, "setting": { "rule": "repeated", "type": "GservicesSetting", "id": 5 }, "marketOk": { "type": "bool", "id": 6 }, "androidId": { "type": "fixed64", "id": 7 }, "securityToken": { "type": "fixed64", "id": 8 }, "versionInfo": { "type": "string", "id": 11 } } } } } } };

module.exports = {
  register,
  checkIn,
};

async function register(appId) {
  protobuf.util.Long = Long;
  protobuf.configure();

  const options = await checkIn();
  console.log("PUSH_RECEIVER::options: ", options, appId);
  const credentials = await doRegister(options, appId);
  return credentials;
}

async function checkIn(androidId, securityToken) {
  await loadProtoFile();
  const buffer = getCheckinRequest(androidId, securityToken);
  const body = await request({
    url     : CHECKIN_URL,
    method  : 'POST',
    headers : {
      'Content-Type' : 'application/x-protobuf',
    },
    body     : buffer,
    encoding : null,
  });
  const message = AndroidCheckinResponse.decode(body);
  const object = AndroidCheckinResponse.toObject(message, {
    longs : String,
    enums : String,
    bytes : String,
  });
  return object;
}

async function doRegister({ androidId, securityToken }, appId) {
  const body = {
    app         : 'org.chromium.linux',
    'X-subtype' : appId,
    device      : androidId,
    sender      : serverKey,
  };
  const response = await postRegister({ androidId, securityToken, body });
  const token = response.split('=')[1];
  return {
    token,
    androidId,
    securityToken,
    appId,
  };
}

async function postRegister({ androidId, securityToken, body, retry = 0 }) {
  const response = await request({
    url     : REGISTER_URL,
    method  : 'POST',
    headers : {
      Authorization  : `AidLogin ${androidId}:${securityToken}`,
      'Content-Type' : 'application/x-www-form-urlencoded',
    },
    form : querystring.stringify(body),
  });
  if (response.includes('Error')) {
    console.warn(`Register request has failed with ${response}`);
    if (retry >= 20) {
      throw new Error('GCM register has failed');
    }
    console.warn(`Retry... ${retry + 1}`);
    await waitFor(1000);
    return postRegister({ androidId, securityToken, body, retry : retry + 1 });
  }
  return response;
}

async function loadProtoFile() {
  if (root) {
    return;
  }
  // root = await protobuf.load('checkin.proto');
  root = await protobuf.Root.fromJSON(checkin_proto_file);
  return root;
}

function getCheckinRequest(androidId, securityToken) {
  const AndroidCheckinRequest = root.lookupType(
    'checkin_proto.AndroidCheckinRequest'
  );
  root.tojs
  AndroidCheckinResponse = root.lookupType(
    'checkin_proto.AndroidCheckinResponse'
  );
  const payload = {
    userSerialNumber : 0,
    checkin          : {
      type        : 3,
      chromeBuild : {
        platform      : 2,
        chromeVersion : '63.0.3234.0',
        channel       : 1,
      },
    },
    version       : 3,
    id            : androidId ? Long.fromString(androidId) : undefined,
    securityToken : securityToken
      ? Long.fromString(securityToken, true)
      : undefined,
  };
  const errMsg = AndroidCheckinRequest.verify(payload);
  if (errMsg) throw Error(errMsg);
  const message = AndroidCheckinRequest.create(payload);
  return AndroidCheckinRequest.encode(message).finish();
}
