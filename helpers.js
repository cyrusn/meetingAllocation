const { DateTime, Duration, Interval } = require('luxon')
const _ = require('lodash')

// mergePrincipalsToMeetings is a function that merge principals to meetings
// the result is sExaminations and Assessment Teamorted by the number of members in the meeting
// and the number of meetings that member in members are in others meetings
function mergePrincipalsToMeetings(principalsMeetings, meetings, orders) {
  // mergedMeetings  is an array of meetings with principals
  const mergedMeetings = _(meetings).map((meeting) => {
    const { name, pics, cname, members, duration, location, remark } = meeting

    const principals = principalsMeetings.reduce(
      (prev, { name: principalName, meetings }) => {
        if (meetings.includes(name)) {
          prev.push(principalName)
        }
        return prev
      },
      []
    )

    return Object.assign({}, meeting, {
      principals,
      members: [...new Set(members)],
      participants: [...new Set([...members, ...principals, ...pics])]
    })
  })

  // countMembers is an array of all members in all meetings, including principals.
  const countParticipants = _(mergedMeetings)
    .map(({ participants }) => participants)
    .flatten()
    .countBy()
    .value()

  return mergedMeetings
    .orderBy(
      [
        // sort the meetings that member in members are in many meeting
        ({ name }) => {
          return orders.indexOf(name)
        },
        ({ participants }) => {
          let count = 0
          participants.forEach((participant) => {
            count += countParticipants[participant]
          })
          return count
        }
        // Then sort the meetings by the number of members
      ],
      ['desc', 'desc', 'desc']
    )
    .value()
    .map((meeting, n) => {
      meeting.rank = n + 1
      return meeting
    })
}

function checkPrefilledMeetings(prefilledMeetings, meetings, unavailables) {
  const prefilledMeetingsWithParticipants = prefilledMeetings.map(
    (prefilledMeeting) => {
      const { name } = prefilledMeeting
      const found = meetings.find((meeting) => meeting.name == name)
      if (found) {
        const { members, principals, pics, duration } = found
        return Object.assign(
          {},
          { participants: [...members, ...principals, ...pics], duration },
          prefilledMeeting
        )
      }
      throw new Error(`Prefilled meeting is not found: ${name}`)
    }
  )

  prefilledMeetingsWithParticipants.forEach((prefilledMeeting) => {
    const { slot, participants, name, duration } = prefilledMeeting

    const formattedDurationA = Duration.fromObject({ hours: duration })
    const intervalA = Interval.after(DateTime.fromISO(slot), formattedDurationA)

    return participants.forEach((participant) => {
      const teacherUnavailableSlots = unavailables[participant]
      if (teacherUnavailableSlots) {
        teacherUnavailableSlots.forEach((unavailableSlot) => {
          const { start, end } = unavailableSlot
          const intervalC = Interval.fromISO(`${start}/${end}`)
          if (intervalC.overlaps(intervalA)) {
            console.error(name, participant, slot, unavailableSlot)
            throw new Error(
              'Prefilled meetings is not available for some teachers'
            )
          }
        })
      }

      const found = prefilledMeetingsWithParticipants.find((meeting) => {
        // meeting.participants.includes(participant) && meeting.name != name

        const intervalB = Interval.after(
          DateTime.fromISO(meeting.slot),
          Duration.fromObject({
            hours: meeting.duration
          })
        )
        return meeting.name !== name && intervalA.overlaps(intervalB)
      })

      if (found) {
        const intersection = _.intersection(participants, found.participants)
        if (intersection.length) {
          console.log(name, 'vs', found.name)
          console.log(intersection)
          throw new Error('Prefilled meetings crashed')
        }
      }
    })
  })
}

// checkParticipantsAvailability is a function that check if all participants are available
// by comparing the `unavailables` with the slot and participants
// and return the list of participants that are not available
function checkParticipantsAvailability({
  unavailables,
  slot,
  participants,
  duration
}) {
  const notAvailabeParticipants = []
  // check if every participant is available
  const isAllAvailable = participants.every((participant) => {
    const formattedDuration = Duration.fromObject({
      hours: duration
    })

    const interval = Interval.after(DateTime.fromISO(slot), formattedDuration)

    const participantUnavailableSchedules = unavailables[participant]

    if (!participantUnavailableSchedules) {
      return true
    }

    const unavailableIntervals = participantUnavailableSchedules.map(
      ({ start, end }) => {
        const interval = new Interval({
          start: DateTime.fromISO(start),
          end: DateTime.fromISO(end)
        })
        return interval
      }
    )

    const isOk = unavailableIntervals.every(
      (unavailableInterval) => !unavailableInterval.overlaps(interval)
    )

    if (isOk) return true

    notAvailabeParticipants.push(participant)
    return false
  })

  return {
    isAllAvailable,
    notAvailabeParticipants
  }
}

function findDiffs(data, path) {
  try {
    const file = require(path)
    const diffs = []

    data.forEach((meeting, index) => {
      const found = file.data.find((m) => m.name === meeting.name)
      if (!found) return

      if (meeting.slot !== found.slot) {
        const { name, cname, slot } = meeting
        diffs.push({
          name,
          cname,
          newSlot: slot,
          previousSlot: found.slot
        })
      }
    })

    return diffs
  } catch (e) {
    console.error(e)
    return []
  }
}

// flatten unavailableArrays. Flatten teachers key to teacher.
// e.g. [{ teacher: "teacher1", start: "2021-01-01T08:00:00.000Z", end: "2021-01-01T09:00:00.000Z" }]
function flattenTeachers(unavailableArrays) {
  return unavailableArrays
    .reduce((prev, curr) => {
      if ('teachers' in curr) {
        const { teachers } = curr
        delete curr.teachers

        const flatten = teachers.map((t) =>
          Object.assign({}, { teacher: t }, curr)
        )
        prev = prev.concat(flatten)
        return prev
      }

      prev.push(curr)
      return prev
    }, [])
    .reduce((prev, curr) => {
      if ('slots' in curr) {
        const { slots, teacher } = curr
        delete curr.slots
        const flatten = slots.map((s) => ({
          teacher,
          start: s.start,
          end: s.end,
          remark: s.remark
        }))
        prev = prev.concat(flatten)
        return prev
      }
      prev.push(curr)
      return prev
    }, [])
}

module.exports = {
  checkParticipantsAvailability,
  mergePrincipalsToMeetings,
  findDiffs,
  checkPrefilledMeetings,
  flattenTeachers
}
