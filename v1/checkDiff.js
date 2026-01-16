const newFilePath = `./out/result.dev.json`
const lastOutputFilePath = `./out/result.v4.1.0.json`
const data = require(newFilePath)

const { findDiffs } = require('./helpers.js')

const updatedMeetings = findDiffs(data, lastOutputFilePath)

updatedMeetings.forEach((meeting) => {
  console.log(meeting)
})
