import { proxyActivities } from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';
import { SearchRule, SwPerson } from './types';

const { greet, fetchPeople, filterPeople } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/** A workflow that simply calls an activity */
export async function example(name: string): Promise<string> {
  return await greet(name);
}

export async function people(swApiUrl: string, rules: SearchRule<SwPerson>[]): Promise<SwPerson[]> {
  const allPeople = await fetchPeople(swApiUrl);
  const filteredPeople = await filterPeople(allPeople, rules);
  return filteredPeople;
}
