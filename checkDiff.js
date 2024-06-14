const pathA = `./out/result.dev.json`
const pathB = `./out/result.v4.1.0.json`

const _ = require('lodash')

const fileA = require(pathA)
const fileB = require(pathB)

const diffs = []

console.log(fileA.title, fileB.title)
fileA.data.forEach((meeting, index) => {
  const found = fileB.data.find((m) => m.name === meeting.name)
  if (!found) return

  if (!_.isEqual(meeting, found)) {
    diffs.push(meeting)
  }
})

diffs.forEach((diff) => {
  console.log(`- ${diff.cname} (${diff.name})`)
})
