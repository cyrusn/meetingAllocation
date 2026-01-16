const { DateTime } = require('luxon')
const config = require('../config')
const { batchClearData, appendRows } = require('./googleSheet')

async function printView(data) {
  const SPREADSHEET_ID = config.SPREADSHEET_ID
  
  // Clear existing data
  await batchClearData(SPREADSHEET_ID, 'result!A:Z')
  
  const excelPrintView = [
    [
      'Date',
      'Time',
      'Venue',
      'Department/Committee/Team',
      'Principals',
      'PICs',
      'Members'
    ]
  ]

  let currentDate = ''
  let currentTime = ''

  data.forEach(
    ({ 
      name,
      cname,
      location,
      slot,
      members,
      principals,
      duration,
      pics,
      remark
    }) => {
      const startDateTime = DateTime.fromISO(slot)
      const endDateTime = startDateTime.plus({ hour: duration })
      const date = startDateTime.toFormat('d/M(EEE)')
      const startTime = startDateTime.toFormat('HH:mm')
      const endTime = endDateTime.toFormat('HH:mm')
      const mTime = `${startTime}-${endTime}`

      excelPrintView.push([
        currentDate == date ? '' : date,
        currentTime == mTime ? '' : mTime,
        location,
        `${cname}\n${name}` + (remark ? `\n(${remark})` : ''),
        principals.join(', '),
        pics.join(', '),
        members.join(', ')
      ])

      if (currentDate != date) {
        currentDate = date
      }

      if (currentTime != mTime) {
        currentTime = mTime
      }
    }
  )
  
  await appendRows(SPREADSHEET_ID, 'result!A:A', excelPrintView)
}

module.exports = {
  printView
}

