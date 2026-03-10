const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'horti-gestao-limpo',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const getUserActiveSubscriptionsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUserActiveSubscriptions', inputVars);
}
getUserActiveSubscriptionsRef.operationName = 'GetUserActiveSubscriptions';
exports.getUserActiveSubscriptionsRef = getUserActiveSubscriptionsRef;

exports.getUserActiveSubscriptions = function getUserActiveSubscriptions(dcOrVars, vars) {
  return executeQuery(getUserActiveSubscriptionsRef(dcOrVars, vars));
};

const createReminderForUserSubscriptionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateReminderForUserSubscription', inputVars);
}
createReminderForUserSubscriptionRef.operationName = 'CreateReminderForUserSubscription';
exports.createReminderForUserSubscriptionRef = createReminderForUserSubscriptionRef;

exports.createReminderForUserSubscription = function createReminderForUserSubscription(dcOrVars, vars) {
  return executeMutation(createReminderForUserSubscriptionRef(dcOrVars, vars));
};

const markReminderAsSentRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'MarkReminderAsSent', inputVars);
}
markReminderAsSentRef.operationName = 'MarkReminderAsSent';
exports.markReminderAsSentRef = markReminderAsSentRef;

exports.markReminderAsSent = function markReminderAsSent(dcOrVars, vars) {
  return executeMutation(markReminderAsSentRef(dcOrVars, vars));
};

const getAllSubscriptionTypesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetAllSubscriptionTypes');
}
getAllSubscriptionTypesRef.operationName = 'GetAllSubscriptionTypes';
exports.getAllSubscriptionTypesRef = getAllSubscriptionTypesRef;

exports.getAllSubscriptionTypes = function getAllSubscriptionTypes(dc) {
  return executeQuery(getAllSubscriptionTypesRef(dc));
};
