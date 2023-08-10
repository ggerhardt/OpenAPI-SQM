/* eslint-disable max-len */

const axios = require('axios').default;

/**
 * SendSchemasToCheck - get opendata endpoints listed on UK Open Banking and test their schemas.
 */
async function sendSchemasToCheck() {
  const port = (process.argv[2] || '8080');
  const openapiUrls = {'atms': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/atmlocator/atml.2.3.0.swagger.json',
    'branches': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/branchlocator//bral.2.3.0.swagger.json',
    'personal-current-accounts': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/pca/pca.2.4.0.swagger.json',
    'business-current-accounts': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/bca/bca.2.4.0.swagger.json',
    'commercial-credit-cards': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/smeccc/ccc.2.3.0.swagger.json',
    'unsecured-sme-loans': 'https://openbankinguk.github.io/opendata-api-docs-pub/assets/smeloan/smel.2.3.0.swagger.json'};
  let count=0;
  let name = '';
  const openDataLists = await axios.request('https://raw.githubusercontent.com/OpenBankingUK/opendata-api-spec-compiled/master/participant_store.json');
  for (let x = 0; x < openDataLists.data.data.length; x++) {
    name = openDataLists.data.data[x].name;
    if (openDataLists.data.data[x].supportedAPIs) {
      const apis = Object.keys(openDataLists.data.data[x].supportedAPIs);
      for (let y = 0; y < apis.length; y++) {
        const objApi = openDataLists.data.data[x].supportedAPIs[apis[y]];
        for (let z = 0; z < objApi.length; z++) {
          const urlParts = [];
          urlParts.push(openDataLists.data.data[x].baseUrl);
          if (typeof(objApi[z]) === 'string') {
            urlParts.push(objApi[z]);
            urlParts.push(apis[y]);
          } else {
            if (objApi[z]['version']) {
              urlParts.push(objApi[z]['version']);
            }
            urlParts.push(apis[y]);
            if (objApi[z]['product-type']) {
              urlParts.push(objApi[z]['product-type']);
            }
          }
          if (openapiUrls[apis[y]]) {
            const url = urlParts.join('/');
            const openapiUrl = openapiUrls[apis[y]];
            let dataFromClient;
            try {
              dataFromClient = await axios.request(url);
            } catch (err) {
              console.log(name + ' - ' + urlParts.join('/'));
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
                'tags': 'UKOpenData',
                'date': '2023-08-09',
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

(async () => {
  await sendSchemasToCheck();
  console.log('Finished');
  await mongoClient.close();
})();

