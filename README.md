# rik-health
Health endpoint module for RIK

Requires Express Installed

## Usage

```bash
npm install rik-health
```

```js
const setupHealth = require('rik-health');

const router = express.Router();

function logme(str){
    console.log(str);
}

setupHealth(router, '/api/v1/something', '/my/config/dependencies.yml', logme);
```

## Dependencies Schema (uses joi -> joi-json -> joi-yml)

```yml
dependencies:
  '@items':
    name: 'string:required'
    endpoint: 'string:required'
    timeout: 'number:required'
    expectedStatusCode: 'number:required'
```