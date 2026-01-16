const config = require('./config')
const { findDiffs } = require('./utils/diff')
const fs = require('fs')

// This script allows checking differences between the latest output and a specific version manually
const run = () => {
  const newFilePath = config.PATHS.OUTPUT
  const lastOutputFilePath = config.PATHS.LAST_OUTPUT

  console.log(`Comparing ${newFilePath} with ${lastOutputFilePath}...`)

  if (!fs.existsSync(newFilePath)) {
    console.error(`Error: New file not found at ${newFilePath}`)
    return
  }

  const data = JSON.parse(fs.readFileSync(newFilePath, 'utf8')).data
  const updatedMeetings = findDiffs(data, lastOutputFilePath)

  if (updatedMeetings.length === 0) {
    console.log('No differences found.')
  } else {
    console.log(`${updatedMeetings.length} updated meetings found:`)
    updatedMeetings.forEach((meeting) => {
      console.log(`- ${meeting.name} (${meeting.cname}): ${meeting.previousSlot} -> ${meeting.newSlot}`)
    })
  }
}

run()
