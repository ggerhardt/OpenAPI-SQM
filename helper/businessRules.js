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
  // Filter rules based on date conditions before iterating
  const validRulesByDate = rules.filter((rule) => {
    const conditionInitialDate = rule.initialDate ?
      new Date(rule.initialDate) <= new Date() :
      true;
    const conditionEndDate = rule.endDate ?
      new Date(rule.endDate) >= new Date() :
      true;
    return conditionInitialDate && conditionEndDate;
  });
  // loop through the rules
  validRulesByDate.forEach((rule) => {
    const loops = [];
    rule.conditionResultContext = [];
    // Identify conditions that need to be expanded
    for (
      let conditionIndex = 0;
      conditionIndex < rule.conditions.length;
      conditionIndex++
    ) {
      while (rule.conditions[conditionIndex].value.indexOf('[]') >= 0) {
        const completeObjectPath = rule.conditions[conditionIndex].value.split(
            '[]')[0];
        const lastDotIndex = completeObjectPath.lastIndexOf('.');
        const objectName = completeObjectPath.slice(lastDotIndex + 1);
        loops.push({objectName, completeObjectPath, parm: '@'+ loops.length});
        // Reuse theloop variable instead of creating new ones in each iteration
        for (
          let conditionIndex2 = 0;
          conditionIndex2 < rule.conditions.length;
          conditionIndex2++
        ) {
          if (
            rule.conditions[conditionIndex2].value.indexOf(
                objectName + '[]',
            ) >= 0
          ) {
            rule.conditions[conditionIndex2].value = rule.conditions[
                conditionIndex2
            ].value.replaceAll(
                `${objectName}[]`,
                `${objectName}[@${loops.length - 1}]`,
            );
          }
        }
      }
    }
    const sortedLoops = loops.sort((a, b) =>
      a.completeObjectPath.localeCompare(b.completeObjectPath),
    );
    const validArrayRef = sortedLoops.reduce(
        (prev, current) => {
          if (
            // eslint-disable-next-line max-len
            current.completeObjectPath.indexOf(prev.previousCompleteObjectPath) >= 0
          ) {
            return {
              status: prev.status,
              previousCompleteObjectPath: current.completeObjectPath,
            };
          } else {
            return {
              status: false,
              previousCompleteObjectPath: current.completeObjectPath,
            };
          }
        },
        {status: true, previousCompleteObjectPath: ''},
    );
    if (!validArrayRef.status) {
      // Non-nested array objects.
      console.log(
          'Invalid rule [' +
          rule.id +
          ']: Different array structures referenced in the same rule ',
      );
    }
    rule.conditionsResult = {};
    // Pass a single array to explodeContexts for reuse
    rule.contexts = explodeContexts(
        documentJson,
        rule.conditions,
        loops,
        [],
    );
    if (rule.contexts.length == 0) {
      rule.conditionsResult = rule.conditions.reduce(
          (result, condition) => {
            if (result.response) {
              try {
                const firstValue = objectPath.get(
                    documentJson,
                    condition.value,
                );
                const test = testCondition(
                    firstValue,
                    condition.comparisonValue,
                    condition.operator,
                );
                if (test) {
                  result.items.push(
                    {
                      instancePath: condition.value,
                      instancePathValue: firstValue,
                      operator: condition.operator,
                      comparisonValue: condition.comparisonValue,
                    }
                  );
                }
                return {response: test, items: result.items};
              } catch (err) {
                return {response: false, items: result.items};
              }
            } else return {response: false, items: result.items};
          },
          {response: true, items: []},
      );
    } else {
      rule.conditionResultContext = [];
      // Run conditions for each context
      for (
        let contextIndex = 0;
        contextIndex < rule.contexts.length;
        contextIndex++
      ) {
        condInContext = [];
        for (let condId = 0; condId < rule.conditions.length; condId++) {
          condInContext[condId] = replaceContextValues(
              rule.conditions[condId],
              loops,
              rule.contexts[contextIndex],
          );
        }
        returnCondInContext = condInContext.reduce((prevItem, condition) => {
          if (prevItem.result) {
            try {
              const firstValue = objectPath.get(
                  documentJson,
                  condition.value,
              );
              const test = testCondition(
                  firstValue,
                  condition.comparisonValue,
                  condition.operator,
              );
              if (test) {
                prevItem.conditionValues.push({
                  instancePath: condition.value,
                  instancePathValue: firstValue,
                  operator: condition.operator,
                  comparisonValue: condition.comparisonValue,
                });
                return {result: true, conditionValues: prevItem.conditionValues};
              } else {
                return {result: false, conditionValues: prevItem.conditionValues};
              }
            } catch (err) {
              return {result: false, conditionValues: prevItem.conditionValues};
            }
          } else return {result: false, conditionValues: prevItem.conditionValues};
        }, {result: true, conditionValues: []});
        rule.conditionResultContext[contextIndex] = JSON.parse(JSON.stringify(returnCondInContext));
      }
    }
    const trueInstances = rule.conditionResultContext.filter((item)=>item.result);
    // If any condition context is met, add the rule to the results
    if (trueInstances.length > 0) {
      const returnValue = {
        id: rule.id,
        type: rule.type,
        message: rule.description,
        conditions: trueInstances,
        keyword: 'conditional',
      };
      if (rule.conditionsResult.contexts) {
        returnValue.context = rule.conditionsResult.contexts;
      }
      results.push(returnValue);
    } else {
      // If the simple condition is met, add the rule to the results
      if (rule.conditionsResult.response) {
        const returnValue = {
          id: rule.id,
          type: rule.type,
          message: rule.description,
          conditions: {result: true, conditionValues: rule.conditionsResult.items},
          keyword: 'conditional',
        };
        results.push(returnValue);
      }
    }
  });
  return results;
};
/**
 * Explodes the contexts of a JSON document based on the given conditions and loops.
 * @param {object} documentJson The JSON document to explode.
 * @param {Array<object>} conditions The conditions to apply.
 * @param {Array<object>} existingLoops The existing loops to consider.
 * @param {Array<number>} currentTuple The current tuple of indices.
 * @return {Array<Array<number>>} An array of arrays, where each inner array represents a context.
 */
