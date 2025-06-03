/* eslint-disable max-len */
const objectPath = require('object-path');

/**
 * Validates a set of rules against a JSON document.
 * @param {object} documentJson The JSON document to validate.
 * @param {Array<object>} rules The array of rules to validate.
 * @return {Array<object>} An array of objects containing the IDs
 * and types of the rules that passed validation, along with their contexts.
 */
const validateRules = (documentJson, rules) => {
  const results = [];
  const validRulesByDate = filterRulesByDate(rules);

  validRulesByDate.forEach((rule) => {
    try {
      const loops = [];
      rule.conditionResultContext = [];

      processConditionsForLoops(rule, loops);

      const sortedLoops = sortLoopsByPath(loops);
      if (!validateArrayReferences(sortedLoops, rule)) return;

      rule.contexts = explodeContexts(documentJson, rule.conditions, loops, []);
      if (rule.contexts.length === 0) {
        rule.conditionsResult = evaluateSimpleConditions(documentJson, rule.conditions);
      } else {
        rule.conditionResultContext = evaluateConditionsInContexts(documentJson, rule, loops);
      }

      addRuleToResults(rule, results);
    } catch (error) {
      logError(`Error processing rule [${rule.id}]`, error);
      results.push({
        id: rule.id,
        type: rule.type,
        message: rule.description,
        conditions: rule.conditionsResult?.items || [],
        keyword: 'conditional',
        errors: [
          {
            cause: error.message,
            context: `Error occurred while processing rule [${rule.id}]`,
          },
        ],
      });
    }
  });

  return results;
};

/**
 * Filters rules based on their validity dates.
 * @param {Array<object>} rules The array of rules.
 * @return {Array<object>} The filtered rules.
 */
function filterRulesByDate(rules) {
  return rules.filter((rule) => {
    const isAfterStartDate = rule.initialDate ? new Date(rule.initialDate) <= new Date() : true;
    const isBeforeEndDate = rule.endDate ? new Date(rule.endDate) >= new Date() : true;
    return isAfterStartDate && isBeforeEndDate;
  });
}

/**
 * Processes conditions to identify and expand loops.
 * @param {object} rule The rule being processed.
 * @param {Array<object>} loops The array to store identified loops.
 */
function processConditionsForLoops(rule, loops) {
  rule.conditions.forEach((condition, conditionIndex) => {
    while (condition.value.includes('[]')) {
      const {objectName, completeObjectPath} = extractLoopDetails(condition.value);
      loops.push({objectName, completeObjectPath, parm: `@${loops.length}`});

      rule.conditions.forEach((innerCondition) => {
        if (innerCondition.value.includes(`${objectName}[]`)) {
          innerCondition.value = innerCondition.value.replaceAll(
              `${objectName}[]`,
              `${objectName}[@${loops.length - 1}]`,
          );
        }
      });
    }
  });
}

/**
 * Extracts details of a loop from a condition value.
 * @param {string} value The condition value.
 * @return {object} The extracted loop details.
 */
function extractLoopDetails(value) {
  const completeObjectPath = value.split('[]')[0];
  const lastDotIndex = completeObjectPath.lastIndexOf('.');
  const objectName = completeObjectPath.slice(lastDotIndex + 1);
  return {objectName, completeObjectPath};
}

/**
 * Sorts loops by their complete object paths.
 * @param {Array<object>} loops The array of loops.
 * @return {Array<object>} The sorted loops.
 */
function sortLoopsByPath(loops) {
  return loops.sort((a, b) => a.completeObjectPath.localeCompare(b.completeObjectPath));
}

/**
 * Validates if array references in loops are nested correctly.
 * @param {Array<object>} sortedLoops The sorted loops.
 * @param {object} rule The rule being validated.
 * @return {boolean} True if valid, false otherwise.
 */
