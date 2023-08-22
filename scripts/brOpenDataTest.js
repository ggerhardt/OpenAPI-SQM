/* eslint-disable max-len */

const axios = require('axios').default;
const fs = require('fs');

/**
 * SendSchemasToCheck - get opendata endpoints listed on UK Open Banking and test their schemas.
 */
async function sendSchemasToCheck() {
  const port = (process.argv[2] || '8080');
  const listaFamilyTypeOpenAPI = {
    'discovery': 'https://openbanking-brasil.github.io/openapi/swagger-apis/common/2.0.0-beta.1.yml',
    'channels': 'https://openbanking-brasil.github.io/openapi/swagger-apis/channels/1.0.2.yml',
    'products-services': 'https://openbanking-brasil.github.io/openapi/swagger-apis/products-services/1.0.2.yml',
    'admin': 'https://openbanking-brasil.github.io/openapi/swagger-apis/admin/2.0.0-beta.1.yml',
    'opendata-capitalization': 'https://openbanking-brasil.github.io/openapi/swagger-apis/capitalization-bonds/1.0.1.yml',
    'opendata-investments': 'https://openbanking-brasil.github.io/openapi/swagger-apis/investments/1.0.0.yml',
    'opendata-exchange': 'https://openbanking-brasil.github.io/openapi/swagger-apis/exchange/1.0.0.yml',
    'opendata-acquiring-services': 'https://openbanking-brasil.github.io/openapi/swagger-apis/acquiring-services/1.0.0.yml',
    'opendata-pension': 'https://openbanking-brasil.github.io/openapi/swagger-apis/pension/1.0.1.yml',
    'opendata-insurance': 'https://openbanking-brasil.github.io/openapi/swagger-apis/insurances/1.0.1.yml',
  };
  let count=0;
  let name = '';
  const errorList = [];
  const openDataLists = await axios.request('https://data.directory.openbankingbrasil.org.br/participants');
  for (let x = 0; x < openDataLists.data.length; x++) {
    name = openDataLists.data[x].OrganisationName;
    if (openDataLists.data[x].AuthorisationServers) {
      const authServers = openDataLists.data[x].AuthorisationServers;
      for (let y = 0; y < authServers.length; y++) {
        if (authServers[y].ApiResources) {
          const apiResourcesArray = authServers[y].ApiResources;
          for (let z = 0; z < apiResourcesArray.length; z++) {
            const apiFamily = apiResourcesArray[z].ApiFamilyType.split('_')[0];
            // const apiVersion = apiResourcesArray[z].ApiVersion;
            if (apiResourcesArray[z].ApiDiscoveryEndpoints) {
              const apiEndpointsArray = apiResourcesArray[z].ApiDiscoveryEndpoints;
              for (let w = 0; w < apiEndpointsArray.length; w++) {
                const url = apiEndpointsArray[w].ApiEndpoint;
                const openapiUrl = listaFamilyTypeOpenAPI[apiFamily];
                if (openapiUrl) {
                  let dataFromClient;
                  try {
                    dataFromClient = await axios.request(url);
                  } catch (err) {
                    errorList.push({organizationName: name, url: url, familyName: apiResourcesArray[z].ApiFamilyType, error: err.message, date: new Date().toISOString().split('T')[0]});
                    console.log(name + ' - ' + url);
                    console.log('Message: '+ err.message);
                  }
                  if (dataFromClient) {
                    const dataObj = {
                      'oasUrl': openapiUrl,
                      'payloadSourceId': name,
                      'payloadSourceName': name,
                      'requestUrl': url,
                      'requestOperation': 'GET',
                      'requestContentType': 'json',
                      'responseCode': dataFromClient.status.toString(),
                      'responsePayload': JSON.parse(JSON.stringify(dataFromClient.data)),
                      'tags': 'BrOpenData',
                      'date': new Date().toISOString().split('T')[0],
                    };
                    const options = {
                      method: 'POST',
                      url: `http://localhost:${port}/api/payloads`,
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'x-api-key': '3161fd56-1869-42d5-b58a-6c217083c739',
                      },
                      data: dataObj,
                    };

                    console.log(count++);
                    try {
                      await axios.request(options);
                    } catch (err) {
                      console.log(err.message);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  fs.writeFileSync('./errorList.json', JSON.stringify(errorList));
}


(async () => {
  await sendSchemasToCheck();
  console.log('Finished');
  await mongoClient.close();
})();

