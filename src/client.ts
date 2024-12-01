import { Connection, Client } from '@temporalio/client';
import { filterPeople } from './workflows';
import { nanoid } from 'nanoid';

async function run() {
  // Connect to the default Server location
  const connection = await Connection.connect({ address: 'localhost:7233' });
  // In production, pass options to configure TLS and other settings:
  // {
  //   address: 'foo.bar.tmprl.cloud',
  //   tls: {}
  // }

  const client = new Client({
    connection
    // namespace: 'foo.bar', // connects to 'default' namespace if not specified
  });

  const handle = await client.workflow.start(filterPeople, {
    taskQueue: 'sw',
    // the url and filtering rules could come from env or command
    args: ['https://swapi.dev/api', {
      condition: 'AND',
      rules: [
        {
          condition: 'OR',
          rules: [
            {
              propertyName: 'name',
              operator: 'matches_regex',
              value: '\\d'
            },
            {
              propertyName: 'eye_color',
              operator: 'equals',
              value: 'red'
            }
          ]
        },
        {
          condition: 'OR',
          rules: [
            {
              propertyName: 'name',
              operator: 'matches_regex',
              value: 'x'
            },
            {
              propertyName: 'name',
              operator: 'matches_regex',
              value: 'y'
            },
          ]
        },
      ]
    }],
    // in practice, use a meaningful business ID, like customerId or transactionId
    workflowId: 'workflow-' + nanoid()
  });
  console.log(`Started workflow ${handle.workflowId}`);

  // optional: wait for client result
  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
