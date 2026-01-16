const fs = require('fs')

function findDiffs(data, path) {
  try {
    if (!fs.existsSync(path)) return []
    
    const fileContent = fs.readFileSync(path, 'utf8')
    const file = JSON.parse(fileContent)
    
    const diffs = []
    data.forEach((meeting) => {
      const found = file.data.find((m) => m.name === meeting.name)
      if (!found) return

      if (meeting.slot !== found.slot) {
        diffs.push({
          name: meeting.name,
          cname: meeting.cname,
          newSlot: meeting.slot,
          previousSlot: found.slot
        })
      }
    })
    return diffs
  } catch (e) {
    console.error('Error finding diffs:', e.message)
    return []
  }
}

module.exports = { findDiffs }