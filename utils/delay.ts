import { promiseTimeout } from "@vueuse/core";

export default function(ms: number) {
    return promiseTimeout(ms);
}