/* eslint-disable max-len */
schUtils = require('./schemaUtils.js');

describe('getApiSpec test', () => {
  test('Get API test', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/channels/1.0.2.yml';
    const schemaObj = await schUtils.getApiSpec(openApiSpecPath);
    expect(schemaObj).toBeDefined();
  });

  test('Get API test - file not found', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/channelxs/1.0.2.yml';
    await expect(schUtils.getApiSpec(openApiSpecPath)).rejects.toThrow('[error validating API Spec]');
  });

  test('Get API test - not specification file - html', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/consents/?urls.primaryName=2.0.1';
    await expect(schUtils.getApiSpec(openApiSpecPath)).rejects.toThrow('[error validating API Spec]');
  });

  test('Get API test - not specification file - json', async () => {
    const openApiSpecPath = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=\'07-13-2023\'&$top=100&$format=json';
    await expect(schUtils.getApiSpec(openApiSpecPath)).rejects.toThrow('[error validating API Spec]');
  });

  test('Get API test - error on references', async () => {
    const spec = {
      'openapi': '3.0.2',
      'info': {
        'title': 'OpenWeatherMap API',
        'version': '1.0.0',
      },
      'paths': {
        '/weather': {
          'get': {
            'responses': {
              '200': {
                'description': 'ok',
                'content': {
                  'application/json': {
                    'schema': {
                      '$ref': '#/components/schemas/parent',
                    },
                  },
                },
              },
            },
          },
        },
      },
      'components': {
        'schemas': {
          'parent': {
            'type': 'object',
            'properties': {
              'name': {
                'type': 'string',
              },
              'son': {
                '$ref': '#/components/schemas/son',
              },
            },
          },
          'son': {
            'type': 'object',
            'properties': {
              'name': {
                'type': 'string',
              },
              'parent': {
                '$ref': '#/components/schemas/parent',
              },
            },
          },
        },
      },
    };
    await expect(schUtils.getApiSpec(spec)).rejects.toThrow('[error dereferencing]');
  });
});

describe('getApiPath test', () => {
  test('Get API path with param', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/consents/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/consents/C1DD33123';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('/consents/{consentId}');
  });

  test('Get API path without param', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/consents/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/consents';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('/consents');
  });

  test('Get API path with query param', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/consents/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/consents?32345345=3423/33';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('/consents');
  });

  test('Get API best path', async () => {
    //
    const openApiSpecPath = 'https://raw.githubusercontent.com/readmeio/oas-examples/main/3.0/json/petstore.json';
    const url = 'https://api.banco.com.br/pet/findByTags';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('/pet/findByTags');
  });

  test('Get API best path 2', async () => {
    //
    const openApiSpecPath = 'https://raw.githubusercontent.com/readmeio/oas-examples/main/3.0/json/petstore.json';
    const url = 'https://api.banco.com.br/pet/dfdfs';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('/pet/{petId}');
  });

  test('Get API path with wrong url', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/consents/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/conksents?32345345=3423/33';
    const apiSpec = await schUtils.getApiSpec(openApiSpecPath);
    expect(schUtils.getApiPath(url, apiSpec)).toBe('');
  });
});

describe('getSchemaUrl test', () => {
  test('Get SchemaId test', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/resources';

    const schInfo = await schUtils.getSchemaUrl(openApiSpecPath, url, 'GET', '200', 'application/json');
    expect(schInfo).toBeDefined();
  });
  test('Get SchemaId test tipo inexistente', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/resources';

    const schInfo = await schUtils.getSchemaUrl(openApiSpecPath, url, 'GET ', '200', 'outroTipo');
    console.log(schInfo.content);
    expect(schInfo.content.toLowerCase()).toContain('application/json');
  });
  test('Get SchemaId test operation inexistente', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/resources';

    const schInfo = await schUtils.getSchemaUrl(openApiSpecPath, url, 'GET ', '999', 'outroTipo');
    console.log(schInfo.content);
    expect(schInfo.response).toBe('default');
  });
  test('Get SchemaId test - bad oas', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.ymlx';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/resources';
    await expect(schUtils.getSchemaUrl(openApiSpecPath, url, 'get ', '200', 'json')).rejects.toThrow('[error validating API Spec]');
    // let schId = await schUtils.getSchemaUrl(openApiSpecPath, url, "get ", "200", "json");
    // expect(schId).not.toBeDefined();
  });
  test('Get SchemaId test - url with wrong path', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const url = 'https://api.banco.com.br/open-banking/consents/v2/resodurces';
    await expect(schUtils.getSchemaUrl(openApiSpecPath, url, 'GET ', '200', 'application/json')).rejects.toThrow('Couldn\'t find url\'s path in schema');
    // let schId = await schUtils.getSchemaUrl(openApiSpecPath, url, "GET", "200", "application/json");
    // expect(schId).not.toBeDefined();
  });
});

