# API 응답 표준

```ts
// 성공
{ data: T, meta?: PaginationMeta }
// 에러
{ error: { code: string, message: string, details?: object } }
```
