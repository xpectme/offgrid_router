import { Context } from "../Context.ts";
import { RouterHook } from "../RouterHook.ts";

export default function pathHook(): RouterHook {
  return (context: Context) => {
    const url = new URL(context.request.url);
    context.state.currentPath = url.pathname;
  };
}
