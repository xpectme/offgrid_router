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

const CACHE_VERSION = "v1";

const hbsEngine = new HandlebarsEngine({
  layoutsPath: "views",
  partialsPath: "views/partials",
  defaultLayout: "layout",
  extName: ".hbs",
});

const router = new Router();

// enables logging
router.hooks.add(hooks.logging);

// parses the current path and adds it to the context.state.currentPath
// This can be directly accessed in the template.
router.hooks.add(hooks.path);

// adds the current state to the context.state.onlineState
// This can be directly accessed in the template.
router.hooks.add(hooks.onlineState);

router.setViewEngine(hbsEngine);

// URL: /hello?name=John
router.get("/hello", (context) => {
  context.plain(`Hello ${context.query.get("name")}`);
});

// URL: /hello/John
router.get("/hello/:name", (context) => {
  context.json({ message: `Hello ${context.params.name}` });
});

// URL: /hello/John/42
router.get("/hello/:name/:age", (context) => {
  if (context.request.headers.get("HX-Request") === "true") {
    // If you want to use only a partial view, you can use the context.partial
    context.partial("hello", {
      name: context.params.name,
      age: context.params.age,
    });
  } else {
    // If you want to use a full view with a layout, you can use the context.view
    context.view("hello", {
      name: context.params.name,
      age: context.params.age,
    });
  }
});

// route that throws a 503 in offline state
router.get("/offline", (context) => {
  context.plain("Must not be called in offline state");
}, { offline: "throw" });

// route that is only accessible in offline state
router.get("/online_only", (context) => {
  context.plain("Must be called in offline state, but not in online state");
}, { offline: "only" });

// Status Code 503: Can be used to handle offline state
app.setErrorHandler(Status.ServiceUnavailable);

// you can also add a handler function to the error handler
app.setErrorHandler(Status.NotFound, (context) => {
  context.plain("Not Found");
});

globalThis.addEventListener("install", (event) => {
  (event as any).waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      hbsEngine.install({ fetch: cachedFetch(cache), partials: [] });
      return (cache as any).addAll([
        "/views/layout.hbs",
        "/views/hello.hbs",
        "/views/503.hbs",
      ]);
    }),
  );
});

addEventListener("fetch", (event) => {
  router.listen(event);
});
```
