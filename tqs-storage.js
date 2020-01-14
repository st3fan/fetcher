/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/ */

const got = require('got');

/**
 * Storage backend that drops the results in a TQS queue.
 *
 * The Tiny Queue Service is a work in progress and mostly an experiment
 * for some home automation infrastructure.
 *
 * See https://github.com/st3fan/tqs-server for more info.
 */

class TinyQueueServiceStorage {
  constructor(endpoint, queue) {
    this.endpoint = endpoint;
    this.queue = queue;
  }

  async setup() {
    const r = await got.post(`${this.endpoint}/queues`, {
      json: { name: this.queue },
      responseType: 'json',
      throwHttpErrors: false
    });
    if (r.statusCode !== 200 && r.statusCode !== 409) {
      throw new Error(`Could not create queue <${this.queue}>: <${r.statusCode}>`);
    }
  }

  async store(request, response) {
    console.log(`Storing result in TQS`);

    try {
      const r = await got.post(`${this.endpoint}/queues/${this.queue}`, {
        json: {
          messages: [{ body: JSON.stringify({ request, response }), type: 'application/json' }]
        },
        responseType: 'json'
      });
      if (r.statusCode !== 200) {
        console.log(`Could not post to TQS: ${r.statusCode}`);
      }
    } catch (error) {
      console.log(`Could not post to TQS: ${error}`);
    }
  }
}

module.exports = TinyQueueServiceStorage;
