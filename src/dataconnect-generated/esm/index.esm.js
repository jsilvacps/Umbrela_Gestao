import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'horti-gestao-limpo',
  location: 'us-east4'
};

export const getUserActiveSubscriptionsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserActiveSubscriptions', inputVars);
}
getUserActiveSubscriptionsRef.operationName = 'GetUserActiveSubscriptions';

export function getUserActiveSubscriptions(dcOrVars, vars) {
  return executeQuery(getUserActiveSubscriptionsRef(dcOrVars, vars));
}

export const createReminderForUserSubscriptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateReminderForUserSubscription', inputVars);
}
createReminderForUserSubscriptionRef.operationName = 'CreateReminderForUserSubscription';

export function createReminderForUserSubscription(dcOrVars, vars) {
  return executeMutation(createReminderForUserSubscriptionRef(dcOrVars, vars));
}

export const markReminderAsSentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkReminderAsSent', inputVars);
}
markReminderAsSentRef.operationName = 'MarkReminderAsSent';

export function markReminderAsSent(dcOrVars, vars) {
  return executeMutation(markReminderAsSentRef(dcOrVars, vars));
}

export const getAllSubscriptionTypesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllSubscriptionTypes');
}
getAllSubscriptionTypesRef.operationName = 'GetAllSubscriptionTypes';

export function getAllSubscriptionTypes(dc) {
  return executeQuery(getAllSubscriptionTypesRef(dc));
}

