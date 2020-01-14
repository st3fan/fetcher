/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/ */

const Redis = require('ioredis');

/**
 * Storage backend that drops the results in a Redis queue.
 */

class RedisStorage {
  constructor(queueName, options) {
    this.options = options;
    this.queueName = queueName;
    this.redis = new Redis(this.options);
  }

  async setup() {
    return null;
  }

  async store(request, response) {
    console.log(`Storing ${request} in Redis`);
    try {
      await this.redis.rpush(this.queueName, JSON.stringify({ request, response }));
    } catch (error) {
      console.log(`Failed to store message in Redis: ${error}`);
    }
  }
}

module.exports = RedisStorage;
