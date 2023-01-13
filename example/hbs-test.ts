import { HandlebarsEngine } from "https://deno.land/x/offgrid_handlebars@v1.0.0/main.ts";

const hbs = new HandlebarsEngine({
  rootPath: "example",
  layout: "main",
});

await hbs.install({
  fetch: async (input) => {
    const textFile = await Deno.readTextFile(input.toString());
    return new Response(textFile);
  },
  partials: [
    "header",
    "nav",
    "footer",
  ],
});

const html = await hbs.view("home", {
  title: "Handlebars",
  page: {
    title: "Home",
    content: "This is the home page",
  },
});

console.log(html);
