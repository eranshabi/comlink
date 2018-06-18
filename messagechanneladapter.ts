/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface StringMessageChannel {
  send(data: string): void;
  addEventListener(typ: string, listener: (ev: MessageEvent) => void | Promise<void>): void;
  removeEventListener(typ: string, listener: (ev: MessageEvent) => void | Promise<void>): void;
}

interface Message {
  id: string;
  msg: any;
  messageChannels: string[][];
}

export function wrap(
  smc: StringMessageChannel,
  id: string | null = null
): MessagePort {
  const { port1, port2 } = new MessageChannel();
  hookup(port2, smc, id);
  return port1;
}

function hookup(
  internalPort: MessagePort,
  smc: StringMessageChannel,
  id: string | null = null
): void {
  internalPort.onmessage = (event: MessageEvent) => {
    if (!id) id = generateUID();
    const msg = event.data;
    const messageChannels = Array.from(findMessageChannels(event.data));
    for (const messageChannel of messageChannels) {
      const id = generateUID();
      const channel = replaceProperty(msg, messageChannel, id);
      hookup(channel, smc, id);
    }
    const payload = JSON.stringify({ id, msg, messageChannels });
    smc.send(payload);
  };

  smc.addEventListener(
    "message",
    (event: Event): void => {
      let data = {} as Message;
      try {
        data = JSON.parse((event as MessageEvent).data) as Message;
      } catch (e) {
        return;
      }
      if (!id) id = data.id;
      if (id !== data.id) return;
      const mcs = data.messageChannels.map(messageChannel => {
        const id = messageChannel.reduce((obj, key) => obj[key], data.msg);
        const port = wrap(smc, id);
        replaceProperty(data.msg, messageChannel, port);
        return port;
      });
      internalPort.postMessage(data.msg, mcs);
    }
    if (!id) id = data.id;
    if (id !== data.id) return;
    const mcs = data.messageChannels.map(messageChannel => {
      const id = messageChannel.reduce((obj, key) => obj[key], data.msg);
      const port = wrap(smc, id);
      replaceProperty(data.msg, messageChannel, port);
      return port;
    });
    internalPort.postMessage(data.msg, mcs);
  });
}

function replaceProperty(obj: any, path: string[], newVal: any): any {
  for (const key of path.slice(0, -1)) obj = obj[key];
  const key = path[path.length - 1];
  const orig = obj[key];
  obj[key] = newVal;
  return orig;
}

function* findMessageChannels(
  obj: any,
  path: string[] = []
): Iterable<string[]> {
  if (!obj) return;
  if (typeof obj === "string") return;
  if (obj instanceof MessagePort) {
    yield path.slice();
    return;
  }
  for (const key of Object.keys(obj)) {
    path.push(key);
    yield* findMessageChannels(obj[key], path);
    path.pop();
  }
}

function hex4(): string {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}

const bits = 128;
function generateUID(): string {
  return new Array(bits / 16)
    .fill(0)
    .map(_ => hex4())
    .join("");
}

