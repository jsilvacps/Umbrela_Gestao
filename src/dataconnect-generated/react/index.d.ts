import { GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables, CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables, MarkReminderAsSentData, MarkReminderAsSentVariables, GetAllSubscriptionTypesData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useGetUserActiveSubscriptions(vars: GetUserActiveSubscriptionsVariables, options?: useDataConnectQueryOptions<GetUserActiveSubscriptionsData>): UseDataConnectQueryResult<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;
export function useGetUserActiveSubscriptions(dc: DataConnect, vars: GetUserActiveSubscriptionsVariables, options?: useDataConnectQueryOptions<GetUserActiveSubscriptionsData>): UseDataConnectQueryResult<GetUserActiveSubscriptionsData, GetUserActiveSubscriptionsVariables>;

export function useCreateReminderForUserSubscription(options?: useDataConnectMutationOptions<CreateReminderForUserSubscriptionData, FirebaseError, CreateReminderForUserSubscriptionVariables>): UseDataConnectMutationResult<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;
export function useCreateReminderForUserSubscription(dc: DataConnect, options?: useDataConnectMutationOptions<CreateReminderForUserSubscriptionData, FirebaseError, CreateReminderForUserSubscriptionVariables>): UseDataConnectMutationResult<CreateReminderForUserSubscriptionData, CreateReminderForUserSubscriptionVariables>;

export function useMarkReminderAsSent(options?: useDataConnectMutationOptions<MarkReminderAsSentData, FirebaseError, MarkReminderAsSentVariables>): UseDataConnectMutationResult<MarkReminderAsSentData, MarkReminderAsSentVariables>;
export function useMarkReminderAsSent(dc: DataConnect, options?: useDataConnectMutationOptions<MarkReminderAsSentData, FirebaseError, MarkReminderAsSentVariables>): UseDataConnectMutationResult<MarkReminderAsSentData, MarkReminderAsSentVariables>;

export function useGetAllSubscriptionTypes(options?: useDataConnectQueryOptions<GetAllSubscriptionTypesData>): UseDataConnectQueryResult<GetAllSubscriptionTypesData, undefined>;
export function useGetAllSubscriptionTypes(dc: DataConnect, options?: useDataConnectQueryOptions<GetAllSubscriptionTypesData>): UseDataConnectQueryResult<GetAllSubscriptionTypesData, undefined>;
