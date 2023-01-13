// deno-lint-ignore-file no-explicit-any
import { Application, Context } from "../main.ts";
import { cachedFetch, HandlebarsEngine } from "../deps.ts";
import { Status } from "../lib/Status.ts";

const hbsEngine = new HandlebarsEngine();

const app = new Application({
  logging: true,
  onlineState: true,
});

app.setAppState({
  nav: [
    { title: "Home", path: "./index.html" },
    { title: "About", path: "./about" },
    { title: "Async", path: "./async" },
  ],
  selectedPath: "/",
});

app.setViewEngine(hbsEngine);

app.get("/example/index.html", (ctx: Context) => {
  ctx.view("home", { title: "Hello World" });
});

// make an async route handler
app.get("/example/async", async (ctx: Context) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  ctx.view("async", { title: "Hello World" });
}, {
  offlineHandling: "errorOffline",
});

app.get("/example/about", (ctx: Context) => {
  ctx.view("about", {
    title: "About Me",
    name: "John Doe",
    age: 30,
    occupation: "Software Engineer",
  });
});

app.setErrorHandler(Status.ServiceUnavailable, (ctx: Context) => {
  ctx.view("offline", { title: "Offline" });
});

globalThis.addEventListener("install", (event) => {
  (event as any).waitUntil(
    caches.open("v1").then((cache) => {
      const partials = ["header", "footer", "nav"];

      hbsEngine.install({
        fetch: cachedFetch(cache),
        partials: ["header", "footer", "nav"],
        helpers: {
          eq: (a: any, b: any) => a === b,
        },
      });

      console.log(
        partials.map((partial) => `${hbsEngine.partialPath}/${partial}.hbs`),
      );

      return (cache as any).addAll([
        "/example/index.html",
      ]);
    }),
  );
});

globalThis.addEventListener("fetch", (event) => {
  app.listen(event);
});
