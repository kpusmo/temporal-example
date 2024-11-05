import { TestWorkflowEnvironment } from '@temporalio/testing';
import { before, describe, it } from 'mocha';
import { Worker } from '@temporalio/worker';
import { example, filterPeople } from '../workflows';
import * as activities from '../activities';
import assert from 'assert';
import sinon from 'sinon';
import axios from 'axios';

describe('workflow', () => {
  describe('example', () => {
    let testEnv: TestWorkflowEnvironment;

    before(async () => {
      testEnv = await TestWorkflowEnvironment.createLocal();
    });

    after(async () => {
      await testEnv?.teardown();
    });

    it('successfully completes the Workflow', async () => {
      const { client, nativeConnection } = testEnv;
      const taskQueue = 'test';

      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities: activities.createActivities(client),
      });

      const result = await worker.runUntil(
        client.workflow.execute(example, {
          args: ['Temporal'],
          workflowId: 'test',
          taskQueue,
        })
      );
      assert.equal(result, 'Hello, Temporal!');
    });
  });

  describe('filterPeople', () => {
    let testEnv: TestWorkflowEnvironment;

    before(async () => {
      testEnv = await TestWorkflowEnvironment.createLocal();
    });

    after(async () => {
      await testEnv?.teardown();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('successfully completes the Workflow and returns filtered people', async () => {
      const { client, nativeConnection } = testEnv;
      const taskQueue = 'test';

      sinon.stub(axios, 'get').resolves({ data: getSwApiResponse() });

      const worker = await Worker.create({
        connection: nativeConnection,
        taskQueue,
        workflowsPath: require.resolve('../workflows'),
        activities: activities.createActivities(client),
      });

      const result = await worker.runUntil(
        client.workflow.execute(filterPeople, {
          args: [
            'https://test.api',
            [
              {
                propertyName: 'name',
                operator: 'matches_regex',
                value: '\\d',
              },
              {
                propertyName: 'eye_color',
                operator: 'equals',
                value: 'red',
              },
            ],
          ],
          workflowId: 'test',
          taskQueue,
        })
      );
      assert.deepStrictEqual(result, getSwApiResponse().results.slice(2));
    });

    function getSwApiResponse() {
      return {
        next: null,
        results: [
          {
            name: 'filtered out 1',
            eye_color: 'blue',
          },
          {
            name: 'also filtered out',
            eye_color: 'red',
          },
          {
            name: 'matching 1',
            eye_color: 'red',
          },
          {
            name: 'matching 2',
            eye_color: 'red',
          },
        ],
      };
    }
  });
});
