import { defineSignal } from '@temporalio/workflow';

export interface SwPerson {
  // based on https://swapi.dev/documentation#people
  name: string;
  birth_year: string;
  eye_color: string;
  gender: string;
  hair_color: string;
  height: string;
  mass: string;
  skin_color: string;
  homeworld: string;
  films: string[];
  species: string[];
  starships: string[];
  vehicles: string[];
  url: string;
  created: string;
  edited: string;
}

// those two types may be extended (extending `filterPeople` activity may be required)
type SearchableTypes = string | number;
type SearchOperator = 'equals' | 'matches_regex';

export interface SearchRule<Entity> {
  propertyName: keyof Entity;
  operator: SearchOperator;
  value: SearchableTypes;
}

export interface SearchRules<Entity> {
  condition: Condition;
  rules: SearchRule<Entity>[];
}

export type Condition = 'OR' | 'AND';

export interface GetPeopleRequest {
  rules: SearchRules<SwPerson>;
  initiatorId: string;
}

export const getPeopleSignal = defineSignal<[GetPeopleRequest]>('get-people-signal');

export const sendPeopleSignal = defineSignal<[SwPerson[]]>('send-people-signal');