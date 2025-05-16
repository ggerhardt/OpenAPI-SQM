const rulesEngine = require('./businessRules.js');

describe('validateRules', () => {

  const documentJson = {
    a: 1,
    b: 'test',
    c: [
      { d: 2, e: 'test2' },
      { d: 3, e: 'test3' }
    ]
  };

  test('should return an empty array if no rules are provided', () => {
    expect(rulesEngine.validateRules(documentJson, [])).toEqual([]);
  });

  test('should validate rules with basic operators', () => {
    const rules = [
      { id: 1, type: 'rule1', conditions: [{ value: 'a', operator: '=', comparisonValue: 1 }] },
      { id: 2, type: 'rule2', conditions: [{ value: 'b', operator: '<>', comparisonValue: 'test1' }] },
      { id: 3, type: 'rule3', conditions: [{ value: 'a', operator: '<', comparisonValue: 2 }] },
      { id: 4, type: 'rule4', conditions: [{ value: 'a', operator: '<=', comparisonValue: 1 }] },
      { id: 5, type: 'rule5', conditions: [{ value: 'a', operator: '>', comparisonValue: 0 }] },
      { id: 6, type: 'rule6', conditions: [{ value: 'a', operator: '>=', comparisonValue: 1 }] },
    ];
    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(6);
  });

  test('should validate rules with basic operators - errors', () => {
    const rules = [
      { id: 1, type: 'rule1', conditions: [{ value: 'a', operator: '=', comparisonValue: 2 }] },
      { id: 2, type: 'rule2', conditions: [{ value: 'b', operator: '<>', comparisonValue: 'test' }] },
      { id: 3, type: 'rule3', conditions: [{ value: 'a', operator: '<', comparisonValue: 0 }] },
      { id: 4, type: 'rule4', conditions: [{ value: 'a', operator: '<=', comparisonValue: 0 }] },
      { id: 5, type: 'rule5', conditions: [{ value: 'a', operator: '>', comparisonValue: 1 }] },
      { id: 6, type: 'rule6', conditions: [{ value: 'a', operator: '>=', comparisonValue: 5 }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(0);
  });

  test('should validate rules with string operators', () => {
    const rules = [
      { id: 7, type: 'rule7', conditions: [{ value: 'b', operator: 'contains', comparisonValue: 'test' }] },
      { id: 8, type: 'rule8', conditions: [{ value: 'b', operator: 'does_not_contains', comparisonValue: 'test1' }] },
      { id: 9, type: 'rule9', conditions: [{ value: 'b', operator: 'is_contained', comparisonValue: 'testing' }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(3);
  });

  test('should validate rules with array operators', () => {
    const rules = [
      { id: 10, type: 'rule10', conditions: [{ value: 'a', operator: 'in', comparisonValue: [1,2,3] }] },
      { id: 11, type: 'rule11', conditions: [{ value: 'a', operator: 'not_in', comparisonValue: [2,3] }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(2);
  });

  test('should validate rules with existence operators', () => {
    const rules = [
      { id: 12, type: 'rule12', conditions: [{ value: 'a', operator: 'exists' }] },
      { id: 13, type: 'rule13', conditions: [{ value: 'z', operator: 'does_not_exists' }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(2);
  });
})
describe('businessRules operators test', () => {
  const jsonDocument = {
    name: 'John Doe',
    age: 22,
    tags: ['blue_eyed', 'blind'],
    alive: true,
  };
  test('String Equality test', async () => {
    const rules = [{
      id: 1,
      returnCode: 'ERR001',
      name: 'Invalid value',
      description: 'Value should be "John Doe"',
      conditions: [
        {
          value: 'name',
          operator: '=',
          comparisonValue: 'John Doe',
        },
      ],
    }];
    const results = rulesEngine.validateRules(jsonDocument, rules);

    expect(results.length).toBe(1);
  });
  test('String Equality test error', async () => {
    const rules = [{
      id: 1,
      type: 'ERROR',
      returnCode: 'ERR001',
      name: 'Invalid value',
      description: 'Value should be "John Doe 1"',
      conditions: [
        {
          value: 'name',
          operator: '=',
          comparisonValue: 'John Doe 1',
        },
      ],
    }];
    const results = rulesEngine.validateRules(jsonDocument, rules);

    expect(results.length).toBe(0);
  });
});
