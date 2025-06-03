const rulesEngine = require('./businessRules.js');
const { validateRules } = require('./businessRules');

describe('validateRules', () => {

  const documentJson = {
    a: 1,
    b: 'test',
    c: [
      { d: 2, e: 'test2' },
      { d: 3, e: 'test3' }
    ]
  };

  test('returns an empty array if no rules are provided', () => {
    expect(rulesEngine.validateRules(documentJson, [])).toEqual([]);
  });

  test('validates rules with basic operators', () => {
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

  test('does not return rules when basic operators do not match', () => {
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

  test('validates rules with string operators', () => {
    const rules = [
      { id: 7, type: 'rule7', conditions: [{ value: 'b', operator: 'contains', comparisonValue: 'test' }] },
      { id: 8, type: 'rule8', conditions: [{ value: 'b', operator: 'does_not_contains', comparisonValue: 'test1' }] },
      { id: 9, type: 'rule9', conditions: [{ value: 'b', operator: 'is_contained', comparisonValue: 'testing' }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(3);
  });

  test('validates rules with array operators', () => {
    const rules = [
      { id: 10, type: 'rule10', conditions: [{ value: 'a', operator: 'in', comparisonValue: [1,2,3] }] },
      { id: 11, type: 'rule11', conditions: [{ value: 'a', operator: 'not_in', comparisonValue: [2,3] }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(2);
  });

  test('validates rules with existence operators', () => {
    const rules = [
      { id: 12, type: 'rule12', conditions: [{ value: 'a', operator: 'exists' }] },
      { id: 13, type: 'rule13', conditions: [{ value: 'z', operator: 'does_not_exists' }] },
    ];

    const rulesCheck = rulesEngine.validateRules(documentJson, rules);
    expect(rulesCheck.length).toEqual(2);
  });
});

describe('validateRules - initialDate and endDate', () => {
  const baseDocument = {
    foo: 'bar',
    arr: [{ value: 1 }, { value: 2 }]
  };

  const alwaysValidRule = {
    id: 'rule1',
    type: 'test',
    description: 'Always valid rule',
    conditions: [
      { value: 'foo', operator: '=', comparisonValue: 'bar' }
    ]
    // no initialDate or endDate
  };

  const futureRule = {
    id: 'rule2',
    type: 'test',
    description: 'Future rule',
    initialDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    conditions: [
      { value: 'foo', operator: '=', comparisonValue: 'bar' }
    ]
  };

  const expiredRule = {
    id: 'rule3',
    type: 'test',
    description: 'Expired rule',
    endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    conditions: [
      { value: 'foo', operator: '=', comparisonValue: 'bar' }
    ]
  };

  const validNowRule = {
    id: 'rule4',
    type: 'test',
    description: 'Valid now rule',
    initialDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    conditions: [
      { value: 'foo', operator: '=', comparisonValue: 'bar' }
    ]
  };

  test('includes rules without initialDate/endDate', () => {
    const result = validateRules(baseDocument, [alwaysValidRule]);
    expect(result.some(r => r.id === 'rule1')).toBe(true);
  });

  test('excludes rules with initialDate in the future', () => {
    const result = validateRules(baseDocument, [futureRule]);
    expect(result.some(r => r.id === 'rule2')).toBe(false);
  });

  test('excludes rules with endDate in the past', () => {
    const result = validateRules(baseDocument, [expiredRule]);
    expect(result.some(r => r.id === 'rule3')).toBe(false);
  });

  test('includes rules valid for the current date', () => {
    const result = validateRules(baseDocument, [validNowRule]);
    expect(result.some(r => r.id === 'rule4')).toBe(true);
  });

  test('filters only valid rules among mixed rules', () => {
    const result = validateRules(baseDocument, [alwaysValidRule, futureRule, expiredRule, validNowRule]);
    const ids = result.map(r => r.id);
    expect(ids).toContain('rule1');
    expect(ids).toContain('rule4');
    expect(ids).not.toContain('rule2');
    expect(ids).not.toContain('rule3');
  });
});

describe('businessRules operators test', () => {
  const jsonDocument = {
    name: 'John Doe',
    age: 22,
    tags: ['blue_eyed', 'blind'],
    alive: true,
  };
  test('returns rule when string equality matches', async () => {
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
  test('does not return rule when string equality does not match', async () => {
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
describe('businessRules forcing errors', () => {
  const jsonDocument = {
    name: 'John Doe',
    age: 22,
    tags: ['blue_eyed', 'blind'],
    alive: true,
  };
  test('returns error when operator is invalid in one condition', async () => {
    const rules = [{
      id: 1,
      returnCode: 'ERR001',
      name: 'Invalid value',
      description: 'Value should be "John Doe"',
      conditions: [
        {
          value: 'name',
          operator: 'INVALID_OPERATOR',
          comparisonValue: 'John Doe',
        },
      ],
    }];
    const results = rulesEngine.validateRules(jsonDocument, rules);

    expect(results.length).toBe(1);
    expect(results[0].errors).toExist;
  });
  test('handles invalid operator in one rule and valid operator in another', async () => {
    const rules = [{
      id: 1,
      returnCode: 'ERR001',
      name: 'Invalid value',
      description: 'Value should be "John Doe"',
      conditions: [
        {
          value: 'name',
          operator: 'INVALID_OPERATOR',
          comparisonValue: 'John Doe',
        },
      ],
    },{
      id: 2,
      type: 'ERROR',
      returnCode: 'ERR001',
      name: 'Invalid value',
      description: 'Value should be "John Doe 1"',
      conditions: [
        {
          value: 'name',
          operator: '=',
          comparisonValue: 'John Doe',
        },
      ],
    }];
    const results = rulesEngine.validateRules(jsonDocument, rules);

    expect(results.length).toBe(2);
    expect(results[0].errors).toExist;
    expect(results[1].errors).toNotExist;
  });
});