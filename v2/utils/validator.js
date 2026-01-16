const { DateTime, Interval, Duration } = require('luxon')
const _ = require('lodash')

/**
 * Performs a final check on the assigned slots to ensure no participant-level conflicts.
 * @param {Array} assignedSlots - The list of meetings with their assigned slots and participants.
 * @throws {Error} if any participant-level conflict is found.
 */
function validateSchedule(assignedSlots) {
  const participantSchedules = {}

  // Group all meeting intervals by participant
  assignedSlots.forEach((meeting) => {
    const { name, slot, duration, participants } = meeting
    const start = DateTime.fromISO(slot)
    const end = start.plus(Duration.fromObject({ hours: duration }))
    const interval = Interval.fromDateTimes(start, end)

    participants.forEach((participant) => {
      if (!participantSchedules[participant]) {
        participantSchedules[participant] = []
      }
      participantSchedules[participant].push({ name, interval, slot })
    })
  })

  // Check each participant's schedule for overlaps
  for (const [participant, schedules] of Object.entries(participantSchedules)) {
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const meetingA = schedules[i]
        const meetingB = schedules[j]

        if (meetingA.interval.overlaps(meetingB.interval)) {
          console.error(`Conflict detected for teacher ${participant}:`)
          console.error(`  - Meeting: ${meetingA.name} at ${meetingA.slot}`)
          console.error(`  - Meeting: ${meetingB.name} at ${meetingB.slot}`)
          throw new Error(`Participant conflict: ${participant} is scheduled for overlapping meetings.`)
        }
      }
    }
  }

  console.log('✅ Final validation passed: No participant-level conflicts found.')
  return true
}

module.exports = { validateSchedule }
