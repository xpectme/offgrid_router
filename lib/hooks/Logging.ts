import { Context } from "../Context.ts";
import { RouterHook } from "../RouterHook.ts";

export default function logging(): RouterHook {
  return {
    onRequest: (context: Context) => {
      console.info(context.request.method + " " + context.request.url, {
        headers: Object.fromEntries(context.request.headers),
        state: context.state,
      });
    },
    onError: (context: Context) => {
      console.error(context.state.error);
      console.log(context.state);
    },
  };
}
