import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateReminderForUserSubscriptionData {
  reminder_insert: Reminder_Key;
}

export interface CreateReminderForUserSubscriptionVariables {
  userSubscriptionId: UUIDString;
  message: string;
  reminderDate: DateString;
}

export interface GetAllSubscriptionTypesData {
  subscriptionTypes: ({
    id: UUIDString;
    name: string;
    description?: string | null;
  } & SubscriptionType_Key)[];
}

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

export interface GetUserActiveSubscriptionsVariables {
  userId: UUIDString;
}

export interface MarkReminderAsSentData {
  reminder_update?: Reminder_Key | null;
}

export interface MarkReminderAsSentVariables {
  reminderId: UUIDString;
}

export interface Reminder_Key {
  id: UUIDString;
  __typename?: 'Reminder_Key';
}

export interface SubscriptionType_Key {
  id: UUIDString;
  __typename?: 'SubscriptionType_Key';
}

export interface UserSubscription_Key {
  id: UUIDString;
  __typename?: 'UserSubscription_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface GetUserActiveSubscriptionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserActiveSubscriptionsVariables): QueryRef<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserActiveSubscriptionsVariables): QueryRef<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
  operationName: string;
}
export const getUserActiveSubscriptionsRef: GetUserActiveSubscriptionsRef;

export function getUserActiveSubscriptions(vars: GetUserActiveSubscriptionsVariables): QueryPromise<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
export function getUserActiveSubscriptions(dc: DataConnect, vars: GetUserActiveSubscriptionsVariables): QueryPromise<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;

interface CreateReminderForUserSubscriptionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateReminderForUserSubscriptionVariables): MutationRef<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateReminderForUserSubscriptionVariables): MutationRef<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
  operationName: string;
}
export const createReminderForUserSubscriptionRef: CreateReminderForUserSubscriptionRef;

export function createReminderForUserSubscription(vars: CreateReminderForUserSubscriptionVariables): MutationPromise<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
export function createReminderForUserSubscription(dc: DataConnect, vars: CreateReminderForUserSubscriptionVariables): MutationPromise<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;

interface MarkReminderAsSentRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MarkReminderAsSentVariables): MutationRef<MarkReminderAsSentData, MarkReminderAsSentVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MarkReminderAsSentVariables): MutationRef<MarkReminderAsSentData, MarkReminderAsSentVariables>;
  operationName: string;
}
export const markReminderAsSentRef: MarkReminderAsSentRef;

export function markReminderAsSent(vars: MarkReminderAsSentVariables): MutationPromise<MarkReminderAsSentData, MarkReminderAsSentVariables>;
export function markReminderAsSent(dc: DataConnect, vars: MarkReminderAsSentVariables): MutationPromise<MarkReminderAsSentData, MarkReminderAsSentVariables>;

interface GetAllSubscriptionTypesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetAllSubscriptionTypesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetAllSubscriptionTypesData, undefined>;
  operationName: string;
}
export const getAllSubscriptionTypesRef: GetAllSubscriptionTypesRef;

export function getAllSubscriptionTypes(): QueryPromise<GetAllSubscriptionTypesData, undefined>;
export function getAllSubscriptionTypes(dc: DataConnect): QueryPromise<GetAllSubscriptionTypesData, undefined>;

