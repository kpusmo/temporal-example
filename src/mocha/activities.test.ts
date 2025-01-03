import { MockActivityEnvironment, TestWorkflowEnvironment } from '@temporalio/testing';
import { before, describe, it } from 'mocha';
import * as activities from '../activities';
import assert from 'assert';
import sinon from 'sinon';
import { Filter, SwPerson } from '../types';
import axios from 'axios';
import { Client } from '@temporalio/client';

describe('activity', async () => {
  let testEnv: TestWorkflowEnvironment;
  let client: Client;

  before(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
    client = testEnv.client;
  });

  after(async () => {
    await testEnv?.teardown();
  });

  describe('greet', () => {
    it('successfully greets the user', async () => {
      const env = new MockActivityEnvironment();
      const name = 'Temporal';
      const result = await env.run(activities.createActivities(client).greet, name);
      assert.equal(result, 'Hello, Temporal!');
    });
  });

  describe('fetchPeople', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('successfully fetches people from multiple pages', async () => {
      sinon
        .stub(axios, 'get')
        .onCall(0)
        .resolves({ data: getSwApiResponse(0, 'https://test.api/people?page=2') })
        .onCall(1)
        .resolves({ data: getSwApiResponse(1, null) });

      const env = new MockActivityEnvironment();
      const result = await env.run(activities.createActivities(client).fetchPeople, 'https://test.api/people');

      assert.deepStrictEqual(result, [getSwPerson(0), getSwPerson(1), getSwPerson(2), getSwPerson(3)]);
    });

    function getSwApiResponse(i: number, next: string | null) {
      return {
        next,
        results: [getSwPerson(2 * i), getSwPerson(2 * i + 1)],
      };
    }
  });

  describe('filterPeople', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('filters input based on provided AND filter', async () => {
      const people = [
        getSwPerson({
          name: 'filtered out 1',
          eye_color: 'blue',
        }),
        getSwPerson({
          name: 'also filtered out',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matching 1',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matching 2',
          eye_color: 'red',
        }),
      ];
      const rules: Filter<SwPerson> = {
        condition: 'AND',
        rules: [
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
      };

      const env = new MockActivityEnvironment();
      const result = await env.run(activities.createActivities(client).performFiltering, people, rules);

      assert.deepStrictEqual(result, people.slice(2));
    });

    it('filters input based on provided OR filter', async () => {
      const people = [
        getSwPerson({
          name: 'matching 1',
          eye_color: 'blue',
        }),
        getSwPerson({
          name: 'filtered out',
          eye_color: 'blue',
        }),
        getSwPerson({
          name: 'matching two',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matching three',
          eye_color: 'red',
        }),
      ];
      const rules: Filter<SwPerson> = {
        condition: 'OR',
        rules: [
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
      };

      const env = new MockActivityEnvironment();
      const result = await env.run(activities.createActivities(client).performFiltering, people, rules);

      assert.deepStrictEqual(result, [people[0], ...people.slice(2)]);
    });

    it('filters input based on provided nested filters', async () => {
      const people = [
        getSwPerson({
          name: 'filtered out 1',
          eye_color: 'blue',
        }),
        getSwPerson({
          name: 'filtered out',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matching 1',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matching 2',
          eye_color: 'red',
        }),
        getSwPerson({
          name: 'matchingx',
          eye_color: 'green',
        }),
        getSwPerson({
          name: 'yyyy matching',
          eye_color: 'green',
        }),
        getSwPerson({
          name: 'matchix',
          eye_color: 'red',
        }),
      ];
      const rules: Filter<SwPerson> = {
        condition: 'OR',
        rules: [
          {
            condition: 'AND',
            rules: [
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
          },
          {
            condition: 'OR',
            rules: [
              {
                propertyName: 'name',
                operator: 'matches_regex',
                value: 'x',
              },
              {
                propertyName: 'name',
                operator: 'matches_regex',
                value: 'y',
              },
            ],
          },
        ],
      };

      const env = new MockActivityEnvironment();
      const result = (await env.run(activities.createActivities(client).performFiltering, people, rules)) as SwPerson[];

      const sorter = (a: SwPerson, b: SwPerson) => a.name.localeCompare(b.name);
      assert.deepStrictEqual(result.toSorted(sorter), people.slice(2).toSorted(sorter));
    });
  });

  function getSwPerson(person: Partial<SwPerson> | number): SwPerson {
    const name = typeof person === 'number' ? `name ${person}` : person?.name ?? 'name';
    return {
      name,
      created: 'created',
      birth_year: 'birth_year',
      edited: 'edited',
      films: ['film'],
      gender: 'gender',
      hair_color: 'hair_color',
      height: 'height',
      homeworld: 'homeworld',
      mass: 'mass',
      skin_color: 'skin_color',
      species: ['name'],
      starships: ['name'],
      url: 'url',
      vehicles: ['name'],
      eye_color: 'eye_color',
      ...(typeof person === 'object' ? person : undefined),
    };
  }
});