function validateArrayReferences(sortedLoops, rule) {
  try {
    const validArrayRef = sortedLoops.reduce(
        (prev, current) => {
          if (current.completeObjectPath.includes(prev.previousCompleteObjectPath)) {
            return {status: prev.status, previousCompleteObjectPath: current.completeObjectPath};
          } else {
            return {status: false, previousCompleteObjectPath: current.completeObjectPath};
          }
        },
        {status: true, previousCompleteObjectPath: ''},
    );

    if (!validArrayRef.status) {
      console.warn(
          `Invalid rule [${rule.id}]: Different array structures referenced in the same rule`,
      );
      return false;
    }
    return true;
  } catch (error) {
    logError(`Error in validateArrayReferences for rule [${rule.id}]`, error);
    throw new Error(`Failed to validate array references for rule [${rule.id}].`);
  }
}

/**
 * Explodes the contexts of a JSON document based on the given conditions and loops.
 * @param {object} documentJson The JSON document to explode.
 * @param {Array<object>} conditions The conditions to apply.
 * @param {Array<object>} existingLoops The existing loops to consider.
 * @param {Array<number>} currentTuple The current tuple of indices.
 * @return {Array<Array<number>>} An array of arrays, where each inner array represents a context.
 */
function explodeContexts(documentJson, conditions, existingLoops, currentTuple) {
  const loops = [...existingLoops];
  const totalTuples = [];
  if (loops.length === 0) {
    return currentTuple;
  }
  const currentLoop = JSON.parse(JSON.stringify(loops.shift()));
  const loopItemsCount = objectPath.get(documentJson, currentLoop.completeObjectPath) ?? [];
  for (let i = 0; i < loopItemsCount.length; i++) {
    if (loops.length > 0) {
      const newLoops = loops.map((item) => {
        return {
          objectName: item.objectName,
          completeObjectPath: item.completeObjectPath.replace(
              `${currentLoop.completeObjectPath}[${currentLoop.parm}]`,
              `${currentLoop.completeObjectPath}.${i}`,
          ),
        };
      });
      explodeContexts(documentJson, conditions, [...newLoops], [...currentTuple, i]).forEach((tuple) =>
        totalTuples.push(tuple),
      );
    } else {
      totalTuples.push([...currentTuple, i]);
    }
  }
  return totalTuples;
}

/**
 * Evaluates simple conditions without contexts.
 * @param {object} documentJson The JSON document.
 * @param {Array<object>} conditions The conditions to evaluate.
 * @return {object} The result of the evaluation.
 */
function evaluateSimpleConditions(documentJson, conditions) {
  return conditions.reduce(
      (result, condition) => {
        if (result.response) {
          try {
            const firstValue = objectPath.get(documentJson, condition.value);
            const test = testCondition(firstValue, condition.comparisonValue, condition.operator);
            if (test) {
              result.items.push({
                instancePath: condition.value,
                instancePathValue: firstValue,
                operator: condition.operator,
                comparisonValue: condition.comparisonValue,
              });
            }
            return {response: test, items: result.items};
          } catch (error) {
            logError('Error in evaluateSimpleConditions', error);
            throw new Error(`Failed to evaluate conditions in one context.`);
          }
        }
        return {response: false, items: result.items};
      },
      {response: true, items: []},
  );
}

/**
 * Evaluates conditions in multiple contexts.
 * @param {object} documentJson The JSON document.
 * @param {object} rule The rule being evaluated.
 * @param {Array<object>} loops The loops to consider.
 * @return {Array<object>} The results of the evaluation for each context.
 */
function evaluateConditionsInContexts(documentJson, rule, loops) {
  return rule.contexts.map((context) => {
    const conditionsInContext = rule.conditions.map((condition) =>
      replaceContextValues(condition, loops, context),
    );

    return conditionsInContext.reduce(
        (prevItem, condition) => {
          if (prevItem.result) {
            try {
              const firstValue = objectPath.get(documentJson, condition.value);
              const test = testCondition(firstValue, condition.comparisonValue, condition.operator);
              if (test) {
                prevItem.conditionValues.push({
                  instancePath: condition.value,
                  instancePathValue: firstValue,
                  operator: condition.operator,
                  comparisonValue: condition.comparisonValue,
                });
                return {result: true, conditionValues: prevItem.conditionValues};
              }
              return {result: false, conditionValues: prevItem.conditionValues};
            } catch (error) {
              logError('Error in evaluateConditionsInContexts', error);
              throw new Error(`Failed to evaluate conditions in one context in rule [${rule.id}].`);
            // return { result: false, conditionValues: prevItem.conditionValues };
            }
          }
          return {result: false, conditionValues: prevItem.conditionValues};
        },
        {result: true, conditionValues: []},
    );
  });
}

