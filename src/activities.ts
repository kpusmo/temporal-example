import { GetPeopleRequest, getPeopleSignal, SearchRule, Filter, SwPerson } from './types';
import axios, { AxiosResponse } from 'axios';
import { ApplicationFailure, Client } from '@temporalio/client';
import { activityInfo } from '@temporalio/activity';
import { Rule } from 'eslint';

interface SwResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SwPerson[];
}

export function createActivities(client: Client) {
  return {
    async greet(name: string): Promise<string> {
      return `Hello, ${name}!`;
    },

    async fetchPeople(swApiUrl: string): Promise<SwPerson[]> {
      const fetchPage = (pageUrl: string) => axios.get(pageUrl);
      const processPage = async ({ data: pageResult }: AxiosResponse<SwResponse>): Promise<SwPerson[]> => {
        // loading everything to memory with recursive calls
        // there are 82 items in SW api, so that's ok, but with more data we should persist it to some external storage instead
        // (and refactor to iterative manner)
        if (pageResult.next) {
          return [...pageResult.results, ...(await fetchPage(pageResult.next).then(processPage))];
        }
        return pageResult.results;
      };
      const results = await fetchPage(`${swApiUrl}/people`).then(processPage);
      return results;
    },

    performFiltering: async function performFiltering(people: SwPerson[], filters: Filter<SwPerson>): Promise<SwPerson[]> {
      if (isNestedFilter(filters.rules)) {
        const filteredSets = await Promise.all(filters.rules.map(
          async (nestedFilter) => new Set(await performFiltering(people, nestedFilter)))
        );
        const resultSet = filteredSets.reduce(
          (acc, chunk) =>
            acc[filters.condition === 'AND' ? 'intersection' : 'union'](new Set(chunk)),
        );
        return Array.from(resultSet);
      }
      if (filters.condition === 'AND') {
        return filterWithAnd(people, filters.rules);
      }
      if (filters.condition === 'OR') {
        return filterWithOr(people, filters.rules);
      }
      return [];
    },

    async fetchAndFilterPeople(swApiUrl: string, filters: Filter<SwPerson>): Promise<void> {
      const request: GetPeopleRequest = {
        filters,
        initiatorId: activityInfo().workflowExecution.workflowId,
      };
      await client.workflow.signalWithStart('getPeople', {
        taskQueue: activityInfo().taskQueue,
        args: [swApiUrl],
        workflowId: `get-people`,
        signal: getPeopleSignal,
        signalArgs: [request],
      });
    },
  };
}

function filterWithAnd(people: SwPerson[], rules: SearchRule<SwPerson>[]): SwPerson[] {
  return rules.reduce(
    (filteredPeople, rule) =>
      filteredPeople.filter(applyRule(rule)),
    people
  );
}

function filterWithOr(people: SwPerson[], rules: SearchRule<SwPerson>[]): SwPerson[] {
  return rules.reduce(
    (filteredPeople, rule) => {
      return [
        ...filteredPeople,
        ...people.filter(applyRule(rule)),
      ]
    },
    [] as SwPerson[],
  )
}

const applyRule = (rule: SearchRule<SwPerson>) => (person: SwPerson): boolean => {
  switch (rule.operator) {
    case 'equals':
      return person[rule.propertyName] === rule.value;
    case 'matches_regex':
      validateRegexRule(rule, person);
      return new RegExp(rule.value as string).test(person[rule.propertyName] as string);
  }
}

function validateRegexRule<Entity>(rule: SearchRule<Entity>, entity: Entity): void {
  if (!(typeof rule.value === 'string' && typeof entity[rule.propertyName] === 'string')) {
    // no secrets in our use case, can safely print debug info
    console.error('invalid rule', rule, entity[rule.propertyName]);
    throw new ApplicationFailure('Invalid filtering rule', null, true, [rule, entity[rule.propertyName]]);
  }
}

function isNestedFilter<Entity>(rules: Filter<Entity>['rules']): rules is Filter<Entity>[] {
  return rules.length > 0 && (rules[0] as Filter<Entity>).condition !== undefined;
}
