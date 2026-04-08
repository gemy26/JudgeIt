import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const submissionSuccess = new Rate('submission_success_rate');
const submitDuration = new Trend('submit_duration', true);
const verdictDuration = new Trend('verdict_wait_duration', true);
const totalSubmissionDuration = new Trend('total_submission_duration', true);
const submissionsHandled = new Counter('submissions_handled');

const BASE_URL = 'http://localhost:3000';

const CPP_SOLUTION = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}
`;

const PYTHON_SOLUTION = `
a, b = map(int, input().split())
print(a + b)
`;

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 15 },
    { duration: '1m', target: 15 },
    { duration: '15s', target: 30 },
    { duration: '30s', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    submission_success_rate: ['rate>0.90'],
    submit_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.10'],
    total_submission_duration: ['p(95)<10000'],
  },
};

export function setup() {
  const registerPayload = JSON.stringify({
    email: `loadtest_${Date.now()}@test.com`,
    password: 'LoadTest123!',
    username: `loadtest_${Date.now()}`,
  });

  const registerRes = http.post(`${BASE_URL}/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'registration succeeded': (r) => r.status === 201,
  });

  const body = JSON.parse(registerRes.body);

  return {
    authToken: body.access_token,
    refreshToken: body.refresh_token,
    problemId: 1,
  };
}

export default function (data) {
  const useCpp = Math.random() > 0.5;
  const language = useCpp ? 'cpp' : 'python';
  const code = useCpp ? CPP_SOLUTION : PYTHON_SOLUTION;

  const submitPayload = JSON.stringify({
    problemId: data.problemId,
    language: language,
    sourceCode: code,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `Authentication=${data.authToken}; Refresh=${data.refreshToken}`,
    },
    tags: { name: 'submit' },
  };

  const startTime = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/submissions/submit`,
    submitPayload,
    params,
  );
  const elapsed = Date.now() - startTime;
  submitDuration.add(elapsed);

  const submitOk = check(submitRes, {
    'submit status is 201': (r) => r.status === 201,
    'submit returns submission id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!submitOk) {
    submissionSuccess.add(false);
    console.error(
      `Submit failed: status=${submitRes.status} body=${submitRes.body}`,
    );
    sleep(1);
    return;
  }

  const submissionId = JSON.parse(submitRes.body).id;

  const maxPollTime = 60;
  const pollInterval = 2;
  let verdict = 'PENDING';
  let pollAttempts = 0;

  while (verdict === 'PENDING' && pollAttempts < maxPollTime / pollInterval) {
    sleep(pollInterval);
    pollAttempts++;

    const pollRes = http.get(`${BASE_URL}/submissions/${submissionId}`, {
      headers: {
        Cookie: `Authentication=${data.authToken}; Refresh=${data.refreshToken}`,
      },
      tags: { name: 'poll_verdict' },
    });

    if (pollRes.status === 200) {
      try {
        const body = JSON.parse(pollRes.body);
        verdict = body.verdicate;
      } catch {
        // keep polling
      }
    }
  }

  const totalTime = Date.now() - startTime;
  totalSubmissionDuration.add(totalTime);

  verdictDuration.add(totalTime - elapsed);

  const success = verdict !== 'PENDING';
  submissionSuccess.add(success);

  if (success) {
    submissionsHandled.add(1);
    console.log(
      `VU ${__VU} | Submission #${submissionId} | ${language} | verdict=${verdict} | ${totalTime}ms`,
    );
  } else {
    console.warn(
      `VU ${__VU} | Submission #${submissionId} | TIMEOUT after ${maxPollTime}s`,
    );
  }

  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  console.log('Load test complete. Check k6 summary below.');
}