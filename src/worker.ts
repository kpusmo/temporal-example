import { Worker } from '@temporalio/worker';
import { createActivities } from './activities';
import { Client, Connection, ConnectionLike } from '@temporalio/client';

async function run() {
  const connection = await Connection.connect();
  const client = new Client({ connection: connection as ConnectionLike });

  const worker = await Worker.create({
    namespace: 'default',
    taskQueue: 'sw',
    // Workflows are registered using a path as they run in a separate JS context.
    workflowsPath: require.resolve('./workflows'),
    activities: createActivities(client),
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
