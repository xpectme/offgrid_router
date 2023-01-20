import { Context } from "./Context.ts";
import { ActionOptions } from "./Router.ts";

/**
 * A hook function is called before a request is handled and before a response is
 * sent. It can be used to modify the request or response, or to throw an error
 * to stop the request.
 *
 * If the hook function returns `false` the request will be stopped and no
 * response will be sent.
 */
export interface HookFunction {
  (
    context: Context,
    options: ActionOptions,
  ): false | void | Promise<false | void>;
}

export interface HookMethods {
  onRequest?: HookFunction;
  onRespond?: HookFunction;
  onError?: HookFunction;
}

export type RouterHook = HookMethods | HookFunction;
