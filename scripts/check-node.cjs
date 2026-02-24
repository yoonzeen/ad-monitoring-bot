const major = Number(process.versions.node.split('.')[0] || 0)

// Vite 7 + modern toolchain requires Node 18+.
// We standardize on Node 20 to match CI (GitHub Actions uses Node 20).
if (major < 20) {
  // eslint-disable-next-line no-console
  console.error(
    [
      `Node.js ${process.versions.node} is too old for this project.`,
      'Please use Node.js >= 20.',
      '',
      'If you use nvm-windows:',
      '  nvm use 22.14.0',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

