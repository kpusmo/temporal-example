import { SearchRule, SwPerson } from './types';
import axios, { AxiosResponse } from 'axios';
import { ApplicationFailure } from '@temporalio/client';

export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

interface SwResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SwPerson[];
}

export async function fetchPeople(swApiUrl: string): Promise<SwPerson[]> {
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
}

export async function filterPeople(people: SwPerson[], rules: SearchRule<SwPerson>[]): Promise<SwPerson[]> {
  return rules.reduce(
    (filteredPeople, rule) =>
      filteredPeople.filter((person) => {
        switch (rule.operator) {
          case 'equals':
            return person[rule.propertyName] === rule.value;
          case 'matches_regex':
            validateRegexRule(rule, person);
            return new RegExp(rule.value as string).test(person[rule.propertyName] as string);
        }
      }),
    people
  );
}

function validateRegexRule<Entity>(rule: SearchRule<Entity>, entity: Entity): void {
  if (!(typeof rule.value === 'string' && typeof entity[rule.propertyName] === 'string')) {
    // no secrets in our use case, can safely print debug info
    console.error('invalid rule', rule, entity[rule.propertyName]);
    throw new ApplicationFailure('Invalid filtering rule', null, true, [rule, entity[rule.propertyName]]);
  }
}
