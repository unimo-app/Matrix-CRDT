import * as http from "http";
import * as https from "https";
import Matrix, { createClient, MemoryStore } from "matrix-js-sdk";
import { uuid } from "vscode-lib";
import { createMatrixRoom, RoomSecuritySetting } from "../matrixRoomManagement";
import { matrixTestConfig } from "./matrixTestUtilServer";

const request = require("request");

export function initMatrixSDK() {
  // make sure the matrix sdk initializes request properly
  // Matrix.request(request);
}

http.globalAgent.maxSockets = 2000;
https.globalAgent.maxSockets = 2000;

const TEST_PASSWORD = "testpass";

export async function createRandomMatrixClient() {
  const testId = uuid.generateUuid();
  const username = "testuser_" + testId;

  const client = await createMatrixUser(username, TEST_PASSWORD);

  return {
    username,
    client,
  };
}

export async function createRandomMatrixClientAndRoom(
  security: RoomSecuritySetting
) {
  const { client, username } = await createRandomMatrixClient();
  const roomName = "@" + username + "/test";
  const result = await createMatrixRoom(client, roomName, security);

  if (typeof result === "string" || result.status !== "ok") {
    throw new Error("couldn't create room");
  }

  return {
    client,
    roomId: result.roomId,
    roomName,
  };
}

export async function createMatrixUser(username: string, password: string) {
  console.log("create", username);
  let matrixClient = createClient({
    baseUrl: matrixTestConfig.baseUrl,
    // accessToken: access_token,
    // userId: user_id,
    // deviceId: device_id,
  });
  let sessionId = "";
  // first get a session_id. this is returned in a 401 response :/
  try {
    const result = await matrixClient.register(
      username,
      password,
      null,
      undefined as any
    );
    // console.log(result);
  } catch (e: any) {
    // console.log(e);
    sessionId = e.data.session;
  }

  if (!sessionId) {
    throw new Error("unexpected, no sessionId set");
  }
  // now register

  const result = await matrixClient.register(username, password, sessionId, {
    type: "m.login.dummy",
  });
  //   console.log(result);

  // login
  const loginResult = await matrixClient.loginWithPassword(username, password);
  // console.log(result);
  // result.access_token
  let matrixClientLoggedIn = createClient({
    baseUrl: matrixTestConfig.baseUrl,
    accessToken: loginResult.access_token,
    store: new MemoryStore() as any,
    userId: loginResult.user_id,
    deviceId: loginResult.device_id,
  });

  await matrixClientLoggedIn.initCrypto();
  matrixClientLoggedIn.setCryptoTrustCrossSignedDevices(true);
  matrixClientLoggedIn.setGlobalErrorOnUnknownDevices(false);
  (matrixClientLoggedIn as any).canSupportVoip = false;

  await matrixClientLoggedIn.startClient({
    lazyLoadMembers: true,
    initialSyncLimit: 0,
  });
  return matrixClientLoggedIn;
}