describe('getSchema test', () => {
  test('Get Schema test', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const apiPath = '/resources';

    const schInfo = await schUtils.getSchema(openApiSpecPath, apiPath, 'GET', '200', 'application/json');
    expect(schInfo).toBeDefined();
  });
  test('Get Schema test tipo inexistente', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const apiPath = '/resources';
    const schInfo = await schUtils.getSchema(openApiSpecPath, apiPath, 'GET ', '200', 'outroTipo');
    console.log(schInfo.content);
    expect(schInfo.content.toLowerCase()).toContain('application/json');
  });
  test('Get Schema test operation inexistente', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const apiPath = '/resources';

    const schInfo = await schUtils.getSchema(openApiSpecPath, apiPath, 'GET ', '999', 'outroTipo');
    console.log(schInfo.content);
    expect(schInfo.response).toBe('default');
  });
  test('Get Schema test - bad oas', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.ymlx';
    const apiPath = '/resources';
    await expect(schUtils.getSchema(openApiSpecPath, apiPath, 'get ', '200', 'json')).rejects.toThrow('[error validating API Spec]');
  });
  test('Get Schema test - wrong path', async () => {
    const openApiSpecPath = 'https://openbanking-brasil.github.io/openapi/swagger-apis/resources/2.0.1.yml';
    const apiPath = '/xresources';
    await expect(schUtils.getSchema(openApiSpecPath, apiPath, 'GET ', '200', 'application/json')).rejects.toThrow('not found in the specification');

    // let schId = await schUtils.getSchemaUrl(openApiSpecPath, url, "GET", "200", "application/json");
    // expect(schId).not.toBeDefined();
  });
});

describe('validatePayload test', () => {
  test('Get SchemaId test', async () => {
    const openApiSpecPath = 'https://raw.githubusercontent.com/readmeio/oas-examples/main/3.0/json/petstore.json';
    const url = 'https://api.banco.com.br/pet/564564';

    const schInfo = await schUtils.getSchemaUrl(openApiSpecPath, url, 'GET', '200', 'application/json');
    const ret = schUtils.validatePayload(schInfo.schemaId, {name: 'abcde', id: 123, photoUrls: []});
    expect(ret.validSchema).toBe(true);
  });
});
describe('findKey test', () => {
  test('findKey found 1', async () => {
    const obj = {'foo': {'a': 1}, 'bar': {'b': '233232'}};
    expect(schUtils.findKeyObj(obj, 'oo')).toBe('foo');
  });
  test('findKey found 2', async () => {
    const obj = {'foo ': {'a': 1}, 'bar ': {'b': '233232'}};
    expect(schUtils.findKeyObj(obj, 'ba')).toBe('bar ');
  });
  test('findKey not found', async () => {
    const obj = {'foo ': {'a': 1}, 'bar ': {'b': '233232'}};
    expect(schUtils.findKeyObj(obj, 'bo')).not.toBeDefined();
  });
});
describe('getKey test', () => {
  test('getKey found 1', async () => {
    const obj = {'foo': {'a': 1}, 'bar': {'b': '233232'}};
    expect(schUtils.getKeyObj(obj, 'bar ')).toBe('bar');
  });
  test('getKey found 2', async () => {
    const obj = {'foo ': {'a': 1}, 'bar ': {'b': '233232'}};
    expect(schUtils.getKeyObj(obj, ' FOO')).toBe('foo ');
  });
  test('getKey not found', async () => {
    const obj = {'foo ': {'a': 1}, 'bar ': {'b': '233232'}};
    expect(schUtils.getKeyObj(obj, 'bo')).not.toBeDefined();
  });
});
