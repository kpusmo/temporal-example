import {
  continueAsNew,
  getExternalWorkflowHandle,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';
import { getPeopleSignal, SearchRule, sendPeopleSignal, SwPerson } from './types';

const { greet, fetchPeople, fetchAndFilterPeople, performFiltering } = proxyActivities<
  ReturnType<(typeof activities)['createActivities']>
>({
  startToCloseTimeout: '1 minute',
});

/** A workflow that simply calls an activity */
export async function example(name: string): Promise<string> {
  return await greet(name);
}

export async function getPeople(swApiUrl: string, carriedPeople?: SwPerson[]): Promise<void> {
  // we do not expect sw api response to change, hence data is only fetched once
  // if we expected data to mutate, we could fetch it e.g. once per day in a while loop below (with sleep adequately modified)
  const allPeople = carriedPeople ?? (await fetchPeople(swApiUrl));

  setHandler(getPeopleSignal, async ({ rules, initiatorId }) => {
    const filteredPeople = await performFiltering(allPeople, rules);
    const workflowInitiatingSignal = getExternalWorkflowHandle(initiatorId);
    await workflowInitiatingSignal.signal(sendPeopleSignal, filteredPeople);
  });

  while (!workflowInfo().continueAsNewSuggested) {
    // once this workflow is created, it runs forever (keeping once fetched data), once in a while continued as new
    await sleep(1_000);
  }

  await continueAsNew(swApiUrl, allPeople);
}

export async function filterPeople(swApiUrl: string, rules: SearchRule<SwPerson>[]): Promise<SwPerson[]> {
  const start = new Date();

  let results: SwPerson[] | undefined = undefined;
  setHandler(sendPeopleSignal, (filteredPeople) => {
    results = filteredPeople;
  });
  await fetchAndFilterPeople(swApiUrl, rules);

  while (results === undefined) {
    await sleep(10);
  }
  console.log('elapsed time', new Date().getTime() - start.getTime());
  return results;
}