function explodeContexts(
    documentJson,
    conditions,
    existingLoops,
    currentTuple,
) {
  const loops = [...existingLoops];
  // Initialize a single array for reuse
  const totalTuples = [];
  if (loops.length == 0) {
    return currentTuple;
  }
  const currentLoop = JSON.parse(JSON.stringify(loops.shift()));
  const loopItemsCount = (
    objectPath.get(documentJson, currentLoop.completeObjectPath) ?? []
  ).length;
  for (let i = 0; i < loopItemsCount; i++) {
    // Reuse totalTuples instead of creating newTuples
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
      explodeContexts(
          documentJson,
          conditions,
          [...newLoops],
          [...currentTuple, i],
      ).forEach((tuple) => totalTuples.push(tuple));
    } else {
      totalTuples.push([...currentTuple, i]);
    }
  }
  return totalTuples;
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
    if (operator == 'exists') return typeof leftValue != 'undefined';
    else if (operator == 'does_not_exists') {
      return typeof leftValue == 'undefined';
    } else if (operator == 'is_empty') {
      return leftValue.length == 0;
    } else if (operator == 'is_not_empty') {
      return leftValue.length > 0}
  } catch (err) {
    throw new Error(
        `Error in condition ${JSON.stringify(leftValue)} ${JSON.stringify(
            operator,
        )}`,
    );
  }
  try {
    if (operator == '=') return leftValue == rightValue;
    else if (operator == '<>') return leftValue != rightValue;
    else if (operator == '<') return leftValue < rightValue;
    else if (operator == '<=') return leftValue <= rightValue;
    else if (operator == '>') return leftValue > rightValue;
    else if (operator == '>=') return leftValue >= rightValue;
    else if (operator == 'contains') {
      return leftValue.indexOf(rightValue) >= 0;
    } else if (operator == 'does_not_contains') {
      return leftValue.indexOf(rightValue) == -1;
    } else if (operator == 'is_contained') {
      return rightValue.indexOf(leftValue) >= 0;
    } else if (operator == 'in') {
      return rightValue.includes(leftValue);
    } else if (operator == 'not_in') {
      return !rightValue.includes(leftValue);
    }
  } catch (err) {
    throw new Error(
        `Error in condition ${JSON.stringify(leftValue)} ${JSON.stringify(
            operator,
        )} ${JSON.stringify(rightValue)}`,
    );
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
  for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    adjustedValue = adjustedValue.replaceAll(
        `[@${loopIndex}]`,
        `.${context[loopIndex]}`,
    );
  }
  return {
    value: adjustedValue,
    operator: condition.operator,
    comparisonValue: condition.comparisonValue,
  };
}

module.exports.validateRules = validateRules;
