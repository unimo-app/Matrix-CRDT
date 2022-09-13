import got from "got";
import { MatrixClient } from "matrix-js-sdk";
import * as qs from "qs";
import { beforeAll, expect, it } from "vitest";
import { MatrixCRDTEventTranslator } from "../MatrixCRDTEventTranslator";
import {
  createRandomMatrixClient,
  createRandomMatrixClientAndRoom,
} from "../test-utils/matrixTestUtil";
import { ensureMatrixIsRunning } from "../test-utils/matrixTestUtilServer";
import { sendMessage } from "../util/matrixUtil";
import { MatrixReader } from "./MatrixReader";

const { Worker, isMainThread } = require("worker_threads");

beforeAll(async () => {
  await ensureMatrixIsRunning();
});

function validateMessages(messages: any[], count: number) {
  expect(messages.length).toBe(count);
  for (let i = 1; i <= count; i++) {
    expect(messages[i - 1].content.body).toEqual("message " + i);
  }
}

it("handles initial and live messages", async () => {
  let messageId = 0;
  const setup = await createRandomMatrixClientAndRoom({
    permissions: "public-read-write",
    encrypted: false,
  });

  const { client, username } = await createRandomMatrixClient();
  // const guestClient = await createMatrixGuestClient(matrixTestConfig);
  await client.joinRoom(setup.roomId);

  // send more than 1 page (30 messages) initially
  for (let i = 0; i < 40; i++) {
    await sendMessage(setup.client, setup.roomId, "message " + ++messageId);
  }

  const reader = new MatrixReader(
    client,
    setup.roomId,
    new MatrixCRDTEventTranslator()
  );
  try {
    const messages = await reader.getInitialDocumentUpdateEvents(
      "m.room.message"
    );

    reader.onEvents((msgs) => {
      messages.push.apply(
        messages,
        msgs.events.filter((e) => e.type === "m.room.message")
      );
    });
    reader.startPolling();

    while (messageId < 60) {
      await sendMessage(setup.client, setup.roomId, "message " + ++messageId);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    validateMessages(messages, messageId);
  } finally {
    reader.dispose();
  }
}, 100000);
