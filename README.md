## Error Handling Examples

`AuthService.validateInstance` now exposes clearer errors when communicating with
the Evolution API.

```ts
try {
  await authService.validateInstance('your-instance-id', 'invalid-token');
} catch (error) {
  // Possible messages:
  // - "Evolution API responded with status 401: Unauthorized"
  // - "Evolution API unreachable"
  console.error(error.message);
}
```
