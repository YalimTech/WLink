# WLink Bridge

This service acts as a bridge between Evolution API and GoHighLevel. The integration requires several environment variables, including `EVOLUTION_CONSOLE_URL` to point to the Evolution API console. See `.env.example` for the complete list.

All instance IDs are stored as strings to match the Prisma schema. When
registering a new Evolution instance you now provide its **instance name** as
shown in the Evolution console. The service will look up the ID automatically
before persisting it.

## Development

Install dependencies before building or running tests:

```bash
npm install
npm run build
npm test
```
