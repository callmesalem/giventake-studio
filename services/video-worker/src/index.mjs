import { createWorkerConfig } from "./config.mjs";
import { createWorkerHttpServer } from "./http-server.mjs";
import { createWorkerRepository } from "./repository.mjs";

const config = createWorkerConfig();
if (!config.sharedSecret)
  throw new Error("STUDIO_WORKER_SHARED_SECRET is required to start the video worker.");

const repository = createWorkerRepository({ databasePath: config.databasePath });
const server = createWorkerHttpServer({ repository, config });
const address = await server.listen(config.port, config.host);

console.log(`GivenTake video worker listening on ${address.host}:${address.port}`);
