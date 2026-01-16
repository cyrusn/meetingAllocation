const { DateTime, Duration, Interval } = require('luxon')

/**
 * Checks if all participants are available for a given slot.
 * @param {Object} params
 * @param {Object} params.unavailables - Map of participant names to their unavailable slots.
 * @param {string} params.slot - ISO date string of the meeting start.
 * @param {Array<string>} params.participants - List of participant names.
 * @param {number} params.duration - Duration in hours.
 * @param {string} params.meetingName - Name of the meeting (to ignore self-conflicts if needed).
 * @returns {Object} { isAllAvailable, notAvailabeParticipants }
 */
function checkParticipantsAvailability({
  unavailables,
  slot,
  participants,
  duration,
  meetingName
}) {
  const notAvailabeParticipants = []
  
  const isAllAvailable = participants.every((participant) => {
    const formattedDuration = Duration.fromObject({ hours: duration })
    const meetingInterval = Interval.after(DateTime.fromISO(slot), formattedDuration)
    const participantUnavailableSchedules = unavailables[participant]

    if (!participantUnavailableSchedules) return true

    const unavailableIntervals = participantUnavailableSchedules.map(
      ({ start, end, ignoredMeeting }) => ({
        interval: Interval.fromDateTimes(DateTime.fromISO(start), DateTime.fromISO(end)),
        ignoredMeeting
      })
    )

    const isOk = unavailableIntervals.every(({ interval, ignoredMeeting }) => {
      // If overlap exists, check if it's the same meeting being ignored
      if (interval.overlaps(meetingInterval)) {
          return ignoredMeeting == meetingName
      }
      return true
    })

    if (isOk) return true

    notAvailabeParticipants.push(participant)
    return false
  })

  return { isAllAvailable, notAvailabeParticipants }
}

module.exports = { checkParticipantsAvailability }