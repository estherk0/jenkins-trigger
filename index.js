const request = require('request');
const core = require('@actions/core');

// create auth token for Jenkins API
const API_TOKEN = Buffer.from(`${core.getInput('user_name')}:${core.getInput('api_token')}`).toString('base64');

let timer = setTimeout(() => {
  core.setFailed("Job Timeout");
  core.error("Exception Error: Timed out");
  }, (Number(core.getInput('timeout')) * 1000));

const sleep = (seconds) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, (seconds * 1000));
  });
};

// returns the queue item url from the response's location header
async function triggerJenkinsJob(jobName, params) {
  const jenkinsEndpoint = core.getInput('url');
  const req = {
    method: 'POST',
    url: `${jenkinsEndpoint}/job/${jobName}/buildWithParameters`,
    form: params,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  return new Promise((resolve, reject) =>
    request(req, (err, res) => {
      if (err) {
        core.setFailed(err);
        core.error(JSON.stringify(err));
        clearTimeout(timer);
        reject();
        return;
      }
      const location = res.headers['location'];
      if (!location) {
        const errorMessage = "Failed to find location header in response!";
        core.setFailed(errorMessage);
        core.error(errorMessage);
        clearTimeout(timer);
        reject();
        return;
      }

      resolve(location);
    })
  );
}

async function getJobStatus(jobName, statusUrl) {
  if (!statusUrl.endsWith('/'))
    statusUrl += '/';

  const req = {
    method: 'GET',
    url: `${statusUrl}api/json`,
    headers: {
      'Authorization': `Basic ${API_TOKEN}`
    }
  }
  return new Promise((resolve, reject) =>
      request(req, (err, res, body) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }
        resolve(JSON.parse(body));
      })
    );
}

// see https://issues.jenkins.io/browse/JENKINS-12827
async function waitJenkinsJob(jobName, queueItemUrl, timestamp) {
  const sleepInterval = 5;
  let buildUrl = undefined
  core.info(`>>> Waiting for '${jobName}' ...`);
  while (true) {
    // check the queue until the job is assigned a build number
    if (!buildUrl) {
      let queueData = await getJobStatus(jobName, queueItemUrl);

      if (queueData.cancelled)
        throw new Error(`Job '${jobName}' was cancelled.`);

      if (queueData.executable && queueData.executable.url) {
        buildUrl = queueData.executable.url; 
        core.info(`>>> Job '${jobName}' started executing. BuildUrl=${buildUrl}`);
      }

      if (!buildUrl) {
        core.info(`>>> Job '${jobName}' is queued (Reason: '${queueData.why}'). Sleeping for ${sleepInterval}s...`);
        await sleep(sleepInterval);
        continue;
      }
    }

    let buildData = await getJobStatus(jobName, buildUrl);

    if (buildData.result == "SUCCESS") {
      core.info(`>>> Job '${buildData.fullDisplayName}' completed successfully!`);
      break;
    } else if (buildData.result == "FAILURE" || buildData.result == "ABORTED") {
      throw new Error(`Job '${buildData.fullDisplayName}' failed.`);
    }

    core.info(`>>> Job '${buildData.fullDisplayName}' is executing (Duration: ${buildData.duration}ms, Expected: ${buildData.estimatedDuration}ms). Sleeping for ${sleepInterval}s...`);
    await sleep(sleepInterval); // API call interval
  }
}

async function main() {
  try {
    let params = {};
    let startTs = + new Date();
    let jobName = core.getInput('job_name');
    if (core.getInput('parameter')) {
      params = JSON.parse(core.getInput('parameter'));
      core.info(`>>> Parameter ${params.toString()}`);
    }
    // POST API call
    let queueItemUrl = await triggerJenkinsJob(jobName, params);

    core.info(`>>> Job '${jobName}' was queued successfully. QueueUrl=${queueItemUrl}`);

    // Waiting for job completion
    if (core.getInput('wait') == 'true') {
      await waitJenkinsJob(jobName, queueItemUrl, startTs);
    }
  } catch (err) {
    core.setFailed(err.message);
    core.error(err.message);
  } finally {
    clearTimeout(timer);
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";
main();