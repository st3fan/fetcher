/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/ */

// TODO Get rid of this
// eslint-disable no-await-in-loop
// eslint-disable-next-line max-classes-per-file

const express = require('express');
const bodyParser = require('body-parser');
const got = require('got');
const uuid = require('uuid/v4');
const UserAgent = require('user-agents');
const Limiter = require('async-limiter');

const RedisStorage = require('./redis-storage');
const TinyQueueServiceStorage = require('./tqs-storage');

const destinations = {
  redis: new RedisStorage('responses', 'redis://localhost/0'),
  tqs: new TinyQueueServiceStorage('http://localhost:8080', 'responses')
};

const limiter = new Limiter({ concurrency: 1 });

const processDownload = async (job, uploader) => {
  await got(job.request.url).then(
    res => {
      console.log(`Got a response ${res.statusCode}`);
      const response2 = {
        url: res.url,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers
      };
      uploader.store(job, response2);
    },
    err => {
      console.log(`Got an error ${err}`);
      uploader.store(job, { error: err.toString() });
    }
  );
};

const userAgentHeader = userAgent => {
  if (!userAgent) {
    return 'Fetcher/1.0';
  }

  if (typeof userAgent === 'string' || userAgent instanceof String) {
    return userAgent;
  }

  // As documented on https://www.npmjs.com/package/user-agents
  if (userAgent instanceof Object) {
    // TODO Only pull out those keys that we support? deviceClass and ... ?
    const ua = new UserAgent(userAgent);
    return ua.toString();
  }

  throw new Error(`Invalid userAgent <${userAgent}>`);
};

/**
 * Convert the acceptLanguage value from the request to something
 * that can be used in the Accept-Language header.
 *
 * @param {string} acceptLanguage what it this
 */

const acceptLanguageHeader = acceptLanguage => {
  if (acceptLanguage === undefined) {
    return 'en-US,en;q=0.9';
  }
  if (typeof acceptLanguage === 'string' || acceptLanguage instanceof String) {
    return acceptLanguage;
  }
  throw new Error(`Invalid acceptLanguage <${acceptLanguage}>`);
};

const app = express();
app.post('/fetch', bodyParser.json(), async (request, response) => {
  try {
    const { url, userAgent, acceptLanguage, destination } = request.body;

    // Check destination

    let uploader;
    if (destination) {
      if (!destinations[destination]) {
        throw new Error(`Unknown destination <${destination}>`);
      }
      uploader = destinations[destination];
    }

    const headers = {
      'User-Agent': userAgentHeader(userAgent),
      'Accept-Language': acceptLanguageHeader(acceptLanguage)
    };

    if (uploader) {
      const response1 = {
        id: uuid(),
        destination: destination,
        request: {
          url: url,
          headers: headers
        }
      };

      // Tell the client we have queued it
      response.status(200).json(response1);

      console.log(`Queueing ${response1.request.url}`);
      limiter.push(async cb => {
        console.log(`Fetching ${response1.request.url}`);
        await processDownload(response1, uploader);
        cb();
      });
    } else {
      const res = await got(request.body.url);
      response.status(200).json({
        id: uuid(),
        request: {
          url: url,
          headers: headers
        },
        response: {
          url: res.url,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers
        }
      });
    }
  } catch (error) {
    response.status(500).json({ error: error.toString() });
  }
});

(async () => {
  for (const [destination, storage] of Object.entries(destinations)) {
    console.log(`Initializing storage <${destination}>`);
    // eslint-disable-next-line no-await-in-loop
    await storage.setup();
  }

  const server = app.listen(3000, function() {
    console.log(`Started <downloader> at http://127.0.0.1:${server.address().port}`);
  });
})();
