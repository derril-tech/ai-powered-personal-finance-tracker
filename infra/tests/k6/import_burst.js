// Created automatically by Cursor AI (2025-08-28)
import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '10s', target: 0 },
  ],
}

export default function () {
  const url = `${__ENV.BASE_URL || 'http://localhost:3000'}/api/v1/imports`
  const payload = JSON.stringify({ type: 'csv', size: 100000, dryRun: true })
  const params = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.TOKEN || 'dev'}` } }
  http.post(url, payload, params)
  sleep(1)
}
