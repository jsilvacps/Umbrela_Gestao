# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUserActiveSubscriptions*](#getuseractivesubscriptions)
  - [*GetAllSubscriptionTypes*](#getallsubscriptiontypes)
- [**Mutations**](#mutations)
  - [*CreateReminderForUserSubscription*](#createreminderforusersubscription)
  - [*MarkReminderAsSent*](#markreminderassent)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetUserActiveSubscriptions
You can execute the `GetUserActiveSubscriptions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserActiveSubscriptions(vars: GetUserActiveSubscriptionsVariables): QueryPromise<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;

interface GetUserActiveSubscriptionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserActiveSubscriptionsVariables): QueryRef<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
}
export const getUserActiveSubscriptionsRef: GetUserActiveSubscriptionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserActiveSubscriptions(dc: DataConnect, vars: GetUserActiveSubscriptionsVariables): QueryPromise<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;

interface GetUserActiveSubscriptionsRef {
  ...
  (dc: DataConnect, vars: GetUserActiveSubscriptionsVariables): QueryRef<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
}
export const getUserActiveSubscriptionsRef: GetUserActiveSubscriptionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserActiveSubscriptionsRef:
```typescript
const name = getUserActiveSubscriptionsRef.operationName;
console.log(name);
```

### Variables
The `GetUserActiveSubscriptions` query requires an argument of type `GetUserActiveSubscriptionsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserActiveSubscriptionsVariables {
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `GetUserActiveSubscriptions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserActiveSubscriptionsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserActiveSubscriptionsData {
  userSubscriptions: ({
    id: UUIDString;
    name: string;
    cost: number;
    billingCycle: string;
    renewalDate: DateString;
    subscriptionType?: {
      name: string;
      description?: string | null;
    };
      reminders_on_userSubscription: ({
        id: UUIDString;
        message: string;
        reminderDate: DateString;
      } & Reminder_Key)[];
  } & UserSubscription_Key)[];
}
```
### Using `GetUserActiveSubscriptions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserActiveSubscriptions, GetUserActiveSubscriptionsVariables } from '@dataconnect/generated';

// The `GetUserActiveSubscriptions` query requires an argument of type `GetUserActiveSubscriptionsVariables`:
const getUserActiveSubscriptionsVars: GetUserActiveSubscriptionsVariables = {
  userId: ..., 
};

// Call the `getUserActiveSubscriptions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserActiveSubscriptions(getUserActiveSubscriptionsVars);
// Variables can be defined inline as well.
const { data } = await getUserActiveSubscriptions({ userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserActiveSubscriptions(dataConnect, getUserActiveSubscriptionsVars);

console.log(data.userSubscriptions);

// Or, you can use the `Promise` API.
getUserActiveSubscriptions(getUserActiveSubscriptionsVars).then((response) => {
  const data = response.data;
  console.log(data.userSubscriptions);
});
```

### Using `GetUserActiveSubscriptions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserActiveSubscriptionsRef, GetUserActiveSubscriptionsVariables } from '@dataconnect/generated';

// The `GetUserActiveSubscriptions` query requires an argument of type `GetUserActiveSubscriptionsVariables`:
const getUserActiveSubscriptionsVars: GetUserActiveSubscriptionsVariables = {
  userId: ..., 
};

// Call the `getUserActiveSubscriptionsRef()` function to get a reference to the query.
const ref = getUserActiveSubscriptionsRef(getUserActiveSubscriptionsVars);
// Variables can be defined inline as well.
const ref = getUserActiveSubscriptionsRef({ userId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserActiveSubscriptionsRef(dataConnect, getUserActiveSubscriptionsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.userSubscriptions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.userSubscriptions);
});
```

## GetAllSubscriptionTypes
You can execute the `GetAllSubscriptionTypes` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getAllSubscriptionTypes(): QueryPromise<GetAllSubscriptionTypesData, undefined>;

interface GetAllSubscriptionTypesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllSubscriptionTypesData, undefined>;
}
export const getAllSubscriptionTypesRef: GetAllSubscriptionTypesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getAllSubscriptionTypes(dc: DataConnect): QueryPromise<GetAllSubscriptionTypesData, undefined>;

interface GetAllSubscriptionTypesRef {
  ...
  (dc: DataConnect): QueryRef<GetAllSubscriptionTypesData, undefined>;
}
export const getAllSubscriptionTypesRef: GetAllSubscriptionTypesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getAllSubscriptionTypesRef:
```typescript
const name = getAllSubscriptionTypesRef.operationName;
console.log(name);
```

### Variables
The `GetAllSubscriptionTypes` query has no variables.
### Return Type
Recall that executing the `GetAllSubscriptionTypes` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetAllSubscriptionTypesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetAllSubscriptionTypesData {
  subscriptionTypes: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & SubscriptionType_Key)[];
}
```
### Using `GetAllSubscriptionTypes`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getAllSubscriptionTypes } from '@dataconnect/generated';


// Call the `getAllSubscriptionTypes()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getAllSubscriptionTypes();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getAllSubscriptionTypes(dataConnect);

console.log(data.subscriptionTypes);

// Or, you can use the `Promise` API.
getAllSubscriptionTypes().then((response) => {
  const data = response.data;
  console.log(data.subscriptionTypes);
});
```

### Using `GetAllSubscriptionTypes`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getAllSubscriptionTypesRef } from '@dataconnect/generated';


// Call the `getAllSubscriptionTypesRef()` function to get a reference to the query.
const ref = getAllSubscriptionTypesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getAllSubscriptionTypesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.subscriptionTypes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.subscriptionTypes);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateReminderForUserSubscription
You can execute the `CreateReminderForUserSubscription` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createReminderForUserSubscription(vars: CreateReminderForUserSubscriptionVariables): MutationPromise<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;

interface CreateReminderForUserSubscriptionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateReminderForUserSubscriptionVariables): MutationRef<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
}
export const createReminderForUserSubscriptionRef: CreateReminderForUserSubscriptionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createReminderForUserSubscription(dc: DataConnect, vars: CreateReminderForUserSubscriptionVariables): MutationPromise<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;

interface CreateReminderForUserSubscriptionRef {
  ...
  (dc: DataConnect, vars: CreateReminderForUserSubscriptionVariables): MutationRef<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
}
export const createReminderForUserSubscriptionRef: CreateReminderForUserSubscriptionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createReminderForUserSubscriptionRef:
```typescript
const name = createReminderForUserSubscriptionRef.operationName;
console.log(name);
```

### Variables
The `CreateReminderForUserSubscription` mutation requires an argument of type `CreateReminderForUserSubscriptionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateReminderForUserSubscriptionVariables {
  userSubscriptionId: UUIDString;
  message: string;
  reminderDate: DateString;
}
```
### Return Type
Recall that executing the `CreateReminderForUserSubscription` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateReminderForUserSubscriptionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateReminderForUserSubscriptionData {
  reminder_insert: Reminder_Key;
}
```
### Using `CreateReminderForUserSubscription`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createReminderForUserSubscription, CreateReminderForUserSubscriptionVariables } from '@dataconnect/generated';

// The `CreateReminderForUserSubscription` mutation requires an argument of type `CreateReminderForUserSubscriptionVariables`:
const createReminderForUserSubscriptionVars: CreateReminderForUserSubscriptionVariables = {
  userSubscriptionId: ..., 
  message: ..., 
  reminderDate: ..., 
};

// Call the `createReminderForUserSubscription()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createReminderForUserSubscription(createReminderForUserSubscriptionVars);
// Variables can be defined inline as well.
const { data } = await createReminderForUserSubscription({ userSubscriptionId: ..., message: ..., reminderDate: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createReminderForUserSubscription(dataConnect, createReminderForUserSubscriptionVars);

console.log(data.reminder_insert);

// Or, you can use the `Promise` API.
createReminderForUserSubscription(createReminderForUserSubscriptionVars).then((response) => {
  const data = response.data;
  console.log(data.reminder_insert);
});
```

### Using `CreateReminderForUserSubscription`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createReminderForUserSubscriptionRef, CreateReminderForUserSubscriptionVariables } from '@dataconnect/generated';

// The `CreateReminderForUserSubscription` mutation requires an argument of type `CreateReminderForUserSubscriptionVariables`:
const createReminderForUserSubscriptionVars: CreateReminderForUserSubscriptionVariables = {
  userSubscriptionId: ..., 
  message: ..., 
  reminderDate: ..., 
};

// Call the `createReminderForUserSubscriptionRef()` function to get a reference to the mutation.
const ref = createReminderForUserSubscriptionRef(createReminderForUserSubscriptionVars);
// Variables can be defined inline as well.
const ref = createReminderForUserSubscriptionRef({ userSubscriptionId: ..., message: ..., reminderDate: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createReminderForUserSubscriptionRef(dataConnect, createReminderForUserSubscriptionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.reminder_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.reminder_insert);
});
```

## MarkReminderAsSent
You can execute the `MarkReminderAsSent` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
markReminderAsSent(vars: MarkReminderAsSentVariables): MutationPromise<MarkReminderAsSentData, MarkReminderAsSentVariables>;

interface MarkReminderAsSentRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkReminderAsSentVariables): MutationRef<MarkReminderAsSentData, MarkReminderAsSentVariables>;
}
export const markReminderAsSentRef: MarkReminderAsSentRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
markReminderAsSent(dc: DataConnect, vars: MarkReminderAsSentVariables): MutationPromise<MarkReminderAsSentData, MarkReminderAsSentVariables>;

interface MarkReminderAsSentRef {
  ...
  (dc: DataConnect, vars: MarkReminderAsSentVariables): MutationRef<MarkReminderAsSentData, MarkReminderAsSentVariables>;
}
export const markReminderAsSentRef: MarkReminderAsSentRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the markReminderAsSentRef:
```typescript
const name = markReminderAsSentRef.operationName;
console.log(name);
```

### Variables
The `MarkReminderAsSent` mutation requires an argument of type `MarkReminderAsSentVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MarkReminderAsSentVariables {
  reminderId: UUIDString;
}
```
### Return Type
Recall that executing the `MarkReminderAsSent` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MarkReminderAsSentData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MarkReminderAsSentData {
  reminder_update?: Reminder_Key | null;
}
```
### Using `MarkReminderAsSent`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, markReminderAsSent, MarkReminderAsSentVariables } from '@dataconnect/generated';

// The `MarkReminderAsSent` mutation requires an argument of type `MarkReminderAsSentVariables`:
const markReminderAsSentVars: MarkReminderAsSentVariables = {
  reminderId: ..., 
};

// Call the `markReminderAsSent()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await markReminderAsSent(markReminderAsSentVars);
// Variables can be defined inline as well.
const { data } = await markReminderAsSent({ reminderId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await markReminderAsSent(dataConnect, markReminderAsSentVars);

console.log(data.reminder_update);

// Or, you can use the `Promise` API.
markReminderAsSent(markReminderAsSentVars).then((response) => {
  const data = response.data;
  console.log(data.reminder_update);
});
```

### Using `MarkReminderAsSent`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, markReminderAsSentRef, MarkReminderAsSentVariables } from '@dataconnect/generated';

// The `MarkReminderAsSent` mutation requires an argument of type `MarkReminderAsSentVariables`:
const markReminderAsSentVars: MarkReminderAsSentVariables = {
  reminderId: ..., 
};

// Call the `markReminderAsSentRef()` function to get a reference to the mutation.
const ref = markReminderAsSentRef(markReminderAsSentVars);
// Variables can be defined inline as well.
const ref = markReminderAsSentRef({ reminderId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = markReminderAsSentRef(dataConnect, markReminderAsSentVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.reminder_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.reminder_update);
});
```