/**
 * Tests a condition against two values.
 * @param {any} leftValue The left-hand side value of the condition.
 * @param {any} rightValue The right-hand side value of the condition.
 * @param {string} operator The operator to use for the comparison.
 * @return {boolean} True if the condition is met, false otherwise.
 */
function testCondition(leftValue, rightValue, operator) {
  try {
    if (operator === 'exists') return typeof leftValue !== 'undefined';
    if (operator === 'does_not_exists') return typeof leftValue === 'undefined';
    if (typeof leftValue === 'undefined') return false; // Avoids error when leftValue is undefined
    if (operator === 'is_empty') return leftValue.length === 0;
    if (operator === 'is_not_empty') return leftValue.length > 0;

    if (typeof leftValue === 'string') leftValue = leftValue.toLowerCase();
    if (typeof rightValue === 'string') rightValue = rightValue.toLowerCase();

    if (operator === '=') return leftValue === rightValue;
    if (operator === '<>') return leftValue !== rightValue;
    if (operator === '<') return leftValue < rightValue;
    if (operator === '<=') return leftValue <= rightValue;
    if (operator === '>') return leftValue > rightValue;
    if (operator === '>=') return leftValue >= rightValue;
    if (operator === 'contains') return leftValue.includes(rightValue);
    if (operator === 'does_not_contains') return !leftValue.includes(rightValue);
    if (operator === 'is_contained') return rightValue.includes(leftValue);
    if (operator === 'in') return rightValue.includes(leftValue);
    if (operator === 'not_in') return !rightValue.includes(leftValue);

    throw new Error(`Unsupported operator: ${operator}`);
  } catch (error) {
    logError(`Error in testCondition with operator [${operator}]`, error);
    throw new Error(`Failed to test condition with operator [${operator}].`);
  }
}

/**
 * Replaces the context values in a condition.
 * @param {object} condition The condition to replace the values in.
 * @param {Array<object>} loops The loops to consider.
 * @param {Array<number>} context The context to use for the replacement.
 * @return {object} The condition with the replaced values.
 */
function replaceContextValues(condition, loops, context) {
  let adjustedValue = condition.value;
  loops.forEach((loop, loopIndex) => {
    adjustedValue = adjustedValue.replaceAll(`[@${loopIndex}]`, `.${context[loopIndex]}`);
  });
  return {
    value: adjustedValue,
    operator: condition.operator,
    comparisonValue: condition.comparisonValue,
  };
}

/**
 * Adds a rule to the results if its conditions are met.
 * If an error occurs, it should be handled gracefully.
 * @param {object} rule The rule being processed.
 * @param {Array<object>} results The results array.
 */
function addRuleToResults(rule, results) {
  try {
    if (rule.conditionResultContext.length > 0) {
      const trueInstances = rule.conditionResultContext.filter((item) => item.result);
      if (trueInstances.length > 0) {
        results.push({
          id: rule.id,
          type: rule.type,
          message: rule.description,
          conditions: trueInstances,
          keyword: 'conditional',
        });
      }
    } else if (rule.conditionsResult.response) {
      results.push({
        id: rule.id,
        type: rule.type,
        message: rule.description,
        conditions: {result: true, conditionValues: rule.conditionsResult.items},
        keyword: 'conditional',
      });
    }
  } catch (error) {
    logError(`Error adding rule [${rule.id}] to results`, error);
    results.push({
      id: rule.id,
      type: rule.type,
      message: rule.description,
      conditions: [],
      keyword: 'conditional',
      errors: [
        {
          cause: error.message,
          context: `Error occurred while adding rule [${rule.id}] to results`,
        },
      ],
    });
  }
}

/**
 * Logs an error with a detailed message.
 * @param {string} message The error message.
 * @param {Error} error The error object.
 */
function logError(message, error) {
  console.error(`[ERROR] ${message}:`, {
    message: error.message,
    stack: error.stack,
  });
}

module.exports.validateRules = validateRules;
