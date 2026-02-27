// @ts-ignore
import Hyperswarm from "hyperswarm";
// @ts-ignore
import Hyperdrive from "hyperdrive";
// @ts-ignore
import Localdrive from "localdrive";
// @ts-ignore
import Corestore from "corestore";
// @ts-ignore
import debounce from "debounceify";
import b4a from "b4a";
import express, { Request, Response } from "express";
import { HttpError } from "./HttpError.js";

interface ServerArgs {
  srcDir: string;
  cacheDir?: string;
}

export const serve = async (args: ServerArgs) => {
  const { srcDir, cacheDir } = {
    // replace with ~/.tuub
    cacheDir: ".tuub",
    ...args,
  };

  // create a Corestore instance
  const store = new Corestore(cacheDir);
  const swarm = new Hyperswarm();
  // replication of the corestore instance on connection with other peers
  swarm.on("connection", (conn: any) => store.replicate(conn));

  // A local drive provides a Hyperdrive interface to a local directory
  // TODO replace with a command line argument
  const local = new Localdrive(srcDir);

  // A Hyperdrive takes a Corestore because it needs to create many cores
  // One for a file metadata Hyperbee, and one for a content Hypercore
  const drive = new Hyperdrive(store);

  // wait till the properties of the hyperdrive instance are initialized
  await drive.ready();

  async function mirrorDrive() {
    console.log(`Serving ${srcDir}...`);
    const mirror = local.mirror(drive);
    await mirror.done();
    console.log("Finished mirroring:", mirror.count);
    console.log(`Share key: ${b4a.toString(drive.key, "hex")}`);
  }

  // Import changes from the local drive into the Hyperdrive
  const mirror = debounce(mirrorDrive);

  const discovery = swarm.join(drive.discoveryKey);
  await discovery.flushed();

  mirror();
};

interface BrowseArgs {
  shareKey: string;
  port?: number;
  cacheDir?: string;
}

interface Entry {
  seq: number;
  key: string;
  value: {
    executable: boolean; // Whether the blob at path is an executable
    linkname: null; // If entry not symlink, otherwise a string to the entry this links to
    blob: {
      // Hyperblobs id that can be used to fetch the blob associated with this entry
      blockOffset: number;
      blockLength: number;
      byteOffset: number;
      byteLength: number;
    };
    metadata: null;
  };
}

export const browse = async (args: BrowseArgs) => {
  const { shareKey, port, cacheDir } = {
    port: 3000,
    // replace with ~/.tuub
    cacheDir: ".tuub",
    ...args,
  };

  // create a Corestore instance
  const store = new Corestore(cacheDir);

  const swarm = new Hyperswarm();

  // replication of store on connection with other peers
  swarm.on("connection", (conn: any) => store.replicate(conn));

  // create a hyperdrive using the public key passed as a command-line argument
  const drive = new Hyperdrive(store, b4a.from(shareKey, "hex"));

  await drive.ready();

  // join a topic
  swarm.join(drive.discoveryKey, { client: true, server: false });
  await swarm.flush();

  const app = express();

  app.get("/{*path}", (req, res, next) => {
    const path = req.path.length > 1 ? req.path.slice(1) : "index.html";

    drive
      .entry(path)
      .then((entry: Entry) => {
        if (!entry) {
          next(new HttpError(404, "Not Found"));
          return;
        }
        res.setHeader("Content-Length", entry.value.blob.byteLength);
        res.setHeader("Content-Type", "*/*");
        const rs = drive.createReadStream(path);
        rs.pipe(res);

        // Handle stream errors
        rs.on("error", (error: Error | unknown) => {
          next(new HttpError(500, "Stream error", error));
        });
      })
      .catch((err: Error | unknown) => {
        next(err);
      });
  });

  // Error handler middleware
  app.use((err: Error | unknown, _req: Request, res: Response) => {
    if (!(err as HttpError).isHttpError) {
      return res.status(500).send();
    }

    const _err = err as HttpError;
    const status = _err.status || 500;
    const message = _err.message || "Internal Server Error";
    console.error(`[${status}] ${message}`, _err.cause || "");
    res.status(status).end(message);
  });

  app.listen(3000, () => {
    console.log(`tuub listening on ${port}`);
  });
};
