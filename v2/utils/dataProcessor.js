const _ = require('lodash')
const { DateTime, Duration, Interval } = require('luxon')

/**
 * Merges principals to meetings based on meeting names.
 * Adds 'busyness' score to each meeting.
 */
function mergePrincipalsToMeetings(principalsMeetings, meetings, orders) {
  const mergedMeetings = meetings.map((meeting) => {
    const { name, pics, members } = meeting

    const principals = principalsMeetings.reduce(
      (prev, { name: principalName, meetings }) => {
        if (meetings.includes(name)) {
          prev.push(principalName)
        }
        return prev
      },
      []
    )

    return {
      ...meeting,
      principals,
      members: [...new Set(members)],
      participants: [...new Set([...members, ...principals, ...pics])]
    }
  })

  // Count participant occurrences
  const countParticipants = _(mergedMeetings)
    .map(({ participants }) => participants)
    .flatten()
    .countBy()
    .value()

  // Attach busyness score and rank
  return mergedMeetings.map((meeting, index) => {
    let count = 0
    meeting.participants.forEach((participant) => {
      count += countParticipants[participant]
    })
    meeting.busyness = count
    meeting.rank = index + 1 // Initial rank based on input order
    return meeting
  })
}

/**
 * Flattens the unavailable arrays from the raw sheet format.
 */
function flattenTeachers(unavailableArrays) {
  return unavailableArrays
    .reduce((prev, curr) => {
      if ('teachers' in curr) {
        const { teachers, ...rest } = curr
        const flatten = teachers.map((t) => ({ ...rest, teacher: t }))
        return prev.concat(flatten)
      }
      prev.push(curr)
      return prev
    }, [])
    .reduce((prev, curr) => {
      if ('slots' in curr) {
        const { slots, teacher } = curr
        const flatten = slots.map((s) => ({
          teacher,
          start: s.start,
          end: s.end,
          remark: s.remark,
          ignoredMeeting: s.ignoredMeeting
        }))
        return prev.concat(flatten)
      }
      prev.push(curr)
      return prev
    }, [])
}

/**
 * Validates prefilled meetings against availability.
 */
function checkPrefilledMeetings(prefilledMeetings, meetings, unavailables) {
  const prefilledWithParticipants = prefilledMeetings.map((pm) => {
    const found = meetings.find((m) => m.name == pm.name)
    if (!found) throw new Error(`Prefilled meeting not found: ${pm.name}`)
    
    return {
      ...pm,
      participants: found.participants,
      duration: found.duration
    }
  })

  prefilledWithParticipants.forEach((pm) => {
    const { slot, participants, name, duration } = pm
    const intervalA = Interval.after(DateTime.fromISO(slot), Duration.fromObject({ hours: duration }))

    participants.forEach((participant) => {
      const teacherSlots = unavailables[participant]
      if (teacherSlots) {
        teacherSlots.forEach((unavailableSlot) => {
          const { start, end, ignoredMeeting } = unavailableSlot
          const intervalC = Interval.fromDateTimes(DateTime.fromISO(start), DateTime.fromISO(end))

          if (intervalC.overlaps(intervalA) && ignoredMeeting !== name) {
            console.error(`Conflict for ${participant} in ${name} at ${slot}`, unavailableSlot)
            throw new Error('Prefilled meetings conflict with teacher availability')
          }
        })
      }

      // Check conflict with other prefilled meetings
      const conflict = prefilledWithParticipants.find((other) => {
        if (other.name === name) return false
        const intervalB = Interval.after(
            DateTime.fromISO(other.slot), 
            Duration.fromObject({ hours: other.duration })
        )
        return intervalA.overlaps(intervalB) && _.intersection(participants, other.participants).length > 0
      })

      if (conflict) {
        console.error(`${name} conflicts with ${conflict.name}`)
        throw new Error('Prefilled meetings crash')
      }
    })
  })
}

module.exports = {
  mergePrincipalsToMeetings,
  flattenTeachers,
  checkPrefilledMeetings
}