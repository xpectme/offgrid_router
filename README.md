# Offgrid Router

This is a project to build a router that can be used in areas without internet
access.

## Getting Started

Create an instance

```typescript
import {
  hooks,
  Router,
  Status,
} from "https://deno.land/x/offgrid-router/main.ts";
import { HandlebarsEngine } from "https://deno.land/x/offgrid_handlebars/main.ts";

const router = new Router();

router.hooks.add(hooks.logging);
router.hooks.add(hooks.path);
router.hooks.add(hooks.onlineState);

router.setViewEngine(handlebarsEngine);

router.get("/hello", (context) => {
  context.plain("Hello World");
});

router.get("/hello/:name", (context) => {
  context.json({ message: `Hello ${context.params.name}` });
});

router.get("/hello/:name/:age", (context) => {
  context.view("hello", {
    name: context.params.name,
    age: context.params.age,
  });
});

// route that throws a 503 in offline state
router.get("/offline", (context) => {
  context.plain("Offline");
}, { offlineHandling: "errorOffline" });

// route that is only accessible in offline state
router.get("/offline", (context) => {
  context.plain("Offline");
}, { offlineHandling: "onlyOffline" });

// Status Code 503: Can be used to handle offline state
app.setErrorHandler(Status.ServiceUnavailable);

// you can also add a handler function to the error handler
app.setErrorHandler(Status.NotFound, (context) => {
  context.plain("Not Found");
});

addEventListener("fetch", (event) => {
  router.listen(event);
});
```
