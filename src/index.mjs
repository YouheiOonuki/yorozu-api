// Workers の入口。Workers の main は default（と Durable Object などの類）しか出せないので、本体は app.mjs に置く
import { handler } from './app.mjs';
export default handler;
