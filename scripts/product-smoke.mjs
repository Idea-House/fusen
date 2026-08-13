import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const userData = await mkdtemp(resolve(tmpdir(), 'fusen-product-test-'))
const outputDirectory = resolve('qa', 'product-smoke')
const executable = resolve('node_modules', 'electron', 'dist', 'electron.exe')

try {
  const runProduct = (extraEnvironment = {}) => new Promise((resolvePromise, reject) => {
    const child = spawn(executable, ['.'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FUSEN_QA_USER_DATA: userData,
        FUSEN_QA_OUTPUT_DIR: outputDirectory,
        ...extraEnvironment
      },
      stdio: 'inherit',
      windowsHide: true
    })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Product smoke test timed out'))
    }, 30_000)
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolvePromise()
      else reject(new Error(`Product smoke test exited with code ${code}`))
    })
  })

  await runProduct()
  await runProduct({ FUSEN_QA_RESTART_ONLY: '1' })

  const result = JSON.parse(await readFile(resolve(outputDirectory, 'qa-result.json'), 'utf8'))
  if (
    result.ready !== true ||
    result.savedText !== '製品版 日本語入力テスト' ||
    result.schemaVersion !== 2 ||
    result.restartVerified !== true
  ) {
    throw new Error(`Unexpected product smoke result: ${JSON.stringify(result)}`)
  }
  console.log('Product smoke test passed: preload, Japanese input, autosave, restart restore, and schema v2 are working.')
} finally {
  await rm(userData, { recursive: true, force: true })
}
