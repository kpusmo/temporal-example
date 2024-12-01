# Temporal workflow

This project presents a simple workflow utilizing [Temproal](https://docs.temporal.io/workflows#workflow-execution).
It is built based on [Hello World Tutorial](https://learn.temporal.io/getting_started/typescript/hello_world_in_typescript/).
Hello world code is kept in the project, on top of it new workflows `getPeople` and `filterPeople` are added, which use newly created activities.

## Filter people workflow

Filter people workflow fetches all people from [SW API](https://swapi.dev/), then filters this list based on the filtering rules
provided to workflow (hard coded in `client.ts`). For fetching, it uses a child workflow, `getPeople`, of which a single
instance is spawned and then runs infinitely. This way, the data from the external API is only fetched once.

It is assumed that the data returned from SW API does not change. If we'd expect it changes, we could modify get people 
workflow so it fetches data e.g. once per day.

Reusing once fetched data speeds up consecutive executions of the `filterPeople` workflow, which can be observed
in logs, e.g.

```bash
[filterPeople(workflow-9gAH8H10MzdU9wXve8AGl)] elapsed time 3078
[filterPeople(workflow-moYdIzXsw-Etgyl5DXmAa)] elapsed time 1022
[filterPeople(workflow-6ivSDMkxdAfDNcYWA9E2H)] elapsed time 1024
```

## Filters

You can provide multiple filters, which are combined using `AND` or `OR` operator. Filters can be nested.
Provided filters must meet the `Filter` interface:
```ts
export interface Filter<Entity> {
  condition: Condition;
  rules: SearchRule<Entity>[] | Filter<Entity>[];
}

export interface SearchRule<Entity> {
  propertyName: keyof Entity;
  operator: 'equals' | 'matches_regex';
  value: SearchableTypes;
}
```

If `matches_regex` is used, `value` **must** be a string, which can be compiled into 
[`RegExp` object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp).
Furthermore, in this case type of the `Entity`'s field provided in `propertyName` must be string. If those conditions are
not met, [ApplicationFailure](https://typescript.temporal.io/api/classes/common.ApplicationFailure) is thrown and 
execution fails (without retry).

More filter operators may be added in the future by extending `SearchRule<Entity>.operator` type and `filterPeople`
implementation in `activities.ts`. Similarly, `SearchableTypes` (currently `string | number`) may be extended.

# Prerequisites

- [Local env of Temporal](https://learn.temporal.io/getting_started/typescript/dev_environment/)

# Running application

1. `temporal server start-dev` to start [Temporal Server](https://github.com/temporalio/cli/#installation).
1. `npm install` to install dependencies.
1. `npm run start.watch` to start the Worker.
1. In another shell, `npm run workflow` to run the Workflow Client.

The Workflow should return list of people matching filters:
- number in `name` or red `eye_color`, AND
- name containing `x` or `y`.

You can play with filters in `client.ts`.

```ts
[
  {
    name: 'Nute Gunray',
    height: '191',
    mass: '90',
    hair_color: 'none',
    skin_color: 'mottled green',
    eye_color: 'red',
    birth_year: 'unknown',
    gender: 'male',
    homeworld: 'https://swapi.dev/api/planets/18/',
    films: [
      'https://swapi.dev/api/films/4/',
      'https://swapi.dev/api/films/5/',
      'https://swapi.dev/api/films/6/'
    ],
    species: [ 'https://swapi.dev/api/species/11/' ],
    vehicles: [],
    starships: [],
    created: '2014-12-19T17:05:57.357000Z',
    edited: '2014-12-20T21:17:50.377000Z',
    url: 'https://swapi.dev/api/people/33/'
  }
]
```

# Tests

Defined in `src/mocha`.

```bash
npm run test
```